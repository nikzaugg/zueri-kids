# zueri-kids

Web app + data set of activities for 0–4 year olds in the city of Zurich.
Start with `docs/specs/000-overview.md`.

## Rules

- **Spec first.** Every change starts in `docs/specs/` (add/change `REQ-…`
  IDs), then a plan in `docs/plans/`, then tests, then code. Never implement
  behaviour that is not in a spec.
- Tests reference the REQ ID in their name: `it("REQ-OCC-004: …")`.
  `npm run trace` must pass.
- Never renumber or reuse REQ IDs; mark removed ones `(removed)`.
- English for code, comments, commands, specs and commits. German only for UI
  strings (`apps/web/src/i18n/de.ts`).
- Data changes: run `npm run validate`. Never guess data — use `unknown` and
  cite a `source.url` (see `docs/specs/020-research-tool.md`).
- Do not commit on behalf of the user during research commands.
- Prefer established, maintained libraries and tools over writing
  infrastructure yourself (e.g. Workbox for the service worker). Custom code
  is for project-specific logic only.
