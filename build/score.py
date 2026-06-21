#!/usr/bin/env python3
"""
TVI-rebuild scoring engine — OUR OWN, independently designed.

Inputs are FACTS from IMDb public datasets (title, type, year, genres, avg rating, vote count).
We compute three sub-dimension raw scores from transparent genre + quality + reach signals,
blend them into a composite, then QUANTILE-NORMALIZE the composite to a true Normal(100, 15)
distribution (an "IQ"-like scale that is, by construction, an actual bell curve).

No values from the original product are used. See CLEANROOM.md.
"""
import gzip, json, math, re, statistics
from statistics import NormalDist

DATA = "/Users/bryanroscoe/Developer/tvi-rebuild/data"
OUT  = "/Users/bryanroscoe/Developer/tvi-rebuild/build"
N_MOVIES, N_SERIES = 5000, 2500          # ~7500 titles total (>3x a 2,338 catalog)
MIN_VOTES = 1000

# --- our genre weight maps (0..1) per dimension -------------------------------
# cognitive stimulation: rewards complexity / sustained attention
COG = {"Film-Noir":1.0,"Mystery":0.95,"Sci-Fi":0.9,"Thriller":0.85,"Drama":0.8,"Crime":0.8,
       "War":0.8,"History":0.8,"Biography":0.75,"Documentary":0.7,"Fantasy":0.65,"Adventure":0.55,
       "Western":0.55,"Animation":0.5,"Action":0.45,"Music":0.45,"Romance":0.4,"Sport":0.4,
       "Comedy":0.4,"Musical":0.4,"Family":0.35,"Horror":0.45,"Reality-TV":0.1,"Game-Show":0.05,
       "Talk-Show":0.1,"News":0.5}
# educational value: real-world knowledge / informational density
EDU = {"Documentary":1.0,"History":0.95,"Biography":0.9,"News":0.9,"War":0.8,"Drama":0.5,
       "Crime":0.5,"Sci-Fi":0.5,"Western":0.45,"Sport":0.4,"Music":0.4,"Mystery":0.4,
       "Film-Noir":0.4,"Thriller":0.35,"Adventure":0.35,"Fantasy":0.3,"Animation":0.3,
       "Romance":0.25,"Action":0.25,"Comedy":0.25,"Family":0.3,"Musical":0.3,"Horror":0.2,
       "Reality-TV":0.15,"Game-Show":0.1,"Talk-Show":0.2}
# entertainment / craft: broad enjoyment + production craft (mostly rating-driven)
ENT = {"Adventure":0.8,"Action":0.75,"Animation":0.75,"Fantasy":0.75,"Musical":0.7,"Sci-Fi":0.7,
       "Comedy":0.7,"Crime":0.7,"Thriller":0.7,"Drama":0.65,"Mystery":0.7,"Romance":0.65,
       "Family":0.65,"Music":0.6,"War":0.6,"History":0.55,"Biography":0.55,"Western":0.6,
       "Sport":0.6,"Horror":0.6,"Documentary":0.5,"Film-Noir":0.7,"News":0.3,"Reality-TV":0.4,
       "Game-Show":0.4,"Talk-Show":0.4}

def gmean(genres, table, default=0.4):
    vals = [table.get(g, default) for g in genres if g != "Short"]
    return sum(vals)/len(vals) if vals else default

