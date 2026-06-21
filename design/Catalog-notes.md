# Explore / Catalog redesign spec (from Catalog.dc.html)

Apply the **Acuity design system** from `design/Acuity.dc.html` (violet `#8a78ff`, `#0d0c12`
bg, Instrument Serif / Hanken Grotesk / IBM Plex Mono). Build the Explore page in that language
**while keeping every feature we already have** (feature-complete = the design's filters ∪ ours).

## Tier names + colors (adopt globally — from the design)
low→high, mapping data `tier` 0→4:
- 0 **Idle** `#c66a86`
- 1 **Ambient** `#6a6580`
- 2 **Engaging** `#6f63c4`
- 3 **Absorbing** `#8a78ff`
- 4 **Profound** `#b9acff`
(Replaces the old Idle/Passive/Engaging/Stimulating/Profound + clay/teal/champagne palette.)

## Layout
- Same nav as home (logo mark + "Acuity" + "AQ"; Catalog active/underlined).
- Header: eyebrow "The index" + serif H1 "Every title, on one scale."
- Body = two columns: a **sticky left sidebar (~248px)** of filters + a results section.

## Sidebar filters — design order, but feature-complete
Design shows: **Filters** label + "Clear all"; **Tier** chips (colored dot + name); **Type**
(Films/Series); **Audience** (Kids & family only); **Acuity score range** (two number inputs 0–200);
**My streaming services** (checkbox rows: box + name + count); **Genre** chips.
Keep ALSO (ours, styled to match), and make sections **collapsible**, sidebar **scrolls
independently** of the grid:
- **Weight your priorities** — Depth / Insight / Craft sliders (reweighting → personalized AQ).
- **Dimension minimums** — Depth / Insight / Craft min sliders.
- **Audience age** — NEW slider using `maxage` ("suitable for age ≤ N"); pairs with cert data.
- **IMDb** — rating ≥ and minimum votes.
- **Streaming** — official logos, brand variants merged, curated majors + a **"+ N more"**
  expander with search (don't dump all ~212).
Per the user: streaming should sit **higher** in the order than it does today.

## Results
- Search box (with our ranked/typo-tolerant autocomplete).
- Count ("N titles") + **Sort** dropdown: Highest/Lowest Acuity, A–Z, Newest, Oldest — plus
  OUR dimension sorts (Depth / Insight / Craft) and IMDb rating.
- Empty state: serif "Nothing matches." + clear-all CTA.
- Card grid `minmax(218px,1fr)`: 2:3 poster (real `p`, hatched fallback), **tier badge top-right**
  (tier color bg, dark text), **AQ bottom-left** over a bottom gradient in tier color + `/200`,
  title + `year · genres`. Hover lift `translateY(-5px)`. Whole card → `title.html?t=slug`.
  Keep clickable metadata (genre/year/type/tier → filtered Explore).

## Rules
Real data (`./data/catalog.json`, 15,883). No inline `on*=` handlers. Relative paths. Keep
localStorage persistence, URL-param filters, performance over 15,883 rows.
