# Functional Requirements Specification — "Cognitive Value" TV/Film Rating Site

> Clean-room deliverable. This document describes FUNCTION and REQUIREMENTS only.
> It contains no verbatim copy, no reproduced assets, and no score values from any
> existing product. The implementation team computes its own scores and writes its
> own prose from the briefs below.

---

## 1. Product purpose & target user

**Purpose.** A static, catalog-style website that rates TV series and films on their
*cognitive value* — how mentally enriching a title is — rather than on popularity or
raw enjoyment. Each title receives an IQ-style overall number, several sub-dimension
scores, and a named quality tier, plus a short evidence-based rationale.

**Positioning / point of view.** An intentional, "anti-algorithm" stance: the site
exists to help people choose what to watch deliberately, as a counterweight to
autoplay/engagement-optimized recommendation feeds. It frames watching as a choice
with intellectual consequences.

**Target user.** Discerning viewers who want to spend limited screen time well:
lifelong learners, parents vetting kids' content, people curating a watchlist, and
readers who enjoy cultural/critical writing. Secondary: people who want to "audit"
their current watchlist and see its aggregate cognitive profile.

**Business model signals (idea-level, optional).** Newsletter/waitlist capture and a
"score my list" engagement hook are reasonable conversion mechanisms; implement only
if desired. They are not core to the rating product.

---

## 2. Information architecture — page types

### 2.1 Home / landing
- Hero region: a one-line value proposition (see Copywriter brief) + a short subtitle.
- Prominent instant-search entry point into the catalog.
- A "featured" set of cards (e.g., highest-scoring or editor picks) using the standard title card.
- A credibility / statistics band (catalog size, number of dimensions scored, etc.).
- One primary call-to-action (newsletter, waitlist, or "score my list"), non-blocking.
- Optional returning-visitor hook: "log what you watched this week" feeding the local tracker.
- Standard top nav + footer.

### 2.2 Catalog / Explore
- Full searchable, filterable, sortable index of all titles.
- Instant client-side text search (filters as you type, Escape clears).
- Facet filters (tier, genre, type, score range, streaming availability — see §4).
- Sort controls (at minimum: by overall score, and alphabetical).
- A live result count and an empty-state message when nothing matches.
- Rows/cards show: poster thumbnail, name, genre summary, overall score (color-coded to tier), tier chip.
- Clear separation (or filter) for kids/family titles vs. general titles.

### 2.3 Title detail
- Header with title, year, type, and the overall score shown as `score / max`.
- Tier badge (color-coded) + a one-line description of what that tier means.
- Dimension breakdown: a labeled bar per sub-dimension, each as `value / dimension-max`.
- A short original rationale paragraph explaining the score (factual/critical voice).
- Optional trailer embed (privacy-respecting, e.g. no-cookie YouTube).
- "Where to watch" block: stream/rent/buy provider chips sourced from a public
  availability provider (e.g. JustWatch/TMDB), with attribution and a "see all options" link.
- "Compare with" links to relevant head-to-head pages.
- "Similar / what to watch next" cards.
- Client-side controls to mark watched / add to watchlist (see §4).

### 2.4 Methodology / How we score
- Plain-language explanation of the scoring concept: what the overall number means,
  what each sub-dimension measures, and how tiers map to score ranges.
- Description of the data sources and that scores are computed by a defined, repeatable method.
- A short version (overview) and optionally a long/full version.
- This page is the credibility anchor and must be linked from nav, footer, and score displays.

### 2.5 Compare two titles
- Side-by-side layout of two titles' cards (poster, name, tier, overall score, rationale snippet).
- Visual highlight of the higher-scoring title ("winner").
- A one-line summary of the gap/relationship between them.
- A per-dimension comparison (each sub-dimension shown for both titles).
- Links back to each title's detail page; breadcrumb back to Explore/Compare index.
- A Compare index/hub listing available matchups.

