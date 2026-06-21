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

## The clean-room separation, in practice (the legal core)
The defensibility rests on one fact: **the agent that wrote the shippable expression (code, copy,
design) never saw the original.** Two *separate* sub-agents, not one:

1. **Analyst (sub-agent A)** — given access to a local mirror of the original and asked to produce
   a *functional requirements specification* and nothing else. Output: `SPEC.md`. Explicitly
   instructed NOT to transcribe verbatim copy, prose, taglines, assets, or the original's score
   values / tier names / thresholds. It described *what the product does* (information
   architecture, data-schema shape, UX flows, idea-level design parameters) — the unprotectable
   layer (ideas, function, facts), not protected expression.

2. **Implementer (sub-agent B)** — a *different* agent, run as a separate process, with the
   original **explicitly off-limits** (the mirror directory and the live URL were named as
   forbidden in its instructions; it performed no read/fetch/search of them). It authored ALL code,
   copy, brand, tier names, colors, and design **solely from `SPEC.md` and our fact-derived
   dataset**. `SPEC.md` was the *only* channel between the two rooms.

Because A and B are distinct agent sessions, no memory of the original's expression could reach B
except through the functional spec — which by construction contains none. The orchestrator (main
session) coordinated and built the *data pipeline* (IMDb facts + our own `score.py`) but authored
no product expression; it handed B only the spec and the fact data.

## What is independent (not derived from the original)
- **Scores** — computed by our own `build/score.py` from IMDb facts (genre / rating / votes),
  mapped to our own distribution. No original score value was used.
- **Catalog** — sourced from **IMDb public datasets** (facts), independently selected and scored.
- **Brand, copy, tier names, colors, layout, code** — all original, authored by the clean-room
  implementer(s).
- **Posters** — hotlinked from TMDB (not copied/rehosted), with attribution; not the original's assets.

## Evidence / paper trail
- `SPEC.md` — the requirements artifact that crossed the wall (it contains function only).
- This file's dated, per-agent **attestations** (below) — Analyst, Implementer, and every
  subsequent pass, each affirming it did not access the original.
