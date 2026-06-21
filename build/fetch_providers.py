#!/usr/bin/env python3
"""
Pull streaming availability + official provider branding from TMDB (build-time only).
For each catalog title: resolve TMDB id/type via IMDb id, then fetch US watch providers.
Writes per-title `svc` (subscription/free/ads provider names) into catalog.json and a global
`build/providers.json` manifest: provider_name -> {logo, id, count} (logo = public TMDB URL).
Token stays in .tmdb_token; never written to catalog or deployed.
"""
import urllib.request, urllib.error, json, os, time, threading
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = "/Users/bryanroscoe/Developer/tvi-rebuild"
TOK  = open(f"{ROOT}/.tmdb_token").read().strip()
cat  = json.load(open(f"{ROOT}/build/catalog.json"))
ID_F = f"{ROOT}/build/tmdb_id_cache.json"     # imdb_id -> [tmdb_id, type]
PRV_F= f"{ROOT}/build/providers_cache.json"   # imdb_id -> [provider_name,...]
idc  = json.load(open(ID_F))  if os.path.exists(ID_F)  else {}
prc  = json.load(open(PRV_F)) if os.path.exists(PRV_F) else {}
lock = threading.Lock()
manifest = {}   # provider_name -> {logo, id, count}

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

def resolve(imdb):
    if imdb in idc: return idc[imdb]
    d = api(f"/find/{imdb}?external_source=imdb_id") or {}
    if d.get("movie_results"): out = [d["movie_results"][0]["id"], "movie"]
    elif d.get("tv_results"):  out = [d["tv_results"][0]["id"], "tv"]
    else: out = [None, None]
    with lock: idc[imdb] = out
    return out

def work(rec):
    imdb = rec.get("id")
    if imdb in prc:
        rec["svc"] = prc[imdb]; return rec
    names = []
    if imdb:
        tid, typ = resolve(imdb)
        if tid:
            d = api(f"/{typ}/{tid}/watch/providers") or {}
            us = ((d.get("results") or {}).get("US")) or {}
            seen = {}
            for bucket in ("flatrate", "free", "ads"):
                for p in (us.get(bucket) or []):
                    seen[p["provider_name"]] = p.get("logo_path")
            names = sorted(seen)
            with lock:
                for nm, logo in seen.items():
                    e = manifest.setdefault(nm, {"logo": logo, "count": 0})
                    e["count"] += 1
                prc[imdb] = names
    rec["svc"] = names
    return rec

done = withsvc = 0
with ThreadPoolExecutor(max_workers=20) as ex:
    futs = {ex.submit(work, r): r for r in cat}
    for i, f in enumerate(as_completed(futs)):
        r = f.result(); done += 1
        if r.get("svc"): withsvc += 1
        if done % 1000 == 0: print(f"  {done}/{len(cat)} with_streaming={withsvc} providers={len(manifest)}", flush=True)

# finalize manifest with public logo URLs (TMDB logos served at image.tmdb.org)
out = {nm: {"logo": ("https://image.tmdb.org/t/p/original"+v["logo"]) if v["logo"] else None,
            "count": v["count"]}
       for nm, v in sorted(manifest.items(), key=lambda kv: -kv[1]["count"])}
json.dump(cat,  open(f"{ROOT}/build/catalog.json","w"), separators=(",",":"))
json.dump(out,  open(f"{ROOT}/build/providers.json","w"), indent=2)
json.dump(idc,  open(ID_F,"w")); json.dump(prc, open(PRV_F,"w"))
print(f"DONE: {withsvc}/{len(cat)} titles have streaming; {len(out)} distinct providers (with logos).", flush=True)
print("top:", [k for k in list(out)[:12]], flush=True)