### 2.6 Secondary pages (include as scope allows)
- **Tonight / "what to watch":** a single guided recommendation pick.
- **Kids:** filtered catalog of family/children's titles.
- **About:** mission, team, contact.
- **Quiz / personal score, Tracker/"My list", Wrapped/year-in-review:** optional engagement features built on the local tracker.
- **Genre / collection landing pages, Reviews/Guides/Blog:** editorial, optional.
- Standard legal pages (privacy, terms) and machine-readable SEO assets (sitemap, robots).

---

## 3. Data schema

Each title record needs (field names are illustrative — implementer chooses its own):

| Field | Type | Purpose |
|---|---|---|
| `name` | string | Display title |
| `year` | number | Release/first-air year |
| `type` | enum `film` \| `series` | Title kind |
| `genres` | string[] | One or more genre tags |
| `overall` | number | IQ-like overall cognitive-value score on a fixed scale |
| `dimCognitive` | number | Sub-score: cognitive stimulation / mental challenge |
| `dimEducational` | number | Sub-score: educational / knowledge value |
| `dimCraftEntertainment` | number | Sub-score: craft, execution & entertainment quality |
| `tier` | enum | Named tier label (see below) |
| `slug` | string | URL-safe identifier for the detail page route |
| `poster` | string (optional) | Poster image reference |
| `rationale` | string (optional) | Short prose explaining the score |
| `trailerId` | string (optional) | Video embed reference |
| `externalId` | string (optional) | ID into the availability/metadata provider |