- Preserved sub-agent **transcripts** (the harness retains each agent's session log).
- The independent **data pipeline** (`build/score.py` + IMDb datasets) and distinct **brand** (Acuity).

> Subsequent passes (feature work + the visual redesign, logged below as v2–v10) all iterated on
> *our own* Acuity site under the same rule — the original stayed off-limits to every agent; the
> only inputs were our existing `dist/` files, our dataset, and the user's own design files.

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

### Implementer attestation (v5 — design implementation)
- **Role:** Implementer (clean room). **Date:** 2026-06-21.
- **Statement:** I had **no access to any reference product** — I did not read
  `/Users/bryanroscoe/Developer/tvintelligentsia`, did not fetch `tvintelligentsia.com`, and ran
  no web search for any competitor. I worked solely from the approved design mockup
  `design/Acuity.dc.html`, the existing `dist/` files, and our own `data/catalog.json` +
  `data/stats.json`.
- **What changed:**
  - **Global identity (`dist/styles.css`):** retuned `:root` to the Acuity violet system
    (accent `#8a78ff`, bg `#0d0c12`, surfaces `#15131d`/`#16141f`/`#1a1726`, hairline borders
    `rgba(190,180,235,…)`, text `#ece9f4`/`#f4f1fb`/muted greys). Swapped fonts to **Instrument
    Serif** (display + wordmark), **Hanken Grotesk** (body/UI), **IBM Plex Mono** (numbers/
    eyebrows/labels). Added the grain overlay (`.acu-grain`) and keyframes `acuGrain`/`acuPulse`/
    `acuUp`/`acuDown`; remapped the five tier colors onto a violet scale (rose floor); added home
    component classes (`.acu-nav/.acu-tile/.acu-res/.acu-chip/.acu-feat/.acu-bar/.acu-legend/
    .acu-swap`). Every page inherits the new theme through the shared stylesheet.
  - **Terminology (whole site):** "Acuity Score"/"AS" → **"Acuity Quotient"/"AQ"** (cards, detail,
    sorts, filters, methodology, compare, brand glyph); dimensions relabeled **Depth/Insight/Craft**
    (data fields `cog/edu/ent` and the `/200` scale unchanged). Tier names kept (Idle · Passive ·
    Engaging · Stimulating · Profound).
  - **Home (`dist/index.html` rebuilt + `initHome` in `dist/app.js`):** faithful static port of the
    DSL mockup — sticky blurred nav with the network logo mark; hero with a 6-column real-poster
    marquee (TMDB `w154`, hatched fallback), gradient masks, eyebrow/headline/subtitle copy, a live
    autocomplete search dropdown (AQ in tier color, click → `title.html?t=slug`, typing focuses the
    instrument), two CTAs and the real `15,883 titles scored · Method v2.0 · No studio money` line;
    the **Acuity Instrument** focus card (poster, AQ in tier color, tier chip, AQ bar, Depth/Insight/
    Craft bars, clickable genre chips); **Top of the curve** featured grid (real top 6, rank/tier
    badge/AQ/mini-bars, hover lift); **Methodology** lens cards + "Calibrated, not published" callout
    + flat-curve histogram drawn from `stats.json` (183 bars colored by tier, hover tooltip, 0–200
    axis) + interactive tier legend + real "titles plotted" (15,883) / "out in the tails" (25%);
    **Compare** head-to-head with DELTA and real swap-right options; **Stats** band (15,883 / 3 / 9 /
    100%). The internal "naming study" section was **omitted** as instructed.
  - **Other pages:** updated `explore/methodology/compare/title/kids` font links, brand glyph (AQ),
    AQ terminology, and Depth/Insight/Craft labels (sort options, weight + dimension-minimum rows,
    methodology lens cards) so they adopt the new identity and keep working.
- **Engineering:** no inline `<script>` or `on*=` handlers (all listeners via `addEventListener`;
  grain overlay injected from JS); relative paths; single `./data/catalog.json` source; `acuity_v1`
  localStorage namespace with graceful degradation unchanged.
- **Self-verify:** `node --check app.js` passes; served on `:8915` — all six pages + both data files
  return **200** (server stopped after). `grep` confirms **zero** inline `on*=` handlers and that
  "Acuity Score"/"AS"/Fraunces no longer appear; "Acuity Quotient"/"AQ" and "Depth/Insight/Craft"
  are present. Data-path numerics validated against the real JSON (15,883 titles, 25% tail, 183
  histogram bars max-count 244, top title Schindler's List AQ 200, search/compare/genre wiring).

### Implementer attestation (v6 — Explore redesign)
**Date:** 2026-06-21

I confirm I had **no access to any reference product**: I did not read the
`/Users/bryanroscoe/Developer/tvintelligentsia` repo, did not fetch
`tvintelligentsia.com`, and did not web-search for any reference product. Work was done
solely from `design/Catalog-notes.md`, `design/Acuity.dc.html`, the existing `dist/`, and
`dist/data/*.json` (catalog/providers/stats) plus the `build/` pipeline source.

**Changes made:**
- **Tier rename/recolor (global):** the five tiers are now **Idle / Ambient / Engaging /
  Absorbing / Profound** (data tier 0→4). Renamed `Passive`→`Ambient` and
  `Stimulating`→`Absorbing` in the `TIERS` map in `app.js` (single source of truth — every
  page, card, badge, methodology legend/table, filter chip, and home instrument reads from
  it). CSS tier colors `--t0..--t4` already matched the design ramp
  (`#c66a86 #6a6580 #6f63c4 #8a78ff #b9acff`); updated their comments to the new names.
- **Data:** merged the `maxage` field (from MPAA/TV `cert`, via `build/catalog.json`) into
  `dist/data/catalog.json`, keyed by IMDb id; 12,181 of 15,883 titles carry an age. Used by
  the new Audience-age slider.
- **`explore.html` rebuilt in the design language, feature-complete.** Sidebar (≈248px,
  sticky, scrolls independently) is now a stack of **collapsible** groups with a "Filters /
  Clear all" header, **streaming placed high**. Order: Tier · Type · Audience (Kids & family) ·
  **My streaming services** (official logos, brand variants merged, majors + "+ N more"
  search expander) · **Audience age** (NEW `maxage` slider, "suitable for age ≤ N", hides
  higher/unknown) · Weight your priorities (Depth/Insight/Craft) · Dimension minimums ·
  Acuity score range (0–200) · IMDb (rating ≥ / min votes) · Genre. Results header keeps the
  ranked/typo-tolerant autocomplete + live count, and the **Sort** dropdown now offers
  Highest Acuity, Lowest Acuity, A–Z, Newest, Oldest, Depth, Insight, Craft, IMDb rating.
  Empty state reads "Nothing matches."
- **`app.js`:** added `maxAge` to state + `age` URL param, the age filter in `apply()`, slider
  wiring/sync/active-pill/reset, `year-asc` (Oldest) sort, and generic collapsible-group
  behaviour (click + keyboard, ignores inner buttons). All listeners via `addEventListener`.
- **`styles.css`:** filters header + collapsible chevron styles, independent-scroll sidebar,
  age-slider row; card refinements to match the spec — grid `minmax(218px,1fr)`, hover lift
  `translateY(-5px)`, **tier badge top-right** (tier-color bg, dark text), type tag top-left,
  AQ bottom-left over a tier-tinted bottom gradient.

**Self-verification:** `node --check app.js` passes; served on `:8916` — all six pages +
`data/catalog.json` return **200** (server stopped). Zero inline `<script>`/`on*=` handlers.
`explore.html?genre=Drama&tier=4` → 1,664 titles; the age slider changes the count
(15,883 → 3,113 at ≤8 → 5,432 at ≤13); sort-by-Craft reorders vs. AQ; a provider logo URL is
referenced (261 brands carry tmdb logos). "Ambient"/"Absorbing" present; "Passive"/"Stimulating"
gone from app.js.

### Implementer attestation (v7 — polish: cards/percentile/title page/methodology)

**Date:** 2026-06-21. **Clean-room confirmed:** I did not read `tvintelligentsia/`, did not
fetch `tvintelligentsia.com`, and ran no web searches for any reference product. Work drew
only on `dist/`, the `design/` files, and `dist/data/`.

**Changes**
- **FIX 1 — card badge layout (no clip, baseline-aligned).** `titleCard` (`app.js`) now puts
  the AQ score (`/200`) bottom-LEFT and the tier badge bottom-RIGHT in one absolutely-positioned
  `.tile-foot` flex row (`space-between`, padded 11–12px) over the poster's bottom gradient, on
  both real-poster and hatched-placard cards. The tier chip moved off the top-right corner; it
  carries `max-width:62%` + ellipsis so it can never overflow/clip. The placard fallback now
  shows the title in faint mono (poster-style) instead of a giant number. The home "top of the
  curve" grid (`buildFeatured`) got the same bottom-overlay treatment (rank top-left; AQ + tier
  on one baseline over a bottom gradient). `styles.css`: new `.tile-foot`, reworked
  `.tile .tile-score-badge` / `.tile .tier-chip` (static in the foot), `.tile-placard`,
  `.tile-grad` now applied to both card types.
- **FIX 2 — percentile (`pct`).** New `pctTag()` / `pctPhrase()` / `ordinal()` helpers. Cards
  show a small mono `.pct-tag` in the card foot — "Top {100−pct}%" when pct ≥ 90 (clamped so the
  max reads "Top 1%"), otherwise "{n}th pct". Home featured cards append it to the meta line.
  Detail page surfaces "In the top X% of the catalog" / "Scores better than X% of the catalog".
- **FIX 3 — title detail page.** `renderTitle` gained the `cert` content-rating badge in the
  meta row, plus an `.aq-strip` (percentile phrase + tier-colored AQ bar on the 0–200 scale).
  The page already carried serif title, clickable year/type/genre links, big AQ + tier chip,
  Depth/Insight/Craft bars, rationale, watch/watchlist actions, provider chips with logos, and a
  similar-titles row — all retained, now in the violet language. `styles.css`: `.age-badge`,
  `.aq-strip` family. Fixed the broken Google-Fonts `<link>` on `title.html` (and `explore.html`
  / `methodology.html`) so Instrument Serif / Hanken / IBM Plex Mono actually load.
- **FIX 4 — methodology copy.** Removed "A true bell curve" and all "flat curve" language
  (also on `index.html`). Reframed as a single, bell-shaped but deliberately flattened hump,
  flatter-than-normal with real weight pushed into the tails; numbers (median 100, sd≈37) read
  from `stats.json` via `data-stat`. Histogram aria-label updated to match. Tier table reads
  the new tier names/colors and current `tier_counts`.

**Self-verification**
- `node --check app.js` passes. No inline `<script>` and no inline `on*=` handlers in any HTML
  (grep clean). Relative paths and the single `./data/catalog.json` source unchanged.
- Served on `:8917`: index, explore, title, `title.html?t=schindlers-list-1993`, methodology,
  kids, compare, and all three data files + app.js/styles.css return **200** (server stopped).
- **Badge geometry, headless Chrome** (rendered a real-poster card and a hatched placeholder,
  measured `getBoundingClientRect`): on both, the tier chip is fully inside the tile (right edge
  12px clear of the card edge, `chipFullyInside=true`) and shares the AQ badge's baseline exactly
  (`badgeBottom == chipBottom`, baseline delta **0.00px**). A 2× screenshot confirms "195 /200"
  + "Profound" and "78 /200" + "Ambient" sitting on one line, neither clipped.
- Detail screenshot confirms poster, AQ tile, "R" cert badge, "In the top 1% of the catalog",
  full AQ bar, the three lenses, rationale, Netflix where-to-watch chip, and similar titles.
- Methodology renders sd **37** and the five-row tier table; grep confirms no "flat curve" /
  "true bell curve" remains anywhere.

### Implementer attestation (v8 — unify card, remove LIVE/compare, search thumbnails)

Date: 2026-06-21. I confirm no reference-product access during this work: I did not read
`/Users/bryanroscoe/Developer/tvintelligentsia`, did not fetch `tvintelligentsia.com`, and ran no
web search for any reference product. All work was done solely from `dist/` and the local dataset
(`./data/catalog.json`, 15,883 rows).

Changes:
- **ONE canonical title card.** Rewrote `titleCard(rec, opts)` in `app.js` into the single approved
  "top of the curve" layout and used it on every grid: home top-of-curve (`buildFeatured` now just
  calls `titleCard(rec, {rank:i+1})`), the Explore/catalog grid, the Kids grid, and the "similar
  titles" row. Layout: surface `#15131d`, 1px border `rgba(190,180,235,0.09)`, radius 13px, padding
  13px, hover `translateY(-5px)` + border `rgba(138,120,255,0.45)` over `.22s`; the whole card is an
  `<a>` to `title.html?t=<slug>`. Poster `aspect-ratio:2/3`, radius 9px, real cover (`w342`, lazy) or
  hatched violet placard with faint mono title. Tier badge top-right ON the poster (tier-color bg,
  `#0d0c12` text, mono ~9px uppercase, inset 9px, `max-width`+ellipsis guard — fully inside). Rank
  pill top-left ON the poster, home top-of-curve only. Below the poster: title (Hanken Grotesk 600
  ~15.5px `#f4f1fb`) + `YEAR · TYPE` meta (mono) + percentile tag on the left, big tier-colored AQ
  number (mono 600 ~30px, line-height 0.8, no `/200`) on the right. Bottom: three thin Depth/Insight/
  Craft mini-bars (`flex:1; height:3px`, track `rgba(190,180,235,0.10)`, fill `var(--acc)`). Removed
  the old bottom-overlay AQ treatment. Added `.tcard*` rules to `styles.css`.
- **Removed the "LIVE" notifier** — deleted the pulsing dot + "LIVE" text in the home Acuity
  Instrument panel header (`index.html`); the panel itself is unchanged.
- **Search dropdown thumbnails** — both instant-search dropdowns now show a mini 2:3 rounded poster
  per row: Explore via the shared `attachAutocomplete` (already had `.ac-thumb` `w92`), and the home
  hero search via a new `.acu-res-thumb` (`w92`, ~30px) with hatched fallback; AQ (tier color),
  title and `year · type · tier` and keyboard nav/click→`title.html?t=slug` retained.
- **Removed the Compare feature entirely** — deleted `dist/compare.html`; removed the Compare nav
  links + "Compare titles"/"Compare two titles" CTAs from every page's nav/footer/hero (replaced with
  Kids / Browse / How-scoring links); removed the home `#compare` head-to-head section; removed the
  title-detail "Compare ↔" action; deleted the dead JS (`buildCompare`, `initCompare`, `escapeHtml`,
  the `compare` boot dispatch). No `compare.html`/`#compare`/`data-cmp` references remain.

