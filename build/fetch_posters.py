#!/usr/bin/env python3
"""Resolve a TMDB poster_path for each catalog title via its IMDb id (build-time only).
Token read from gitignored .tmdb_token; output (public poster paths) written into catalog.json.
The token is NEVER written to the catalog or the deployed site."""
import urllib.request, urllib.error, json, time, os, threading
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = "/Users/bryanroscoe/Developer/tvi-rebuild"
TOK  = open(f"{ROOT}/.tmdb_token").read().strip()
cat  = json.load(open(f"{ROOT}/build/catalog.json"))
CACHE_F = f"{ROOT}/build/poster_cache.json"
cache = json.load(open(CACHE_F)) if os.path.exists(CACHE_F) else {}   # imdb_id -> poster_path|null
lock = threading.Lock()

def find(imdb):
    url = f"https://api.themoviedb.org/3/find/{imdb}?external_source=imdb_id"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOK}", "accept": "application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                d = json.load(r)
            res = (d.get("movie_results") or []) + (d.get("tv_results") or [])
            return res[0].get("poster_path") if res else None
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(1.5 * (attempt + 1)); continue
            return None
        except Exception:
            time.sleep(0.5 * (attempt + 1))
    return None

def work(rec):
    iid = rec.get("id")
    if iid in cache:                       # reuse prior result (incl. cached null)
        rec["p"] = cache[iid]; return rec
    p = find(iid) if iid else None
    rec["p"] = p
    with lock: cache[iid] = p
    return rec

ok = miss = cached = 0
with ThreadPoolExecutor(max_workers=24) as ex:
    futs = {ex.submit(work, r): r for r in cat}
    for i, f in enumerate(as_completed(futs)):
        r = f.result()
        if r.get("p"): ok += 1
        else: miss += 1
        if (i + 1) % 1000 == 0:
            print(f"  {i+1}/{len(cat)} posters={ok} missing={miss}", flush=True)

json.dump(cat,   open(f"{ROOT}/build/catalog.json", "w"), separators=(",", ":"))
json.dump(cache, open(CACHE_F, "w"))
print(f"DONE: {ok} posters resolved, {miss} without (placeholder fallback). -> catalog.json", flush=True)
