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
