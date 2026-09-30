# Phase 1 – Core, CLI and first data: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A validated, tested data layer (schema + occurrence engine), the CLI
tools `validate` / `report` / `trace`, the Claude Code research commands, and
the first 5–10 real venues near Wiedikon.

**Architecture:** npm-workspaces monorepo with TypeScript run directly from
source (no build step; `tsx` for scripts, Vitest for tests). `packages/core`
has two entry points: `@zueri-kids/core` (pure, browser-safe: schema, dates,
occurrences, staleness) and `@zueri-kids/core/node` (file loading and
warnings, uses `node:fs`). `packages/cli` wraps core in thin, tested functions
plus tiny `bin/` scripts.

**Tech Stack:** Node 22 LTS, TypeScript 5, Zod 4, `yaml` 2, Vitest 3, tsx 4.

**Specs implemented:** [000](../specs/000-overview.md) (META),
[010](../specs/010-data-model.md) (DATA, OCC),
[020](../specs/020-research-tool.md) (CLI, RES).

## Global Constraints

- Code, comments, commands, commit messages: English.
- Every test that verifies a requirement has the REQ ID at the start of its
  name: `it("REQ-OCC-004: …")`.
- Test files must not contain literal IDs of requirements that do not exist
  (trace treats them as errors). Build fake IDs by concatenation:
  `"REQ" + "-XMP-001"`.
- All dates are ISO `YYYY-MM-DD` strings, all times `HH:MM` strings,
  Europe/Zurich wall-clock. Never use `Date` for calendar arithmetic except
  through `packages/core/src/dates.ts`.
- `packages/core/src/index.ts` must never import `node:*` modules (it will be
  bundled for the browser in phase 2).
- YAML is parsed with `yaml` v2 defaults (YAML 1.2 core schema): unquoted
  `2026-10-05`, `09:30`, `yes`, `no` stay strings.
- Commit after every task. Commit messages end with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File structure

```
.nvmrc                               Node version (22)
package.json                         workspaces, scripts, dev deps
tsconfig.json                        strict TS config for all packages
vitest.config.ts                     test discovery, TZ override
packages/core/
  package.json                       exports "." and "./node"
  src/index.ts                       pure entry (browser-safe)
  src/node.ts                        node entry (fs)
  src/dates.ts                       calendar-date arithmetic, todayInZurich
  src/issues.ts                      Issue type, formatPath, formatIssue
  src/schema/common.ts               Id, IsoDate, Time, HttpsUrl
  src/schema/venue.ts                Venue, Offer, Schedule, Price, …
  src/schema/holidays.ts             Holidays
  src/occurrences.ts                 occurrences()
  src/staleness.ts                   STALE_AFTER_DAYS, isStale()
  src/load.ts                        loadDataset()
  src/warnings.ts                    collectWarnings()
  test/fixtures.ts                   typed builders for tests
  test/tmp-data.ts                   writeDataDir() temp-dir helper
  test/*.test.ts
packages/cli/
  package.json
  src/validate.ts                    runValidate()
  src/report.ts                      buildReport()
  src/trace.ts                       parseRequirements(), trace(), formatTrace()
  src/bin/{validate,report,trace}.ts thin process wrappers
  test/*.test.ts
data/holidays.yaml, data/sources.md, data/candidates.md, data/venues/*.yaml
.claude/commands/{research,discover,reverify}.md
```

---

### Task 1: Tooling scaffold and calendar dates

