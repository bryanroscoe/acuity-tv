#!/usr/bin/env python3
"""
Place a SINGLE new title on Acuity's Normal(100,15) scale — used when an independent
agent generates a title that isn't in the IMDb-sourced catalog (see prompts/generate-title.md).

Input: the three sub-dimension percentiles (0-100) the agent assigned.
Output: the calibrated overall IQ + tier, consistent with the catalog's bell curve.

Usage:
    python3 build/score_one.py --cog 82 --edu 70 --ent 88
or import score_one(cog, edu, ent) -> dict.
"""
import argparse, json
from statistics import NormalDist

# same dimension weights as the catalog scorer (build/score.py)
W_COG, W_EDU, W_ENT = 0.40, 0.25, 0.35
ND = NormalDist(100, 15)

def tier_index(iq):
    if iq >= 130: return 4
    if iq >= 115: return 3
    if iq >=  85: return 2
    if iq >=  70: return 1
    return 0

def score_one(cog, edu, ent):
    cog, edu, ent = (max(0, min(100, float(x)) ) for x in (cog, edu, ent))
    composite = W_COG*cog + W_EDU*edu + W_ENT*ent          # 0..100, treated as a percentile
    p = min(0.999, max(0.001, composite/100.0))
    iq = round(min(160, max(40, ND.inv_cdf(p))))
    return {"cog": round(cog), "edu": round(edu), "ent": round(ent),
            "iq": iq, "tier": tier_index(iq)}

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--cog", type=float, required=True)
    ap.add_argument("--edu", type=float, required=True)
    ap.add_argument("--ent", type=float, required=True)
    args = ap.parse_args()
    print(json.dumps(score_one(args.cog, args.edu, args.ent), indent=2))
