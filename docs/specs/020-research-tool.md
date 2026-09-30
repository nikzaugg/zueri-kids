# 020 – Research tool

Status: Draft · Last updated: 2026-09-30

The research tool has two layers:

1. **CLI scripts** (`packages/cli`, run via npm) — deterministic, tested.
2. **Claude Code commands** (`.claude/commands/*.md`) — AI-assisted research
   that reads websites and edits YAML. Their output is always reviewed by the
   user via `git diff` before committing.

## CLI

### validate

- **REQ-CLI-001:** `npm run validate` parses every file in `data/venues/` and
  `data/holidays.yaml` against the schema ([010](010-data-model.md)) and exits
  non-zero on any error.
- **REQ-CLI-002:** Each error message names the file, the field path and the
  problem (e.g. `data/venues/gz-heuried.yaml: offers[0].schedule.rules[0].end:
  must be later than start`).
- **REQ-CLI-003:** Validate reports *all* errors across all files, not just the
  first one.
- **REQ-CLI-004:** Validate checks REQ-DATA-001 (file name = id) and duplicate
  offer IDs within a venue.
- **REQ-CLI-005:** Validate prints warnings (without failing) for stale offers
  (REQ-DATA-050) and when `holidays.yaml` has no school holiday entries ending
  later than 60 days from today.

### report

- **REQ-CLI-010:** `npm run report` prints: number of venues and offers per
  kreis (plus "outside Zurich"), per category, number of stale offers (listed by
  key, oldest first), and number of fields with value `unknown` per field name.

### trace

- **REQ-CLI-020:** `npm run trace` implements REQ-META-004: collects REQ IDs
  from `docs/specs/*.md`, collects references from test files
  (`**/*.test.ts`, `**/*.spec.ts`), prints a coverage table and exits non-zero
  if any REQ not tagged `(manual)` or `(removed)` lacks a test.
- **REQ-CLI-021:** Trace reports test references to REQ IDs that do not exist
  in any spec as errors.

## Claude Code commands

All command behaviour is verified by manual review of the resulting diff.

### Common rules

- **REQ-RES-001:** Every offer written or updated has a `source.url` pointing to
  the page where the information was found. (manual)
- **REQ-RES-002:** Information that cannot be found on a source is set to
  `unknown` (or omitted where optional) — never guessed. (manual)
- **REQ-RES-003:** `source.lastVerified` is set to today and `source.by` to `ai`
  only for offers actually checked in this run. (manual)
- **REQ-RES-004:** After editing data, the command runs `npm run validate` and
  fixes errors before finishing. (manual)
- **REQ-RES-005:** The command never commits. It ends with a summary: venues
  and offers added/changed/removed, and a list of uncertainties for the user to
  check. (manual)
- **REQ-RES-006:** Fetches are targeted (specific pages), no bulk crawling;
  at most ~30 page fetches per run unless the user asks for more. (manual)
- **REQ-RES-007:** Only offers suitable for at least part of the 0–4 age range
  are recorded. (manual)
- **REQ-RES-008:** Offers that ended (past `validUntil` or all `dates` in the
  past) are removed; removal is listed in the summary. (manual)

### /research `<venue or topic>`

- **REQ-RES-010:** Given a venue name (e.g. "GZ Heuried") or topic (e.g.
  "indoor playgrounds Zurich"), researches the matching venue(s) and creates or
  updates their YAML files, including amenities where findable. (manual)
- **REQ-RES-011:** Before creating a venue, checks existing files to avoid
  duplicates (same place under another ID). (manual)

### /discover `<category or area>`

- **REQ-RES-020:** Searches for venues not yet in `data/venues/` and appends
  them to `data/candidates.md` as unchecked items
  `- [ ] <name> — <url> — <one-line reason>`, without creating venue files.
  (manual)
- **REQ-RES-021:** Skips candidates already present in `data/venues/` or
  `data/candidates.md`. (manual)

### /reverify `[n]`

- **REQ-RES-030:** Re-checks the `n` (default 10) offers with the oldest
  `source.lastVerified` and updates them per the common rules. (manual)

## Seed sources

- **REQ-RES-040:** The initial source list is kept in `data/sources.md`:
  Stadt Zürich "Familienfreizeit" pages per Kreis, the 17 Zürcher
  Gemeinschaftszentren, PBZ libraries, kikuka.ch, and known indoor playgrounds.
  Commands consult it first. (manual)

## Later (not in v1)

Scrapers for structured sources (kikuka.ch, GZ agendas) will get their own spec
(`021-scrapers.md`).
