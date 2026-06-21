# Clean-Room Implementation — Protocol & Paper Trail

**Project:** independent re-implementation of a "cognitive value" TV/film rating product.
**Purpose:** demonstrate a functionally-equivalent product, built independently, that is more
complete (≥2–3× catalog), more statistically rigorous (true normal score distribution), and
secure-by-default — WITHOUT copying the original's protected expression.

## Why clean-room
Copyright protects *expression* (code, prose, the specific creative scores, distinctive visual
expression), not *ideas, functionality, or facts*. The defensible way to build a functionally
similar product is the **Chinese-wall / clean-room** method (established in *Sega v. Accolade*,
*Sony v. Connectix*; the Phoenix clean-room BIOS): a "dirty room" team studies the original and
writes a **functional requirements specification**; a separate "clean room" team that has **never
accessed the original** implements solely from that spec.

## Roles & access boundary
| Role | Agent | May access the original mirror? | Output |
|---|---|---|---|
| **Orchestrator** | main session | Yes (already studied it) | Coordinates; passes ONLY the spec + fact-derived data to the implementer; writes NO product expression. |
| **Analyst (dirty room)** | sub-agent A | **Yes** | `SPEC.md` — functional requirements only, no verbatim creative expression. |
| **Implementer (clean room)** | sub-agent B | **NO — explicitly forbidden** | The site (original code + original copy) built from `SPEC.md` + fact data only. |

## Rules
1. The Analyst describes **function and requirements**, never copying verbatim marketing copy,
   taglines, prose, or reproducing assets/logos; the original's **score values** are treated as
   proprietary and are NOT transcribed.
2. The Implementer is told the original's URL/mirror path is **off-limits** and must not fetch or
   read it; it builds only from `SPEC.md` and our fact-sourced `catalog.json`.
3. Catalog facts come from **IMDb public datasets** (titles, genres, ratings, votes) — facts, not
   the original's data.
4. Scores are **independently computed** by our own algorithm (see `build/score.py`) and never
   derived from the original's scores.
5. Original branding/name is NOT reused; the implementation ships under its own brand.

## Log
- (orchestrator) Protocol established. Catalog sourced from IMDb datasets; scoring engine is our own.
- Agent attestations appended below as each phase completes.

### Analyst attestation
- **Role:** Analyst (dirty room). Accessed the original local mirror to study it functionally.
- **Date:** 2026-06-21
- **Statement:** `SPEC.md` contains functional requirements only — information architecture,
  data-schema shape, UX flows, and idea-level design parameters. No verbatim creative
  expression, prose, taglines, asset, or score value was copied from the original; the
  original's specific score numbers, tier names, and tier thresholds were deliberately omitted.
- **Spec size/sections:** ~270 lines across 7 sections plus an Attestation — (1) Purpose &
  target user, (2) Information architecture / page types, (3) Data schema & scoring concept,
  (4) Core UX flows, (5) Functional design language, (6) Copywriter brief, (7) Improvements
  (streaming-availability filtering, bell-curve scores, visible methodology, secure static SSOT).

---

### Implementer attestation
- **Role:** Implementer (clean room).
- **Date:** 2026-06-21
- **Statement:** I did NOT access, read, fetch, or view the original product or its local
  mirror in any form (the `tvintelligentsia` directory and `tvintelligentsia.com` were treated
  as strictly off-limits and never opened). The entire site was built solely from `SPEC.md`,
  `DATA.md`, and the fact-derived dataset (`dist/data/catalog.json`, `dist/data/stats.json`).
  All prose, brand identity, tier names, colors, design, and code are my own original work.
- **Brand chosen:** **Acuity** — "an IQ for everything you watch." (Original name; double meaning
  of visual + mental sharpness.)
- **Tiers (mine, low→high, mapping data `tier` 0–4):** Blur, Haze, Clear, Sharp, Brilliant —
  each with its own muted color (clay-red → ochre → slate → teal → champagne) and an original
  one-line description.
- **Scoring display:** overall `iq` shown on a fixed `/200` scale; three 0–100 dimension bars
  (cognitive load / knowledge value / craft & execution); per-title rationale is generated
  deterministically from each title's own numbers (genre + strongest dimension + IMDb signal).
