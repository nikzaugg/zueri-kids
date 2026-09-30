# 000 – Overview

Status: Draft · Last updated: 2026-09-30

## Problem

Families with young children (0–4 years) in the city of Zurich have many daily
options — community centres (GZ), clubs, libraries, indoor playgrounds, cafés
with play corners — but the information is scattered across dozens of websites.
Existing calendars (kikuka.ch, lolabrause.ch, Eventfrog, …) focus on one-off
events; the recurring weekly offers that matter most for toddlers are only
listed on static pages.

## Goal

A mobile-first web app that answers **"What can we do today / this week?"** for
a 0–4 year old in Zurich, with where, when, cost, registration and a link to the
source — backed by a curated, version-controlled dataset and an AI-assisted
research tool that keeps it up to date.

## Users

- **v1:** a single parent living in Wiedikon (Kreis 3), mostly on a phone.
- **Later:** published for other Zurich parents (a public URL; no accounts).

## System parts

| Part | Spec | Purpose |
|---|---|---|
| Data model | [010](010-data-model.md) | Schema for venues, offers, schedules, holidays. Single source of truth shared by all parts. |
| Research tool | [020](020-research-tool.md) | Claude Code commands + CLI scripts to research, validate and report on data. |
| Web app | [030](030-web-app.md) | Static PWA with day view, week view, search, filters, detail pages. |

## Conventions

- **Language:** code, comments, commands, specs and commit messages in English.
  The web app UI is German; all UI strings live in one message file.
- **Stack:** TypeScript, Node 22 LTS, npm workspaces, Zod, Vitest, Astro,
  Playwright.
- **Time zone:** all dates and times in the data are Europe/Zurich wall-clock
  values.

## Spec-driven workflow

- **REQ-META-001:** Every requirement has a unique ID of the form
  `REQ-<AREA>-<NNN>` defined in exactly one spec file.
- **REQ-META-002:** Every change starts with a spec change (new/changed REQ
  IDs), followed by a plan in `docs/plans/`, then tests, then code. (manual)
- **REQ-META-003:** Automated tests reference the REQ ID they verify in the test
  name (e.g. `it("REQ-OCC-004: skips school holidays", …)`). (manual)
- **REQ-META-004:** `npm run trace` lists every REQ ID and the tests referencing
  it, and exits non-zero if a REQ has no test — unless the requirement is
  tagged with the manual marker in its spec (verified by manual review).
- **REQ-META-005:** Removed requirements are not renumbered; their IDs are
  marked `(removed)` and never reused. (manual)

## Repository layout

```
docs/specs/        specs (this folder)
docs/plans/        implementation plans, one per spec change
data/venues/       one YAML file per venue
data/holidays.yaml school and public holidays
data/candidates.md discovered venues not yet researched
packages/core/     schema, occurrence engine, filter registry
packages/cli/      validate, report, trace
apps/web/          Astro web app
.claude/commands/  research, discover, reverify
```

## Deployment

- **REQ-META-010:** CI (GitHub Actions) runs tests, `validate` and `trace` on
  every push; the web app is deployed to GitHub Pages only if all pass. (manual)
- **REQ-META-011:** Until a GitHub remote exists, everything works locally
  (`npm test`, `npm run validate`, `npm run dev`). (manual)

## Phases

1. Core (schema, occurrence engine, validate) + first 5–10 venues via `/research`.
2. Web app v1.
3. Research commands extended; cover the whole city.
4. Later: scrapers for structured sources (kikuka.ch, GZ agendas), cafés with
   play corners, publishing.

## Out of scope for v1

Map view, user accounts, favourites, notifications, multiple children,
languages other than German in the UI, venues outside the canton of Zurich.
