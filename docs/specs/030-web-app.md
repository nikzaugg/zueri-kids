# 030 – Web app

Status: Draft · Last updated: 2026-09-30

Static, mobile-first PWA built with Astro in `apps/web`. UI language German.

## Build

- **REQ-WEB-001:** The build loads and validates all data via `packages/core`;
  invalid data fails the build with the same messages as `npm run validate`.
- **REQ-WEB-002:** The build emits one JSON bundle (venues + holidays) that the
  client uses to compute occurrences; occurrences are computed in the browser
  for the visible date range.
- **REQ-WEB-003:** "Today" and "now" are determined in the Europe/Zurich time
  zone regardless of device time zone.

## Views

### Day view (start page, `/`)

- **REQ-WEB-010:** Shows the occurrences of one day (default: today) matching
  the active filters.
- **REQ-WEB-011:** Occurrences are grouped into "Vormittag" (start < 12:00),
  "Nachmittag" (start ≥ 12:00), and "Offen" (kind `open`, e.g. indoor
  playgrounds), each sorted by start time.
- **REQ-WEB-012:** Previous/next buttons move by one day; the date is part of
  the URL (`?date=YYYY-MM-DD`).
- **REQ-WEB-013:** When showing today, occurrences whose `end` has passed are
  visually muted and listed after the others in their group.
- **REQ-WEB-014:** If the day is within a school holiday, a notice is shown
  ("Schulferien – viele Angebote pausieren"); on a public holiday, its name is
  shown.
- **REQ-WEB-015:** Each item shows title, venue name, time, kreis, price, and
  icons for setting and registration; tapping opens the detail page.

### Week view (`/woche`)

- **REQ-WEB-020:** Shows seven consecutive days starting Monday of the selected
  week, with the same filters. Columns on wide screens, stacked list on
  narrow screens.

### Search (`/suche`)

- **REQ-WEB-030:** Free-text search over offer title, description, venue name
  and address (case- and diacritic-insensitive, e.g. "zurich" matches
  "Zürich"). Results list offers (not occurrences) with their next occurrence
  within 28 days, if any.

### Detail page (`/angebot/<venue-id>/<offer-id>`)

- **REQ-WEB-040:** Shows all offer and venue fields, the next 5 occurrences,
  the address with a maps link, website and source links, and "zuletzt geprüft
  am <date>".
- **REQ-WEB-041:** Detail pages are statically generated, one per offer.

### Staleness and empty states

- **REQ-WEB-050:** Stale offers (REQ-DATA-050) show "Angaben evtl. veraltet"
  in list and detail views.
- **REQ-WEB-051:** If no occurrences match, the view says "Keine passenden
  Angebote" and names the active filters that can be relaxed.

## Filters

- **REQ-FLT-001:** Filters are modules with a common interface, registered in a
  single registry; views render the filter bar from the registry. Adding a
  filter requires only a new module and one registry entry.

  ```ts
  interface Filter<V> {
    id: string;                       // also the URL param name
    label: string;                    // German UI label
    control: "toggle" | "select" | "multiselect" | "number";
    defaultValue: V;
    parse(param: string | null): V;   // from URL
    serialize(value: V): string | null;  // to URL (null = default, omitted)
    isActive(value: V): boolean;
    matches(ctx: { occurrence; offer; venue; date }, value: V): boolean;
  }
  ```
- **REQ-FLT-002:** An occurrence is shown if it matches all active filters.
- **REQ-FLT-003:** Active filter values are reflected in the URL so a filtered
  view can be bookmarked.
- **REQ-FLT-010 (age):** Uses the child's birth date from settings. Matches if
  the child's age in whole months on the occurrence date is within
  `ageMonths.min`..`ageMonths.max`. Inactive if no birth date is set.
- **REQ-FLT-011 (setting):** Values `all` (default), `indoor`, `outdoor`.
  `indoor` matches `indoor` and `both`; `outdoor` matches `outdoor` and `both`.
- **REQ-FLT-012 (price):** Values `all` (default), `free`, `max:<chf>`. `free`
  matches only `type: free`. `max:<chf>` matches `free`, `donation`, `fixed`
  with `chf <= max`, and `range` with `minChf <= max`. `unknown` never matches
  an active price filter.
- **REQ-FLT-013 (registration):** Toggle "Ohne Anmeldung": matches only
  `registration: none`.
- **REQ-FLT-014 (kreis):** Multiselect of Kreis 1–12 plus "Ausserhalb". Default
  from settings; initial default is Kreis 1, 2, 3, 4, 9.

## Settings

- **REQ-WEB-060:** A settings page (`/einstellungen`) stores the child's birth
  date and default Kreise in `localStorage`. The app works when storage is
  unavailable (falls back to defaults).
- **REQ-WEB-061:** URL filter values override settings defaults.

## Platform

- **REQ-WEB-070:** Installable PWA with a web manifest; after the first visit,
  the app shell and data bundle work offline. (manual)
- **REQ-WEB-071:** Layout works from 360px width without horizontal scrolling.
- **REQ-WEB-072:** All UI strings live in one German message file
  (`apps/web/src/i18n/de.ts`).
- **REQ-WEB-073:** Basic accessibility: semantic HTML, labelled controls,
  sufficient contrast, keyboard navigable. (manual)

## Tests

- Filters and grouping logic: Vitest unit tests.
- **REQ-WEB-080:** Playwright smoke test: day view loads with fixture data,
  a filter changes the list, a detail page opens.