Self-verification (served on :8918, then stopped):
- All remaining pages return 200 (index, explore, kids, methodology, title); `compare.html` → 404;
  `data/catalog.json` → 200.
- Headless Chrome (`getBoundingClientRect`) on a catalog card and a home card:
  `badgeFullyInside=true` and `badgeTopRight=true` (tier badge fully inside the poster, top-right,
  not clipped) on BOTH; `aqBelowPoster=true` and `aqOnRight=true` (AQ number sits below the poster on
  the right); `hasPct=true` and `barCount=3` (percentile tag + three dimension bars present);
  `sameCardClass=true` (both grids render the identical `.tcard` component); the home card has the
  rank pill, the catalog card does not.
- Search dropdowns: Explore dropdown and home hero dropdown each rendered rows that all contain an
  `<img>` thumbnail (`exploreDropdownImgs == rows`, `heroDropdownImgs == rows`).
- `node --check app.js` passes; grep shows no `compare.html` references and no inline `on*=` handlers;
  no "LIVE" text remains; the only `<script>` tags are `src="./app.js"`.

### Implementer attestation (v9 — filters basic/advanced + tier histogram)

Date: 2026-06-21. I confirm no reference-product access during this work: I did not read
`/Users/bryanroscoe/Developer/tvintelligentsia`, did not fetch `tvintelligentsia.com`, and ran no
web search for any reference product. All work was done solely from the existing `dist/` files,
the `design/` mockups, and the local dataset (`./data/catalog.json`, `./data/stats.json`).

