# 010 – Data model

Status: Draft · Last updated: 2026-09-30

The schema is implemented once in `packages/core` (Zod) and used by the CLI,
the web app build and the research commands.

## Files

- **REQ-DATA-001:** Each venue is stored in `data/venues/<venue-id>.yaml`. The
  file name (without extension) equals the venue `id`.
- **REQ-DATA-002:** IDs (venue and offer) are lowercase kebab-case
  (`^[a-z0-9]+(-[a-z0-9]+)*$`). Offer IDs are unique within their venue; the
  global offer key is `<venue-id>/<offer-id>`.
- **REQ-DATA-003:** School and public holidays are stored in
  `data/holidays.yaml` (see [Holidays](#holidays)).

## Venue

```yaml
id: gz-heuried
name: GZ Heuried
type: community-centre
location:
  address: Döltschiweg 130, 8055 Zürich
  municipality: Zürich
  kreis: 3
website: https://gz-zh.ch/gz-heuried/
amenities:
  stroller: yes
  changingTable: yes
  cafe: yes
offers: [ ... ]
```

- **REQ-DATA-010:** A venue has required fields `id`, `name`, `type`,
  `location.address`, `location.municipality`, `offers` (at least one), and
  optional `website`, `amenities`, `notes`.
- **REQ-DATA-011:** `type` is one of `community-centre`, `club`, `library`,
  `indoor-playground`, `museum`, `cafe`, `church`, `other`.
- **REQ-DATA-012:** If `location.municipality` is `Zürich`, `location.kreis` is
  required and an integer 1–12. Otherwise `kreis` must be absent.
- **REQ-DATA-013:** `amenities.stroller` is one of `yes`, `partial`, `no`,
  `unknown`; `amenities.changingTable` and `amenities.cafe` are one of `yes`,
  `no`, `unknown`. Missing amenity fields are treated as `unknown`.

## Offer

```yaml
- id: krabbeltreff
  title: Krabbeltreff
  description: Offener Treff für Eltern mit Babys und Kleinkindern.
  category: meetup
  ageMonths: { min: 0, max: 36 }
  setting: indoor
  price: { type: free }
  registration: none
  schedule:
    type: weekly
    rules:
      - { days: [tue], start: "09:30", end: "11:30" }
    validFrom: 2026-08-17
    validUntil: 2027-07-09
    pausesDuringSchoolHolidays: true
    pausesOnPublicHolidays: true
    cancelled: [2026-12-22]
  url: https://gz-zh.ch/gz-heuried/angebote/krabbeltreff
  source: { url: https://gz-zh.ch/gz-heuried/angebote/, lastVerified: 2026-09-30, by: ai }
```

- **REQ-DATA-020:** An offer has required fields `id`, `title`, `category`,
  `ageMonths`, `setting`, `price`, `registration`, `schedule`, `source`, and
  optional `description`, `url`, `notes`.
- **REQ-DATA-021:** `category` is one of `meetup` (open parent–child meetups),
  `play` (free play, incl. indoor playgrounds), `music`, `movement`, `culture`
  (theatre, museum, reading), `nature`, `course`, `play-corner` (e.g. café play
  corners), `advice` (counselling for parents, e.g. Familienberatung), `other`.
- **REQ-DATA-022:** `ageMonths` has optional integer `min` (default 0) and
  optional integer `max` (no upper bound if absent); if both are present,
  `min <= max`. An empty object `{}` means "all ages".
- **REQ-DATA-023:** `setting` is one of `indoor`, `outdoor`, `both`.
- **REQ-DATA-024:** `price` is one of:
  - `{ type: free }`
  - `{ type: fixed, chf: <number ≥ 0>, note? }`
  - `{ type: range, minChf: <number ≥ 0>, maxChf: <number ≥ minChf>, note? }`
  - `{ type: donation, note? }`
  - `{ type: unknown }`
- **REQ-DATA-025:** `registration` is one of `none`, `recommended`, `required`,
  `unknown`.
- **REQ-DATA-026:** `source` has `url` (https), `lastVerified` (ISO date, not in
  the future) and `by` (`ai` or `human`).
- **REQ-DATA-027:** All URLs (`website`, `url`, `source.url`) are absolute
  `https://` URLs.

## Schedule

Three schedule types. Times are `HH:MM` 24h, Europe/Zurich wall-clock. Dates
are ISO `YYYY-MM-DD`.

- **REQ-DATA-030:** `weekly` — recurring sessions with a start and end:
  `rules` (≥1 of `{ days: [mon..sun]+, start, end }`), optional `validFrom`,
  optional `validUntil`, required booleans `pausesDuringSchoolHolidays` and
  `pausesOnPublicHolidays`, optional `cancelled` (list of dates).
- **REQ-DATA-031:** `openingHours` — a place that is open during hours (indoor
  playground, café play corner): same fields as `weekly`. It differs only in
  meaning (drop in any time vs. session starts at `start`).
- **REQ-DATA-032:** `dates` — one-off or irregular events: `dates` (≥1 of
  `{ date, start, end }`).
- **REQ-DATA-033:** In every rule/date, `end` is later than `start` (no
  sessions across midnight).
- **REQ-DATA-034:** If both `validFrom` and `validUntil` are present,
  `validFrom <= validUntil`.
- **REQ-DATA-035:** The two `pauses…` booleans are required (no default) so
  that every schedule states explicitly how it behaves on holidays.

## Holidays

```yaml
schoolHolidays:
  - { name: Herbstferien, from: 2026-10-05, to: 2026-10-17 }
publicHolidays:
  - { name: Weihnachten, date: 2026-12-25 }
```

- **REQ-DATA-040:** `schoolHolidays` are the holidays of the Volksschule Stadt
  Zürich; `from` and `to` are inclusive, `from <= to`.
- **REQ-DATA-041:** `publicHolidays` are the full-day public holidays observed
  in the city of Zurich. Half-day local holidays (Sechseläuten,
  Knabenschiessen) are not listed. (manual)

## Occurrence engine

The engine turns schedules into concrete occurrences for a date range. It lives
in `packages/core` and is a pure function (no clock, no I/O).

```ts
type Occurrence = {
  key: string;          // "<venue-id>/<offer-id>"
  date: string;         // YYYY-MM-DD
  start: string;        // HH:MM
  end: string;          // HH:MM
  kind: "session" | "open";  // weekly/dates → session, openingHours → open
};
occurrences(venues, holidays, fromDate, toDate): Occurrence[]
```

- **REQ-OCC-001:** Returns all occurrences with `fromDate <= date <= toDate`
  (inclusive).
- **REQ-OCC-002:** A `weekly`/`openingHours` rule produces one occurrence on
  every date whose weekday is in `days`.
- **REQ-OCC-003:** No occurrences before `validFrom` or after `validUntil`
  (both inclusive bounds).
- **REQ-OCC-004:** If `pausesDuringSchoolHolidays` is true, no occurrences on
  dates within any school holiday.
- **REQ-OCC-005:** If `pausesOnPublicHolidays` is true, no occurrences on
  public holidays.
- **REQ-OCC-006:** No occurrences on dates listed in `cancelled`.
- **REQ-OCC-007:** A `dates` schedule produces exactly its listed entries
  (within range).
- **REQ-OCC-008:** Output is sorted by `date`, then `start`, then `key`.
- **REQ-OCC-009:** Date arithmetic is time-zone independent (calendar dates
  only), so daylight-saving transitions do not add, drop or shift occurrences.
- **REQ-OCC-010:** Multiple rules of the same offer may produce several
  occurrences on the same date (e.g. morning and afternoon opening).

## Staleness

- **REQ-DATA-050:** An offer is *stale* if `source.lastVerified` is more than
  90 days before the reference date. The threshold is one constant in
  `packages/core`.