**Files:**
- Create: `.nvmrc`, `package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `packages/core/package.json`, `packages/core/src/index.ts`, `packages/core/src/node.ts`, `packages/core/src/dates.ts`
- Test: `packages/core/test/dates.test.ts`

**Interfaces:**
- Produces (`@zueri-kids/core`):
  - `WEEKDAYS: readonly ["mon","tue","wed","thu","fri","sat","sun"]`, `type Weekday`
  - `isValidDate(s: string): boolean`
  - `addDays(date: string, n: number): string`
  - `daysBetween(from: string, to: string): number` (to − from)
  - `weekday(date: string): Weekday`
  - `todayInZurich(now: Date): string`

- [ ] **Step 1: Install Node 22 and create root config**

```bash
source ~/.nvm/nvm.sh && nvm install 22 && nvm use 22 && node -v
```
Expected: `v22.x.x`

`.nvmrc`:
```
22
```

`package.json`:
```json
{
  "name": "zueri-kids",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "workspaces": ["packages/*"],
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "validate": "tsx packages/cli/src/bin/validate.ts data",
    "report": "tsx packages/cli/src/bin/report.ts data",
    "trace": "tsx packages/cli/src/bin/trace.ts ."
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["packages/*/src", "packages/*/test", "vitest.config.ts"]
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts"],
    // Run tests in a time zone far from Zurich to prove date logic is
    // time-zone independent (REQ-OCC-009, REQ-WEB-003).
    env: { TZ: "America/Los_Angeles" },
  },
});
```

`packages/core/package.json`:
```json
{
  "name": "@zueri-kids/core",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./node": "./src/node.ts"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install -D typescript@^5 vitest@^3 tsx@^4 @types/node@^22
npm install -w @zueri-kids/core zod@^4 yaml@^2
```
Expected: `node_modules/` created, `package-lock.json` written.

- [ ] **Step 3: Write the failing test** – `packages/core/test/dates.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { addDays, daysBetween, isValidDate, todayInZurich, weekday } from "../src";

describe("dates", () => {
  it("validates ISO calendar dates", () => {
    expect(isValidDate("2026-02-28")).toBe(true);
    expect(isValidDate("2028-02-29")).toBe(true);
    expect(isValidDate("2026-02-29")).toBe(false);
    expect(isValidDate("2026-13-01")).toBe(false);
    expect(isValidDate("2026-1-01")).toBe(false);
    expect(isValidDate("01.10.2026")).toBe(false);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("REQ-OCC-009: adds days across DST transitions without drift", () => {
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(addDays("2027-03-27", 2)).toBe("2027-03-29");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-09-30", "2026-10-30")).toBe(30);
    expect(daysBetween("2026-10-30", "2026-09-30")).toBe(-30);
  });

  it("returns the weekday", () => {
    expect(weekday("2026-09-30")).toBe("wed");
    expect(weekday("2026-10-04")).toBe("sun");
    expect(weekday("2026-10-05")).toBe("mon");
  });

  it("REQ-WEB-003: determines today in Europe/Zurich", () => {
    // 23:30 UTC on 30 Sep = 01:30 on 1 Oct in Zurich (CEST, UTC+2)
    expect(todayInZurich(new Date("2026-09-30T23:30:00Z"))).toBe("2026-10-01");
    expect(todayInZurich(new Date("2026-09-30T12:00:00Z"))).toBe("2026-09-30");
  });
});
```

Note: `REQ-WEB-003` lives in the draft spec 030; referencing it already is
fine (trace only errors on IDs that do not exist).

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run packages/core/test/dates.test.ts`
Expected: FAIL – cannot resolve `../src`.

- [ ] **Step 5: Implement** – `packages/core/src/dates.ts`

```ts
// Calendar-date arithmetic on ISO "YYYY-MM-DD" strings.
// All math happens in UTC on whole days, so the host time zone and DST never
// affect results.

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDate(s: string): boolean {
  const m = ISO_DATE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

function toDayNumber(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

function fromDayNumber(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  return fromDayNumber(toDayNumber(date) + n);
}

export function daysBetween(from: string, to: string): number {
  return toDayNumber(to) - toDayNumber(from);
}

export function weekday(date: string): Weekday {
  // getUTCDay: 0 = Sunday … 6 = Saturday
  return WEEKDAYS[(new Date(toDayNumber(date) * DAY_MS).getUTCDay() + 6) % 7];
}

export function todayInZurich(now: Date): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(now);
}
```

`packages/core/src/index.ts`:
```ts
// Browser-safe entry point. Never import node:* modules here.
export * from "./dates";
```

`packages/core/src/node.ts`:
```ts
// Node-only entry point (file system access).
export {};
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: 6 tests PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold workspace; add calendar date utilities"
```

---

### Task 2: Data schema

**Files:**
- Create: `packages/core/src/issues.ts`, `packages/core/src/schema/common.ts`, `packages/core/src/schema/venue.ts`, `packages/core/src/schema/holidays.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/test/fixtures.ts`
- Test: `packages/core/test/schema.test.ts`

**Interfaces:**
- Consumes: `isValidDate`, `WEEKDAYS` (Task 1)
- Produces (`@zueri-kids/core`):
  - Zod schemas **and** same-named types: `Venue`, `Offer`, `Schedule`, `Price`, `Holidays`
  - `type Issue = { file: string; path: string; message: string }`
  - `formatPath(path: readonly PropertyKey[]): string` → `offers[0].schedule.rules[0].end`
  - `formatIssue(issue: Issue): string` → `<file>: <path>: <message>` (path part omitted if empty)
  - Test builders in `packages/core/test/fixtures.ts`: `source`, `offer(overrides?)`, `venue(overrides?)`, `noHolidays`

- [ ] **Step 1: Write fixtures** – `packages/core/test/fixtures.ts`

```ts
import type { Holidays, Offer, Venue } from "../src";

export const source = {
  url: "https://example.ch/angebote",
  lastVerified: "2026-09-01",
  by: "ai" as const,
};

export function offer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: "treff",
    title: "Treff",
    category: "meetup",
    ageMonths: {},
    setting: "indoor",
    price: { type: "free" },
    registration: "none",
    schedule: {
      type: "weekly",
      rules: [{ days: ["tue"], start: "09:30", end: "11:30" }],
      pausesDuringSchoolHolidays: false,
      pausesOnPublicHolidays: false,
    },
    source,
    ...overrides,
  };
}

export function venue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: "gz-test",
    name: "GZ Test",
    type: "community-centre",
    location: { address: "Teststrasse 1, 8003 Zürich", municipality: "Zürich", kreis: 3 },
    amenities: { stroller: "unknown", changingTable: "unknown", cafe: "unknown" },
    offers: [offer()],
    ...overrides,
  };
}

export const noHolidays: Holidays = { schoolHolidays: [], publicHolidays: [] };
```

- [ ] **Step 2: Write the failing test** – `packages/core/test/schema.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { Holidays, Venue, formatPath } from "../src";
import { offer, venue } from "./fixtures";

type Raw = Record<string, unknown>;

function venuePaths(input: unknown): string[] {
  const r = Venue.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => formatPath(i.path));
}

// Replace fields of the first offer.
function withOffer(fields: Raw): Raw {
  return { ...venue(), offers: [{ ...offer(), ...fields }] };
}

// Replace fields of the first offer's schedule.
function withSchedule(fields: Raw): Raw {
  return withOffer({ schedule: { ...offer().schedule, ...fields } });
}

describe("Venue schema", () => {
  it("accepts a valid venue", () => {
    expect(venuePaths(venue())).toEqual([]);
  });

  it("REQ-DATA-002: rejects IDs that are not kebab-case", () => {
    expect(venuePaths({ ...venue(), id: "GZ_Heuried" })).toContain("id");
    expect(venuePaths(withOffer({ id: "Krabbel Treff" }))).toContain("offers[0].id");
  });

  it("REQ-DATA-002: rejects duplicate offer IDs within a venue", () => {
    const v = { ...venue(), offers: [offer({ id: "a" }), offer({ id: "a" })] };
    expect(venuePaths(v)).toContain("offers[1].id");
  });

  it("REQ-DATA-010: requires name and at least one offer, rejects unknown keys", () => {
    const { name: _name, ...noName } = venue();
    expect(venuePaths(noName)).toContain("name");
    expect(venuePaths({ ...venue(), offers: [] })).toContain("offers");
    expect(Venue.safeParse({ ...venue(), foo: 1 }).success).toBe(false);
  });

  it("REQ-DATA-011: restricts venue type", () => {
    expect(venuePaths({ ...venue(), type: "zoo" })).toContain("type");
    expect(venuePaths({ ...venue(), type: "cafe" })).toEqual([]);
  });

  it("REQ-DATA-012: requires kreis 1–12 in Zürich and forbids it elsewhere", () => {
    const loc = venue().location;
    expect(venuePaths({ ...venue(), location: { ...loc, kreis: undefined } })).toContain("location.kreis");
    expect(venuePaths({ ...venue(), location: { ...loc, kreis: 13 } })).toContain("location.kreis");
    const outside = { address: "Hauptstrasse 1, 8953 Dietikon", municipality: "Dietikon" };
    expect(venuePaths({ ...venue(), location: outside })).toEqual([]);
    expect(venuePaths({ ...venue(), location: { ...outside, kreis: 3 } })).toContain("location.kreis");
  });

  it("REQ-DATA-013: validates amenities and defaults missing ones to unknown", () => {
    expect(venuePaths({ ...venue(), amenities: { stroller: "maybe" } })).toContain("amenities.stroller");
    const { amenities: _a, ...noAmenities } = venue();
    expect(Venue.parse(noAmenities).amenities).toEqual({
      stroller: "unknown",
      changingTable: "unknown",
      cafe: "unknown",
    });
    expect(Venue.parse({ ...venue(), amenities: { stroller: "partial" } }).amenities).toEqual({
      stroller: "partial",
      changingTable: "unknown",
      cafe: "unknown",
    });
  });

  it("REQ-DATA-020: requires offer source", () => {
    const { source: _s, ...noSource } = offer();
    expect(venuePaths({ ...venue(), offers: [noSource] })).toContain("offers[0].source");
  });

  it("REQ-DATA-021: restricts offer category", () => {
    expect(venuePaths(withOffer({ category: "party" }))).toContain("offers[0].category");
    expect(venuePaths(withOffer({ category: "play-corner" }))).toEqual([]);
  });

  it("REQ-DATA-022: validates age range in whole months", () => {
    expect(venuePaths(withOffer({ ageMonths: { min: 24, max: 12 } }))).toContain("offers[0].ageMonths.max");
    expect(venuePaths(withOffer({ ageMonths: { min: 1.5 } }))).toContain("offers[0].ageMonths.min");
    expect(venuePaths(withOffer({ ageMonths: { min: 0, max: 48 } }))).toEqual([]);
    expect(venuePaths(withOffer({ ageMonths: {} }))).toEqual([]);
  });

  it("REQ-DATA-023: restricts setting", () => {
    expect(venuePaths(withOffer({ setting: "inside" }))).toContain("offers[0].setting");
    expect(venuePaths(withOffer({ setting: "both" }))).toEqual([]);
  });

  it("REQ-DATA-024: accepts the five price shapes and rejects invalid ones", () => {
    for (const price of [
      { type: "free" },
      { type: "fixed", chf: 5, note: "pro Kind" },
      { type: "range", minChf: 5, maxChf: 12 },
      { type: "donation" },
      { type: "unknown" },
    ]) {
      expect(venuePaths(withOffer({ price }))).toEqual([]);
    }
    expect(venuePaths(withOffer({ price: { type: "fixed" } }))).toContain("offers[0].price.chf");
    expect(venuePaths(withOffer({ price: { type: "fixed", chf: -1 } }))).toContain("offers[0].price.chf");
    expect(venuePaths(withOffer({ price: { type: "range", minChf: 10, maxChf: 5 } }))).toContain(
      "offers[0].price.maxChf",
    );
    expect(venuePaths(withOffer({ price: { type: "cheap" } }))).not.toEqual([]);
  });

  it("REQ-DATA-025: restricts registration", () => {
    expect(venuePaths(withOffer({ registration: "maybe" }))).toContain("offers[0].registration");
    expect(venuePaths(withOffer({ registration: "unknown" }))).toEqual([]);
  });

  it("REQ-DATA-026: validates source fields", () => {
    expect(venuePaths(withOffer({ source: { ...offer().source, by: "robot" } }))).toContain("offers[0].source.by");
    expect(venuePaths(withOffer({ source: { ...offer().source, lastVerified: "2026-13-01" } }))).toContain(
      "offers[0].source.lastVerified",
    );
  });

  it("REQ-DATA-027: requires absolute https URLs", () => {
    expect(venuePaths({ ...venue(), website: "http://example.ch" })).toContain("website");
    expect(venuePaths(withOffer({ url: "/angebote" }))).toContain("offers[0].url");
    expect(venuePaths({ ...venue(), website: "https://example.ch" })).toEqual([]);
  });

  it("REQ-DATA-030: validates weekly rules", () => {
    expect(venuePaths(withSchedule({ rules: [] }))).toContain("offers[0].schedule.rules");
    expect(venuePaths(withSchedule({ rules: [{ days: [], start: "09:00", end: "10:00" }] }))).toContain(
      "offers[0].schedule.rules[0].days",
    );
    expect(venuePaths(withSchedule({ rules: [{ days: ["tues"], start: "09:00", end: "10:00" }] }))).toContain(
      "offers[0].schedule.rules[0].days[0]",
    );
    expect(venuePaths(withSchedule({ rules: [{ days: ["tue"], start: "9:30", end: "10:00" }] }))).toContain(
      "offers[0].schedule.rules[0].start",
    );
    expect(venuePaths(withSchedule({ cancelled: ["2026-12-22"] }))).toEqual([]);
  });

  it("REQ-DATA-031: accepts openingHours with the same fields", () => {
    expect(venuePaths(withSchedule({ type: "openingHours" }))).toEqual([]);
  });

  it("REQ-DATA-032: validates dates schedules", () => {
    const dates = { type: "dates", dates: [{ date: "2026-10-10", start: "14:00", end: "15:00" }] };
    expect(venuePaths(withOffer({ schedule: dates }))).toEqual([]);
    expect(venuePaths(withOffer({ schedule: { type: "dates", dates: [] } }))).toContain(
      "offers[0].schedule.dates",
    );
  });

  it("REQ-DATA-033: requires end later than start", () => {
    expect(venuePaths(withSchedule({ rules: [{ days: ["tue"], start: "10:00", end: "10:00" }] }))).toContain(
      "offers[0].schedule.rules[0].end",
    );
    const dates = { type: "dates", dates: [{ date: "2026-10-10", start: "15:00", end: "14:00" }] };
    expect(venuePaths(withOffer({ schedule: dates }))).toContain("offers[0].schedule.dates[0].end");
  });

  it("REQ-DATA-034: requires validFrom <= validUntil", () => {
    expect(venuePaths(withSchedule({ validFrom: "2026-10-10", validUntil: "2026-10-01" }))).toContain(
      "offers[0].schedule.validUntil",
    );
    expect(venuePaths(withSchedule({ validFrom: "2026-10-01", validUntil: "2026-10-01" }))).toEqual([]);
  });

  it("REQ-DATA-035: requires explicit holiday behaviour", () => {
    const { pausesDuringSchoolHolidays: _p, ...schedule } = offer().schedule as Raw;
    expect(venuePaths(withOffer({ schedule }))).toContain("offers[0].schedule.pausesDuringSchoolHolidays");
  });
});

describe("Holidays schema", () => {
  it("REQ-DATA-040: validates school holiday ranges", () => {
    const valid = {
      schoolHolidays: [{ name: "Herbstferien", from: "2026-10-05", to: "2026-10-18" }],
      publicHolidays: [{ name: "Weihnachten", date: "2026-12-25" }],
    };
    expect(Holidays.safeParse(valid).success).toBe(true);
    const r = Holidays.safeParse({
      ...valid,
      schoolHolidays: [{ name: "X", from: "2026-10-18", to: "2026-10-05" }],
    });
    expect(r.success ? [] : r.error.issues.map((i) => formatPath(i.path))).toContain("schoolHolidays[0].to");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run packages/core/test/schema.test.ts`
Expected: FAIL – `Venue` / `formatPath` not exported.

- [ ] **Step 4: Implement**

`packages/core/src/issues.ts`:
```ts
export type Issue = { file: string; path: string; message: string };

// ["offers", 0, "schedule"] -> "offers[0].schedule"
export function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((acc, seg) => {
    if (typeof seg === "number") return `${acc}[${seg}]`;
    return acc ? `${acc}.${String(seg)}` : String(seg);
  }, "");
}

export function formatIssue(issue: Issue): string {
  return issue.path ? `${issue.file}: ${issue.path}: ${issue.message}` : `${issue.file}: ${issue.message}`;
}
```

`packages/core/src/schema/common.ts`:
```ts
import { z } from "zod";
import { isValidDate } from "../dates";

export const Id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be lowercase kebab-case");

export const IsoDate = z.string().refine(isValidDate, "must be a valid date YYYY-MM-DD");

export const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:MM (24h)");

export const HttpsUrl = z.string().refine((s) => {
  try {
    return new URL(s).protocol === "https:";
  } catch {
    return false;
  }
}, "must be an absolute https:// URL");
```

`packages/core/src/schema/venue.ts`:
```ts
import { z } from "zod";
import { WEEKDAYS } from "../dates";
import { HttpsUrl, Id, IsoDate, Time } from "./common";

type TimeRange = { start: string; end: string };

function endAfterStart(v: TimeRange, ctx: z.RefinementCtx) {
  if (v.end <= v.start) ctx.addIssue({ code: "custom", path: ["end"], message: "must be later than start" });
}

const Rule = z
  .strictObject({ days: z.array(z.enum(WEEKDAYS)).min(1), start: Time, end: Time })
  .superRefine(endAfterStart);

const DateEntry = z.strictObject({ date: IsoDate, start: Time, end: Time }).superRefine(endAfterStart);

const recurringFields = {
  rules: z.array(Rule).min(1),
  validFrom: IsoDate.optional(),
  validUntil: IsoDate.optional(),
  pausesDuringSchoolHolidays: z.boolean(),
  pausesOnPublicHolidays: z.boolean(),
  cancelled: z.array(IsoDate).optional(),
};

export const Schedule = z
  .discriminatedUnion("type", [
    z.strictObject({ type: z.literal("weekly"), ...recurringFields }),
    z.strictObject({ type: z.literal("openingHours"), ...recurringFields }),
    z.strictObject({ type: z.literal("dates"), dates: z.array(DateEntry).min(1) }),
  ])
  .superRefine((s, ctx) => {
    if (s.type !== "dates" && s.validFrom && s.validUntil && s.validFrom > s.validUntil) {
      ctx.addIssue({ code: "custom", path: ["validUntil"], message: "must not be before validFrom" });
    }
  });
export type Schedule = z.output<typeof Schedule>;

const note = z.string().optional();
const chf = z.number().min(0);

export const Price = z
  .discriminatedUnion("type", [
    z.strictObject({ type: z.literal("free") }),
    z.strictObject({ type: z.literal("fixed"), chf, note }),
    z.strictObject({ type: z.literal("range"), minChf: chf, maxChf: chf, note }),
    z.strictObject({ type: z.literal("donation"), note }),
    z.strictObject({ type: z.literal("unknown") }),
  ])
  .superRefine((p, ctx) => {
    if (p.type === "range" && p.maxChf < p.minChf) {
      ctx.addIssue({ code: "custom", path: ["maxChf"], message: "must not be less than minChf" });
    }
  });
export type Price = z.output<typeof Price>;

const AgeMonths = z
  .strictObject({ min: z.number().int().min(0).optional(), max: z.number().int().min(0).optional() })
  .superRefine((a, ctx) => {
    if (a.min !== undefined && a.max !== undefined && a.min > a.max) {
      ctx.addIssue({ code: "custom", path: ["max"], message: "must not be less than min" });
    }
  });

const Source = z.strictObject({ url: HttpsUrl, lastVerified: IsoDate, by: z.enum(["ai", "human"]) });

export const Offer = z.strictObject({
  id: Id,
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(["meetup", "play", "music", "movement", "culture", "nature", "course", "play-corner", "other"]),
  ageMonths: AgeMonths,
  setting: z.enum(["indoor", "outdoor", "both"]),
  price: Price,
  registration: z.enum(["none", "recommended", "required", "unknown"]),
  schedule: Schedule,
  url: HttpsUrl.optional(),
  source: Source,
  notes: z.string().optional(),
});
export type Offer = z.output<typeof Offer>;

const Location = z
  .strictObject({
    address: z.string().min(1),
    municipality: z.string().min(1),
    kreis: z.number().int().min(1).max(12).optional(),
  })
  .superRefine((l, ctx) => {
    if (l.municipality === "Zürich" && l.kreis === undefined) {
      ctx.addIssue({ code: "custom", path: ["kreis"], message: "is required in Zürich" });
    }
    if (l.municipality !== "Zürich" && l.kreis !== undefined) {
      ctx.addIssue({ code: "custom", path: ["kreis"], message: "must be absent outside Zürich" });
    }
  });

const YesNoUnknown = z.enum(["yes", "no", "unknown"]).default("unknown");

const Amenities = z
  .strictObject({
    stroller: z.enum(["yes", "partial", "no", "unknown"]).default("unknown"),
    changingTable: YesNoUnknown,
    cafe: YesNoUnknown,
  })
  .default({ stroller: "unknown", changingTable: "unknown", cafe: "unknown" });

export const Venue = z
  .strictObject({
    id: Id,
    name: z.string().min(1),
    type: z.enum(["community-centre", "club", "library", "indoor-playground", "museum", "cafe", "church", "other"]),
    location: Location,
    website: HttpsUrl.optional(),
    amenities: Amenities,
    notes: z.string().optional(),
    offers: z.array(Offer).min(1),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.offers.forEach((o, i) => {
      if (seen.has(o.id)) {
        ctx.addIssue({ code: "custom", path: ["offers", i, "id"], message: `duplicate offer id "${o.id}"` });
      }
      seen.add(o.id);
    });
  });
export type Venue = z.output<typeof Venue>;
```

`packages/core/src/schema/holidays.ts`:
```ts
import { z } from "zod";
import { IsoDate } from "./common";

const SchoolHoliday = z
  .strictObject({ name: z.string().min(1), from: IsoDate, to: IsoDate })
  .superRefine((h, ctx) => {
    if (h.from > h.to) ctx.addIssue({ code: "custom", path: ["to"], message: "must not be before from" });
  });

export const Holidays = z.strictObject({
  schoolHolidays: z.array(SchoolHoliday),
  publicHolidays: z.array(z.strictObject({ name: z.string().min(1), date: IsoDate })),
});
export type Holidays = z.output<typeof Holidays>;
```

Update `packages/core/src/index.ts`:
```ts
// Browser-safe entry point. Never import node:* modules here.
export * from "./dates";
export * from "./issues";
export * from "./schema/venue";
export * from "./schema/holidays";
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all PASS. If Zod reports a path differently than asserted (e.g.
for an unmatched discriminator), fix the schema so the path points at the
offending field — do not weaken the assertion.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): add venue, offer, schedule and holiday schemas"
```

---

### Task 3: Occurrence engine

**Files:**
- Create: `packages/core/src/occurrences.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/occurrences.test.ts`

**Interfaces:**
- Consumes: `Venue`, `Holidays`, `addDays`, `weekday` (Tasks 1–2); fixtures `venue`, `offer`, `noHolidays`
- Produces:
  ```ts
  type Occurrence = { key: string; date: string; start: string; end: string; kind: "session" | "open" };
  function occurrences(venues: Venue[], holidays: Holidays, from: string, to: string): Occurrence[];
  ```

Calendar reference: 2026-10-06, -13, -20, -27 are Tuesdays; 2026-10-05 is a
Monday; DST ends 2026-10-25 and starts 2027-03-28 (both Sundays).

- [ ] **Step 1: Write the failing test** – `packages/core/test/occurrences.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { type Holidays, type Schedule, occurrences } from "../src";
import { noHolidays, offer, venue } from "./fixtures";

const weekly = (fields: Partial<Extract<Schedule, { type: "weekly" }>> = {}): Schedule => ({
  type: "weekly",
  rules: [{ days: ["tue"], start: "09:30", end: "11:30" }],
  pausesDuringSchoolHolidays: false,
  pausesOnPublicHolidays: false,
  ...fields,
});

function datesOf(schedule: Schedule, from: string, to: string, holidays: Holidays = noHolidays): string[] {
  return occurrences([venue({ offers: [offer({ schedule })] })], holidays, from, to).map((o) => o.date);
}

const autumn: Holidays = {
  schoolHolidays: [{ name: "Herbstferien", from: "2026-10-05", to: "2026-10-18" }],
  publicHolidays: [{ name: "Testfeiertag", date: "2026-10-13" }],
};

describe("occurrences", () => {
  it("REQ-OCC-001: includes both range bounds", () => {
    expect(datesOf(weekly(), "2026-10-06", "2026-10-20")).toEqual(["2026-10-06", "2026-10-13", "2026-10-20"]);
  });

  it("REQ-OCC-002: produces one occurrence per matching weekday", () => {
    const s = weekly({ rules: [{ days: ["mon", "wed"], start: "09:00", end: "10:00" }] });
    expect(datesOf(s, "2026-10-05", "2026-10-11")).toEqual(["2026-10-05", "2026-10-07"]);
  });

  it("REQ-OCC-003: respects validFrom and validUntil inclusively", () => {
    const s = weekly({ validFrom: "2026-10-13", validUntil: "2026-10-20" });
    expect(datesOf(s, "2026-10-01", "2026-10-31")).toEqual(["2026-10-13", "2026-10-20"]);
  });

  it("REQ-OCC-004: skips school holidays only when the schedule pauses", () => {
    const h = { ...autumn, publicHolidays: [] };
    expect(datesOf(weekly({ pausesDuringSchoolHolidays: true }), "2026-10-01", "2026-10-31", h)).toEqual([
      "2026-10-20",
      "2026-10-27",
    ]);
    expect(datesOf(weekly(), "2026-10-01", "2026-10-31", h)).toEqual([
      "2026-10-06",
      "2026-10-13",
      "2026-10-20",
      "2026-10-27",
    ]);
  });

  it("REQ-OCC-005: skips public holidays only when the schedule pauses", () => {
    const h = { ...autumn, schoolHolidays: [] };
    expect(datesOf(weekly({ pausesOnPublicHolidays: true }), "2026-10-06", "2026-10-20", h)).toEqual([
      "2026-10-06",
      "2026-10-20",
    ]);
    expect(datesOf(weekly(), "2026-10-06", "2026-10-20", h)).toContain("2026-10-13");
  });

  it("REQ-OCC-006: skips cancelled dates", () => {
    expect(datesOf(weekly({ cancelled: ["2026-10-13"] }), "2026-10-06", "2026-10-20")).toEqual([
      "2026-10-06",
      "2026-10-20",
    ]);
  });

  it("REQ-OCC-007: returns listed dates within range as sessions, ignoring holidays", () => {
    const s: Schedule = {
      type: "dates",
      dates: [
        { date: "2026-09-01", start: "10:00", end: "11:00" },
        { date: "2026-10-13", start: "14:00", end: "15:00" },
        { date: "2026-11-01", start: "10:00", end: "11:00" },
      ],
    };
    const result = occurrences([venue({ offers: [offer({ schedule: s })] })], autumn, "2026-10-01", "2026-10-31");
    expect(result).toEqual([
      { key: "gz-test/treff", date: "2026-10-13", start: "14:00", end: "15:00", kind: "session" },
    ]);
  });

  it("REQ-OCC-008: sorts by date, start, key", () => {
    const b = venue({
      id: "b-venue",
      offers: [offer({ schedule: weekly({ rules: [{ days: ["tue"], start: "09:30", end: "10:00" }] }) })],
    });
    const a = venue({
      id: "a-venue",
      offers: [
        offer({ id: "late", schedule: weekly({ rules: [{ days: ["tue"], start: "14:00", end: "15:00" }] }) }),
        offer({ id: "early", schedule: weekly({ rules: [{ days: ["tue"], start: "09:30", end: "10:00" }] }) }),
      ],
    });
    const keys = occurrences([b, a], noHolidays, "2026-10-06", "2026-10-13").map((o) => `${o.date} ${o.start} ${o.key}`);
    expect(keys).toEqual([
      "2026-10-06 09:30 a-venue/early",
      "2026-10-06 09:30 b-venue/treff",
      "2026-10-06 14:00 a-venue/late",
      "2026-10-13 09:30 a-venue/early",
      "2026-10-13 09:30 b-venue/treff",
      "2026-10-13 14:00 a-venue/late",
    ]);
  });

  it("REQ-OCC-009: is unaffected by DST transitions", () => {
    const sunday = weekly({ rules: [{ days: ["sun"], start: "10:00", end: "12:00" }] });
    expect(datesOf(sunday, "2026-10-18", "2026-11-01")).toEqual(["2026-10-18", "2026-10-25", "2026-11-01"]);
    expect(datesOf(sunday, "2027-03-21", "2027-04-04")).toEqual(["2027-03-21", "2027-03-28", "2027-04-04"]);
    const result = occurrences([venue({ offers: [offer({ schedule: sunday })] })], noHolidays, "2026-10-25", "2026-10-25");
    expect(result[0]).toMatchObject({ start: "10:00", end: "12:00" });
  });

  it("REQ-OCC-010: allows several occurrences of one offer per day; openingHours are 'open'", () => {
    const s: Schedule = {
      type: "openingHours",
      rules: [
        { days: ["tue"], start: "09:00", end: "11:00" },
        { days: ["tue"], start: "14:00", end: "17:00" },
      ],
      pausesDuringSchoolHolidays: false,
      pausesOnPublicHolidays: false,
    };
    const result = occurrences([venue({ offers: [offer({ schedule: s })] })], noHolidays, "2026-10-06", "2026-10-06");
    expect(result).toEqual([
      { key: "gz-test/treff", date: "2026-10-06", start: "09:00", end: "11:00", kind: "open" },
      { key: "gz-test/treff", date: "2026-10-06", start: "14:00", end: "17:00", kind: "open" },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/test/occurrences.test.ts`
Expected: FAIL – `occurrences` not exported.

- [ ] **Step 3: Implement** – `packages/core/src/occurrences.ts`

```ts
import { addDays, weekday } from "./dates";
import type { Holidays } from "./schema/holidays";
import type { Venue } from "./schema/venue";

export type Occurrence = {
  key: string; // "<venue-id>/<offer-id>"
  date: string;
  start: string;
  end: string;
  kind: "session" | "open";
};

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// Expands all schedules into concrete occurrences for [from, to] (inclusive).
// Pure: no clock, no I/O. ISO date strings compare correctly as strings.
export function occurrences(venues: Venue[], holidays: Holidays, from: string, to: string): Occurrence[] {
  const publicHolidays = new Set(holidays.publicHolidays.map((h) => h.date));
  const isSchoolHoliday = (d: string) => holidays.schoolHolidays.some((h) => h.from <= d && d <= h.to);
  const out: Occurrence[] = [];

  for (const venue of venues) {
    for (const offer of venue.offers) {
      const key = `${venue.id}/${offer.id}`;
      const s = offer.schedule;

      if (s.type === "dates") {
        for (const e of s.dates) {
          if (from <= e.date && e.date <= to) out.push({ key, date: e.date, start: e.start, end: e.end, kind: "session" });
        }
        continue;
      }

      const kind = s.type === "openingHours" ? "open" : "session";
      const cancelled = new Set(s.cancelled ?? []);
      const first = s.validFrom && s.validFrom > from ? s.validFrom : from;
      const last = s.validUntil && s.validUntil < to ? s.validUntil : to;

      for (let d = first; d <= last; d = addDays(d, 1)) {
        if (cancelled.has(d)) continue;
        if (s.pausesOnPublicHolidays && publicHolidays.has(d)) continue;
        if (s.pausesDuringSchoolHolidays && isSchoolHoliday(d)) continue;
        const wd = weekday(d);
        for (const r of s.rules) {
          if (r.days.includes(wd)) out.push({ key, date: d, start: r.start, end: r.end, kind });
        }
      }
    }
  }

  return out.sort((a, b) => cmp(a.date, b.date) || cmp(a.start, b.start) || cmp(a.key, b.key));
}
```

Add to `packages/core/src/index.ts`:
```ts
export * from "./occurrences";
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): add occurrence engine"
```

---

### Task 4: Staleness, dataset loading and warnings

**Files:**
- Create: `packages/core/src/staleness.ts`, `packages/core/src/load.ts`, `packages/core/src/warnings.ts`
- Modify: `packages/core/src/index.ts`, `packages/core/src/node.ts`
- Create: `packages/core/test/tmp-data.ts`
- Test: `packages/core/test/staleness.test.ts`, `packages/core/test/load.test.ts`

**Interfaces:**
- Consumes: schemas, `formatPath`, `Issue`, `addDays`, `daysBetween`
- Produces:
  - `@zueri-kids/core`: `STALE_AFTER_DAYS = 90`, `isStale(offer: Offer, today: string): boolean`
  - `@zueri-kids/core/node`:
    - `type Dataset = { venues: Venue[]; holidays: Holidays }`
    - `type LoadResult = { dataset: Dataset; errors: Issue[] }`
    - `loadDataset(dataDir: string, today: string): LoadResult` — issue `file` values are `join(dataDir, "venues", "<name>.yaml")` / `join(dataDir, "holidays.yaml")`
    - `HOLIDAY_HORIZON_DAYS = 60`, `collectWarnings(dataset: Dataset, dataDir: string, today: string): Issue[]`
  - Test helpers: `writeDataDir(files: Record<string, string>): string` (returns temp dir), `VALID_VENUE_YAML`, `VALID_HOLIDAYS_YAML`

- [ ] **Step 1: Write test helper** – `packages/core/test/tmp-data.ts`

```ts
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

// Creates a temporary data directory. Keys are paths relative to it,
// e.g. "venues/gz-test.yaml" or "holidays.yaml".
export function writeDataDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "zueri-kids-"));
  mkdirSync(join(dir, "venues"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

export const VALID_HOLIDAYS_YAML = `
schoolHolidays:
  - { name: Weihnachtsferien, from: 2026-12-21, to: 2027-01-03 }
publicHolidays:
  - { name: Weihnachten, date: 2026-12-25 }
`;

export function venueYaml(id: string, lastVerified = "2026-09-01"): string {
  return `
id: ${id}
name: GZ Test
type: community-centre
location: { address: "Teststrasse 1, 8003 Zürich", municipality: Zürich, kreis: 3 }
offers:
  - id: treff
    title: Treff
    category: meetup
    ageMonths: { min: 0, max: 48 }
    setting: indoor
    price: { type: free }
    registration: none
    schedule:
      type: weekly
      rules:
        - { days: [tue], start: "09:30", end: "11:30" }
      pausesDuringSchoolHolidays: true
      pausesOnPublicHolidays: true
    source: { url: "https://example.ch/", lastVerified: ${lastVerified}, by: ai }
`;
}

export const VALID_VENUE_YAML = venueYaml("gz-test");
```

- [ ] **Step 2: Write the failing tests**

`packages/core/test/staleness.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { STALE_AFTER_DAYS, isStale } from "../src";
import { offer, source } from "./fixtures";

describe("staleness", () => {
  it("REQ-DATA-050: offers verified more than 90 days ago are stale", () => {
    expect(STALE_AFTER_DAYS).toBe(90);
    const o = offer({ source: { ...source, lastVerified: "2026-07-01" } });
    expect(isStale(o, "2026-09-29")).toBe(false); // 90 days
    expect(isStale(o, "2026-09-30")).toBe(true); // 91 days
  });
});
```

`packages/core/test/load.test.ts`:
```ts
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatIssue } from "../src";
import { collectWarnings, loadDataset } from "../src/node";
import { VALID_HOLIDAYS_YAML, VALID_VENUE_YAML, venueYaml, writeDataDir } from "./tmp-data";

const TODAY = "2026-09-30";

describe("loadDataset", () => {
  it("REQ-DATA-001: loads venues from data/venues/<id>.yaml", () => {
    const dir = writeDataDir({ "venues/gz-test.yaml": VALID_VENUE_YAML, "holidays.yaml": VALID_HOLIDAYS_YAML });
    const { dataset, errors } = loadDataset(dir, TODAY);
    expect(errors).toEqual([]);
    expect(dataset.venues.map((v) => v.id)).toEqual(["gz-test"]);
    // yaml 1.2: unquoted dates and times stay strings
    expect(dataset.venues[0].offers[0].source.lastVerified).toBe("2026-09-01");
  });

  it("REQ-DATA-001: reports a file name that does not match the id", () => {
    const dir = writeDataDir({ "venues/gz-other.yaml": VALID_VENUE_YAML, "holidays.yaml": VALID_HOLIDAYS_YAML });
    const { dataset, errors } = loadDataset(dir, TODAY);
    expect(errors.map(formatIssue)).toEqual([
      `${join(dir, "venues", "gz-other.yaml")}: id: must match file name "gz-other"`,
    ]);
    expect(dataset.venues).toEqual([]);
  });

  it("REQ-DATA-003: loads holidays from data/holidays.yaml and reports a missing file", () => {
    const ok = loadDataset(writeDataDir({ "holidays.yaml": VALID_HOLIDAYS_YAML }), TODAY);
    expect(ok.dataset.holidays.publicHolidays).toEqual([{ name: "Weihnachten", date: "2026-12-25" }]);
    const dir = writeDataDir({});
    expect(loadDataset(dir, TODAY).errors.map(formatIssue)).toEqual([`${join(dir, "holidays.yaml")}: file not found`]);
  });

  it("REQ-DATA-026: rejects lastVerified in the future", () => {
    const dir = writeDataDir({ "venues/gz-test.yaml": venueYaml("gz-test", "2026-10-01"), "holidays.yaml": VALID_HOLIDAYS_YAML });
    expect(loadDataset(dir, TODAY).errors.map((e) => `${e.path}: ${e.message}`)).toEqual([
      "offers[0].source.lastVerified: must not be in the future",
    ]);
  });

  it("reports YAML syntax errors and keeps loading other files", () => {
    const dir = writeDataDir({
      "venues/a-broken.yaml": "id: [unclosed",
      "venues/gz-test.yaml": VALID_VENUE_YAML,
      "holidays.yaml": VALID_HOLIDAYS_YAML,
    });
    const { dataset, errors } = loadDataset(dir, TODAY);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/^YAML syntax error/);
    expect(dataset.venues.map((v) => v.id)).toEqual(["gz-test"]);
  });
});

describe("collectWarnings", () => {
  it("REQ-CLI-005: warns about stale offers", () => {
    const dir = writeDataDir({ "venues/gz-test.yaml": venueYaml("gz-test", "2026-06-01"), "holidays.yaml": VALID_HOLIDAYS_YAML });
    const { dataset } = loadDataset(dir, TODAY);
    expect(collectWarnings(dataset, dir, TODAY).map(formatIssue)).toEqual([
      `${join(dir, "venues", "gz-test.yaml")}: offers[0].source.lastVerified: stale: last verified 2026-06-01 (121 days ago)`,
    ]);
  });

  it("REQ-CLI-005: warns when no school holidays end more than 60 days from today", () => {
    const dir = writeDataDir({ "holidays.yaml": VALID_HOLIDAYS_YAML });
    const { dataset } = loadDataset(dir, "2026-11-10");
    expect(collectWarnings(dataset, dir, "2026-11-10").map(formatIssue)).toEqual([
      `${join(dir, "holidays.yaml")}: schoolHolidays: no school holidays ending after 2027-01-09; add the next school year`,
    ]);
    expect(collectWarnings(dataset, dir, TODAY)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run packages/core/test/staleness.test.ts packages/core/test/load.test.ts`
Expected: FAIL – missing exports.

- [ ] **Step 4: Implement**

`packages/core/src/staleness.ts`:
```ts
import { daysBetween } from "./dates";
import type { Offer } from "./schema/venue";

export const STALE_AFTER_DAYS = 90;

export function isStale(offer: Offer, today: string): boolean {
  return daysBetween(offer.source.lastVerified, today) > STALE_AFTER_DAYS;
}
```

`packages/core/src/load.ts`:
```ts
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { ZodError } from "zod";
import { type Issue, formatPath } from "./issues";
import { Holidays } from "./schema/holidays";
import { Venue } from "./schema/venue";

export type Dataset = { venues: Venue[]; holidays: Holidays };
export type LoadResult = { dataset: Dataset; errors: Issue[] };

type ReadResult = { ok: true; value: unknown } | { ok: false };

function readYaml(file: string, errors: Issue[]): ReadResult {
  if (!existsSync(file)) {
    errors.push({ file, path: "", message: "file not found" });
    return { ok: false };
  }
  try {
    return { ok: true, value: parseYaml(readFileSync(file, "utf8")) };
  } catch (e) {
    errors.push({ file, path: "", message: `YAML syntax error: ${(e as Error).message}` });
    return { ok: false };
  }
}

function zodIssues(file: string, error: ZodError): Issue[] {
  return error.issues.map((i) => ({ file, path: formatPath(i.path), message: i.message }));
}

// Checks that need context beyond the file content itself.
function contextIssues(file: string, expectedId: string, venue: Venue, today: string): Issue[] {
  const issues: Issue[] = [];
  if (venue.id !== expectedId) issues.push({ file, path: "id", message: `must match file name "${expectedId}"` });
  venue.offers.forEach((o, i) => {
    if (o.source.lastVerified > today) {
      issues.push({ file, path: `offers[${i}].source.lastVerified`, message: "must not be in the future" });
    }
  });
  return issues;
}

// Loads and validates all data. Only fully valid venues end up in the dataset;
// every problem is collected in `errors` (never throws on bad data).
export function loadDataset(dataDir: string, today: string): LoadResult {
  const errors: Issue[] = [];
  const venues: Venue[] = [];

  const venuesDir = join(dataDir, "venues");
  const names = existsSync(venuesDir) ? readdirSync(venuesDir).filter((f) => f.endsWith(".yaml")).sort() : [];
  for (const name of names) {
    const file = join(venuesDir, name);
    const raw = readYaml(file, errors);
    if (!raw.ok) continue;
    const parsed = Venue.safeParse(raw.value);
    if (!parsed.success) {
      errors.push(...zodIssues(file, parsed.error));
      continue;
    }
    const issues = contextIssues(file, basename(name, ".yaml"), parsed.data, today);
    if (issues.length > 0) {
      errors.push(...issues);
      continue;
    }
    venues.push(parsed.data);
  }

  let holidays: Holidays = { schoolHolidays: [], publicHolidays: [] };
  const holidaysFile = join(dataDir, "holidays.yaml");
  const raw = readYaml(holidaysFile, errors);
  if (raw.ok) {
    const parsed = Holidays.safeParse(raw.value);
    if (parsed.success) holidays = parsed.data;
    else errors.push(...zodIssues(holidaysFile, parsed.error));
  }

  return { dataset: { venues, holidays }, errors };
}
```

`packages/core/src/warnings.ts`:
```ts
import { join } from "node:path";
import { addDays, daysBetween } from "./dates";
import type { Issue } from "./issues";
import type { Dataset } from "./load";
import { isStale } from "./staleness";

export const HOLIDAY_HORIZON_DAYS = 60;

export function collectWarnings(dataset: Dataset, dataDir: string, today: string): Issue[] {
  const warnings: Issue[] = [];
  for (const venue of dataset.venues) {
    venue.offers.forEach((o, i) => {
      if (!isStale(o, today)) return;
      warnings.push({
        file: join(dataDir, "venues", `${venue.id}.yaml`),
        path: `offers[${i}].source.lastVerified`,
        message: `stale: last verified ${o.source.lastVerified} (${daysBetween(o.source.lastVerified, today)} days ago)`,
      });
    });
  }
  const horizon = addDays(today, HOLIDAY_HORIZON_DAYS);
  if (!dataset.holidays.schoolHolidays.some((h) => h.to > horizon)) {
    warnings.push({
      file: join(dataDir, "holidays.yaml"),
      path: "schoolHolidays",
      message: `no school holidays ending after ${horizon}; add the next school year`,
    });
  }
  return warnings;
}
```

Add to `packages/core/src/index.ts`:
```ts
export * from "./staleness";
```

Replace `packages/core/src/node.ts`:
```ts
// Node-only entry point (file system access).
export * from "./load";
export * from "./warnings";
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): load dataset from YAML with staleness and holiday warnings"
```

---

### Task 5: `npm run validate`

**Files:**
- Create: `packages/cli/package.json`, `packages/cli/src/validate.ts`, `packages/cli/src/bin/validate.ts`
- Test: `packages/cli/test/validate.test.ts`

**Interfaces:**
- Consumes: `loadDataset`, `collectWarnings` (`@zueri-kids/core/node`), `formatIssue`, `todayInZurich` (`@zueri-kids/core`); test helpers from `packages/core/test/tmp-data.ts`
- Produces: `runValidate(dataDir: string, today: string): { output: string; exitCode: 0 | 1 }`

- [ ] **Step 1: Create the package**

`packages/cli/package.json`:
```json
{
  "name": "@zueri-kids/cli",
  "private": true,
  "type": "module",
  "dependencies": { "@zueri-kids/core": "*" }
}
```

Run: `npm install`
Expected: `node_modules/@zueri-kids/core` symlinked.

- [ ] **Step 2: Write the failing test** – `packages/cli/test/validate.test.ts`

```ts
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VALID_HOLIDAYS_YAML, VALID_VENUE_YAML, venueYaml, writeDataDir } from "../../core/test/tmp-data";
import { runValidate } from "../src/validate";

const TODAY = "2026-09-30";

describe("validate", () => {
  it("REQ-CLI-001: exits 0 for valid data and 1 for invalid data", () => {
    const ok = writeDataDir({ "venues/gz-test.yaml": VALID_VENUE_YAML, "holidays.yaml": VALID_HOLIDAYS_YAML });
    expect(runValidate(ok, TODAY)).toEqual({
      exitCode: 0,
      output: "1 valid venues, 1 offers, 0 errors, 0 warnings",
    });
    const bad = writeDataDir({ "venues/gz-test.yaml": "id: gz-test", "holidays.yaml": VALID_HOLIDAYS_YAML });
    expect(runValidate(bad, TODAY).exitCode).toBe(1);
  });

  it("REQ-CLI-002: names file, field path and problem", () => {
    const yaml = VALID_VENUE_YAML.replace('end: "11:30"', 'end: "09:00"');
    const dir = writeDataDir({ "venues/gz-test.yaml": yaml, "holidays.yaml": VALID_HOLIDAYS_YAML });
    expect(runValidate(dir, TODAY).output).toContain(
      `ERROR ${join(dir, "venues", "gz-test.yaml")}: offers[0].schedule.rules[0].end: must be later than start`,
    );
  });

  it("REQ-CLI-003: reports errors of all files", () => {
    const dir = writeDataDir({
      "venues/a.yaml": "id: a",
      "venues/b.yaml": "id: b",
      "holidays.yaml": VALID_HOLIDAYS_YAML,
    });
    const output = runValidate(dir, TODAY).output;
    expect(output).toContain(join(dir, "venues", "a.yaml"));
    expect(output).toContain(join(dir, "venues", "b.yaml"));
  });

  it("REQ-CLI-004: checks file name and duplicate offer IDs", () => {
    const duplicate = VALID_VENUE_YAML + VALID_VENUE_YAML.slice(VALID_VENUE_YAML.indexOf("  - id: treff"));
    const dir = writeDataDir({
      "venues/wrong-name.yaml": VALID_VENUE_YAML,
      "venues/gz-dup.yaml": duplicate.replace("id: gz-test", "id: gz-dup"),
      "holidays.yaml": VALID_HOLIDAYS_YAML,
    });
    const output = runValidate(dir, TODAY).output;
    expect(output).toContain('id: must match file name "wrong-name"');
    expect(output).toContain('offers[1].id: duplicate offer id "treff"');
  });

  it("REQ-CLI-005: prints warnings without failing", () => {
    const dir = writeDataDir({ "venues/gz-test.yaml": venueYaml("gz-test", "2026-06-01"), "holidays.yaml": VALID_HOLIDAYS_YAML });
    const result = runValidate(dir, TODAY);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("WARN  ");
    expect(result.output).toContain("stale: last verified 2026-06-01");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run packages/cli/test/validate.test.ts`
Expected: FAIL – cannot resolve `../src/validate`.

- [ ] **Step 4: Implement**

`packages/cli/src/validate.ts`:
```ts
import { formatIssue } from "@zueri-kids/core";
import { collectWarnings, loadDataset } from "@zueri-kids/core/node";

export function runValidate(dataDir: string, today: string): { output: string; exitCode: 0 | 1 } {
  const { dataset, errors } = loadDataset(dataDir, today);
  const warnings = collectWarnings(dataset, dataDir, today);
  const offers = dataset.venues.reduce((n, v) => n + v.offers.length, 0);
  const lines = [
    ...errors.map((e) => `ERROR ${formatIssue(e)}`),
    ...warnings.map((w) => `WARN  ${formatIssue(w)}`),
    `${dataset.venues.length} valid venues, ${offers} offers, ${errors.length} errors, ${warnings.length} warnings`,
  ];
  return { output: lines.join("\n"), exitCode: errors.length > 0 ? 1 : 0 };
}
```

`packages/cli/src/bin/validate.ts`:
```ts
import { todayInZurich } from "@zueri-kids/core";
import { runValidate } from "../validate";

const result = runValidate(process.argv[2] ?? "data", todayInZurich(new Date()));
console.log(result.output);
process.exit(result.exitCode);
```

- [ ] **Step 5: Run tests, typecheck and the command**

Run: `npm test && npm run typecheck && npm run validate`
Expected: tests PASS. `npm run validate` exits 1 with
`ERROR data/holidays.yaml: file not found` (data comes in Task 8).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(cli): add validate command"
```

---

### Task 6: `npm run report`

**Files:**
- Create: `packages/cli/src/report.ts`, `packages/cli/src/bin/report.ts`
- Test: `packages/cli/test/report.test.ts`

**Interfaces:**
- Consumes: `Dataset` type, `loadDataset` (`@zueri-kids/core/node`), `isStale`, `formatIssue`, `todayInZurich`; fixtures `venue`, `offer`, `source`, `noHolidays`
- Produces: `buildReport(dataset: Dataset, today: string): string`

- [ ] **Step 1: Write the failing test** – `packages/cli/test/report.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { noHolidays, offer, source, venue } from "../../core/test/fixtures";
import { buildReport } from "../src/report";

describe("report", () => {
  it("REQ-CLI-010: counts per kreis and category, lists stale offers and unknowns", () => {
    const dataset = {
      holidays: noHolidays,
      venues: [
        venue({
          id: "gz-heuried",
          amenities: { stroller: "yes", changingTable: "unknown", cafe: "yes" },
          offers: [
            offer({ id: "krabbeltreff", source: { ...source, lastVerified: "2026-05-01" } }),
            offer({ id: "singen", category: "music", price: { type: "unknown" }, registration: "unknown" }),
          ],
        }),
        venue({
          id: "spielhalle",
          type: "indoor-playground",
          location: { address: "Hauptstrasse 1, 8953 Dietikon", municipality: "Dietikon" },
          offers: [offer({ id: "halle", category: "play", source: { ...source, lastVerified: "2026-06-01" } })],
        }),
        venue({ id: "gz-wipkingen", location: { address: "x", municipality: "Zürich", kreis: 10 } }),
      ],
    };
    expect(buildReport(dataset, "2026-09-30")).toBe(
      [
        "Venues: 3 · Offers: 4",
        "",
        "By kreis:",
        "  Kreis 3: 1 venues, 2 offers",
        "  Kreis 10: 1 venues, 1 offers",
        "  Outside Zurich: 1 venues, 1 offers",
        "",
        "By category:",
        "  meetup: 2",
        "  music: 1",
        "  play: 1",
        "",
        "Stale offers (2):",
        "  2026-05-01  gz-heuried/krabbeltreff",
        "  2026-06-01  spielhalle/halle",
        "",
        "Unknown values:",
        "  amenities.cafe: 2",
        "  amenities.changingTable: 3",
        "  amenities.stroller: 2",
        "  price: 1",
        "  registration: 1",
      ].join("\n"),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/cli/test/report.test.ts`
Expected: FAIL – cannot resolve `../src/report`.

- [ ] **Step 3: Implement**

`packages/cli/src/report.ts`:
```ts
import { isStale } from "@zueri-kids/core";
import type { Dataset } from "@zueri-kids/core/node";

function countBy(items: string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

export function buildReport(dataset: Dataset, today: string): string {
  const { venues } = dataset;
  const offers = venues.flatMap((v) => v.offers.map((o) => ({ venue: v, offer: o })));
  const lines = [`Venues: ${venues.length} · Offers: ${offers.length}`, "", "By kreis:"];

  const OUTSIDE = 99; // sorts after Kreis 1–12
  const kreise = [...new Set(venues.map((v) => v.location.kreis ?? OUTSIDE))].sort((a, b) => a - b);
  for (const k of kreise) {
    const inKreis = venues.filter((v) => (v.location.kreis ?? OUTSIDE) === k);
    const label = k === OUTSIDE ? "Outside Zurich" : `Kreis ${k}`;
    const offerCount = inKreis.reduce((n, v) => n + v.offers.length, 0);
    lines.push(`  ${label}: ${inKreis.length} venues, ${offerCount} offers`);
  }

  lines.push("", "By category:");
  for (const [category, n] of countBy(offers.map(({ offer }) => offer.category))) lines.push(`  ${category}: ${n}`);

  const stale = offers
    .filter(({ offer }) => isStale(offer, today))
    .map(({ venue, offer }) => ({ date: offer.source.lastVerified, key: `${venue.id}/${offer.id}` }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  lines.push("", `Stale offers (${stale.length}):`, ...stale.map((s) => `  ${s.date}  ${s.key}`));

  const unknownFields = [
    ...venues.flatMap((v) =>
      Object.entries(v.amenities)
        .filter(([, value]) => value === "unknown")
        .map(([field]) => `amenities.${field}`),
    ),
    ...offers.filter(({ offer }) => offer.price.type === "unknown").map(() => "price"),
    ...offers.filter(({ offer }) => offer.registration === "unknown").map(() => "registration"),
  ];
  const unknowns = countBy(unknownFields);
  lines.push("", "Unknown values:", ...(unknowns.length ? unknowns.map(([f, n]) => `  ${f}: ${n}`) : ["  none"]));

  return lines.join("\n");
}
```

`packages/cli/src/bin/report.ts`:
```ts
import { formatIssue, todayInZurich } from "@zueri-kids/core";
import { loadDataset } from "@zueri-kids/core/node";
import { buildReport } from "../report";

const today = todayInZurich(new Date());
const { dataset, errors } = loadDataset(process.argv[2] ?? "data", today);
if (errors.length > 0) {
  console.error(errors.map((e) => `ERROR ${formatIssue(e)}`).join("\n"));
  console.error("Data has errors; run `npm run validate` and fix them first.");
  process.exit(1);
}
console.log(buildReport(dataset, today));
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(cli): add report command"
```

---

### Task 7: `npm run trace`

**Files:**
- Create: `packages/cli/src/trace.ts`, `packages/cli/src/bin/trace.ts`
- Test: `packages/cli/test/trace.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type SourceFile = { file: string; content: string };
  type Requirement = { id: string; file: string; manual: boolean; removed: boolean; enforced: boolean };
  type TraceResult = { requirements: Requirement[]; coverage: Map<string, string[]>; errors: string[] };
  function parseRequirements(spec: SourceFile): Requirement[];
  function trace(specs: SourceFile[], tests: SourceFile[]): TraceResult;
  function formatTrace(result: TraceResult): string;
  ```

Parsing rules (from REQ-META-004/006, REQ-CLI-020–022):
- A definition is a line `- **REQ-<AREA>-<NNN>…` (optionally indented).
- Its first paragraph runs until a blank line or the next list item.
- `manual` / `removed`: that paragraph (trimmed) ends with `(manual)` /
  `(removed)`.
- `enforced`: the spec contains a line `Status: Implemented…`.

- [ ] **Step 1: Write the failing test** – `packages/cli/test/trace.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { formatTrace, parseRequirements, trace } from "../src/trace";

// Fake IDs are built by concatenation so this file does not reference
// requirements that do not exist.
const R = (suffix: string) => "REQ" + "-" + suffix;

const spec = (status: string, body: string) => ({ file: "docs/specs/x.md", content: `# X\n\nStatus: ${status}\n\n${body}` });

describe("trace", () => {
  it("REQ-CLI-020: parses definitions, markers and spec status", () => {
    const s = spec(
      "Implemented · Last updated: 2026-09-30",
      [
        `- **${R("XMP-001")}:** Something testable that mentions (manual) in the middle`,
        `  and continues here.`,
        `- **${R("XMP-002")}:** Reviewed by hand. (manual)`,
        `- **${R("XMP-003") } (label):** Retired.`,
        `  (removed)`,
        ``,
        `Text mentioning ${R("XMP-001")} is not a definition.`,
      ].join("\n"),
    );
    expect(parseRequirements(s)).toEqual([
      { id: R("XMP-001"), file: s.file, manual: false, removed: false, enforced: true },
      { id: R("XMP-002"), file: s.file, manual: true, removed: false, enforced: true },
      { id: R("XMP-003"), file: s.file, manual: false, removed: true, enforced: true },
    ]);
    expect(parseRequirements(spec("Draft", `- **${R("XMP-001")}:** x`))[0].enforced).toBe(false);
  });

  it("REQ-META-004: errors on untested REQs in implemented specs only", () => {
    const implemented = spec("Implemented", `- **${R("XMP-001")}:** a\n- **${R("XMP-002")}:** b (manual)`);
    const draft = { ...spec("Draft", `- **${R("DRF-001")}:** c`), file: "docs/specs/y.md" };
    const result = trace([implemented, draft], []);
    expect(result.errors).toEqual([`${R("XMP-001")} (docs/specs/x.md) has no test`]);
    expect(formatTrace(result)).toContain(`${R("DRF-001")}  docs/specs/y.md  pending`);
  });

  it("REQ-META-004: records which tests cover a REQ", () => {
    const s = spec("Implemented", `- **${R("XMP-001")}:** a`);
    const result = trace([s], [{ file: "a.test.ts", content: `it("${R("XMP-001")}: works")` }]);
    expect(result.errors).toEqual([]);
    expect(result.coverage.get(R("XMP-001"))).toEqual(["a.test.ts"]);
    expect(formatTrace(result)).toContain(`${R("XMP-001")}  docs/specs/x.md  a.test.ts`);
  });

  it("REQ-CLI-021: reports test references to unknown REQs", () => {
    const result = trace([spec("Draft", "")], [{ file: "a.test.ts", content: `it("${R("NOPE-001")}: x")` }]);
    expect(result.errors).toEqual([`a.test.ts references unknown ${R("NOPE-001")}`]);
  });

  it("REQ-CLI-022 REQ-META-001: reports duplicate definitions", () => {
    const a = spec("Draft", `- **${R("XMP-001")}:** a`);
    const b = { ...spec("Draft", `- **${R("XMP-001")}:** b`), file: "docs/specs/y.md" };
    expect(trace([a, b], []).errors).toEqual([
      `${R("XMP-001")} is defined twice (docs/specs/x.md, docs/specs/y.md)`,
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/cli/test/trace.test.ts`
Expected: FAIL – cannot resolve `../src/trace`.

- [ ] **Step 3: Implement**

`packages/cli/src/trace.ts`:
```ts
export type SourceFile = { file: string; content: string };
export type Requirement = { id: string; file: string; manual: boolean; removed: boolean; enforced: boolean };
export type TraceResult = { requirements: Requirement[]; coverage: Map<string, string[]>; errors: string[] };

const DEFINITION = /^\s*- \*\*(REQ-[A-Z]+-\d{3})\b/;
const REFERENCE = /REQ-[A-Z]+-\d{3}/g;
const LIST_ITEM = /^\s*- /;

export function parseRequirements(spec: SourceFile): Requirement[] {
  const enforced = /^Status:\s*Implemented\b/m.test(spec.content);
  const lines = spec.content.split("\n");
  const requirements: Requirement[] = [];
  lines.forEach((line, i) => {
    const m = DEFINITION.exec(line);
    if (!m) return;
    const paragraph = [line];
    for (let j = i + 1; j < lines.length && lines[j].trim() !== "" && !LIST_ITEM.test(lines[j]); j++) {
      paragraph.push(lines[j]);
    }
    const text = paragraph.join(" ").trim();
    requirements.push({
      id: m[1],
      file: spec.file,
      manual: text.endsWith("(manual)"),
      removed: text.endsWith("(removed)"),
      enforced,
    });
  });
  return requirements;
}

export function trace(specs: SourceFile[], tests: SourceFile[]): TraceResult {
  const requirements = specs.flatMap(parseRequirements);
  const errors: string[] = [];

  const definedIn = new Map<string, string>();
  for (const r of requirements) {
    const previous = definedIn.get(r.id);
    if (previous) errors.push(`${r.id} is defined twice (${previous}, ${r.file})`);
    else definedIn.set(r.id, r.file);
  }

  const coverage = new Map<string, string[]>(requirements.map((r) => [r.id, []]));
  for (const test of tests) {
    for (const id of new Set(test.content.match(REFERENCE) ?? [])) {
      const files = coverage.get(id);
      if (files) files.push(test.file);
      else errors.push(`${test.file} references unknown ${id}`);
    }
  }

  for (const r of requirements) {
    if (r.enforced && !r.manual && !r.removed && coverage.get(r.id)!.length === 0) {
      errors.push(`${r.id} (${r.file}) has no test`);
    }
  }

  return { requirements, coverage, errors };
}

export function formatTrace(result: TraceResult): string {
  const lines = result.requirements.map((r) => {
    const tests = result.coverage.get(r.id) ?? [];
    const status = r.removed ? "removed" : r.manual ? "manual" : tests.length ? tests.join(", ") : r.enforced ? "MISSING" : "pending";
    return `${r.id}  ${r.file}  ${status}`;
  });
  if (result.errors.length) lines.push("", "Errors:", ...result.errors.map((e) => `  ${e}`));
  lines.push("", `${result.requirements.length} requirements, ${result.errors.length} errors`);
  return lines.join("\n");
}
```

`packages/cli/src/bin/trace.ts`:
```ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { type SourceFile, formatTrace, trace } from "../trace";

const root = process.argv[2] ?? ".";

function walk(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    if (name === "node_modules" || name.startsWith(".")) return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const read = (path: string): SourceFile => ({ file: relative(root, path), content: readFileSync(path, "utf8") });

const specs = walk(join(root, "docs", "specs")).filter((f) => f.endsWith(".md")).sort().map(read);
const tests = [...walk(join(root, "packages")), ...walk(join(root, "apps"))]
  .filter((f) => /\.(test|spec)\.ts$/.test(f))
  .sort()
  .map(read);

const result = trace(specs, tests);
console.log(formatTrace(result));
process.exit(result.errors.length > 0 ? 1 : 0);
```

- [ ] **Step 4: Run tests, typecheck and the command**

Run: `npm test && npm run typecheck && npm run trace`
Expected: tests PASS. `npm run trace` exits 0 — all specs are still Draft,
so uncovered REQs show as `pending`. Check the output lists REQ-DATA-*,
REQ-OCC-*, REQ-CLI-* with test files and REQ-RES-* as `manual`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(cli): add trace command for spec coverage"
```

---

### Task 8: Seed data files and research commands

**Files:**
- Create: `data/holidays.yaml`, `data/sources.md`, `data/candidates.md`, `data/venues/.gitkeep`
- Create: `.claude/commands/research.md`, `.claude/commands/discover.md`, `.claude/commands/reverify.md`

Implements REQ-DATA-040/041 (content), REQ-RES-001…040 (all manual).

- [ ] **Step 1: Write `data/holidays.yaml`**

Holiday ranges are Monday–Sunday of the official holiday weeks of the
Volksschule Stadt Zürich (weeks per stadt-zuerich.ch: Sport 7–8,
Frühling 17–18, or 16–17 if Easter Monday falls in week 16; Sommer 29–33,
Herbst 41–42).

```yaml
# Volksschule Stadt Zürich. Ranges are Monday–Sunday of the holiday weeks.
# Sources:
#   https://www.stadt-zuerich.ch/de/bildung/volksschule/schulferien.html
#   https://www.zh.ch/de/bildung/bildungssystem/schulferien.html
schoolHolidays:
  - { name: Herbstferien, from: 2026-10-05, to: 2026-10-18 }
  - { name: Weihnachtsferien, from: 2026-12-21, to: 2027-01-03 }
  - { name: Sportferien, from: 2027-02-15, to: 2027-02-28 }
  - { name: Frühlingsferien, from: 2027-04-26, to: 2027-05-09 }
  - { name: Sommerferien, from: 2027-07-19, to: 2027-08-22 }
  - { name: Herbstferien, from: 2027-10-11, to: 2027-10-24 }
  - { name: Weihnachtsferien, from: 2027-12-20, to: 2028-01-02 }
  - { name: Sportferien, from: 2028-02-14, to: 2028-02-27 }
  # Easter Monday 2028-04-17 is in week 16, so weeks 16–17
  - { name: Frühlingsferien, from: 2028-04-17, to: 2028-04-30 }
  - { name: Sommerferien, from: 2028-07-17, to: 2028-08-20 }
  - { name: Herbstferien, from: 2028-10-09, to: 2028-10-22 }

# Full-day public holidays in the city of Zurich.
publicHolidays:
  - { name: Weihnachten, date: 2026-12-25 }
  - { name: Stephanstag, date: 2026-12-26 }
  - { name: Neujahr, date: 2027-01-01 }
  - { name: Berchtoldstag, date: 2027-01-02 }
  - { name: Karfreitag, date: 2027-03-26 }
  - { name: Ostermontag, date: 2027-03-29 }
  - { name: Tag der Arbeit, date: 2027-05-01 }
  - { name: Auffahrt, date: 2027-05-06 }
  - { name: Pfingstmontag, date: 2027-05-17 }
  - { name: Bundesfeier, date: 2027-08-01 }
  - { name: Weihnachten, date: 2027-12-25 }
  - { name: Stephanstag, date: 2027-12-26 }
  - { name: Neujahr, date: 2028-01-01 }
  - { name: Berchtoldstag, date: 2028-01-02 }
  - { name: Karfreitag, date: 2028-04-14 }
  - { name: Ostermontag, date: 2028-04-17 }
  - { name: Tag der Arbeit, date: 2028-05-01 }
  - { name: Auffahrt, date: 2028-05-25 }
  - { name: Pfingstmontag, date: 2028-06-05 }
  - { name: Bundesfeier, date: 2028-08-01 }
  - { name: Weihnachten, date: 2028-12-25 }
  - { name: Stephanstag, date: 2028-12-26 }
```

Before committing, open the stadt-zuerich.ch source (or its downloadable
"Termindatei") and check every school-holiday range against it. Fix any
mismatch.

- [ ] **Step 2: Write `data/sources.md`**

```markdown
# Seed sources

Consult these first in `/research` and `/discover`.

## Overviews
- Stadt Zürich – Familienfreizeit, ganze Stadt: https://www.stadt-zuerich.ch/de/stadtleben/zusammenleben/in-den-quartieren/familienfreizeit/in-ganz-zuerich.html
- Stadt Zürich – Familienfreizeit per Kreis (Kleinkinder): https://www.stadt-zuerich.ch/de/stadtleben/zusammenleben/in-den-quartieren/familienfreizeit/kreis<N>/kleinkinder.html (N = 1–12)
- Kanton Zürich – Angebote für Familien mit Babys und Kleinkindern: https://www.zh.ch/de/familie/angebote-fuer-familien-mit-kindern/familienleben-baby-kleinkind/uebersicht-alltags-und-freizeitangebote-familien-mit-kindern/deutsch.html

## Zürcher Gemeinschaftszentren (https://gz-zh.ch/)
Affoltern, Bachwiesen, Buchegg, Grünau, Heuried, Hirzenbach, Höngg,
Hottingen, Leimbach, Loogarten, Oerlikon, Riesbach, Schindlergut, Seebach,
Wipkingen, Witikon, Wollishofen

## Libraries
- PBZ Pestalozzi-Bibliothek Zürich: https://www.pbz.ch/

## Event calendars (one-off events; scrapers later)
- Kinder Kultur Kalender: https://kikuka.ch/kalender
- lolabrause: https://lolabrause.ch/
```

- [ ] **Step 3: Write `data/candidates.md` and `data/venues/.gitkeep`**

`data/candidates.md`:
```markdown
# Candidates

Venues found by `/discover` that are not yet researched. Check an item off
once `/research` has created its venue file.
```

`data/venues/.gitkeep`: empty file.

- [ ] **Step 4: Write `.claude/commands/research.md`**

````markdown
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
3. Record only offers suitable for at least part of the 0–4 age range
   (REQ-RES-007): parent–child meetups, play, music, movement, culture,
   nature, courses, play corners.
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
````

- [ ] **Step 5: Write `.claude/commands/discover.md`**

````markdown
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
````

- [ ] **Step 6: Write `.claude/commands/reverify.md`**

````markdown
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
````

- [ ] **Step 7: Run validate**

Run: `npm run validate`
Expected: exit 0, `0 valid venues, 0 offers, 0 errors, 0 warnings`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(data): add holidays, seed sources and research commands"
```

---

### Task 9: First venues and phase sign-off

This task needs the user in the loop (they review every data diff).

- [ ] **Step 1: Discover candidates near Wiedikon**

Run in Claude Code: `/discover community centres, libraries and indoor playgrounds in Kreis 3 and neighbouring Kreise (1, 2, 4, 9)`
Expected: `data/candidates.md` gains items.

- [ ] **Step 2: Research 5–10 venues**

With the user, pick 5–10 candidates (must include GZ Heuried; ideally at
least one library and one indoor playground). For each run
`/research <name>`. After each run, show the user `git diff data/` and the
summary; apply the user's corrections.

- [ ] **Step 3: Check data quality**

Run: `npm run validate && npm run report`
Expected: validate exits 0; report shows the new venues. Discuss any
`unknown` counts with the user.

- [ ] **Step 4: Commit data (user approved)**

```bash
git add data/
git commit -m "data: add first venues around Wiedikon"
```

- [ ] **Step 5: Mark specs implemented**

In `docs/specs/000-overview.md`, `010-data-model.md` and
`020-research-tool.md`, change the status line to
`Status: Implemented · Last updated: <today>`. Leave `030-web-app.md` as
Draft.

- [ ] **Step 6: Final verification**

Run: `npm test && npm run typecheck && npm run validate && npm run trace`
Expected: all exit 0. `trace` shows no `MISSING` entries; every REQ in
000/010/020 is covered by a test, manual or removed. If a REQ is `MISSING`,
add the missing test (not a manual marker) before continuing.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "docs(specs): mark overview, data model and research tool as implemented"
```