def slugify(name, year):
    s = name.lower()
    s = re.sub(r"[''`]", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return f"{s}-{year}" if year else s

# --- load ratings (small) -----------------------------------------------------
print("loading ratings...")
ratings = {}
with gzip.open(f"{DATA}/title.ratings.tsv.gz", "rt", encoding="utf-8") as f:
    next(f)
    for line in f:
        t, avg, votes = line.rstrip("\n").split("\t")
        try:
            v = int(votes)
            if v >= MIN_VOTES:
                ratings[t] = (float(avg), v)
        except ValueError:
            pass
print(f"  {len(ratings):,} titles with >= {MIN_VOTES} votes")

# --- stream basics, keep movies + series that have ratings --------------------
print("streaming basics (facts: type, title, year, genres)...")
WANT = {"movie": "film", "tvSeries": "series", "tvMiniSeries": "series"}
rows = []
with gzip.open(f"{DATA}/title.basics.tsv.gz", "rt", encoding="utf-8") as f:
    next(f)
    for line in f:
        p = line.rstrip("\n").split("\t")
        if len(p) < 9: continue
        tconst, ttype, ptitle, _otitle, isAdult, startYear, _endYear, runtime, genres = p
        if ttype not in WANT or isAdult == "1": continue
        if tconst not in ratings: continue
        if genres == "\\N": continue
        year = None if startYear == "\\N" else int(startYear)
        if not year or year < 1950: continue
        avg, votes = ratings[tconst]
        rows.append({
            "id": tconst, "n": ptitle, "year": year, "type": WANT[ttype],
            "g": [g for g in genres.split(",") if g and g != "Short"],
            "rating": avg, "votes": votes,
        })
print(f"  {len(rows):,} candidate titles")

# --- select top-by-votes within each kind ------------------------------------
films  = sorted([r for r in rows if r["type"]=="film"],   key=lambda r:-r["votes"])[:N_MOVIES]
series = sorted([r for r in rows if r["type"]=="series"], key=lambda r:-r["votes"])[:N_SERIES]
cat = films + series
print(f"  selected {len(films):,} films + {len(series):,} series = {len(cat):,}")

# --- raw sub-dimension scores (0..1) -----------------------------------------
maxlv = math.log10(max(r["votes"] for r in cat))
minlv = math.log10(MIN_VOTES)
for r in cat:
    rn = (r["rating"] - 1) / 9.0                              # 0..1 quality
    pop = (math.log10(r["votes"]) - minlv) / (maxlv - minlv)  # 0..1 cultural reach
    pop = min(1.0, max(0.0, pop))
    r["_cog"] = 0.55*gmean(r["g"], COG) + 0.35*rn + 0.10*pop
    r["_edu"] = 0.75*gmean(r["g"], EDU) + 0.25*rn
    r["_ent"] = 0.60*rn + 0.25*gmean(r["g"], ENT) + 0.15*pop
    r["_composite"] = 0.40*r["_cog"] + 0.25*r["_edu"] + 0.35*r["_ent"]

# --- quantile-normalize composite -> Normal(100,15) (TRUE bell curve) ---------
def quantile_to_normal(values, mean=100, sd=15, lo=40, hi=160):
    nd = NormalDist(mean, sd)
    order = sorted(range(len(values)), key=lambda i: values[i])
    out = [0]*len(values)
    n = len(values)
    for rank, i in enumerate(order):
        p = (rank + 0.5) / n                 # plotting position in (0,1)
        out[i] = round(min(hi, max(lo, nd.inv_cdf(p))))
    return out

def quantile_to_0_100(values):               # for dimension bars: percentile*100
    order = sorted(range(len(values)), key=lambda i: values[i])
    out = [0]*len(values); n=len(values)
    for rank, i in enumerate(order):
        out[i] = round(100*(rank+0.5)/n)
    return out

iq   = quantile_to_normal([r["_composite"] for r in cat])
cog  = quantile_to_0_100([r["_cog"] for r in cat])
edu  = quantile_to_0_100([r["_edu"] for r in cat])
ent  = quantile_to_0_100([r["_ent"] for r in cat])

# tiers by standard-deviation bands of the Normal(100,15) IQ (0..4 low->high)
def tier_index(x):
    if x >= 130: return 4
    if x >= 115: return 3
    if x >=  85: return 2
    if x >=  70: return 1
    return 0

records = []
for k, r in enumerate(cat):
    records.append({
        "n": r["n"], "year": r["year"], "type": r["type"], "g": r["g"],
        "iq": iq[k], "cog": cog[k], "edu": edu[k], "ent": ent[k],
        "tier": tier_index(iq[k]),
        "rating": r["rating"], "votes": r["votes"],
        "slug": slugify(r["n"], r["year"]),
    })
# de-dup slugs
seen = {}
for rec in records:
    s = rec["slug"]
    if s in seen:
        seen[s]+=1; rec["slug"]=f"{s}-{seen[s]}"
    else:
        seen[s]=1
records.sort(key=lambda r:-r["iq"])

# --- distribution stats (prove normality) ------------------------------------
xs = [r["iq"] for r in records]
m = statistics.mean(xs); sd = statistics.pstdev(xs)
sk = sum(((x-m)/sd)**3 for x in xs)/len(xs)
ku = sum(((x-m)/sd)**4 for x in xs)/len(xs) - 3
tier_counts = {i: sum(1 for r in records if r["tier"]==i) for i in range(5)}
hist = {}
for x in xs: hist[x] = hist.get(x,0)+1

stats = {"n": len(records), "n_films": len(films), "n_series": len(series),
         "mean": round(m,2), "sd": round(sd,2), "skew": round(sk,3), "excess_kurtosis": round(ku,3),
         "min": min(xs), "max": max(xs), "tier_counts": tier_counts,
         "histogram": {str(k): hist[k] for k in sorted(hist)}}

with open(f"{OUT}/catalog.json","w") as f: json.dump(records, f, separators=(",",":"))
with open(f"{OUT}/stats.json","w") as f: json.dump(stats, f, indent=2)

print(f"\nWROTE {len(records):,} records")
print(f"  mean={m:.2f} sd={sd:.2f} skew={sk:.3f} excess_kurtosis={ku:.3f}")
print(f"  tiers (low->high): {tier_counts}")
print(f"  -> catalog.json, stats.json")