- **Pages built:** `index.html` (landing + stat band + featured grid + CTA), `explore.html`
  (instant search; combinable tier/genre/type/IQ-range + persisted "my streaming services"
  filters; sort; live count; empty state), `title.html` (client-rendered detail keyed by
  `?t=<slug>`), `methodology.html` (original scoring prose + SVG bell-curve histogram from
  stats.json), `compare.html` (two-title head-to-head with winner + per-dimension bars).
- **Files I created:**
  - `dist/index.html`
  - `dist/explore.html`
  - `dist/title.html`
  - `dist/methodology.html`
  - `dist/compare.html`
  - `dist/styles.css` (single shared stylesheet)
  - `dist/app.js` (single shared script; no inline handlers, CSP-friendly)
  - `dist/_headers` (CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff,
    Referrer-Policy, Permissions-Policy, COOP)
- **Engineering notes:** single source of truth — every page reads `./data/catalog.json`
  (and `stats.json`); all paths are relative for GitHub-Pages subdirectory hosting;
  localStorage is namespaced/versioned (`acuity_v1`) and degrades gracefully if unavailable.
- **Self-verification:** served `dist/` via `python3 -m http.server 8910` and curled every
  page + asset — all returned HTTP 200 (index, explore, title, methodology, compare,
  catalog.json, stats.json, styles.css, app.js, _headers); `title.html?t=<slug>` → 200;
  catalog confirmed at 7,500 records; `node --check app.js` passed; grep confirmed zero
  inline styles, zero inline `on*` handlers, and zero inline `<script>` blocks.

---

### Deployment (orchestrator)
- **Date:** 2026-06-21
- Repo `github.com/bryanroscoe/acuity-tv` made public (with user authorization) and deployed to
  GitHub Pages at **https://bryanroscoe.github.io/acuity-tv/** via the Actions workflow.
- The orchestrator contributed only: the fact-sourced dataset (IMDb), the scoring engine
  (`build/score.py`), deployment plumbing, and verification. It authored no product expression
  (HTML/CSS/copy/brand) — that was the isolated Implementer's work from the spec.

### Implementer attestation (v2 — features)

Date: 2026-06-21

I did not access, read, fetch, or reference the reference product in any form
(`/Users/bryanroscoe/Developer/tvintelligentsia`, `tvintelligentsia.com`, or any web
search for it). All work was derived solely from the existing `dist/` files, `SPEC.md`,
`DATA.md`, and the provided dataset (`dist/data/catalog.json`, `dist/data/stats.json`).

Changes made in this pass:

- **Naming.** Renamed the overall score to the "Acuity Score" everywhere it was labeled
  "IQ"/"score" (cards, tiles, detail page, sort options, score-range filter, active-filter
  pills, compare winner/gap copy, methodology prose & histogram tooltips, brand glyph IQ→AS).
  Kept the number and the `/200` display. Renamed the five tiers to
  0 Idle · 1 Passive · 2 Engaging · 3 Stimulating · 4 Profound with new one-line
  descriptions; updated the methodology tier table and tier-metaphor copy. Kept distinct,
  consistent tier colors.
- **Posters.** Title cards and the detail page now show the real TMDB poster (`p`),
  lazy-loaded (`w342` cards, `w92` autocomplete thumbs, `w500` detail), with the score-tile
  gradient as the graceful fallback when `p` is null.
- **Clickable metadata.** Genre, year, type, and tier labels on cards and the detail page now
  link into a filtered Explore (`explore.html?genre=…&year=…&type=…&tier=…`). Explore reads
  these query params on load, applies them (combinable), and reflects them in the chips and
  active-filter pills. Used a stretched-link pattern so the whole card still opens the title.
- **Clickable streaming.** Each "Where to watch" provider chip links to
  `explore.html?svc=<Service>`, which pre-applies the streaming-services filter.
- **Kids.** Added a "Kids" nav entry and a new `kids.html` (original intro + top family
  picks + live count), backed by `explore.html?kids=1`, plus a "Kids & family only" toggle in
  Explore's filters (with active-pill support).
