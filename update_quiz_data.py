#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VN QUIZ - quiz-data.js의 VOCAL / 노래 제목 갱신기

사용법:
  python update_quiz_data.py

기본적으로 현재 폴더의 quiz-data.js를 읽고,
VNDB Kana API에서 각 VN의 staff(role=songs) 정보를 가져와
다음 두 필드를 추가/갱신합니다.

  "vocal": "첫 번째 VOCAL 이름",
  "song": "첫 번째 노래 제목"

VNDB의 staff.note가 곡 제목으로 사용됩니다.
VOCAL이 여러 명이면 첫 번째 사람만 저장합니다.
곡 제목이나 VOCAL을 확인할 수 없으면 null로 저장합니다.
"""

import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
except ImportError:
    print("requests가 필요합니다. 먼저 'pip install requests'를 실행하세요.")
    sys.exit(1)

API_URL = "https://api.vndb.org/kana/vn"
INPUT = Path("quiz-data.js")
BATCH_SIZE = 100
SLEEP_BETWEEN_REQUESTS = 1.6


def load_quiz_data(path: Path):
    text = path.read_text(encoding="utf-8")
    prefix = "window.VN_DATA="
    if not text.startswith(prefix):
        raise ValueError("quiz-data.js가 window.VN_DATA= 형식이 아닙니다.")
    raw = text[len(prefix):].strip()
    if raw.endswith(";"):
        raw = raw[:-1]
    return json.loads(raw)


def clean_song_title(note):
    if not note:
        return None

    note = str(note).strip()
    if not note:
        return None

    # VNDB staff.note에 흔히 붙는 역할 표기를 제거합니다.
    note = re.sub(
        r"^(?:opening|ending|op|ed|theme(?: song)?|主題歌)\s*[:：\-–—]\s*",
        "",
        note,
        flags=re.IGNORECASE,
    ).strip()

    return note or None


def fetch_batch(session, ids):
    filters = ["or"]
    filters.extend([["id", "=", vid] for vid in ids])

    payload = {
        "filters": filters,
        "fields": "staff{name,role,note}",
        "results": len(ids),
        "sort": "id",
    }

    for attempt in range(3):
        try:
            r = session.post(API_URL, json=payload, timeout=30)
            r.raise_for_status()
            return r.json().get("results", [])
        except Exception as e:
            if attempt == 2:
                raise
            print(f"  API 오류: {e} / 재시도 {attempt + 1}/2")
            time.sleep(3)


def main():
    data = load_quiz_data(INPUT)
    games = data.get("games", [])
    if not games:
        raise ValueError("games 데이터가 없습니다.")

    # 기존 값은 API 결과로 덮어씁니다.
    for game in games:
        game["vocal"] = None
        game["song"] = None

    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "User-Agent": "vn-quiz/1.0 (personal project)",
    })

    ids = [g["id"] for g in games if g.get("id")]
    by_id = {g["id"]: g for g in games}

    total = (len(ids) + BATCH_SIZE - 1) // BATCH_SIZE
    found_vocal = 0
    found_song = 0

    print(f"VNDB API에서 {len(ids):,}개 VN의 VOCAL 정보를 가져옵니다.")
    print(f"배치: {BATCH_SIZE}개 / 총 {total}회")

    for i in range(0, len(ids), BATCH_SIZE):
        batch = ids[i:i + BATCH_SIZE]
        batch_no = i // BATCH_SIZE + 1
        print(f"[{batch_no}/{total}] {len(batch)}개 조회 중...")

        results = fetch_batch(session, batch)

        for vn in results:
            game = by_id.get(vn.get("id"))
            if not game:
                continue

            songs = [
                staff for staff in (vn.get("staff") or [])
                if staff.get("role") == "songs"
            ]

            if not songs:
                continue

            # 여러 VOCAL이 있어도 첫 번째 사람만 사용합니다.
            vocal = next(
                (str(s.get("name", "")).strip() for s in songs if str(s.get("name", "")).strip()),
                None,
            )
            song = next(
                (clean_song_title(s.get("note")) for s in songs if clean_song_title(s.get("note"))),
                None,
            )

            game["vocal"] = vocal
            game["song"] = song

            if vocal:
                found_vocal += 1
            if song:
                found_song += 1

        if i + BATCH_SIZE < len(ids):
            time.sleep(SLEEP_BETWEEN_REQUESTS)

    meta = data.setdefault("meta", {})
    meta["version"] = max(int(meta.get("version", 0)), 3)
    meta["source"] = "VNDB Kana API"
    meta["generated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    meta["count"] = len(games)

    output = "window.VN_DATA=" + json.dumps(
        data,
        ensure_ascii=False,
        separators=(",", ":"),
    ) + ";\n"

    INPUT.write_text(output, encoding="utf-8")

    print("\n완료")
    print(f"  VN: {len(games):,}")
    print(f"  VOCAL 확인: {found_vocal:,}")
    print(f"  노래 제목 확인: {found_song:,}")
    print(f"  저장: {INPUT.resolve()}")


if __name__ == "__main__":
    main()