Changes:
- **TASK 1 — Explore sidebar split into Basic / Advanced (much tighter).** `explore.html` sidebar
  reordered into a lean Basic set shown by default — **Tier · Type · Genre** (moved high) · **My
  streaming services** · a single **"Kids & family only"** toggle — and everything else moved
  behind an **"Advanced filters"** disclosure (collapsed by default, one click reveals): **Acuity
  score range · Audience age · Weight your priorities · Dimension minimums · IMDb**. The streaming
  helper paragraph was cut to the one-liner "Pick yours; we hide the rest."; the verbose age /
  dimension-minimums / weights helper paragraphs were removed. The Kids toggle is now a bare,
  full-width chip (no heading). Each section remains a compact collapsible group with a chevron;
  the sidebar stays sticky + independently scrollable.
- **`app.js`:** added the Advanced disclosure wiring (`#advToggle`/`#advWrap`, toggles `hidden` +
  `aria-expanded`, all via `addEventListener`); the panel auto-opens when an advanced filter is
  already active (URL params like `?age=` / `?mincog=` or persisted weights) via a new `advActive()`
  check. No filter behavior changed — every filter, URL param, live count, clear-all, persistence,
  and the streaming logos / merged variants / "+ N more" expander still work.
- **`styles.css`:** tightened vertical rhythm throughout the filters (`.filter-block` padding
  16→10px, h3 margin 12→8px, `.chips` gap 7→6px, `.chip` padding 6/11→4/10px, `.filter-hint`
  smaller/tighter, `.svc-list` max-height 220→178px, `.svc-opt` padding 6→4px, `.dimmin-row`
  margin 14→10px); added `.kids-block`/`.kids-chip` and the `.adv-toggle`/`.adv-wrap` styles.
