# Acuity — an independent, clean-room "cognitive value" TV/film index

**Acuity** scores **15,883 films & series** on cognitive value: an overall **Acuity Quotient (AQ)**
on a 0–200 scale, three lenses — **Depth**, **Insight**, **Craft** — and a five-tier scale
(**Idle · Ambient · Engaging · Absorbing · Profound**), with multi-facet filtering including
**"filter to the streaming services you actually have."**

## Clean-room methodology (how this was built, and why it's defensible)
Acuity is an **independent clean-room (Chinese-wall) re-implementation** — a functionally
comparable product built *without copying any protected expression* of a reference product. The
legal core is a strict **two-agent separation**:

- **The Analyst** (one agent) studied a mirror of the reference product and wrote **`SPEC.md`** —
  a *functional requirements specification only*: information architecture, data-schema shape, UX
  flows, and idea-level design parameters. It copied **no** code, prose, taglines, assets, or score
  values; the original's score numbers, tier names, and thresholds were deliberately omitted.
- **The Implementer** (a **separate** agent, run as its own process) had the reference product
  **explicitly off-limits** — it never read the mirror, fetched the site, or searched for it. It
  authored **all** of Acuity's code, copy, brand, tier names, colors, and design **solely from
  `SPEC.md`** and our fact-derived dataset. The spec was the *only* channel between the two rooms.

So the agent that wrote the shippable expression never saw the original. The full protocol, what's
independent, the evidence trail, and dated per-agent attestations (Analyst, Implementer, and every
later pass) are in **`CLEANROOM.md`**.

## What makes it independent / defensible
- **Facts only as input.** The catalog comes from **IMDb public datasets** (titles, types, years,
  genres, average ratings, vote counts) — facts, not anyone's creative data.
- **Our own scores.** `build/score.py` derives the three lenses from transparent genre + quality +
  reach signals, blends them, then maps the result onto our own **deliberately flattened**
  distribution (median 100, range ~0–200, flatter-than-normal). No external score values are used.
- **Posters hotlinked, never downloaded** — served live from **TMDB** with attribution; IMDb data
  credited for non-commercial use (see the site footer and `CLEANROOM.md`).
- **Original everything else** — brand (Acuity), tier names, copy, design, and code, all authored
  independently from the functional spec.

## Layout
```
SPEC.md         functional requirements (clean-room analyst output)
CLEANROOM.md    protocol + dated attestations (the paper trail)
DATA.md         catalog.json schema
build/score.py  the scoring engine (facts -> our scores -> bell curve)
build/*.json    generated catalog + distribution stats
dist/           the static site (deployed to GitHub Pages)
  index.html explore.html title.html methodology.html kids.html
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

## Hosting note
`dist/_headers` (CSP, X-Frame-Options, etc.) is a Netlify/Cloudflare Pages feature and is **not
applied by GitHub Pages**. The public surface is fully static with no secrets, so practical risk is
low; for enforced security headers, deploy `dist/` to Netlify or Cloudflare Pages instead.
