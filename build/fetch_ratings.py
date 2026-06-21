#!/usr/bin/env python3
"""Pull US MPAA (film) / TV content ratings from TMDB (build-time only) and a derived
minimum-audience-age, so the catalog can be filtered by how mature a title is.
Uses the cached TMDB id/type; token stays in .tmdb_token, never deployed."""
import urllib.request, urllib.error, json, os, time, threading
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = "/Users/bryanroscoe/Developer/tvi-rebuild"
TOK  = open(f"{ROOT}/.tmdb_token").read().strip()
cat  = json.load(open(f"{ROOT}/build/catalog.json"))
idc  = json.load(open(f"{ROOT}/build/tmdb_id_cache.json"))           # imdb -> [tmdb_id, type]
CACHE_F = f"{ROOT}/build/ratings_cache.json"
cache = json.load(open(CACHE_F)) if os.path.exists(CACHE_F) else {}  # imdb -> cert string
lock = threading.Lock()

# certificate -> minimum audience age (for the "audience age" slider)
AGE = {"G":0,"TV-Y":0,"TV-G":0,"TV-Y7":7,"PG":8,"TV-PG":8,"PG-13":13,"TV-14":14,
       "R":17,"TV-MA":17,"NC-17":18}

def api(path):
    req = urllib.request.Request("https://api.themoviedb.org/3"+path,
            headers={"Authorization": f"Bearer {TOK}", "accept": "application/json"})
    for a in range(4):
        try:
            with urllib.request.urlopen(req, timeout=25) as r: return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(1.5*(a+1)); continue
            return None
        except Exception:
            time.sleep(0.5*(a+1))
    return None

def cert_for(imdb):
    pair = idc.get(imdb)
    if not pair or not pair[0]: return ""
    tid, typ = pair
    if typ == "movie":
        d = api(f"/movie/{tid}/release_dates") or {}
        for r in (d.get("results") or []):
            if r.get("iso_3166_1") == "US":
                for rd in (r.get("release_dates") or []):
                    c = (rd.get("certification") or "").strip()
                    if c: return c
    else:
        d = api(f"/tv/{tid}/content_ratings") or {}
        for r in (d.get("results") or []):
            if r.get("iso_3166_1") == "US":
                c = (r.get("rating") or "").strip()
                if c: return c
    return ""

def work(rec):
    imdb = rec.get("id")
    if imdb in cache:
        c = cache[imdb]
    else:
        c = cert_for(imdb) if imdb else ""
        with lock: cache[imdb] = c
    rec["cert"] = c or None
    rec["maxage"] = AGE.get(c) if c in AGE else None
    return rec

ok = 0
with ThreadPoolExecutor(max_workers=20) as ex:
    futs = {ex.submit(work, r): r for r in cat}
    for i, f in enumerate(as_completed(futs)):
        if f.result().get("cert"): ok += 1
        if (i+1) % 2000 == 0: print(f"  {i+1}/{len(cat)} rated={ok}", flush=True)

json.dump(cat, open(f"{ROOT}/build/catalog.json","w"), separators=(",",":"))
json.dump(cache, open(CACHE_F,"w"))
from collections import Counter
dist = Counter(r.get("cert") for r in cat if r.get("cert"))
print(f"DONE: {ok}/{len(cat)} have a content rating", flush=True)
print("distribution:", dict(dist.most_common(12)), flush=True)