- **TASK 2 — Methodology histogram colored by tier + tier legend.** `drawHistogram` now colors
  every bar by the tier its Acuity Quotient falls into (`class="bar t<tier>"` + inline
  `fill: var(--t<tier>)`, the five tier colors `#c66a86 #6a6580 #6f63c4 #8a78ff #b9acff`), so the
  five bands are visible across the 4–200 range. Added an interactive **tier legend/key**
  (`[data-hist-legend]` in `methodology.html`): five pills with color swatch + name + AQ range;
  clicking a tier isolates its bars (`.hist.has-active` dims the rest, `.lit` keeps the active
  band) and click-again clears. The hover tooltip (now AQ + tier name + count) and the mean line
  are retained; numbers still come from `stats.json`.

Engineering: no inline `<script>` / no inline `on*=` handlers (matches in grep are
`content=`/`controls=` substrings, not events); relative paths; single `./data/catalog.json`
source; `acuity_v1` localStorage namespace with graceful degradation unchanged.

Self-verification (served on :8919, then stopped):
- `node --check app.js` passes; `explore.html`, `methodology.html`, `app.js`, `data/catalog.json`
  all return 200.
- Headless Chrome (`--dump-dom`) on Explore: Basic sidebar renders **Tier · Type · Genre · My
  streaming services** headings (+ the bare Kids chip) only; the `adv-wrap` is `hidden` and the
  `adv-toggle` is `aria-expanded="false"` by default; streaming helper text reads "Pick yours; we
  hide the rest."; `?genre=Drama&tier=4` → **2,249** titles and `?tier=4` → **2,740** (filters
  change the count); `?age=8` reveals the Advanced panel (`adv-wrap` no longer `hidden`).
- Headless Chrome on Methodology: histogram bars carry per-tier classes and inline tier fills
  spread across all five bands (66/15/30/15/71 bars for tiers 0–4); legend renders all five tiers
  (Idle/Ambient/Engaging/Absorbing/Profound) with AQ ranges; mean line present; tooltips read
  "Acuity Quotient N · <Tier>: M titles". Screenshots confirm the rose→slate→violet→champagne
  tier banding and the legend.
- Data note: this catalog.json build carries no `svc` / `maxage` fields, so the streaming and
  audience-age filters have no data to act on (they render and apply correctly but match nothing);
  this is a pre-existing dataset state, not a regression from this pass.

### Implementer attestation (v10 — TMDB/IMDb attribution)
**Date:** 2026-06-21

I confirm that this pass was performed entirely clean-room: I did not read the
`tvintelligentsia` reference repo, did not fetch `tvintelligentsia.com`, and ran no web
search for any reference product. Work was done solely from `dist/` and the design language
already present in the codebase.

**Why:** the site hotlinks movie/series posters from `image.tmdb.org` and is built on facts
from IMDb's public datasets; both require attribution. Images remain hotlinks (not downloaded
or rehosted).

