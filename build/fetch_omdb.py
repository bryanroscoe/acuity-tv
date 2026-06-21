#!/usr/bin/env python3
"""Fetch audience (IMDb) + critic (Metacritic / Rotten Tomatoes) reception scores from OMDb,
build-time only, by IMDb id. Free tier ~1000/day, so we cover the most-popular titles first and
cache; re-run on later days to extend coverage. Key in .omdb_key (gitignored); never deployed.
Output cache: build/omdb_cache.json  -> { imdb_id: {mc, rt, imdb} }  (mc/rt 0-100, imdb 0-10)."""
import urllib.request, json, os, time, re, threading
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = "/Users/bryanroscoe/Developer/tvi-rebuild"
KEY  = open(f"{ROOT}/.omdb_key").read().strip()
DAILY_BUDGET = 16000                     # paid key — cover the whole catalog (resumable via cache)
cat = json.load(open(f"{ROOT}/build/catalog.json"))
CACHE_F = f"{ROOT}/build/omdb_cache.json"
cache = json.load(open(CACHE_F)) if os.path.exists(CACHE_F) else {}

# most-popular first (best critic coverage + most-visited titles), skip already-cached
todo = [r for r in sorted(cat, key=lambda r:-r.get("votes",0)) if r["id"] not in cache][:DAILY_BUDGET]
print(f"cache has {len(cache)}; fetching {len(todo)} more (by popularity)", flush=True)

def fetch(imdb):
    url = f"http://www.omdbapi.com/?i={imdb}&apikey={KEY}"
    d = None
    for attempt in range(4):                     # resilient to transient timeouts
        try:
            d = json.load(urllib.request.urlopen(url, timeout=25)); break
        except RuntimeError: raise
        except Exception:
            time.sleep(1.0*(attempt+1))
    if d is None: return None                    # gave up on this title, skip (don't crash)
    if d.get("Response") != "True":
        if "limit" in (d.get("Error","").lower()): raise RuntimeError("daily limit reached")
        return None
    mc = None
    try: mc = int(d["Metascore"]) if d.get("Metascore","N/A") != "N/A" else None
    except: mc = None
    rt = None
    for r in d.get("Ratings", []):
        if r["Source"] == "Rotten Tomatoes":
            m = re.match(r"(\d+)%", r["Value"]);  rt = int(m.group(1)) if m else None
    imdb_r = None
    try: imdb_r = float(d["imdbRating"]) if d.get("imdbRating","N/A") != "N/A" else None
    except: imdb_r = None
    return {"mc": mc, "rt": rt, "imdb": imdb_r}

lock = threading.Lock()
stop = {"limit": False}

def work(r):
    if stop["limit"]: return
    try:
        res = fetch(r["id"])
    except RuntimeError:
        stop["limit"] = True; return
    with lock:
        cache[r["id"]] = res or {}

done = 0
with ThreadPoolExecutor(max_workers=16) as ex:
    futs = [ex.submit(work, r) for r in todo]
    for f in as_completed(futs):
        done += 1
        if done % 1000 == 0:
            with lock: json.dump(cache, open(CACHE_F,"w"))
            print(f"  {done}/{len(todo)} processed", flush=True)
if stop["limit"]: print("stopped: daily limit reached", flush=True)

json.dump(cache, open(CACHE_F,"w"))
withcrit = sum(1 for v in cache.values() if v and (v.get("mc") is not None or v.get("rt") is not None))
print(f"DONE: cache={len(cache)}, with a critic score={withcrit}", flush=True)
