# 030 – Web app

Status: Implemented · Last updated: 2026-09-30

Static, mobile-first PWA built with Astro in `apps/web`. UI language German.
Interactive parts are Preact islands. Reference mockup (v2, 2026-09-30):
https://claude.ai/artifact/6Qa7n7Rz3PRmAinraTL9My

## Build

- **REQ-WEB-001:** The build loads and validates all data via `packages/core`;
  invalid data fails the build with the same messages as `npm run validate`.
- **REQ-WEB-002:** The build emits one JSON bundle (venues + holidays) that the
  client uses to compute occurrences; occurrences are computed in the browser
  for the visible date range.
- **REQ-WEB-003:** "Today" and "now" are determined in the Europe/Zurich time
  zone regardless of device time zone.
- **REQ-WEB-004:** Pages are rendered by Astro; the day view, week view,
  search and filter bar are Preact islands. No other UI framework is used.
  (manual)

## Views

### Day view (start page, `/`)

- **REQ-WEB-010:** Shows the occurrences of one day (default: today) matching
  the active filters.
- **REQ-WEB-011:** In the list view, occurrences are grouped into "Vormittag"
  (start < 12:00), "Nachmittag" (start ≥ 12:00), and "Offen – kommen und
  gehen" (kind `open`, e.g. indoor playgrounds), each sorted by start time.
- **REQ-WEB-012:** Previous/next buttons and a strip of the seven days of the
  current week move between days; the date is part of the URL
  (`?date=YYYY-MM-DD`).
- **REQ-WEB-013:** When showing today, occurrences whose `end` has passed are
  visually muted. In the list and card views they are listed after the others
  in their group; in the timeline they keep their time order.
- **REQ-WEB-014:** If the day is within a school holiday, a notice is shown
  ("Schulferien – viele Angebote pausieren"); on a public holiday, its name is
  shown.
- **REQ-WEB-015:** Each item shows time, title, venue name with Kreis (omitted
  when grouped by venue or filtered to one venue), price label, a marker
  "Anmeldung" when registration is `required` ("Anmeldung?" when `unknown`),
  and "draussen" when the setting is `outdoor`. Tapping an item expands
  inline details: description, venue and address, age range, setting,
  category, price note and a link to the offer's website and detail page.
- **REQ-WEB-016:** A view switch offers "Zeitleiste" (default), "Liste" and
  "Karten". The last choice is remembered on the device.
- **REQ-WEB-017 (timeline):** An hour axis from 08:00 to 19:00 heads the day
  and stays visible while scrolling, pinned together with the day navigation;
  each occurrence is one row with its time and title above a bar spanning
  its start to end on that axis, coloured by category. Occurrences of kind
  `open` have a striped bar; a legend explains both. When showing today, a
  vertical red line (no label) marks the current time. Rows are sorted by start.
- **REQ-WEB-018 (grouping):** A switch "Nach Zeit" (default) / "Nach Ort"
  applies to all three views. "Nach Ort" shows one section per venue, headed
  by the venue name, its Kreis, the number of offers and a ★ toggle for
  "Meine Orte" (REQ-WEB-062). Sections are ordered favourites first, then by
  earliest start. The last choice is remembered on the device.
- **REQ-WEB-019 (cards):** The card view shows one card per occurrence in a
  responsive grid (one column on phones).
- **REQ-WEB-021:** Tapping a venue name anywhere applies the venue filter
  (REQ-FLT-015) for that venue.

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
  the address with a maps link, website and source links, "zuletzt geprüft
  am <date>", and the ★ toggle for the venue.
- **REQ-WEB-041:** Detail pages are statically generated, one per offer.

### Staleness and empty states

- **REQ-WEB-050:** Stale offers (REQ-DATA-050) show "evtl. veraltet" in all
  views and on the detail page.
- **REQ-WEB-051:** If no occurrences match, the view says "Keine passenden
  Angebote" and names the active filters that can be relaxed.
- **REQ-WEB-052:** Above the results, a summary states how many of the day's
  occurrences match ("12 von 31 Angeboten passen zu deinen Filtern"); with a
  venue filter it states the count for that venue.

## Filters

