# Prompt: Independent Title Generator (clean-room)

Hand this prompt to a **fresh, independent agent** to generate a scored Acuity record for a
TV series or film that isn't already in the catalog. The agent works only from its own general
knowledge and the rubric below — it must **not** read, fetch, or copy any other rating site's
scores, reviews, or text. This keeps every added title independently authored (see `CLEANROOM.md`).

---

## Your task
You will be given a **title** (and optionally a year). Produce ONE JSON record scoring that
title's *cognitive value* using the Acuity rubric. Use only your own knowledge of the work and
verifiable facts (genre, year, format). Do not copy any external rating or review wording.

## The three dimensions — score each 0–100 as a PERCENTILE
Score where this title sits **relative to all film & television**, not on an absolute scale.
50 = exactly average; 84 ≈ one standard deviation above; 16 ≈ one below.

1. **Cognitive load** — how much sustained attention, inference, and working memory the title
   demands (narrative complexity, ambiguity, ideas-per-minute, structural difficulty). High:
   dense mysteries, idea-driven sci-fi, intricate drama. Low: passive/formulaic entertainment.
2. **Knowledge value** — how much verifiable real-world understanding a viewer gains (history,
   science, society, biography, craft of a real domain). High: rigorous documentary/historical
   work. Low: pure fantasy/escapism with no informational content.
3. **Craft & execution** — writing, direction, performance, and formal control, independent of
   subject. High: masterfully made regardless of genre. Low: clumsy or formulaic execution.

Be honest and discriminating — most titles should land near the middle; reserve the extremes.

## Compute the overall score
Run the project's calibrator so the result sits on the same Normal(100, 15) bell curve as the
catalog (do NOT invent the overall number yourself):

```
python3 build/score_one.py --cog <COG> --edu <EDU> --ent <ENT>
```

It returns the calibrated `iq` (overall) and `tier` (0–4). Use those verbatim.

## Output — a single JSON object
```json
{
  "id": null,                      // no IMDb id for agent-generated titles
  "n": "<title>",
  "year": <year>,
  "type": "film" | "series",
  "g": ["<Genre>", ...],           // standard genres
  "cog": <0-100>, "edu": <0-100>, "ent": <0-100>,
  "iq": <from score_one.py>,
  "tier": <0-4 from score_one.py>,
  "kids": <true if family/children's content, else false>,
  "rating": null, "votes": null,   // unknown for generated titles
  "svc": [],                       // fill later from a streaming-availability source if desired
  "p": null,                       // poster path; resolve later via TMDB by title if desired
  "rationale": "<2-3 original sentences: concrete reasons for the dimension scores — themes, structure, knowledge content, craft. Factual and specific. Your own words only.>",
  "source": "agent-generated"      // provenance flag, distinct from imdb-sourced records
}
```

## Rules
- Independent work only: your own assessment, your own prose. No copied scores or review text.
- If you don't actually know the title, say so rather than fabricate facts.
- Keep the rationale specific and non-promotional (this is an evaluation, not marketing copy).
