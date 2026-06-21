# Acuity — an independent, clean-room "cognitive value" TV/film index

**Acuity** scores 7,500 films & series on cognitive value, with an overall *IQ* (an exact
Normal(100, 15) bell curve), three sub-dimensions, and a five-tier scale — plus multi-facet
filtering including **"filter to the streaming services you actually have."**

This was built as a **clean-room (Chinese-wall) re-implementation** to demonstrate a
functionally-comparable product that is *more* complete and *more* rigorous than a reference
product, **without copying any of its protected expression**. See `CLEANROOM.md` for the full
protocol and the per-agent attestations (Analyst wrote a functional spec; a separate, isolated
Implementer built the site without ever seeing the original).

## What makes it independent / defensible
- **Facts only as input.** The catalog is sourced from **IMDb public datasets** (titles, types,
  years, genres, average ratings, vote counts) — facts, not anyone's creative data.
- **Our own scores.** `build/score.py` computes three sub-dimensions from transparent genre +
  quality + reach signals, blends them, then **quantile-normalizes the result to a true
  Normal(100, 15) distribution** (mean 100.00, sd 15.00, skew ≈ 0). No external score values used.
- **Original everything else.** Brand, tier names (Blur · Haze · Clear · Sharp · Brilliant),
  copy, design, and code were all authored independently from a functional spec.

## Layout
```
SPEC.md         functional requirements (clean-room analyst output)
CLEANROOM.md    protocol + dated attestations (the paper trail)
DATA.md         catalog.json schema
build/score.py  the scoring engine (facts -> our scores -> bell curve)
build/*.json    generated catalog + distribution stats
dist/           the static site (deployed to GitHub Pages)
  index.html explore.html title.html methodology.html compare.html
  styles.css app.js _headers   data/catalog.json data/stats.json
```

## Build / run
```bash
# regenerate scores from IMDb datasets (downloads ~230 MB of facts; gitignored)
python3 build/score.py
# serve the site
python3 -m http.server 8911 --directory dist   # http://localhost:8911
```

## Engineering notes (deliberately better than the reference)
- Single source of truth: every page renders from `dist/data/catalog.json` — no hand-edited numbers.
- No inline scripts/handlers → a strict CSP is enforceable (`dist/_headers`).
- All-relative paths → hosts cleanly from any subdirectory on GitHub Pages.
- No secrets in the client; nothing dynamic to attack (fully static).
