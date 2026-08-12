#!/usr/bin/env python3
# VN QUIZ v4 - VNDB data builder
# Generates quiz-data.js. The website itself does NOT need Python.
# Python 3.10+ recommended. Standard library only.

import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.vndb.org/kana/vn"
OUT = Path(__file__).with_name("quiz-data.js")
TARGET = 3000
BATCH = 100

GENRES = {
    "Romance", "Comedy", "Drama", "Fantasy", "Action", "Mystery",
    "Horror", "Science Fiction", "School", "Historical"
}


def post(payload):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        API,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "User-Agent": "VN-QUIZ/4.0",
        },
    )
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            if exc.code == 429:
                wait = 20 + attempt * 15
                print(f"Rate limited; waiting {wait} sec")
                time.sleep(wait)
            else:
                raise
    raise RuntimeError("VNDB API request failed after retries")


def clean_text(value):
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def extract_song_title(note):
    """Extract one song title from VNDB staff.note.

    VNDB's /vn API does not expose a dedicated OP/ED song-title field.
    For staff entries whose role is 'songs', staff.note contains the
    song-related description. We prefer the first quoted title, which
    handles values such as: OP "Answer" / ED "days" / ED1 "Saya no Uta".
    """
    note = clean_text(note)
    if not note:
        return None

    # Quoted titles are the most reliable form in the current VNDB data.
    quoted = re.search(r'["“「『](.+?)["”」』]', note)
    if quoted:
        title = clean_text(quoted.group(1))
        return title or None

    # Fallback for unquoted notes.
    title = re.sub(
        r"^(?:(?:true|normal|good|bad|best)\s+)?"
        r"(?:op|ed|opening|ending|insert(?:\s+song)?|theme(?:\s+song)?|song)"
        r"\s*\d*\s*[:：-]?\s*",
        "",
        note,
        flags=re.IGNORECASE,
    ).strip(" -:：")

    if not title:
        return None

    if title.lower() in {
        "opening", "opening theme", "opening song",
        "ending", "ending theme", "ending song",
        "insert", "insert song", "theme", "theme song",
        "vocal", "vocals",
    }:
        return None

    return title


def fetch_top():
    fields = ",".join([
        "title", "alttitle", "aliases", "olang", "released",
        "rating", "votecount",
        "developers{id,name,original}",
        "tags{id,name,rating,spoiler}",
        "staff{role,aid,name,original,note}",
        "screenshots{id,url,sexual,violence,votecount}",
    ])

    out = []
    page = 1

    while len(out) < TARGET:
        payload = {
            "filters": ["and", ["olang", "=", "ja"], ["devstatus", "=", 0]],
            "fields": fields,
            "sort": "votecount",
            "reverse": True,
            "results": BATCH,
            "page": page,
        }
        result = post(payload)
        rows = result.get("results", [])
        if not rows:
            break

        out.extend(rows)
        print(f"Fetched {len(out)}/{TARGET}")

        if not result.get("more"):
            break

        page += 1
        time.sleep(0.4)

    return out[:TARGET]


def transform(row):
    tags = []
    for tag in row.get("tags") or []:
        name = tag.get("name") or ""
        if name in GENRES and (tag.get("spoiler") or 0) == 0:
            if name not in tags:
                tags.append(name)

    scenario_roles = {"scenario", "script"}
    artist_roles = {"art", "chardesign"}

    scenario = []
    artists = []
    vocal = None
    song = None

    for staff in row.get("staff") or []:
        role = clean_text(staff.get("role")).lower()
        name = clean_text(staff.get("name") or staff.get("original"))

        if name and role in scenario_roles and name not in scenario:
            scenario.append(name)

        if name and role in artist_roles and name not in artists:
            artists.append(name)

        if role == "songs":
            # User requested only one vocal when there are multiple.
            if vocal is None and name:
                vocal = name

            # Use the first usable song title only.
            if song is None:
                song = extract_song_title(staff.get("note"))

    cgs = []
    for screenshot in row.get("screenshots") or []:
        sexual = screenshot.get("sexual")
        violence = screenshot.get("violence")
        if isinstance(sexual, (int, float)) and isinstance(violence, (int, float)):
            if sexual < 0.5 and violence < 1.5:
                cgs.append({
                    "url": screenshot.get("url", ""),
                    "sexual": sexual,
                    "violence": violence,
                    "caption": "VNDB screenshot",
                })

    released = row.get("released")
    year = None
    if isinstance(released, str) and len(released) >= 4 and released[:4].isdigit():
        year = int(released[:4])

    return {
        "id": row["id"],
        "title": row.get("title") or "",
        "aliases": row.get("aliases") or (
            [row["alttitle"]] if row.get("alttitle") else []
        ),
        "developer": [
            dev.get("name")
            for dev in (row.get("developers") or [])
            if dev.get("name")
        ],
        "released": released,
        "year": year,
        "genres": tags,
        "scenario": scenario,
        "artists": artists,
        "vocal": vocal,
        "song": song,
        "rating": row.get("rating"),
        "votecount": row.get("votecount") or 0,
        "cgs": cgs[:5],
    }


def main():
    print("VNDB API -> VN QUIZ data v4")
    print(f"Target: {TARGET} Japanese-origin finished VNs")
    print("VOCAL source: staff.role == 'songs'")
    print("Song title source: first quoted title in staff.note, with fallback parsing")
    print()

    rows = fetch_top()
    games = [transform(row) for row in rows]

    # Keep the same genre behavior as the existing project.
    games = [game for game in games if game["genres"]]
    games.sort(
        key=lambda game: (game["votecount"], game["rating"] or 0),
        reverse=True,
    )

    vocal_count = sum(bool(game["vocal"]) for game in games)
    song_count = sum(bool(game["song"]) for game in games)

    payload = {
        "meta": {
            "version": 4,
            "source": "VNDB Kana API",
            "generated_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
            "count": len(games),
        },
        "games": games,
    }

    OUT.write_text(
        "window.VN_DATA="
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";",
        encoding="utf-8",
    )

    print()
    print(f"Wrote {OUT} with {len(games)} games.")
    print("VOCAL available:", vocal_count)
    print("Song title available:", song_count)
    print("Missing values are intentionally stored as null and shown as '✕ 확인 불가'.")


if __name__ == "__main__":
    main()