**Scoring concept (describe, do not copy values):**
- **Overall score** — a single IQ-styled integer on a fixed maximum scale (an "IQ for
  the show"), higher = more cognitively valuable.
- **Sub-dimensions** — at least three independent component scores, each on its own
  fixed sub-scale: (1) cognitive stimulation, (2) educational value, (3) craft &
  entertainment quality. The overall score is a defined function of the components.
  *(The original additionally exposes a craft/quality split and a music/cinematic
  component; the implementer MAY add optional extra dimensions but must define its own.)*
- **Tiers** — a small ordered set of named, color-coded quality bands from low to high
  (the original uses five). The implementer must invent its OWN tier names, its OWN
  score thresholds, and its OWN color assignments. Tiers must be ordered, mutually
  exclusive, and consistently color-coded across all pages. A separate kids/family
  flag may coexist with the tier.

**Do NOT** transcribe the original's specific score numbers, tier names, or thresholds.
All numeric output comes from the implementer's independently-computed dataset.

---

## 4. Core UX flows

- **Instant search.** Client-side, substring match on title name, updates results and
  count live; Escape resets. No server round-trip.
- **Multi-facet filtering.** Combinable filters that AND together:
  - by **tier** (chip toggles),
  - by **genre** (multi-select),
  - by **type** (film vs. series),
  - by **score range** (min/max slider or bracket),
  - by **streaming availability** — user selects the services they subscribe to and the
    catalog narrows to titles available on those services (see §7a).
- **Sort.** At minimum overall-score (desc) and alphabetical; optionally year and per-dimension.
- **Client-side persistence.** "Mark watched" and "add to watchlist" persist in
  `localStorage` (single namespaced key, versioned, e.g. `app_tracker_v1`), no login
  required. State is reflected wherever a title appears and can power a personal
  tracker / year-in-review view. Provide graceful handling if storage is unavailable.
- **Score display contract.** Anywhere a score is shown it must combine: (a) the
  numeric overall (`score / max`), (b) a visual element (color-coded tier badge and/or
  a bar/gauge), and (c) on detail/compare, the three sub-dimension bars. Color is
  always tied to tier consistently.

---

## 5. Functional design language

Requirements-level only (functional parameters, not pixel reproduction):

- **Theme:** dark UI — near-black background, warm off-white text.
- **Type hierarchy:** a serif *display* face for headings/large numerals (editorial,
  intellectual feel) paired with a humanist *sans-serif* for body and UI. Provide
  utility classes to switch between them.
- **Color roles:** one warm accent color used consistently for the overall score, links,
  and primary CTAs. Each tier gets its own distinct, muted accent (e.g. a warm/copper top
  tier down through cool and neutral tones to a warning tone for the lowest tier). Neutral
  surface tones for cards/dividers using opacity layers over the background.
- **Spacing/layout:** centered max-width content column; responsive card grid; generous
  vertical rhythm; sticky translucent top nav with blur; mobile hamburger/overlay menu.
- **Component types required:**
  - Top navigation (logo lockup, primary links, "more" overflow menu, CTA button, mobile menu).
  - Hero (display headline + subtitle + search/CTA).
  - Stat/credibility band (numeric callouts with labels).
  - Title card (poster, name, genre summary, overall score, tier chip) — used in grids and lists.
  - Score badge / numeral (number + `/max`, colored by tier).
  - Tier chip (small colored label).
  - Dimension bars (labeled track + fill + value, one per sub-dimension; distinct fill color per dimension).
  - Compare card + "winner" emphasis state.
  - Provider/availability chips.
  - Footer (brand line, tagline slot, link groups, contact).
- **Accessibility:** visible focus outlines, semantic roles for search/combobox/options,
  `loading="lazy"` images, sufficient contrast, keyboard operability.

---

## 6. Copywriter brief (write ORIGINAL prose — do not reuse any existing wording)

**Voice:** confident, literate, lightly contrarian. It treats television and film as
worthy of serious evaluation and treats the reader as intelligent. It is the opposite
of hype-driven streaming marketing: calm, specific, evidence-minded, occasionally
wry, never clickbait.

**Slots to write:**
- *Hero headline:* one short line asserting that shows are scored for how much they
  enrich your mind (an "IQ for what you watch").
- *Hero subtitle:* one sentence positioning the site as a deliberate, anti-autoplay
  alternative to engagement-optimized feeds.
- *Tier descriptions:* one line per tier explaining what that band of cognitive value means.
- *Methodology copy:* clear, non-defensive explanation of the scoring method and sources.
- *Per-title rationales:* 2–4 sentence original critical notes citing concrete reasons
  (themes, structure, knowledge content, craft). Factual and specific; no purple prose.
- *Footer tagline, CTA labels, empty-state and microcopy:* concise and on-voice.

All copy must be independently authored. Do not paraphrase closely from any source text.

---

## 7. Improvements the implementer should add (beyond the original)

**(a) Genuinely better multi-facet filtering — including streaming availability.**
Make filters fully combinable (tier ∧ genre ∧ type ∧ score-range ∧ availability) with a
live count. Add a **streaming-service filter**: the user selects which services they
subscribe to (persisted locally), and the catalog hides titles not available on any
selected service. Source availability from a public provider feed and degrade gracefully
when data is missing.

**(b) A true normal / bell-curve score distribution.** The overall-score generator must
produce an approximately Gaussian distribution across the catalog (most titles near the
mean, thin tails), rather than clustering at the top. Document the target mean/spread in
the methodology and provide a histogram view to demonstrate it.

**(c) A visible methodology / credibility section.** Surface the methodology prominently
(nav, footer, and a link from every score display), explaining dimensions, tiers,
thresholds, sources, and update cadence in plain language.

**(d) Secure-by-default, single-source-of-truth static architecture.** One canonical data
file (e.g. `catalog.json`) drives every page via a build step — no duplicated/hand-edited
per-page numbers. Ship security headers (CSP, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`), restrict
embeds, mark operator/private routes `noindex` and gate them, and keep the public surface
fully static (no secrets in the client).

---

## Attestation

This is a **functional requirements specification**. It describes the product's function,
information architecture, data schema shape, UX flows, and idea-level design parameters so
that an independent clean-room team can build a comparable product. **No verbatim creative
expression, marketing copy, prose, taglines, headlines, asset, or score value was copied
from the original.** The original's specific score numbers, tier names, and tier thresholds
are treated as proprietary and were deliberately omitted; the implementer supplies its own
independently-computed scores, tier names, thresholds, and original copy.

Date: 2026-06-21
