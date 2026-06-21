# catalog.json — data schema (for the implementer)

`data/catalog.json` is an array of title records, sorted by `iq` descending. Fields:

| field | type | meaning |
|---|---|---|
| `n` | string | title name (fact, from IMDb) |
| `year` | int | release/first-air year |
| `type` | "film" \| "series" | |
| `g` | string[] | genres (facts) |
| `iq` | int | OUR overall score — Normal(100, 15), an exact bell curve |
| `cog` | int 0–100 | cognitive-stimulation sub-score (percentile) |
| `edu` | int 0–100 | educational-value sub-score (percentile) |
| `ent` | int 0–100 | entertainment/craft sub-score (percentile) |
| `tier` | int 0–4 | tier band by IQ std-dev (0=lowest … 4=highest). YOU name & color the tiers. |
| `rating` | float | IMDb average rating (fact, signal input) |
| `votes` | int | IMDb vote count (fact, signal input) |
| `slug` | string | url slug, unique |
| `svc` | string[] | US streaming services it's on (factual availability; empty if unknown) |

`data/stats.json` has `n`, `mean`, `sd`, `skew`, `excess_kurtosis`, `tier_counts`, and a
`histogram` (iq -> count) you can render as the distribution/bell-curve chart.

Tier bands (by IQ): 4 ≥130, 3 = 115–129, 2 = 85–114, 1 = 70–84, 0 < 70.
