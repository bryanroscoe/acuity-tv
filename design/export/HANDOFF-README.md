# Acuity — design handoff (3 pages + data module)

Five files, all in one folder. Open any `.dc.html` directly in a browser — no build step.

## Files
- **Acuity.dc.html** — home / landing (hero poster wall, instrument, methodology + flattened-curve, compare, naming study). → maps to `dist/index.html`
- **Catalog.dc.html** — explore page: collapsible filter rail (priorities re-weighting, tier, type, streaming w/ logos + "+more", audience-age slider, dimension minimums, score range, IMDb rating/votes, genre search), sort, real posters, mobile drawer. → `dist/explore.html`
- **Title.dc.html** — title detail: AQ + tier, Depth/Insight/Craft breakdown, rationale, where-to-watch, related. Reads `?t=<slug>`. → `dist/title.html`
- **acuity-catalog.js** — SINGLE SOURCE OF TRUTH. Schema matches `DATA.md` (`n, year, type, g, iq, cog, edu, ent, tier, rating, votes, slug, svc, p, kids, rationale`). All three pages import it.
- **support.js** — the rendering runtime the `.dc.html` files load. Ship as-is; don't edit.

## Wiring the real data (15,883 titles)
`acuity-catalog.js → loadCatalog()` already does this:
1. `fetch('./data/catalog.json')` — if present, it's used and the embedded sample is ignored.
2. Falls back to the built-in 52-title `SAMPLE` only when that file is missing.

So drop your generated `dist/data/catalog.json` next to these files (or serve from `./data/`) and every page renders real data. `iq`/`tier` ship precomputed in real data; the in-module `calibIq()` is only used for the sample.

## Posters (TMDB)
`resolvePoster(rec)` uses `rec.p` (TMDB poster path) when present → `https://image.tmdb.org/t/p/w342{p}`. If `p` is empty it searches TMDB by title+type and caches to `localStorage`. The read token is currently inline in `acuity-catalog.js` — swap it for your env/secret if you prefer. Populating `p` in `catalog.json` removes the runtime lookups entirely.

## Tiers (consistent across all pages)
By IQ: 4 ≥130 **Profound** `#b9acff` · 3 =115–129 **Absorbing** `#8a78ff` · 2 =85–114 **Engaging** `#6f63c4` · 1 =70–84 **Ambient** `#6a6580` · 0 <70 **Idle** `#c66a86`.
Dimensions display as Depth=`cog`, Insight=`edu`, Craft=`ent`.

## Note for a vanilla/static port
These are component files for live preview. If you're porting to the plain static `dist/` (no-inline-handlers + CSP per SPEC §7d), treat them as the visual + behavioral reference and re-bind events in `app.js`; the data contract and all filter logic live in `acuity-catalog.js`.
