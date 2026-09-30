---
description: Find venues not yet in the data set and add them to data/candidates.md
argument-hint: <category or area, e.g. "indoor playgrounds" or "Kreis 3">
---

Discover venues for **$ARGUMENTS** that offer activities for children aged
0–4 in or near the city of Zurich.

Read first: `docs/specs/020-research-tool.md` (REQ-RES-020, 021, 006) and
`data/sources.md`.

Process:
1. Search the seed sources and the web. Stay under ~30 fetches.
2. Skip venues already in `data/venues/` or already listed in
   `data/candidates.md` (REQ-RES-021).
3. Append each new venue to `data/candidates.md` as
   `- [ ] <name> — <url> — <one-line reason>` (REQ-RES-020).
   Do not create venue files.
4. Do not commit. Summarise how many candidates were added and which sources
   looked most productive.
