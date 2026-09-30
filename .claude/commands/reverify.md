---
description: Re-check the offers with the oldest lastVerified date
argument-hint: "[n] (default 10)"
---

Re-verify the **$ARGUMENTS** (default 10 if empty) offers with the oldest
`source.lastVerified` in `data/venues/` (REQ-RES-030).

Read first: `docs/specs/010-data-model.md`, `docs/specs/020-research-tool.md`.

Process:
1. Run `npm run report` to see stale offers, then pick the n oldest offers
   across all venue files.
2. For each, fetch its `source.url` (and `url` if different) and update the
   offer following the common rules REQ-RES-001…008: fix changed fields, set
   `lastVerified` to today, remove ended offers, use `unknown` rather than
   guessing.
3. Run `npm run validate` and fix all errors.
4. Do not commit. Summarise changes per offer and list uncertainties.