**Changes:**
- `dist/app.js` — added `injectAttribution()`, a single-source-of-truth helper that appends a
  consistent data-credit block into whichever `<footer>` each page already has, wired into the
  `DOMContentLoaded` boot right after `initNav()`. Text-only (no external logo, since the page
  CSP `img-src 'self' data:` disallows one). The two credit lines:
  - "This product uses the TMDB API but is not endorsed or certified by TMDB." (verbatim TMDB
    wording; "TMDB" links to https://www.themoviedb.org/).
  - "Title data from IMDb. For non-commercial use." ("IMDb" links to
    https://www.imdb.com/interfaces/).
- `dist/styles.css` — added `.attrib-credit` / `.attrib-inner` / `.attrib-line` / `.attrib-link`
  rules in the muted IBM Plex Mono footer idiom, aligned to `--maxw`.
- `dist/methodology.html` — added a "Sources & credits" prose block near the bottom (original
  prose) restating the IMDb public-dataset metadata source, that posters are served by TMDB and
  not downloaded, and the verbatim TMDB-not-endorsed line.

**Self-verification:** `node --check dist/app.js` passes; no inline `<script>` bodies and no
inline `on*=` handlers; served on :8920 — index, explore, title.html?t=schindlers-list-1993,
methodology, and kids all return 200; every page carries a single `<footer>` target plus
`app.js`, so the injected TMDB+IMDb credit lines render on all five; methodology contains the
Sources & credits block and the verbatim TMDB line. Posters remain `image.tmdb.org` hotlinks.
Server stopped after checks.

### Implementer attestation (v11 — favicon + title poster fix)

Date: 2026-06-21. I confirm no reference-product access: I did not read
`/Users/bryanroscoe/Developer/tvintelligentsia`, did not fetch `tvintelligentsia.com`,
and ran no web search for any reference product. Work was done solely from `dist/`.

Changes:
- FIX 1 (favicon): Added `<link rel="icon" type="image/svg+xml" href="./favicon.svg">`
  to the `<head>` of all five pages (index.html, explore.html, title.html,
  methodology.html, kids.html), referencing the existing Acuity logo mark at
  `dist/favicon.svg` via a relative path. No stale favicon tags existed to remove.
- FIX 2 (title poster cropped/zoomed): The `.detail-poster` img carried HTML
  `height="750"` (a presentational hint) that overrode `aspect-ratio: 2/3`, making the
  box 320×750 (taller than 2:3) so `object-fit: cover` zoomed and cropped the poster
  sides. Fixed in `styles.css` `.detail-poster`: added `max-width: 340px; height: auto;
  align-self: start; display: block;` so the height-hint is overridden and the box
  resolves to a true 2:3 at ~320px wide, top-aligned in the column (not stretched to the
  text column height). Kept `object-fit: cover` (TMDB w500 posters are 2:3). Poster
  remains a `image.tmdb.org/t/p/w500` hotlink with the hatched fallback when `p` is null;
  responsive stacking unchanged (grid collapses to 1 column ≤820px). CSS-only fix;
  app.js untouched.

Self-verify: served `dist/` on :8921; all five pages + `favicon.svg` returned 200; every
page references `./favicon.svg`. Rendered `title.html?t=schindlers-list-1993` in headless
Chrome at 1400×1000 — before the fix the poster showed a zoomed, side-cropped hand; after
the fix the full "Schindler's List" artwork displays at 2:3 (title text at top, complete
composition, no crop or distortion), top-aligned with the score box below. `node --check
app.js` passes; no inline `<script>`/`on*=` handlers. Server stopped after checks.

### Implementer attestation (v12 — reception scores UI + methodology + OMDb attribution)

Date: 2026-06-21. I confirm no reference-product access: I did not read
`/Users/bryanroscoe/Developer/tvintelligentsia`, did not fetch `tvintelligentsia.com`,
and ran no web search for any reference product. Work was done solely from `dist/`.

Changes:
- TASK 1 (Reception block on title.html): Added a `receptionBlock(rec)` helper in
  `dist/app.js` and wired it into `renderTitle()` between the Depth/Insight/Craft
  dimension bars and the "Why this score" rationale, so it reads as part of the score
  story. It renders an "Reception — folded into the AQ" header plus mono-number cells:
  an always-present Audience cell (IMDb `rating` as "9.0 /10"), and Critic cells for
  Metacritic (`mc` as "95 /100") and Rotten Tomatoes (`rt` as "98 %") when present. When
  both `mc` and `rt` are null it shows a subtle "No critic score yet." The existing AQ
  number, tier, percentile, dimension bars, rationale, actions, and where-to-watch are
  untouched. Added matching CSS (`.reception`, `.rc-cell`, `.rc-label`, `.rc-val`,
  `.rc-unit`, `.rc-src`, `.rc-empty`, etc.) in `dist/styles.css` using the Acuity idiom:
  IBM Plex Mono numerals, muted uppercase labels, hairline `--surface`/`--line` cards.
- TASK 2 (methodology copy): In `dist/methodology.html` reframed the lede and the
  "One scale, three dimensions" intro so cognitive value is the core, then added a new
  "Three inputs, one number" section explaining the AQ is a blend of (1) cognitive value
  across Depth/Insight/Craft, (2) audience reception (IMDb users), and (3) critic
  reception (Metacritic / Rotten Tomatoes), combined onto the 0–200 flattened scale.
  Noted critic coverage is strongest for popular titles and that others lean on cognitive
  + audience. Kept the verbatim "flatter than a normal distribution" framing and the
  tier-colored histogram. Updated "Where the facts come from" and "Sources & credits" to
  credit OMDb / Metacritic / Rotten Tomatoes.
- TASK 3 (attribution): Extended `injectAttribution()` in `dist/app.js` with a third
  footer line — "Reception scores via OMDb (Metacritic, Rotten Tomatoes, IMDb)." with an
  OMDb link — so it renders on every page from the shared helper.

Self-verification: `node --check dist/app.js` passes; no inline `<script>` bodies and no
inline `on*=` handlers in any HTML; served `dist/` on :8922 (all five pages 200). Headless
Chrome rendered `title.html?t=schindlers-list-1993` → Reception shows "Audience 9.0 /10
IMDb · Critic 95 /100 Metacritic · Critic 98 % Rotten Tomatoes"; `title.html?t=cosmos-1980`
(no critic) → "Audience 9.3 /10 IMDb · No critic score yet." Methodology renders the
"Three inputs, one number" section (audience + critic) with the flattened-curve framing
and histogram intact. Footer on title and methodology pages shows "Reception scores via
OMDb (Metacritic, Rotten Tomatoes, IMDb)." Server stopped after checks.

### Implementer attestation (v13 — Title + Catalog designs)

Date: 2026-06-21. These two visual designs are the user's OWN mockups (`Title.dc.html`
and `Catalog.dc.html`, in the user's private design project). No competitor or third-party
property was accessed; the work re-skins our existing pages in our own established Acuity
design language (violet `#8a78ff`, `#0d0c12`, Instrument Serif / Hanken Grotesk / IBM Plex
Mono) and wires the designs to OUR real `dist/data/catalog.json` (15,883 titles) and
`providers.json` — the mock catalog/scoring data embedded in the design files was ignored.

TASK A — Title page (`dist/title.html` → `renderTitle()` in `dist/app.js`, CSS in
`dist/styles.css`):
- Replaced the old breadcrumb/two-column layout with the new design: a back-to-catalog
  link; a hero (sticky ~286px 2:3 poster left; right = chips row [kind · year · cert ·
  ★IMDb·votes in gold], 54px serif title, clickable genres → filtered Explore, the big
  AQ card [76px AQ in tier color, /200, tier chip-link, AQ bar, tier blurb], plus the
  preserved mark-watched / add-to-watchlist controls and Where-to-watch logo chips).
- Preserved: AQ is displayed as-is (already blends cognitive + audience + critic — never
  recomputed); Reception block (Audience IMDb + Critic Metacritic/RT, else "No critic
  score yet"); percentile "In the top X%"; content-rating `cert` chip; streaming with real
  provider logos; watched/watchlist (localStorage `acuity_v1`); attribution footer.
- Added the design's "The breakdown — Three lenses, scored" (Depth/Insight/Craft rows),
  "The rationale — Why this score" + a "How this was scored" sidecard (→ methodology), and
  the "In the same vein" related grid (same primary genre, nearest AQ) using the new card.

TASK B — Catalog page (`dist/explore.html` + `initExplore()` in `dist/app.js` + CSS):
- Rebuilt the sidebar in the design order: Weight-your-priorities reweighting panel pinned
  at TOP (toggle + Depth/Insight/Craft sliders, live re-rank on `cog/edu/ent`), then Tier,
  Type, Audience (Kids & family), Audience age as a SELECT (any / 6 / 8 / 10 / 13 / 16 via
  `maxage`), My streaming services (OUR merged logo list + "+N more" expander, kept), then
  Dimension minimums as SELECTs (Depth/Insight/Craft, any/40+/60+/80+), Acuity score range,
  IMDb (rating SELECT + minimum-vote chip bands), and Genre with a search box.
- Added the mobile filter DRAWER (≤900px): the sidebar becomes an off-canvas drawer with a
  dimming scrim, a sticky "Filters" header with a close ✕, a sticky bottom "Show N titles"
  button, and a "Filters" trigger button (with an active-count badge) above the results;
  body scroll locks while open; ✕ / scrim / Show-N / Esc all close it.
- New card (`posterCard()`, replaces the prior "AQ-below-the-poster" card on Catalog and on
  the Title "In the same vein" grid): 2:3 poster, tier badge top-right, AQ + /200 bottom-
  left over a bottom gradient, ★IMDb (gold) bottom-right, title + `year · genres` below.
  Home and Kids keep the existing `titleCard` so the home design is not regressed.
- Kept: ranked/typo-tolerant autocomplete, clickable metadata, URL-param filters,
  localStorage service/weight persistence, "re-ranked to your priorities" tag, all sorts
  (Highest/Lowest Acuity, A–Z, Newest, Oldest, Depth, Insight, Craft, IMDb), performance
  over 15,883 rows. Compare was NOT re-added (the mocks still reference it; intentionally
  omitted). No inline `<script>` bodies, no inline `on*=` handlers, relative paths only.

Self-verification: `node --check dist/app.js` passes; no real inline `on*=` handlers and no
inline `<script>` bodies in the HTML; no Compare links. Served `dist/` on :8923 and rendered
with headless Chrome 149. `title.html?t=schindlers-list-1993` → new hero with chips row,
54px title, AQ card showing "200 /200 AQ", tier chip "Profound", "In the top 1% of the
catalog", animated AQ bar + tier blurb; Reception shows Audience 9.0 IMDb · Critic 95
Metacritic · Critic 98% Rotten Tomatoes; "The breakdown" with three lenses; rationale +
"How this was scored" sidecard; "In the same vein" grid of poster cards. `explore.html`
sidebar order verified as Priorities → Tier → Type → Audience → Audience age (select) →
Streaming (logos) → Dimension minimums (selects) → Acuity range → IMDb (rating select +
vote chip bands) → Genre (search box); result count "15,883 titles"; first card = Breaking
Bad (AQ 200, tier badge "Profound", ★9.5). Drove the drawer via CDP at 600px: opens
(transform→0, scrim visible, body locked, "Show 15,883 titles"), closes via ✕ / scrim /
Show-N; applying Tier + IMDb 8.0 + 10k+ votes set the trigger badge to "3" and filtered to
1,113 titles; A–Z sort reordered to "'Allo 'Allo!"; enabling priorities showed the
"★ re-ranked to your priorities" tag. Server stopped after checks.

### Implementer attestation (v14 — motion / entrance animations)

Date: 2026-06-21. I confirm I did not access the reference product (no read of
`/Users/bryanroscoe/Developer/tvintelligentsia`, no fetch, no web search for it); all work was
done solely from `dist/`.

Added a tasteful entrance/motion layer to the existing static design:

- **Reusable entrance mechanism (DRY).** New CSS `.acu-motion .acu-anim` (start: `opacity:0`,
  `translateY(16px) scale(0.985)`) → `.is-in` (natural position), eased with
  `cubic-bezier(0.22,1,0.36,1)` over 0.6s with a per-element `--d` stagger delay. In `app.js` a
  single `IntersectionObserver` (`animObserver`) adds `.is-in` when an element enters view
  (above-the-fold marks fire immediately); helpers `animate()` / `animateStagger()` / `initMotion()`
  wire it once in the boot sequence. After the transition the helper classes are stripped on
  `transitionend` so card hover transitions are unaffected. `<html>` is flagged `.acu-motion` by JS
  so the page stays fully visible with no JS; a 1.6s failsafe reveals anything an observer missed.
- **Where it animates.** Home: hero eyebrow→headline→subtitle→search→CTAs (stagger), the Acuity
  Instrument panel, the curve heading, the three methodology cards (stagger), the calibrated box,
  distribution header, curve card, and the stat band — plus the top-of-the-curve cards staggered as
  they enter view. Catalog: header + result cards (new cards stagger in; on "Show more" only the new
  batch animates; capped for perf). Title: poster + hero column, AQ card, reception, breakdown,
  rationale, related cards (stagger). Kids & Methodology: their hero/main blocks and grids.
- **Marquee + pulse.** Confirmed the six hero poster columns scroll continuously and loop seamlessly
  (`acuUp`/`acuDown` on duplicated content) and the accent pulse dot (`acuPulse`, now classed
  `.acu-pulse`) animates.
- **Title AQ reveal.** On render the big AQ number counts up 0→value (ease-out cubic, ~0.72s) and the
  AQ bar fills from 0; the three dimension bars fill from 0 (existing CSS width transition). Once per
  load.
- **Reduced motion.** `@media (prefers-reduced-motion: reduce)` forces `.acu-anim` to its final state
  (no transform/transition) and disables the marquee and pulse; `countUp()` writes the final number
  immediately.

Engineering: no inline `<script>` bodies, no inline `on*=` handlers (observer/listeners only),
relative paths preserved; the mobile filter drawer was deliberately left un-animated so the
off-canvas `translateX` transform is never overridden; data rendering, filters, search, sort, and
the drawer are unchanged.

Self-verification: `node --check dist/app.js` passes; `grep` finds no inline `on*=` handlers or
inline `<script>` bodies. Served `dist/` on :8924 and drove headless Chrome 149 over the DevTools
Protocol (Node global WebSocket). Home: `.acu-motion` applied to `<html>`, 22 `.acu-anim` marks; a
below-the-fold block started hidden (`opacity:0`, no `.is-in`, `transition: opacity, transform`)
while the hero revealed to `opacity:1`; the marquee column transform advanced between samples
(`matrix(... -24.5)` → `-26.4`); pulse `animation-name: acuPulse`; 6 featured cards present. Title
(`schindlers-list-1993`): AQ number sampled mid-flight at "65" then settled to "200"; the AQ bar
fill measured 0px → 302 → 488 → 573 → 616 → 657px across a sample burst (smooth ease-out); dim bar
filled; 5 related cards. With `prefers-reduced-motion: reduce` emulated: home hero `opacity:1`,
`transform:none`, marquee `animation-name:none`; title AQ rendered "200" immediately. Server and
Chrome stopped after checks.
