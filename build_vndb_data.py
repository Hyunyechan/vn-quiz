#!/usr/bin/env python3
# VN QUIZ v2 - VNDB data builder
# Site itself does NOT need Python. This script is only for generating quiz-data.js.
# Python 3.10+ recommended. Standard library only.

import json, time, urllib.request, urllib.error
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
    req = urllib.request.Request(API, data=data, method="POST",
        headers={"Content-Type":"application/json","User-Agent":"VN-QUIZ/2.0"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 20 + attempt*15
                print("Rate limited; waiting", wait, "sec")
                time.sleep(wait)
            else:
                raise
    raise RuntimeError("VNDB API request failed after retries")

def fetch_top():
    # Japanese-origin, finished VNs; ranked by vote count.
    fields = ",".join([
        "title","alttitle","aliases","olang","released",
        "rating","votecount",
        "developers{id,name,original}",
        "tags{id,name,rating,spoiler}",
        "staff{role,aid,name,original,note}",
        "screenshots{id,url,sexual,violence,votecount}"
    ])
    out=[]
    page=1
    while len(out)<TARGET:
        payload={
            "filters":["and",["olang","=","ja"],["devstatus","=",0]],
            "fields":fields,
            "sort":"votecount","reverse":True,
            "results":BATCH,"page":page
        }
        res=post(payload)
        rows=res.get("results",[])
        if not rows: break
        out.extend(rows)
        print(f"Fetched {len(out)}/{TARGET}")
        if not res.get("more"): break
        page += 1
        time.sleep(0.4)
    return out[:TARGET]

def transform(row):
    tags=[]
    for t in row.get("tags") or []:
        if (t.get("name") or "") in GENRES and (t.get("spoiler") or 0) == 0:
            if t["name"] not in tags: tags.append(t["name"])
    # Staff role names can change in VNDB; accept common role names.
    scenario_roles={"scenario","script"}
    artist_roles={"art","chardesign"}
    scenario=[]; artists=[]
    vocal=""
    song=""
    for s in row.get("staff") or []:
        role=(s.get("role") or "").lower()
        name=s.get("name") or s.get("original")
        note=(s.get("note") or "").strip()
        if not name: continue
        if role in scenario_roles and name not in scenario: scenario.append(name)
        if role in artist_roles and name not in artists: artists.append(name)
        if role == "songs":
            # VNDB's songs credit names the vocalist; its note is the song title.
            if not vocal:
                vocal=name
            if not song and note:
                song=note

    cgs=[]
    for s in row.get("screenshots") or []:
        sexual=s.get("sexual")
        violence=s.get("violence")
        if isinstance(sexual,(int,float)) and isinstance(violence,(int,float)):
            if sexual < 0.5 and violence < 1.5:
                cgs.append({"url":s.get("url",""),"sexual":sexual,"violence":violence,"caption":"VNDB screenshot"})
    released=row.get("released")
    year=None
    if isinstance(released,str) and len(released)>=4 and released[:4].isdigit():
        year=int(released[:4])

    return {
        "id":row["id"],
        "title":row.get("title") or "",
        "aliases":row.get("aliases") or ([row["alttitle"]] if row.get("alttitle") else []),
        "developer":[d.get("name") for d in (row.get("developers") or []) if d.get("name")],
        "released":released,
        "year":year,
        "genres":tags,
        "scenario":scenario,
        "artists":artists,
        "vocal":vocal or None,
        "song":song or None,
        "rating":row.get("rating"),
        "votecount":row.get("votecount") or 0,
        "cgs":cgs[:5]
    }

def main():
    print("VNDB API -> VN QUIZ data")
    print("Target:", TARGET, "Japanese-origin finished VNs")
    rows=fetch_top()
    games=[transform(x) for x in rows]
    # Require at least one of the selected genre tags so the genre hint is meaningful.
    games=[g for g in games if g["genres"]]
    games.sort(key=lambda x:(x["votecount"],x["rating"] or 0), reverse=True)
    payload={"meta":{"version":2,"source":"VNDB Kana API","generated_at":time.strftime("%Y-%m-%d %H:%M:%S UTC",time.gmtime()),"count":len(games)},"games":games}
    OUT.write_text("window.VN_DATA="+json.dumps(payload,ensure_ascii=False,separators=(",",":"))+";",encoding="utf-8")
    print("Wrote", OUT, "with", len(games), "games.")
    print("VOCAL available:", sum(1 for g in games if g.get("vocal")))
    print("Song title available:", sum(1 for g in games if g.get("song")))

if __name__=="__main__":
    main()