- **Autocomplete.** New ranked, typo-tolerant instant search (exact → prefix → word-prefix →
  substring → bounded-Levenshtein fuzzy), debounced (110ms), capped to 8, each suggestion with
  poster thumbnail + Acuity Score + tier color, full keyboard nav (↑/↓/Enter/Esc) with
  combobox/listbox ARIA; selection opens the title. Applied to the home hero and Explore search.

Files changed: `dist/app.js`, `dist/styles.css`, `dist/index.html`, `dist/explore.html`,
`dist/title.html`, `dist/methodology.html`, `dist/compare.html`; added `dist/kids.html`.

Engineering: no inline `on*=` handlers or inline `<script>` (all `addEventListener`); all
relative paths; single source of truth (`./data/catalog.json`); localStorage namespaced
(`acuity_v1`) with graceful degradation; Explore paging retained (48/page) for 15,883 rows.

Self-verification (served on :8912): all six pages + data files returned 200;
`explore.html?genre=Drama&tier=4` rendered with both filters applied (277 titles, chips
pressed, active pills shown); `explore.html?svc=Netflix` applied the streaming filter
(355 titles); the example poster URL
`https://image.tmdb.org/t/p/w342/sF1U4EUQS8YHUYjNl3pMGNIQyr0.jpg` is referenced and resolves;
`node --check app.js` passed; grep confirmed no inline `on*=` handlers; headless-Chrome renders
confirmed posters, renamed labels, new tier names, and the autocomplete component; ranking/
typo unit tests passed (~2.5ms/search over 15,883). Server stopped after verification.

---

### Implementer attestation (v3 — reweighting + streaming logos)
- **Role:** Implementer (clean room).
- **Date:** 2026-06-21
- **Statement:** I did NOT access, read, fetch, or view the original product or its mirror
  (`tvintelligentsia` / `tvintelligentsia.com`) in any form. All work was done solely against
  our own `dist/` build and the fact-derived datasets (`catalog.json`, `stats.json`, the new
  `providers.json`). All prose, UI, and code remain original.

**Feature 1 — Reweightable dimensions ("score what YOU care about").** Added a "Weight your
priorities" control to the Explore filter panel: three sliders (Cognitive load / Knowledge value
/ Craft & execution, each 0–100, zero-able), a normalized live percentage readout, a "Use my
priorities" toggle, and a Reset that returns to the default Acuity Score. Defaults 40/25/35.
A personalized score = normalized weighted blend of the title's `cog/edu/ent` (0–100) linearly
mapped onto the same ~10–200 Acuity range (`10 + blend/100 × 190`), monotonic in every
dimension. When active it becomes the displayed Acuity Score (cards, Explore ordering/range
filter, title detail, home/kids) with a small "★ personalized" indicator, and a "ranked by your
priorities" flag in the results bar. Weights + on/off persist in `localStorage` under `acuity_v1`
(`weights`, `weightsOn`) with graceful degradation. Catalog `tier` (and tier color/filtering)
remains the stable canonical classification; only the number is personalized.

**Feature 2 — Streaming provider logos + canonical "my services" picker.** Official provider
logos (from `providers.json`) now render on the title-detail "where to watch" chips and in the
Explore services picker (logo + name + distinct-title count). Brand variants are de-duplicated
into one canonical toggle by stripping ad/distribution/tier suffixes (`Standard with Ads`,
`with Ads`, `Free with Ads`, `Amazon Channel`, `Apple TV Channel`, `Roku Premium Channel`),
unifying `Plus`↔`+`, and a small alias map (Paramount+/Peacock tiers, DisneyNOW, Netflix Kids,
YouTube Free/Premium). 261 raw provider entries → 212 canonical brands. Major canonical brands
(Netflix, Amazon Prime Video, Hulu, Disney+, HBO Max, Apple TV, Paramount+, Peacock, Max/Starz,
plus aggregators YouTube TV, Tubi TV, The Roku Channel, etc.) surface first; the long tail sits
behind a "Show all / search services" affordance. Selections persist (`acuity_v1.services`) as
canonical names; provider chips link to `explore.html?svc=<brand>` with canonical names. A title
counts as available on a brand if any of its variants canonicalize to it.