- **REQ-FLT-001:** Filters are modules with a common interface, registered in a
  single registry; views render the filter bar from the registry. Adding a
  filter requires only a new module and one registry entry.

  ```ts
  interface Filter<V> {
    id: string;                                   // also the URL param name
    control: "toggle" | "select" | "multiselect" | "removable";
    label(settings: Settings, date: string): string;          // German UI label
    options?: { value: string; label: string }[];             // for select
    defaultValue(settings: Settings): V;
    parse(param: string | null, settings: Settings): V;      // from URL
    serialize(value: V, settings: Settings): string | null;  // to URL (null = default, omitted)
    isActive(value: V, settings: Settings): boolean;
    matches(ctx: { occurrence; offer; venue; date; settings }, value: V): boolean;
    overrides?: string[];            // ids of filters ignored while this one is active
  }
  ```
- **REQ-FLT-002:** An occurrence is shown if it matches all active filters,
  except filters listed in the `overrides` of another active filter.
- **REQ-FLT-003:** Active filter values are reflected in the URL so a filtered
  view can be bookmarked.
- **REQ-FLT-010 (age):** Uses the child's birth date from settings. Matches if
  the child's age in whole months on the occurrence date is within
  `ageMonths.min`..`ageMonths.max`. Label "Passt für <n> Mt." (or "<n> J."
  from 24 months). Active by default when a birth date is set; inactive if
  none is set.
- **REQ-FLT-011 (setting):** Values `all` (default), `indoor`, `outdoor`.
  `indoor` matches `indoor` and `both`; `outdoor` matches `outdoor` and `both`.
- **REQ-FLT-012 (price):** Values `all` (default), `free`, `max:<chf>`. `free`
  (label "Gratis / Kollekte") matches `type: free` and `type: donation`.
  `max:<chf>` matches `free`, `donation`, `fixed` with `chf <= max`, and
  `range` with `minChf <= max`. `unknown` never matches an active price
  filter.
- **REQ-FLT-013 (registration):** Toggle "Ohne Anmeldung": matches only
  `registration: none`.
- **REQ-FLT-014 (kreis):** Multiselect of Kreis 1–12 plus "Ausserhalb". Default
  from settings; initial default is Kreis 1, 2, 3, 4, 9.
- **REQ-FLT-015 (venue):** A single venue id (URL param `ort`). Matches only
  occurrences at that venue. Overrides the Kreis and "Meine Orte" filters.
  Shown as a removable chip "<venue name> ✕" at the start of the filter bar.
- **REQ-FLT-016 (mine):** Toggle "★ Meine Orte": matches only occurrences at
  venues in the favourites list (REQ-WEB-062).

## Settings

- **REQ-WEB-060:** A settings page (`/einstellungen`) stores the child's birth
  date and default Kreise in `localStorage`. The app works when storage is
  unavailable (falls back to defaults).
- **REQ-WEB-061:** URL filter values override settings defaults.
- **REQ-WEB-062:** "Meine Orte" is a list of favourite venue ids stored in
  `localStorage`, edited with the ★ toggle on venue section headers and
  detail pages, and listed on the settings page.

## Design

- **REQ-WEB-075:** Visual direction follows the reference mockup: calm and
  clear, off-white (light) / dark green-black (dark) background, one blue
  accent, one colour per offer category used for bars, dots and card edges.
  Display face Bricolage Grotesque, body face Atkinson Hyperlegible (Google
  Fonts, with system fallbacks). (manual)
- **REQ-WEB-076:** Light and dark theme follow the device setting. (manual)

## Platform

- **REQ-WEB-070:** Installable PWA with a web manifest; after the first visit,
  the app shell and data bundle work offline. (manual)
- **REQ-WEB-077:** The service worker is generated by Workbox
  (`workbox generateSW`) from the built site; app icons are generated with
  `@vite-pwa/assets-generator` from one SVG. No hand-written service worker.
  (manual)
- **REQ-WEB-078:** The data bundle is fetched network-first (falling back to
  the cached copy offline), so new data is visible on the next app start.
  (manual)
- **REQ-WEB-071:** Layout works from 360px width without horizontal scrolling.
- **REQ-WEB-079:** Page content never shows behind the phone's status bar:
  the top safe-area inset is covered with the page background on every page,
  and content starts below it. (manual)
- **REQ-WEB-072:** All UI strings live in one German message file
  (`apps/web/src/i18n/de.ts`). (manual)
- **REQ-WEB-073:** Basic accessibility: semantic HTML, labelled controls,
  sufficient contrast, keyboard navigable. (manual)

## Tests

- Filters, grouping and timeline layout logic: Vitest unit tests.
- **REQ-WEB-080:** Playwright smoke test: day view loads with fixture data,
  a filter changes the list, switching to "Nach Ort" groups by venue, and a
  detail page opens.
