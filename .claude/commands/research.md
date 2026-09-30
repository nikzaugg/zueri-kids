---
description: Research a venue or topic and create/update venue YAML files
argument-hint: <venue name or topic, e.g. "GZ Heuried" or "indoor playgrounds">
---

Research **$ARGUMENTS** for the zueri-kids data set (activities for children
aged 0–4 in the city of Zurich) and create or update files in `data/venues/`.

Read first:
- `docs/specs/010-data-model.md` – the schema (follow it exactly)
- `docs/specs/020-research-tool.md` – rules REQ-RES-001…040
- `data/sources.md` – where to start

Process:
1. List `data/venues/` and check whether the venue(s) already exist, possibly
   under another ID (REQ-RES-011). Update existing files instead of creating
   duplicates.
2. Find the official page(s) of the venue. Fetch only specific pages; stay
   under ~30 fetches (REQ-RES-006).
   For GZ, get the complete offer list from the sitemap
   `https://gz-zh.ch/<gz>/angebote-sitemap.xml` (the program page only shows
   the next few days). The sitemap also contains past offers: keep only
   pages that list upcoming dates.
3. Record only offers for children in at least part of the 0–4 age range or
   for parents who can bring their child (REQ-RES-007): parent–child
   meetups, play, music, movement, culture, crafts, nature, courses, play
   corners, and advice such as the city's Familienberatung (often held in
   GZ). Skip parent-only courses and offers held in languages other than
   German or English (REQ-RES-009).
4. For each offer, fill every field from what the source says. Where the source
   is silent, use `unknown` (price, registration, amenities) or omit optional
   fields. Never guess (REQ-RES-002). For `pausesDuringSchoolHolidays` and
   `pausesOnPublicHolidays`: GZ and club offers usually pause – set `true`
   only if the source says so or the offer runs in term time only; if truly
   unclear, set `true` and list it as an uncertainty.
5. Set `source.url` to the page where the information was found,
   `source.lastVerified` to today, `source.by: ai` – only for offers you
   actually checked in this run (REQ-RES-001, REQ-RES-003).
6. Remove offers that have ended (REQ-RES-008).
7. Run `npm run validate` and fix all errors (REQ-RES-004).
8. Do not commit (REQ-RES-005). Finish with a summary:
   - venues/offers added, changed, removed
   - uncertainties the user should check (with the source URL)
9. If `data/candidates.md` lists this venue, check it off.
