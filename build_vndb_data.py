#!/usr/bin/env python3
# VN QUIZ v3 - VNDB data builder
# This script generates quiz-data.js. The website itself does not need Python.
# Python 3.10+ recommended. Standard library only.

import json, time, urllib.request, urllib.error, re
from pathlib import Path

API = "https://api.vndb.org/kana/vn"
OUT = Path(__file__).with_name("quiz-data.js")
TARGET = 3000
BATCH = 100

GENRES = {
    "Romance","Comedy","Drama","Fantasy","Action","Mystery",
    "Horror","Science Fiction","School","Historical"
}

def post(payload):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        API, data=data, method="POST",
        headers={
            "Content-Type":"application/json",
            "User-Agent":"VN-QUIZ/3.0"
        }
    )
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 20 + attempt * 15
                print("Rate limited; waiting", wait, "sec")
                time.sleep(wait)
            else:
                raise
    raise RuntimeError("VNDB API request failed after retries")

def clean_text(value):
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()

def extract_song_title(note):
    """
    VNDB's Kana /vn API does not have a dedicated song-title field.
    The VN staff relation does expose staff.note, which is the only
    song-related text available alongside the 'songs' staff role.

    We use note when it looks like a song title, and remove common
    role prefixes such as 'Opening theme:'.
    """
    note = clean_text(note)
    if not note:
        return ""

    # Common labels seen in staff notes.
    prefixes = [
        r"^(?:opening|op)\s+(?:theme|song)\s*[:：]\s*",
        r"^(?:ending|ed)\s+(?:theme|song)\s*[:：]\s*",
        r"^(?:insert)\s+(?:song|theme)\s*[:：]\s*",
        r"^(?:theme|song)\s*[:：]\s*",
        r"^(?:vocal|vocals)\s*[:：]\s*",
    ]
    for pattern in prefixes:
        cleaned = re.sub(pattern, "", note, flags=re.I)
        if cleaned != note:
            note = clean_text(cleaned)
            break

    # A bare role label is not a song title.
    if note.lower() in {
        "opening", "opening theme", "opening song",
        "ending", "ending theme", "ending song",
        "insert", "insert song", "theme song",
        "vocal", "vocals"
    }:
        return ""

    return note

def fetch_top():
    # Japanese-origin, finished VNs; ranked by vote count.
    fields = ",".join([
        "title","alttitle","aliases","olang","released",
        "rating","votecount",
        "developers{id,name,original}",
        "tags{id,name,rating,spoiler}",
        # songs role + note are used for VOCAL / song-title hints.
        "staff{role,aid,name,original,note}",
        "screenshots{id,url,sexual,violence,votecount}"
    ])

    out = []
    page = 1

    while len(out) < TARGET:
        payload = {
            "filters":["and",["olang","=","ja"],["devstatus","=",0]],
            "fields":fields,
            "sort":"votecount",
            "reverse":True,
            "results":BATCH,
            "page":page
        }

        res = post(payload)
        rows = res.get("results",[])
        if not rows:
            break

        out.extend(rows)
        print(f"Fetched {len(out)}/{TARGET}")

        if not res.get("more"):
            break

        page += 1
        time.sleep(0.4)

    return out[:TARGET]

def transform(row):
    tags = []
    for t in row.get("tags") or []:
        name = t.get("name") or ""
        if name in GENRES and (t.get("spoiler") or 0) == 0:
            if name not in tags:
                tags.append(name)

    scenario_roles = {"scenario","script"}
    artist_roles = {"art","chardesign"}

    scenario = []
    artists = []

    # First songs-role entry is enough for this quiz.
    vocal = None
    song = None

    for s in row.get("staff") or []:
        role = clean_text(s.get("role")).lower()
        name = clean_text(s.get("name") or s.get("original"))

        if name and role in scenario_roles and name not in scenario:
            scenario.append(name)

        if name and role in artist_roles and name not in artists:
            artists.append(name)

        if role == "songs":
            if vocal is None and name:
                vocal = name

            if song is None:
                title = extract_song_title(s.get("note"))
                if title:
                    song = title

    cgs = []
    for s in row.get("screenshots") or []:
        sexual = s.get("sexual")
        violence = s.get("violence")

        if isinstance(sexual,(int,float)) and isinstance(violence,(int,float)):
            if sexual < 0.5 and violence < 1.5:
                cgs.append({
                    "url":s.get("url",""),
                    "sexual":sexual,
                    "violence":violence,
                    "caption":"VNDB screenshot"
                })

    released = row.get("released")
    year = None
    if isinstance(released,str) and len(released) >= 4 and released[:4].isdigit():
        year = int(released[:4])

    return {
        "id":row["id"],
        "title":row.get("title") or "",
        "aliases":row.get("aliases") or (
            [row["alttitle"]] if row.get("alttitle") else []
        ),
        "developer":[
            d.get("name")
            for d in (row.get("developers") or [])
            if d.get("name")
        ],
        "released":released,
        "year":year,
        "genres":tags,
        "scenario":scenario,
        "artists":artists,
        "vocal":vocal,
        "song":song,
        "rating":row.get("rating"),
        "votecount":row.get("votecount") or 0,
        "cgs":cgs[:5]
    }

def main():
    print("VNDB API -> VN QUIZ data v3")
    print("Target:", TARGET, "Japanese-origin finished VNs")
    print("VOCAL source: staff.role == 'songs'")
    print("Song title source: staff.note when available")
    print()

    rows = fetch_top()
    games = [transform(x) for x in rows]

    # Require at least one selected genre tag so the genre hint remains meaningful.
    games = [g for g in games if g["genres"]]
    games.sort(
        key=lambda x:(x["votecount"],x["rating"] or 0),
        reverse=True
    )

    vocal_count = sum(bool(g["vocal"]) for g in games)
    song_count = sum(bool(g["song"]) for g in games)

    payload = {
        "meta":{
            "version":3,
            "source":"VNDB Kana API",
            "generated_at":time.strftime(
                "%Y-%m-%d %H:%M:%S UTC",
                time.gmtime()
            ),
            "count":len(games)
        },
        "games":games
    }

    OUT.write_text(
        "window.VN_DATA="+
        json.dumps(payload,ensure_ascii=False,separators=(",",":"))+
        ";",
        encoding="utf-8"
    )

    print()
    print("Wrote", OUT, "with", len(games), "games.")
    print("VOCAL available:", vocal_count)
    print("Song title available:", song_count)
    print()
    print("If a VN has no verified value, the game will show '✕ 확인 불가'.")

if __name__ == "__main__":
    main()
