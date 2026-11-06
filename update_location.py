# update_location.py - run from the Portfolio-HQ folder (the one that contains local/ and global/)
# NOTE README - THIS SCRIPT SHOULD BE RUN TO UPDATE YOUR LOCATION
# RUN THIS SCRIPT USING python update_location.py
# RUN BEFORE PUSHING



import json, datetime, urllib.request
from pathlib import Path

PAGES = ["local", "global"]   # folders that hold a site; edit this list if you add or rename one

req = urllib.request.Request("https://ipapi.co/json/", headers={"User-Agent": "portfolio-location"})
try:
    d = json.load(urllib.request.urlopen(req, timeout=5))
except Exception as e:
    raise SystemExit(f"Lookup failed: {e}")
if "city" not in d:
    raise SystemExit(f"Lookup failed: {d.get('reason', d)}")

loc = {"city": d["city"], "region": d["region"], "country": d["country_name"],
       "lat": round(d["latitude"], 2), "lon": round(d["longitude"], 2),
       "updated": datetime.date.today().isoformat()}

done = 0
for folder in PAGES:
    path = Path(folder) / "index.json"
    if not path.parent.is_dir():
        continue
    try:
        data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    except json.JSONDecodeError as e:
        print(f"Skipped {path}: not valid JSON ({e}). JSON cannot contain comments.")
        continue
    data["location"] = loc          # only this key changes; anything else in index.json is kept
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("Updated", path, "->", loc["city"], loc["lat"], loc["lon"])
    done += 1

if not done:
    print("Nothing updated: run this from the Portfolio-HQ folder (the one that has local/ and global/).")