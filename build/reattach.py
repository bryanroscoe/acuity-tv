#!/usr/bin/env python3
"""Re-attach cached enrichment (posters, streaming, content rating/age) onto build/catalog.json.
ALWAYS run this after score.py — score.py only writes the base scored fields.
    python3 build/score.py && python3 build/reattach.py
"""
import json
ROOT = "/Users/bryanroscoe/Developer/tvi-rebuild"
cat = json.load(open(f"{ROOT}/build/catalog.json"))
pc  = json.load(open(f"{ROOT}/build/poster_cache.json"))      # imdb -> poster_path
rc  = json.load(open(f"{ROOT}/build/providers_cache.json"))   # imdb -> [provider names]
rt  = json.load(open(f"{ROOT}/build/ratings_cache.json"))     # imdb -> cert string
AGE = {"G":0,"TV-Y":0,"TV-G":0,"TV-Y7":7,"PG":8,"TV-PG":8,"PG-13":13,"TV-14":14,"R":17,"TV-MA":17,"NC-17":18}
for r in cat:
    i = r["id"]
    r["p"]   = pc.get(i)
    r["svc"] = rc.get(i, [])
    c = rt.get(i) or ""
    r["cert"]   = c or None
    r["maxage"] = AGE.get(c)
json.dump(cat, open(f"{ROOT}/build/catalog.json","w"), separators=(",",":"))
print(f"re-attached: posters={sum(1 for r in cat if r.get('p'))}, "
      f"streaming={sum(1 for r in cat if r.get('svc'))}, "
      f"rated={sum(1 for r in cat if r.get('cert'))} / {len(cat)}")