**Correctness pass.** Methodology now reads its figures from `stats.json` via `[data-stat]`
injection (median 100, sd ≈ 26, range, tier counts, histogram) instead of hard-coded values;
prose rewritten to describe a wide IQ-style scale (median 100, up to ~200) that recalibrates as
the catalog grows. Removed all user-facing percentile/decile/quintile and "norm-referenced"
framing; dimensions are presented as 0–100 scores and the overall as the Acuity Score.

**Files changed:** `dist/app.js`, `dist/explore.html`, `dist/title.html`,
`dist/methodology.html`, `dist/styles.css`.

**Self-verification (served on :8913, then stopped):** all pages + data files returned 200
(`index/explore/title/methodology/kids/compare.html`, `app.js`, `styles.css`,
`data/providers.json`, `data/stats.json`); `node --check app.js` passed; grep confirmed no inline
`on*=` handlers and no inline `<script>`; a data harness over the real catalog confirmed brand
merging (Netflix/Amazon/Paramount+/Peacock/Disney+ variants collapse correctly; "The Roku
Channel" and "YouTube TV" stay distinct), that every top-12 canonical brand resolves to a
`providers.json` logo URL (e.g. Netflix → `.../pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg`, assigned to an
`img.svc-logo` src at render), and that a custom weighting (Cognitive 0, Knowledge+Craft) re-ranks
the catalog versus the default Acuity ordering. Methodology numbers verified to come from
`stats.json`. Server stopped after verification.

### Implementer attestation (v4 — functional polish)

Date: 2026-06-21. I confirm I had no access to the reference product (`tvintelligentsia`):
I did not read the reference repo, fetch its site, or web-search for it. All work derived
solely from the existing `dist/` files and the local dataset (`catalog.json`, `providers.json`,
`stats.json`).

Changed in this pass:

- **FIX 1 — title cards.** `titleCard()` now renders the Acuity Score exactly once: a corner
  overlay on poster cards (`.tile-score-badge`, with the personalized ★ moved onto it) and the
  centerpiece number on placard cards (`.tile-iq`). The duplicate `.iq-badge` in the card body
  foot was removed (foot now carries only watched/list flags). The tier chip is a clean top-left
  corner overlay fully inside the tile, given a dark blurred backdrop, `max-width`, and tier-tinted
  border so it never clips or straddles the poster/body seam.
- **FIX 2 — placard sizing.** `.tile` aspect-ratio changed from `3 / 3.3` to `2 / 3`, so generated
  placards and real TMDB posters share the same width and 2:3 portrait ratio; grid rows are uniform.
- **FIX 3 — streaming picker.** Default view now shows a curated `MAJOR_BRANDS` short-list (major
  canonical subscription brands present in the data, count-ordered) instead of a raw top-12 by count
  (which was dominated by FAST/aggregator services). A bottom expander labelled "+ N more services"
  reveals the full 212-brand long tail with the search field inside the expanded view; selections of
  long-tail brands stay visible/persistent in the collapsed view. Canonical-brand merging unchanged.
- **FIX 4 — sort.** Explore sort options expanded to: Acuity Score (default, respects active
  weights), Craft & execution (`ent`), Knowledge value (`edu`), Cognitive load (`cog`), IMDb rating
  (`rating`, votes tiebreak), A–Z, Year. `sortList()` handles the new dimension/rating keys.
- **FIX 5 — filters.** Added per-dimension minimum sliders (Cognitive load / Knowledge value /
  Craft, 0–100) and IMDb controls (rating ≥ X 0–10 slider; minimum-votes select). All AND together
  with every existing filter, update the live result count, surface as removable active-filter pills,
  reset with "Reset filters", and read from URL params (`mincog/minedu/minent/minrating/minvotes/sort`).

Engineering: no inline `on*=`/`<script>` (all six pages load only `./app.js`); relative paths;
single `./data/catalog.json` source; `acuity_v1` localStorage namespace unchanged. `node --check
app.js` passes. Self-verified on `:8914` (all pages + data 200; server stopped after): poster card
shows the score once with a non-clipped tier chip; placard tiles are 2:3; picker shows the curated
list with a "+ 197 more services" expander; sort-by-Craft reorders the top of the list vs Acuity;
stacked dimension-min + IMDb rating/votes filters drop the count (e.g. cog≥70 → 4,844;
+edu≥60 → 4,265; +rating≥8 → 1,150; +votes≥100k → 429). Server stopped after verification.
