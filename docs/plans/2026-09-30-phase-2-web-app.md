# Phase 2 – Web app: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The installable, offline-capable web app from spec
[030](../specs/030-web-app.md): day view (timeline / list / cards, grouped by
time or venue), week view, search, settings, detail pages – built from the
YAML data with Astro + Preact, ready to deploy to GitHub Pages.

**Architecture:** `apps/web` is a new npm workspace. Astro renders static
pages at build time and emits `bundle.json` (all venues + holidays).
Interactive parts are Preact islands (`client:only="preact"`) that fetch the
bundle and compute occurrences in the browser with `@zueri-kids/core`. All
view logic lives in pure TypeScript modules under `apps/web/src/lib/`
(unit-tested with Vitest); components only render. Workbox generates the
service worker after the Astro build; `@vite-pwa/assets-generator` generates
the app icons. Playwright runs smoke tests against a build with fixture data.

**Tech Stack:** Astro 7, @astrojs/preact 6, Preact 10 (the integration does
not support Preact 11 yet), workbox-cli 7, @vite-pwa/assets-generator 2,
@astrojs/check, Playwright, Vitest 5 (existing), Node 22.

**Specs implemented:** [030](../specs/030-web-app.md) (WEB, FLT).

## Global Constraints

- Code, comments, commits in English. **Every UI string lives in
  `apps/web/src/i18n/de.ts`** – components and `.astro` files contain no
  German literals (REQ-WEB-072).
- Tests reference REQ IDs at the start of their names; fake IDs in tests are
  built by concatenation (trace treats unknown literal IDs as errors).
- `apps/web/src/lib/**` and `apps/web/src/i18n/**` must not import `preact`,
  `astro` or `node:*`; `apps/web/src/data/**` runs only at build time.
- Islands use `client:only="preact"` (they depend on the current time and
  `localStorage`, so server rendering them would be wrong).
- "Today" and "now" always come from `nowInZurich(new Date())`.
- Prefer existing libraries over custom infrastructure (CLAUDE.md). The only
  hand-written PWA piece is the web manifest JSON.
- Use `rtk proxy npx …` when a command's output looks truncated by the rtk
  hook.
- Commit after every task; messages end with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File structure

```
apps/web/
  package.json, astro.config.mjs, tsconfig.json
  workbox-config.cjs              Workbox generateSW config
  playwright.config.ts
  public/icon.svg                 source for generated icons (+ generated PNGs, favicon.ico)
  public/manifest.webmanifest
  src/i18n/de.ts                  all UI strings
  src/styles/global.css           tokens + styles (from the mockup)
  src/data/bundle.ts              build-time: load + validate data → Bundle
  src/lib/types.ts                Bundle type
  src/lib/paths.ts                joinBase()
  src/lib/time.ts                 nowInZurich(), toMinutes(), ageInMonths()
  src/lib/calendar.ts             weekOf(), dayNotice()
  src/lib/labels.ts               price/age/registration/kreis/date labels
  src/lib/filters/*.ts            filter modules + registry
  src/lib/prefs.ts                device preferences (localStorage)
  src/lib/urlState.ts             URL ⇄ view state
  src/lib/model.ts                day items, filtering, search, next dates
  src/lib/grouping.ts             by period / by venue / past last
  src/lib/timeline.ts             axis maths
  src/components/*.tsx            Preact islands and view components
  src/layouts/Base.astro
  src/pages/index.astro, woche.astro, suche.astro, einstellungen.astro,
            bundle.json.ts, angebot/[venue]/[offer].astro
  e2e/fixtures/data/…             small dataset for Playwright
  e2e/app.spec.ts
.github/workflows/ci.yml          tests + build + GitHub Pages deploy
```

---

### Task 1: Scaffold `apps/web`, build-time data bundle, layout

**Files:**
- Modify: `package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `apps/web/package.json`, `apps/web/astro.config.mjs`, `apps/web/tsconfig.json`
- Create: `apps/web/src/i18n/de.ts`, `apps/web/src/styles/global.css`
- Create: `apps/web/src/lib/types.ts`, `apps/web/src/lib/paths.ts`, `apps/web/src/components/env.ts`
- Create: `apps/web/src/data/bundle.ts`, `apps/web/src/pages/bundle.json.ts`
- Create: `apps/web/workbox-config.cjs` (content in Task 9, Step 3 – needed because the build script runs Workbox)
- Create: `apps/web/src/layouts/Base.astro`, `apps/web/src/pages/index.astro` (placeholder)
- Test: `apps/web/src/data/bundle.test.ts`, `apps/web/src/lib/paths.test.ts`

**Interfaces:**
- Produces:
  - `type Bundle = { builtOn: string; venues: Venue[]; holidays: Holidays }` (`src/lib/types.ts`)
  - `toBundle(dataDir: string, today: string): Bundle` – throws `Error` whose message lists `formatIssue` lines
  - `getBundle(): Bundle` – cached; data dir from `DATA_DIR` env (default `../../data` relative to `apps/web`)
  - `joinBase(base: string, path: string): string`, `href(path: string): string` (uses `import.meta.env.BASE_URL`)
  - `de` message object (full content below; later tasks only read it)
  - `Base.astro` props `{ title: string; active?: "today" | "week" | "search" | "settings" }`

- [ ] **Step 1: Workspace and dependencies**

Root `package.json` – set `workspaces` and scripts to:
```json
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit -p tsconfig.json && npm run check -w @zueri-kids/web",
    "validate": "tsx packages/cli/src/bin/validate.ts data",
    "report": "tsx packages/cli/src/bin/report.ts data",
    "trace": "tsx packages/cli/src/bin/trace.ts .",
    "dev": "npm run dev -w @zueri-kids/web",
    "build": "npm run build -w @zueri-kids/web",
    "preview": "npm run preview -w @zueri-kids/web",
    "e2e": "npm run e2e -w @zueri-kids/web"
  }
```

`apps/web/package.json`:
```json
{
  "name": "@zueri-kids/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build && workbox generateSW workbox-config.cjs",
    "preview": "astro preview --host",
    "check": "astro check",
    "icons": "pwa-assets-generator --preset minimal-2023 public/icon.svg",
    "e2e": "playwright test"
  },
  "dependencies": { "@zueri-kids/core": "*" }
}
```

```bash
source ~/.nvm/nvm.sh && nvm use 22
npm install -w @zueri-kids/web astro@^7 @astrojs/preact@^6 preact@^10
npm install -w @zueri-kids/web -D @astrojs/check@^0.9 typescript@^5 workbox-cli@^7 @vite-pwa/assets-generator@^2 @playwright/test@^1
```
Expected: installs without peer-dependency errors. If npm reports a peer
conflict, stop and report it (do not use `--force`).

- [ ] **Step 2: Config files**

`apps/web/astro.config.mjs`:
```js
import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";

// SITE_URL / BASE_PATH are set by CI for GitHub Pages; OUT_DIR lets e2e
// tests build fixture data without touching dist/.
export default defineConfig({
  site: process.env.SITE_URL || "http://localhost:4321",
  base: process.env.BASE_PATH || "/",
  outDir: process.env.OUT_DIR || "./dist",
  integrations: [preact()],
});
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "preact" },
  "include": [".astro/types.d.ts", "src/**/*", "e2e/**/*", "playwright.config.ts"],
  "exclude": ["dist", "dist-e2e"]
}
```

Root `tsconfig.json` – extend `include`:
```json
  "include": ["packages/*/src", "packages/*/test", "vitest.config.ts",
              "apps/web/src/lib", "apps/web/src/data", "apps/web/src/i18n"]
```

`vitest.config.ts` – extend `include`:
```ts
    include: ["packages/**/*.test.ts", "apps/web/src/**/*.test.ts"],
```

Append to `.gitignore`:
```
apps/web/dist-e2e/
apps/web/.astro/
```

- [ ] **Step 3: Write the failing tests**

`apps/web/src/lib/paths.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { joinBase } from "./paths";

describe("joinBase", () => {
  it("joins the site base and a relative path", () => {
    expect(joinBase("/", "bundle.json")).toBe("/bundle.json");
    expect(joinBase("/zueri-kids", "bundle.json")).toBe("/zueri-kids/bundle.json");
    expect(joinBase("/zueri-kids/", "angebot/a/b/")).toBe("/zueri-kids/angebot/a/b/");
    expect(joinBase("/zueri-kids", "")).toBe("/zueri-kids/");
  });
});
```

`apps/web/src/data/bundle.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { VALID_HOLIDAYS_YAML, VALID_VENUE_YAML, writeDataDir } from "../../../../packages/core/test/tmp-data";
import { toBundle } from "./bundle";

describe("toBundle", () => {
  it("REQ-WEB-001: returns venues and holidays for valid data", () => {
    const dir = writeDataDir({ "venues/gz-test.yaml": VALID_VENUE_YAML, "holidays.yaml": VALID_HOLIDAYS_YAML });
    const bundle = toBundle(dir, "2026-09-30");
    expect(bundle.builtOn).toBe("2026-09-30");
    expect(bundle.venues.map((v) => v.id)).toEqual(["gz-test"]);
    expect(bundle.holidays.publicHolidays).toHaveLength(1);
  });

  it("REQ-WEB-001: fails with validate-style messages for invalid data", () => {
    const yaml = VALID_VENUE_YAML.replace('end: "11:30"', 'end: "09:00"');
    const dir = writeDataDir({ "venues/gz-test.yaml": yaml, "holidays.yaml": VALID_HOLIDAYS_YAML });
    expect(() => toBundle(dir, "2026-09-30")).toThrow(/offers\[0\]\.schedule\.rules\[0\]\.end: must be later than start/);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run apps/web`
Expected: FAIL – modules not found.

- [ ] **Step 5: Implement**

`apps/web/src/lib/types.ts`:
```ts
import type { Holidays, Venue } from "@zueri-kids/core";

export type Bundle = { builtOn: string; venues: Venue[]; holidays: Holidays };
```

`apps/web/src/lib/paths.ts`:
```ts
// Joins Astro's BASE_URL ("/" or "/zueri-kids") with a path relative to it.
export function joinBase(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}/${path}`;
}
```

`apps/web/src/components/env.ts`:
```ts
import { joinBase } from "../lib/paths";

export const href = (path: string): string => joinBase(import.meta.env.BASE_URL, path);
```

`apps/web/src/data/bundle.ts`:
```ts
import { resolve } from "node:path";
import { formatIssue, todayInZurich } from "@zueri-kids/core";
import { loadDataset } from "@zueri-kids/core/node";
import type { Bundle } from "../lib/types";

// Build-time only. Invalid data fails the build (REQ-WEB-001).
export function toBundle(dataDir: string, today: string): Bundle {
  const { dataset, errors } = loadDataset(dataDir, today);
  if (errors.length > 0) {
    throw new Error(`Invalid data – run \`npm run validate\`:\n${errors.map(formatIssue).join("\n")}`);
  }
  return { builtOn: today, venues: dataset.venues, holidays: dataset.holidays };
}

let cached: Bundle | undefined;

export function getBundle(): Bundle {
  cached ??= toBundle(resolve(process.cwd(), process.env.DATA_DIR ?? "../../data"), todayInZurich(new Date()));
  return cached;
}
```

`apps/web/src/pages/bundle.json.ts`:
```ts
import type { APIRoute } from "astro";
import { getBundle } from "../data/bundle";

export const GET: APIRoute = () =>
  new Response(JSON.stringify(getBundle()), { headers: { "Content-Type": "application/json" } });
```

`apps/web/src/i18n/de.ts` (complete; every later task uses these keys):
```ts
import type { Weekday } from "@zueri-kids/core";

const weekdays: Record<Weekday, string> = {
  mon: "Montag", tue: "Dienstag", wed: "Mittwoch", thu: "Donnerstag", fri: "Freitag", sat: "Samstag", sun: "Sonntag",
};
const weekdaysShort: Record<Weekday, string> = { mon: "Mo", tue: "Di", wed: "Mi", thu: "Do", fri: "Fr", sat: "Sa", sun: "So" };
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const de = {
  appName: "Züri Kids",
  brand: { first: "züri", second: "kids" },
  pageTitles: { today: "Heute", week: "Woche", search: "Suche", settings: "Einstellungen" },
  nav: { label: "Hauptnavigation", today: "Heute", week: "Woche", search: "Suche", settings: "Einstellungen" },
  weekdays,
  weekdaysShort,
  months: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
  todayPrefix: "Heute, ",
  prevDay: "Vorheriger Tag",
  nextDay: "Nächster Tag",
  prevWeek: "Vorherige Woche",
  nextWeek: "Nächste Woche",
  chooseDay: "Tag wählen",
  views: { label: "Ansicht", timeline: "Zeitleiste", list: "Liste", cards: "Karten" },
  groups: { label: "Gruppieren", time: "Nach Zeit", venue: "Nach Ort" },
  periods: { morning: "Vormittag", afternoon: "Nachmittag", open: "Offen – kommen und gehen" },
  price: { free: "gratis", donation: "Kollekte", unknown: "Preis unbekannt" },
  registrationMarker: { required: "Anmeldung", unknown: "Anmeldung?" },
  registration: {
    none: "Keine Anmeldung nötig",
    recommended: "Anmeldung empfohlen",
    required: "Anmeldung nötig",
    unknown: "Anmeldung: unbekannt",
  },
  setting: { indoor: "drinnen", outdoor: "draussen", both: "drinnen & draussen" },
  category: {
    meetup: "Treff", play: "Spiel", music: "Musik", movement: "Bewegung", culture: "Kultur", crafts: "Werken",
    nature: "Natur", course: "Kurs", "play-corner": "Spielecke", advice: "Beratung", other: "Anderes",
  },
  age: { all: "alle Altersstufen", from: (a: string) => `ab ${a}`, to: (a: string) => `bis ${a}`, months: (n: number) => `${n} Mt.`, years: (n: number) => `${n} J.` },
  kreis: (k: number | undefined) => (k === undefined || k === 0 ? "Ausserhalb" : `K${k}`),
  filters: {
    label: "Filter",
    ageFits: (age: string) => `Passt für ${age}`,
    mine: "★ Meine Orte",
    setting: "Drinnen oder draussen",
    settingOptions: { all: "Drinnen & draussen", indoor: "Drinnen", outdoor: "Draussen" },
    price: "Preis",
    priceOptions: { all: "Alle Preise", free: "Gratis / Kollekte", max10: "bis CHF 10", max20: "bis CHF 20" },
    noRegistration: "Ohne Anmeldung",
    kreis: "Kreis-Auswahl",
    removeVenue: (name: string) => `Filter ${name} entfernen`,
  },
  summary: (n: number, total: number) => `${n} von ${total} Angeboten passen zu deinen Filtern`,
  summaryVenue: (n: number) => `${plural(n, "Angebot", "Angebote")} an diesem Ort`,
  empty: "Keine passenden Angebote",
  emptyHint: (labels: string[]) => (labels.length ? `Versuch es ohne ${labels.map((l) => `«${l}»`).join(", ")}.` : ""),
  notices: { schoolHoliday: "Schulferien – viele Angebote pausieren", publicHoliday: (name: string) => `Feiertag: ${name}` },
  stale: "evtl. veraltet",
  legend: { session: "Termin mit fixer Zeit", open: "Offen – kommen und gehen" },
  now: "jetzt",
  offers: (n: number) => plural(n, "Angebot", "Angebote"),
  star: { add: "Zu Meine Orte hinzufügen", remove: "Aus Meine Orte entfernen" },
  loading: "Lade Angebote …",
  loadError: "Die Angebote konnten nicht geladen werden. Bitte später nochmals versuchen.",
  details: {
    website: "Zur Website ↗",
    more: "Alle Details",
    maps: "Auf der Karte zeigen ↗",
    source: "Quelle ↗",
    lastVerified: (d: string) => `Zuletzt geprüft am ${d}`,
    next: "Nächste Termine",
    noNext: "Keine Termine in den nächsten 12 Monaten",
    age: "Alter",
    price: "Preis",
    registration: "Anmeldung",
    setting: "Ort",
    category: "Kategorie",
    address: "Adresse",
    notes: "Hinweise",
    back: "‹ Zurück zur Tagesansicht",
  },
  week: { title: (from: string, to: string) => `Woche ${from} – ${to}`, empty: "Keine passenden Angebote", openDay: (d: string) => `Tagesansicht ${d} öffnen` },
  search: {
    label: "Suche",
    placeholder: "Angebot, Ort oder Adresse",
    hint: "Mindestens 2 Zeichen eingeben.",
    none: "Nichts gefunden.",
    next: (when: string) => `Nächster Termin: ${when}`,
    noNext: "Kein Termin in den nächsten 4 Wochen",
    results: (n: number) => plural(n, "Treffer", "Treffer"),
  },
  settings: {
    birthDate: "Geburtsdatum deines Kindes",
    birthHint: "Damit zeigt «Passt für …» nur passende Angebote. Wird nur auf diesem Gerät gespeichert.",
    kreise: "Standard-Kreise",
    favourites: "Meine Orte",
    noFavourites: "Noch keine Orte markiert. Wähle in der Tagesansicht «Nach Ort» und tippe auf ☆.",
    remove: "Entfernen",
    saved: "Gespeichert",
    reset: "Alles zurücksetzen",
    storageUnavailable: "Einstellungen können auf diesem Gerät nicht gespeichert werden.",
  },
} as const;
```

`apps/web/src/styles/global.css` – generated from the approved mockup, then
extended:
```bash
python3 - <<'EOF'
import re, pathlib
src = pathlib.Path("docs/specs/030-mockup.template.html").read_text()
css = re.search(r"<style>(.*?)</style>", src, re.S).group(1).strip()
extra = '''

/* ---------- additions for the real app ---------- */
.app { padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px)); }
.axis { position: static; }
.nowline::before { content: attr(data-label); }
.meta .vlink, .venuehead .vlink { font: inherit; color: inherit; }
select.chip { appearance: none; padding-right: 28px; background-image: linear-gradient(45deg, transparent 50%, var(--muted) 50%), linear-gradient(135deg, var(--muted) 50%, transparent 50%); background-position: calc(100% - 14px) 55%, calc(100% - 9px) 55%; background-size: 5px 5px; background-repeat: no-repeat; }
.bottomnav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 10; display: grid; grid-template-columns: repeat(4, 1fr); background: var(--surface); border-top: 1px solid var(--line); padding-bottom: env(safe-area-inset-bottom, 0px); }
.bottomnav a { text-align: center; padding: 12px 4px; color: var(--muted); text-decoration: none; font-weight: 700; font-size: 14px; }
.bottomnav a[aria-current="page"] { color: var(--accent); }
.week { display: grid; gap: 14px; }
@media (min-width: 900px) { .app.wide { max-width: 1200px; } .week { grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; } }
.weekday h2 { font-family: var(--f-display); font-size: 16px; margin: 0 0 6px; }
.weekday h2 a { color: inherit; }
.weekday ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.weekday li { display: grid; grid-template-columns: 10px auto 1fr; gap: 0 8px; font-size: 14px; }
.weekday li .dot { margin-top: 6px; }
.weekday li .meta { grid-column: 3; font-size: 13px; }
.weekday .time { font-variant-numeric: tabular-nums; font-weight: 700; }
.muted { color: var(--muted); }
.field { display: grid; gap: 6px; }
.field label, fieldset legend { font-weight: 700; }
.field input[type="date"], .field input[type="search"] { font: inherit; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--ink); }
fieldset { border: 1px solid var(--line); border-radius: var(--r); padding: 12px; display: flex; flex-wrap: wrap; gap: 8px 14px; }
.stack { display: grid; gap: 18px; }
.results { list-style: none; padding: 0; margin: 0; display: grid; }
.results li { padding-block: 10px; border-bottom: 1px solid var(--line); }
.results a { color: var(--ink); text-decoration: none; }
.linkbtn { border: 1px solid var(--line); background: var(--surface); border-radius: 999px; padding: 6px 12px; cursor: pointer; }
.facts { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; margin: 0; }
.facts dt { color: var(--muted); }
.facts dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.page-title { font-family: var(--f-display); font-size: clamp(26px, 7vw, 36px); line-height: 1.1; margin: 8px 0 4px; text-wrap: balance; }
.backlink { color: var(--accent); font-weight: 700; text-decoration: none; }
'''
pathlib.Path("apps/web/src/styles/global.css").write_text(css + extra + "\n")
EOF
```
Run from the repo root. Expected: `apps/web/src/styles/global.css` exists and
starts with the `/* Layout: …` comment.

`apps/web/src/layouts/Base.astro`:
```astro
---
import "../styles/global.css";
import { de } from "../i18n/de";

interface Props {
  title: string;
  active?: "today" | "week" | "search" | "settings";
  wide?: boolean;
}
const { title, active, wide = false } = Astro.props;
const base = import.meta.env.BASE_URL.replace(/\/$/, "");
const nav = [
  ["today", "/", de.nav.today],
  ["week", "/woche/", de.nav.week],
  ["search", "/suche/", de.nav.search],
  ["settings", "/einstellungen/", de.nav.settings],
] as const;
---
<!doctype html>
<html lang="de-CH">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>{`${title} · ${de.appName}`}</title>
    <meta name="theme-color" content="#1f56cc" />
    <link rel="manifest" href={`${base}/manifest.webmanifest`} />
    <link rel="icon" href={`${base}/favicon.ico`} sizes="48x48" />
    <link rel="icon" href={`${base}/icon.svg`} type="image/svg+xml" />
    <link rel="apple-touch-icon" href={`${base}/apple-touch-icon-180x180.png`} />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&display=swap" />
  </head>
  <body>
    <div class:list={["app", { wide }]}><slot /></div>
    <nav class="bottomnav" aria-label={de.nav.label}>
      {nav.map(([id, path, label]) => (
        <a href={`${base}${path}`} aria-current={active === id ? "page" : undefined}>{label}</a>
      ))}
    </nav>
    <script is:inline define:vars={{ swUrl: `${base}/sw.js` }}>
      if ("serviceWorker" in navigator && location.hostname !== "localhost") navigator.serviceWorker.register(swUrl);
    </script>
  </body>
</html>
```

`apps/web/src/pages/index.astro` (placeholder until Task 6):
```astro
---
import Base from "../layouts/Base.astro";
import { de } from "../i18n/de";
---
<Base title={de.pageTitles.today} active="today"><p>{de.loading}</p></Base>
```

- [ ] **Step 6: Run tests, typecheck, build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all tests PASS; typecheck clean; build succeeds and
`apps/web/dist/bundle.json` contains 18 venues
(`node -e "console.log(require('./apps/web/dist/bundle.json').venues.length)"` → `18`).
The Workbox step also runs and writes `apps/web/dist/sw.js` (warnings about
missing icons are fine until Task 9).

Note: `workbox generateSW` needs `apps/web/workbox-config.cjs`. Create it now
with the final content from Task 9, Step 3, so the build script works.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(web): scaffold Astro + Preact app with build-time data bundle"
```

---

### Task 2: Time, calendar and label helpers

**Files:**
- Create: `apps/web/src/lib/time.ts`, `apps/web/src/lib/calendar.ts`, `apps/web/src/lib/labels.ts`
- Test: `apps/web/src/lib/time.test.ts`, `apps/web/src/lib/calendar.test.ts`, `apps/web/src/lib/labels.test.ts`

**Interfaces:**
- Consumes: `addDays`, `weekday`, `WEEKDAYS`, `Holidays`, `Price`, `Offer` from core; `de`
- Produces:
  - `type Now = { date: string; minutes: number }`; `nowInZurich(now: Date): Now`
  - `toMinutes(time: string): number`; `ageInMonths(birthDate: string, date: string): number`
  - `weekOf(date: string): string[]` (Mon…Sun); `dayNotice(date: string, holidays: Holidays): { schoolHoliday?: string; publicHoliday?: string }`
  - `priceLabel(p: Price)`, `monthsLabel(m: number)`, `ageLabel(a: Offer["ageMonths"])`, `registrationMarker(r: Offer["registration"]): string | null`, `kreisLabel(k: number | undefined)`, `dayTitle(date, today): { title: string; subtitle: string }`, `weekdayShort(date)`, `dayOfMonth(date): number`, `shortDate(date): string` ("20.10."), `longDate(date): string` ("20. Oktober 2026")

- [ ] **Step 1: Write the failing tests**

`apps/web/src/lib/time.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { ageInMonths, nowInZurich, toMinutes } from "./time";

describe("time", () => {
  it("REQ-WEB-003: reads date and minutes in Europe/Zurich", () => {
    expect(nowInZurich(new Date("2026-10-20T08:15:00Z"))).toEqual({ date: "2026-10-20", minutes: 615 }); // CEST
    expect(nowInZurich(new Date("2026-11-20T08:15:00Z"))).toEqual({ date: "2026-11-20", minutes: 555 }); // CET
    expect(nowInZurich(new Date("2026-09-30T22:30:00Z"))).toEqual({ date: "2026-10-01", minutes: 30 });
  });

  it("converts HH:MM to minutes", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("13:45")).toBe(825);
  });

  it("REQ-FLT-010: computes age in whole months", () => {
    expect(ageInMonths("2025-12-28", "2025-12-28")).toBe(0);
    expect(ageInMonths("2025-12-28", "2026-09-27")).toBe(8);
    expect(ageInMonths("2025-12-28", "2026-09-28")).toBe(9);
    expect(ageInMonths("2025-12-28", "2026-09-30")).toBe(9);
  });
});
```

`apps/web/src/lib/calendar.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { dayNotice, weekOf } from "./calendar";

const holidays = {
  schoolHolidays: [
    { name: "Herbstferien", from: "2026-10-05", to: "2026-10-18" },
    { name: "Weihnachtsferien", from: "2026-12-21", to: "2027-01-03" },
  ],
  publicHolidays: [{ name: "Weihnachten", date: "2026-12-25" }],
};

describe("calendar", () => {
  it("REQ-WEB-012: returns Monday to Sunday of the week", () => {
    const week = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"];
    expect(weekOf("2026-10-19")).toEqual(week);
    expect(weekOf("2026-10-21")).toEqual(week);
    expect(weekOf("2026-10-25")).toEqual(week);
  });

  it("REQ-WEB-014: names school and public holidays of a day", () => {
    expect(dayNotice("2026-10-06", holidays)).toEqual({ schoolHoliday: "Herbstferien" });
    expect(dayNotice("2026-12-25", holidays)).toEqual({ schoolHoliday: "Weihnachtsferien", publicHoliday: "Weihnachten" });
    expect(dayNotice("2026-10-20", holidays)).toEqual({});
  });
});
```

`apps/web/src/lib/labels.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { ageLabel, dayTitle, kreisLabel, longDate, priceLabel, registrationMarker, shortDate, weekdayShort } from "./labels";

describe("labels", () => {
  it("REQ-WEB-015: labels prices", () => {
    expect(priceLabel({ type: "free" })).toBe("gratis");
    expect(priceLabel({ type: "fixed", chf: 5 })).toBe("CHF 5");
    expect(priceLabel({ type: "range", minChf: 2, maxChf: 7 })).toBe("CHF 2–7");
    expect(priceLabel({ type: "donation" })).toBe("Kollekte");
    expect(priceLabel({ type: "unknown" })).toBe("Preis unbekannt");
  });

  it("REQ-WEB-015: labels age ranges", () => {
    expect(ageLabel({})).toBe("alle Altersstufen");
    expect(ageLabel({ min: 0 })).toBe("alle Altersstufen");
    expect(ageLabel({ max: 48 })).toBe("bis 4 J.");
    expect(ageLabel({ min: 0, max: 72 })).toBe("bis 6 J.");
    expect(ageLabel({ min: 36 })).toBe("ab 3 J.");
    expect(ageLabel({ min: 9, max: 24 })).toBe("9 Mt. – 2 J.");
    expect(ageLabel({ min: 30, max: 48 })).toBe("30 Mt. – 4 J.");
  });

  it("REQ-WEB-015: marks registration only when required or unknown", () => {
    expect(registrationMarker("required")).toBe("Anmeldung");
    expect(registrationMarker("unknown")).toBe("Anmeldung?");
    expect(registrationMarker("none")).toBeNull();
    expect(registrationMarker("recommended")).toBeNull();
  });

  it("REQ-WEB-015: labels kreis and dates", () => {
    expect(kreisLabel(3)).toBe("K3");
    expect(kreisLabel(undefined)).toBe("Ausserhalb");
    expect(dayTitle("2026-10-20", "2026-10-20")).toEqual({ title: "Heute, Dienstag", subtitle: "20. Oktober 2026" });
    expect(dayTitle("2026-10-21", "2026-10-20")).toEqual({ title: "Mittwoch", subtitle: "21. Oktober 2026" });
    expect(weekdayShort("2026-10-25")).toBe("So");
    expect(shortDate("2026-10-05")).toBe("5.10.");
    expect(longDate("2027-01-01")).toBe("1. Januar 2027");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run apps/web/src/lib`
Expected: FAIL – modules not found.

- [ ] **Step 3: Implement**

`apps/web/src/lib/time.ts`:
```ts
export type Now = { date: string; minutes: number };

// Current calendar date and minutes since midnight in Europe/Zurich (REQ-WEB-003).
export function nowInZurich(now: Date): Now {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// Whole months between birth date and date (REQ-FLT-010).
export function ageInMonths(birthDate: string, date: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [y, m, d] = date.split("-").map(Number);
  return (y - by) * 12 + (m - bm) - (d < bd ? 1 : 0);
}
```

`apps/web/src/lib/calendar.ts`:
```ts
import { WEEKDAYS, addDays, weekday, type Holidays } from "@zueri-kids/core";

export function weekOf(date: string): string[] {
  const monday = addDays(date, -WEEKDAYS.indexOf(weekday(date)));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function dayNotice(date: string, holidays: Holidays): { schoolHoliday?: string; publicHoliday?: string } {
  const notice: { schoolHoliday?: string; publicHoliday?: string } = {};
  const school = holidays.schoolHolidays.find((h) => h.from <= date && date <= h.to);
  if (school) notice.schoolHoliday = school.name;
  const pub = holidays.publicHolidays.find((h) => h.date === date);
  if (pub) notice.publicHoliday = pub.name;
  return notice;
}
```

`apps/web/src/lib/labels.ts`:
```ts
import { weekday, type Offer, type Price } from "@zueri-kids/core";
import { de } from "../i18n/de";

export function priceLabel(p: Price): string {
  switch (p.type) {
    case "free": return de.price.free;
    case "fixed": return `CHF ${p.chf}`;
    case "range": return `CHF ${p.minChf}–${p.maxChf}`;
    case "donation": return de.price.donation;
    case "unknown": return de.price.unknown;
  }
}

export const monthsLabel = (m: number): string => (m >= 24 && m % 12 === 0 ? de.age.years(m / 12) : de.age.months(m));

export function ageLabel(a: Offer["ageMonths"]): string {
  const min = a.min ?? 0;
  if (a.max === undefined) return min === 0 ? de.age.all : de.age.from(monthsLabel(min));
  if (min === 0) return de.age.to(monthsLabel(a.max));
  return `${monthsLabel(min)} – ${monthsLabel(a.max)}`;
}

export function registrationMarker(r: Offer["registration"]): string | null {
  if (r === "required") return de.registrationMarker.required;
  if (r === "unknown") return de.registrationMarker.unknown;
  return null;
}

export const kreisLabel = (k: number | undefined): string => de.kreis(k);

const parts = (date: string) => date.split("-").map(Number) as [number, number, number];
export const dayOfMonth = (date: string): number => parts(date)[2];
export const weekdayShort = (date: string): string => de.weekdaysShort[weekday(date)];
export const shortDate = (date: string): string => `${parts(date)[2]}.${parts(date)[1]}.`;
export const longDate = (date: string): string => {
  const [y, m, d] = parts(date);
  return `${d}. ${de.months[m - 1]} ${y}`;
};

export function dayTitle(date: string, today: string): { title: string; subtitle: string } {
  const name = de.weekdays[weekday(date)];
  return { title: date === today ? `${de.todayPrefix}${name}` : name, subtitle: longDate(date) };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): time, calendar and label helpers"
```

---

### Task 3: Filter modules and registry

**Files:**
- Create: `apps/web/src/lib/filters/types.ts`, `age.ts`, `setting.ts`, `price.ts`, `registration.ts`, `kreis.ts`, `venue.ts`, `mine.ts`, `registry.ts`
- Test: `apps/web/src/lib/filters.test.ts`

**Interfaces:**
- Consumes: `ageInMonths` (Task 2), `monthsLabel` (Task 2), `de`
- Produces:
  - `type Settings = { birthDate: string | null; kreise: number[]; favourites: string[] }`
  - `type FilterContext = { occurrence: Occurrence; offer: Offer; venue: Venue; date: string; settings: Settings }`
  - `interface Filter<V>` exactly as REQ-FLT-001; `type FilterState = Record<string, unknown>`
  - Filter ids (= URL params): `ort` (venue), `meine` (mine), `alter` (age), `lage` (setting), `preis` (price), `anmeldung` (registration), `kreis`
  - `FILTERS: Filter<any>[]` in bar order: ort, meine, alter, lage, preis, anmeldung, kreis
  - `defaultState(settings): FilterState`, `activeFilters(state, settings): Filter<any>[]`, `matchesFilters(ctx, state): boolean`, `relaxableLabels(state, settings, date, venueName): string[]`

- [ ] **Step 1: Write the failing test** – `apps/web/src/lib/filters.test.ts`

```ts
import { describe, expect, it } from "vitest";
import type { Offer, Venue } from "@zueri-kids/core";
import { offer as makeOffer, venue as makeVenue } from "../../../../packages/core/test/fixtures";
import { FILTERS, activeFilters, defaultState, matchesFilters, relaxableLabels } from "./filters/registry";
import type { FilterContext, Settings } from "./filters/types";

const settings: Settings = { birthDate: "2025-12-28", kreise: [1, 2, 3, 4, 9], favourites: ["gz-test"] };
const noChild: Settings = { ...settings, birthDate: null };

function ctx(o: Partial<Offer> = {}, v: Partial<Venue> = {}, s: Settings = settings): FilterContext {
  const offer = makeOffer(o);
  const venue = makeVenue({ offers: [offer], ...v });
  return {
    occurrence: { key: `${venue.id}/${offer.id}`, date: "2026-10-20", start: "09:30", end: "11:30", kind: "session" },
    offer, venue, date: "2026-10-20", settings: s,
  };
}
const byId = (id: string) => FILTERS.find((f) => f.id === id)!;
const match = (id: string, value: unknown, c: FilterContext) => byId(id).matches(c, value);

describe("filters", () => {
  it("REQ-FLT-001: registers every filter once, in bar order, with the common interface", () => {
    expect(FILTERS.map((f) => f.id)).toEqual(["ort", "meine", "alter", "lage", "preis", "anmeldung", "kreis"]);
    for (const f of FILTERS) {
      expect(typeof f.parse).toBe("function");
      expect(typeof f.serialize).toBe("function");
      expect(typeof f.matches).toBe("function");
      expect(["toggle", "select", "multiselect", "removable"]).toContain(f.control);
    }
  });

  it("REQ-FLT-002: requires all active filters; the venue filter overrides kreis and mine", () => {
    const state = { ...defaultState(settings), anmeldung: true };
    expect(matchesFilters(ctx({ registration: "required" }), state)).toBe(false);
    expect(matchesFilters(ctx({ registration: "none" }), state)).toBe(true);

    const outside = ctx({}, { id: "spielhalle", location: { address: "x", municipality: "Zürich", kreis: 11 } });
    const mineOnly = { ...defaultState(settings), meine: true };
    expect(matchesFilters(outside, mineOnly)).toBe(false);
    const venueState = { ...mineOnly, ort: "spielhalle" };
    expect(activeFilters(venueState, settings).map((f) => f.id)).not.toContain("kreis");
    expect(activeFilters(venueState, settings).map((f) => f.id)).not.toContain("meine");
    expect(matchesFilters(outside, venueState)).toBe(true);
  });

  it("REQ-FLT-010: age filter uses the child's age on the occurrence date", () => {
    expect(byId("alter").label(settings, "2026-10-20")).toBe("Passt für 9 Mt.");
    expect(byId("alter").defaultValue(settings)).toBe(true);
    expect(byId("alter").defaultValue(noChild)).toBe(false);
    expect(byId("alter").isActive(true, noChild)).toBe(false);
    expect(match("alter", true, ctx({ ageMonths: { min: 9, max: 24 } }))).toBe(true);
    expect(match("alter", true, ctx({ ageMonths: { min: 12 } }))).toBe(false);
    expect(match("alter", true, ctx({ ageMonths: { max: 8 } }))).toBe(false);
    expect(match("alter", true, ctx({ ageMonths: {} }))).toBe(true);
    expect(byId("alter").parse(null, settings)).toBe(true);
    expect(byId("alter").parse("0", settings)).toBe(false);
    expect(byId("alter").serialize(true, settings)).toBeNull();
    expect(byId("alter").serialize(false, settings)).toBe("0");
  });

  it("REQ-FLT-011: setting filter", () => {
    expect(match("lage", "indoor", ctx({ setting: "indoor" }))).toBe(true);
    expect(match("lage", "indoor", ctx({ setting: "both" }))).toBe(true);
    expect(match("lage", "indoor", ctx({ setting: "outdoor" }))).toBe(false);
    expect(match("lage", "outdoor", ctx({ setting: "outdoor" }))).toBe(true);
    expect(match("lage", "outdoor", ctx({ setting: "both" }))).toBe(true);
    expect(byId("lage").isActive("all", settings)).toBe(false);
  });

  it("REQ-FLT-012: price filter treats donations as free", () => {
    expect(match("preis", "free", ctx({ price: { type: "free" } }))).toBe(true);
    expect(match("preis", "free", ctx({ price: { type: "donation" } }))).toBe(true);
    expect(match("preis", "free", ctx({ price: { type: "fixed", chf: 3 } }))).toBe(false);
    expect(match("preis", "max:10", ctx({ price: { type: "fixed", chf: 8 } }))).toBe(true);
    expect(match("preis", "max:10", ctx({ price: { type: "fixed", chf: 12 } }))).toBe(false);
    expect(match("preis", "max:10", ctx({ price: { type: "range", minChf: 5, maxChf: 20 } }))).toBe(true);
    expect(match("preis", "max:10", ctx({ price: { type: "unknown" } }))).toBe(false);
    expect(byId("preis").parse("cheap", settings)).toBe("all");
    expect(byId("preis").parse("max:20", settings)).toBe("max:20");
  });

  it("REQ-FLT-013: registration filter", () => {
    expect(match("anmeldung", true, ctx({ registration: "none" }))).toBe(true);
    expect(match("anmeldung", true, ctx({ registration: "recommended" }))).toBe(false);
    expect(match("anmeldung", true, ctx({ registration: "unknown" }))).toBe(false);
  });

  it("REQ-FLT-014: kreis filter defaults to the settings and handles 'Ausserhalb'", () => {
    expect(byId("kreis").defaultValue(settings)).toEqual([1, 2, 3, 4, 9]);
    expect(match("kreis", [3], ctx())).toBe(true);
    expect(match("kreis", [9], ctx())).toBe(false);
    const outside = ctx({}, { location: { address: "x", municipality: "Dietikon" } });
    expect(match("kreis", [0], outside)).toBe(true);
    expect(byId("kreis").parse("", settings)).toEqual([]);
    expect(byId("kreis").parse("9,3", settings)).toEqual([3, 9]);
    expect(byId("kreis").parse(null, settings)).toEqual([1, 2, 3, 4, 9]);
    expect(byId("kreis").serialize([9, 4, 3, 2, 1], settings)).toBeNull();
    expect(byId("kreis").serialize([9, 3], settings)).toBe("3,9");
  });

  it("REQ-FLT-015: venue filter matches one venue and round-trips through the URL", () => {
    expect(match("ort", "gz-test", ctx())).toBe(true);
    expect(match("ort", "other", ctx())).toBe(false);
    expect(byId("ort").parse("gz-heuried", settings)).toBe("gz-heuried");
    expect(byId("ort").parse(null, settings)).toBeNull();
    expect(byId("ort").serialize("gz-heuried", settings)).toBe("gz-heuried");
    expect(byId("ort").overrides).toEqual(["kreis", "meine"]);
  });

  it("REQ-FLT-016: 'Meine Orte' matches favourite venues", () => {
    expect(match("meine", true, ctx())).toBe(true);
    expect(match("meine", true, ctx({}, { id: "elsewhere" }))).toBe(false);
  });

  it("REQ-WEB-051: names the active filters that can be relaxed", () => {
    const state = { ...defaultState(settings), preis: "free", anmeldung: true, ort: "gz-test" };
    expect(relaxableLabels(state, settings, "2026-10-20", "GZ Test")).toEqual([
      "GZ Test", "Passt für 9 Mt.", "Gratis / Kollekte", "Ohne Anmeldung",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/src/lib/filters.test.ts`
Expected: FAIL – modules not found.

- [ ] **Step 3: Implement**

`apps/web/src/lib/filters/types.ts`:
```ts
import type { Occurrence, Offer, Venue } from "@zueri-kids/core";

export type Settings = { birthDate: string | null; kreise: number[]; favourites: string[] };

export type FilterContext = { occurrence: Occurrence; offer: Offer; venue: Venue; date: string; settings: Settings };

// REQ-FLT-001
export interface Filter<V> {
  id: string; // also the URL param name
  control: "toggle" | "select" | "multiselect" | "removable";
  label(settings: Settings, date: string): string;
  options?: { value: string; label: string }[];
  defaultValue(settings: Settings): V;
  parse(param: string | null, settings: Settings): V;
  serialize(value: V, settings: Settings): string | null;
  isActive(value: V, settings: Settings): boolean;
  matches(ctx: FilterContext, value: V): boolean;
  overrides?: string[];
}

export type FilterState = Record<string, unknown>;
```

`apps/web/src/lib/filters/age.ts`:
```ts
import { de } from "../../i18n/de";
import { monthsLabel } from "../labels";
import { ageInMonths } from "../time";
import type { Filter } from "./types";

// REQ-FLT-010
export const ageFilter: Filter<boolean> = {
  id: "alter",
  control: "toggle",
  label: (s, date) => de.filters.ageFits(s.birthDate ? monthsLabel(Math.max(0, ageInMonths(s.birthDate, date))) : ""),
  defaultValue: (s) => s.birthDate !== null,
  parse: (p, s) => (p === "1" ? true : p === "0" ? false : s.birthDate !== null),
  serialize: (v, s) => (v === (s.birthDate !== null) ? null : v ? "1" : "0"),
  isActive: (v, s) => v && s.birthDate !== null,
  matches: ({ offer, date, settings }) => {
    const age = ageInMonths(settings.birthDate!, date);
    return age >= (offer.ageMonths.min ?? 0) && age <= (offer.ageMonths.max ?? Number.POSITIVE_INFINITY);
  },
};
```

`apps/web/src/lib/filters/setting.ts`:
```ts
import { de } from "../../i18n/de";
import type { Filter } from "./types";

type Setting = "all" | "indoor" | "outdoor";
const VALUES: Setting[] = ["all", "indoor", "outdoor"];

// REQ-FLT-011
export const settingFilter: Filter<Setting> = {
  id: "lage",
  control: "select",
  label: () => de.filters.setting,
  options: VALUES.map((v) => ({ value: v, label: de.filters.settingOptions[v] })),
  defaultValue: () => "all",
  parse: (p) => (VALUES.includes(p as Setting) ? (p as Setting) : "all"),
  serialize: (v) => (v === "all" ? null : v),
  isActive: (v) => v !== "all",
  matches: ({ offer }, v) => offer.setting === v || offer.setting === "both",
};
```

`apps/web/src/lib/filters/price.ts`:
```ts
import { de } from "../../i18n/de";
import type { Filter } from "./types";

const MAX = /^max:\d+$/;

// REQ-FLT-012
export const priceFilter: Filter<string> = {
  id: "preis",
  control: "select",
  label: () => de.filters.price,
  options: [
    { value: "all", label: de.filters.priceOptions.all },
    { value: "free", label: de.filters.priceOptions.free },
    { value: "max:10", label: de.filters.priceOptions.max10 },
    { value: "max:20", label: de.filters.priceOptions.max20 },
  ],
  defaultValue: () => "all",
  parse: (p) => (p === "free" || (p !== null && MAX.test(p)) ? p : "all"),
  serialize: (v) => (v === "all" ? null : v),
  isActive: (v) => v !== "all",
  matches: ({ offer }, v) => {
    const p = offer.price;
    if (v === "free") return p.type === "free" || p.type === "donation";
    const max = Number(v.slice(4));
    switch (p.type) {
      case "free":
      case "donation": return true;
      case "fixed": return p.chf <= max;
      case "range": return p.minChf <= max;
      case "unknown": return false;
    }
  },
};
```

`apps/web/src/lib/filters/registration.ts`:
```ts
import { de } from "../../i18n/de";
import type { Filter } from "./types";

// REQ-FLT-013
export const registrationFilter: Filter<boolean> = {
  id: "anmeldung",
  control: "toggle",
  label: () => de.filters.noRegistration,
  defaultValue: () => false,
  parse: (p) => p === "1",
  serialize: (v) => (v ? "1" : null),
  isActive: (v) => v,
  matches: ({ offer }) => offer.registration === "none",
};
```

`apps/web/src/lib/filters/kreis.ts`:
```ts
import { de } from "../../i18n/de";
import type { Filter } from "./types";

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0]; // 0 = outside the city
const sorted = (v: number[]) => [...v].sort((a, b) => a - b);
const same = (a: number[], b: number[]) => sorted(a).join(",") === sorted(b).join(",");

// REQ-FLT-014
export const kreisFilter: Filter<number[]> = {
  id: "kreis",
  control: "multiselect",
  label: () => de.filters.kreis,
  options: ALL.map((k) => ({ value: String(k), label: de.kreis(k) })),
  defaultValue: (s) => sorted(s.kreise),
  parse: (p, s) => {
    if (p === null) return sorted(s.kreise);
    if (p === "") return [];
    return sorted([...new Set(p.split(",").map(Number).filter((k) => ALL.includes(k)))]);
  },
  serialize: (v, s) => (same(v, s.kreise) ? null : sorted(v).join(",")),
  isActive: (v) => v.length < ALL.length,
  matches: ({ venue }, v) => v.includes(venue.location.kreis ?? 0),
};
```

`apps/web/src/lib/filters/venue.ts`:
```ts
import type { Filter } from "./types";

// REQ-FLT-015 – the chip shows the venue name, supplied by the view.
export const venueFilter: Filter<string | null> = {
  id: "ort",
  control: "removable",
  label: () => "",
  defaultValue: () => null,
  parse: (p) => (p ? p : null),
  serialize: (v) => v,
  isActive: (v) => v !== null,
  matches: ({ venue }, v) => venue.id === v,
  overrides: ["kreis", "meine"],
};
```

`apps/web/src/lib/filters/mine.ts`:
```ts
import { de } from "../../i18n/de";
import type { Filter } from "./types";

// REQ-FLT-016
export const mineFilter: Filter<boolean> = {
  id: "meine",
  control: "toggle",
  label: () => de.filters.mine,
  defaultValue: () => false,
  parse: (p) => p === "1",
  serialize: (v) => (v ? "1" : null),
  isActive: (v) => v,
  matches: ({ venue, settings }) => settings.favourites.includes(venue.id),
};
```

`apps/web/src/lib/filters/registry.ts`:
```ts
import { ageFilter } from "./age";
import { kreisFilter } from "./kreis";
import { mineFilter } from "./mine";
import { priceFilter } from "./price";
import { registrationFilter } from "./registration";
import { settingFilter } from "./setting";
import type { Filter, FilterContext, FilterState, Settings } from "./types";
import { venueFilter } from "./venue";

// REQ-FLT-001: the single registry. Order = order in the filter bar.
export const FILTERS: Filter<any>[] = [venueFilter, mineFilter, ageFilter, settingFilter, priceFilter, registrationFilter, kreisFilter];

export function defaultState(settings: Settings): FilterState {
  return Object.fromEntries(FILTERS.map((f) => [f.id, f.defaultValue(settings)]));
}

// REQ-FLT-002: active filters minus those overridden by another active filter.
export function activeFilters(state: FilterState, settings: Settings) {
  const active = FILTERS.filter((f) => f.isActive(state[f.id], settings));
  const overridden = new Set(active.flatMap((f) => f.overrides ?? []));
  return active.filter((f) => !overridden.has(f.id));
}

export function matchesFilters(ctx: FilterContext, state: FilterState): boolean {
  return activeFilters(state, ctx.settings).every((f) => f.matches(ctx, state[f.id]));
}

// REQ-WEB-051: human-readable names of the active filters.
export function relaxableLabels(state: FilterState, settings: Settings, date: string, venueName: string | null): string[] {
  return activeFilters(state, settings).map((f) => {
    if (f.control === "removable") return venueName ?? String(state[f.id]);
    if (f.control === "select") return f.options!.find((o) => o.value === state[f.id])?.label ?? f.label(settings, date);
    return f.label(settings, date);
  });
}
```

Note: the `kreis` filter is active with the default selection (it hides
Kreise 5–8, 10–12 and "Ausserhalb"), so `relaxableLabels` includes
"Kreis-Auswahl" by default. The test above sets `ort`, which overrides
`kreis`, so it is not listed there.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): filter modules and registry"
```

---

### Task 4: Device preferences and URL state

**Files:**
- Create: `apps/web/src/lib/prefs.ts`, `apps/web/src/lib/urlState.ts`
- Test: `apps/web/src/lib/prefs.test.ts`, `apps/web/src/lib/urlState.test.ts`

**Interfaces:**
- Consumes: `FILTERS`, `Settings`, `FilterState` (Task 3); `isValidDate` (core)
- Produces:
  - `type View = "timeline" | "list" | "cards"`, `type Group = "time" | "venue"`, `type Prefs = { settings: Settings; view: View; group: Group }`
  - `type Store = Pick<Storage, "getItem" | "setItem">`; `DEFAULT_PREFS`; `loadPrefs(store: Store | null): Prefs`; `savePrefs(store: Store | null, prefs: Prefs): boolean`; `toggleFavourite(settings, venueId): Settings`; `browserStore(): Store | null`
  - `type UrlState = { date: string | null; filters: FilterState }`; `parseUrl(search: string, settings: Settings): UrlState`; `toSearch(state: UrlState, settings: Settings, today: string): string` (`""` or `?…`)

- [ ] **Step 1: Write the failing tests**

`apps/web/src/lib/prefs.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, loadPrefs, savePrefs, toggleFavourite, type Store } from "./prefs";

function memoryStore(): Store & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}
const broken: Store = {
  getItem: () => { throw new Error("blocked"); },
  setItem: () => { throw new Error("blocked"); },
};

describe("prefs", () => {
  it("REQ-WEB-060: falls back to defaults when storage is missing, blocked or corrupt", () => {
    expect(loadPrefs(null)).toEqual(DEFAULT_PREFS);
    expect(loadPrefs(broken)).toEqual(DEFAULT_PREFS);
    const s = memoryStore();
    s.setItem("zueri-kids:prefs", "{not json");
    expect(loadPrefs(s)).toEqual(DEFAULT_PREFS);
    expect(savePrefs(broken, DEFAULT_PREFS)).toBe(false);
    expect(DEFAULT_PREFS.settings.kreise).toEqual([1, 2, 3, 4, 9]);
  });

  it("REQ-WEB-060: stores birth date and Kreise", () => {
    const s = memoryStore();
    const prefs = { ...DEFAULT_PREFS, settings: { ...DEFAULT_PREFS.settings, birthDate: "2025-12-28", kreise: [3, 9] } };
    expect(savePrefs(s, prefs)).toBe(true);
    expect(loadPrefs(s).settings).toEqual({ birthDate: "2025-12-28", kreise: [3, 9], favourites: [] });
  });

  it("REQ-WEB-060: drops invalid stored values", () => {
    const s = memoryStore();
    s.setItem("zueri-kids:prefs", JSON.stringify({ settings: { birthDate: "31.12.2025", kreise: [3, 99], favourites: [1, "gz-heuried"] }, view: "grid", group: 7 }));
    expect(loadPrefs(s)).toEqual({ settings: { birthDate: null, kreise: [3], favourites: ["gz-heuried"] }, view: "timeline", group: "time" });
  });

  it("REQ-WEB-016: remembers the view", () => {
    const s = memoryStore();
    savePrefs(s, { ...DEFAULT_PREFS, view: "list" });
    expect(loadPrefs(s).view).toBe("list");
    expect(DEFAULT_PREFS.view).toBe("timeline");
  });

  it("REQ-WEB-018: remembers the grouping", () => {
    const s = memoryStore();
    savePrefs(s, { ...DEFAULT_PREFS, group: "venue" });
    expect(loadPrefs(s).group).toBe("venue");
    expect(DEFAULT_PREFS.group).toBe("time");
  });

  it("REQ-WEB-062: toggles favourite venues", () => {
    const once = toggleFavourite(DEFAULT_PREFS.settings, "gz-heuried");
    expect(once.favourites).toEqual(["gz-heuried"]);
    expect(toggleFavourite(once, "gz-heuried").favourites).toEqual([]);
  });
});
```

`apps/web/src/lib/urlState.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import type { Settings } from "./filters/types";
import { parseUrl, toSearch } from "./urlState";

const settings: Settings = { birthDate: "2025-12-28", kreise: [1, 2, 3, 4, 9], favourites: [] };

describe("urlState", () => {
  it("REQ-FLT-003: round-trips active filters through the URL", () => {
    const state = parseUrl("?preis=free&anmeldung=1&ort=gz-heuried", settings);
    expect(state.filters).toMatchObject({ preis: "free", anmeldung: true, ort: "gz-heuried", alter: true });
    const search = toSearch(state, settings, "2026-10-20");
    expect(search).toBe("?ort=gz-heuried&preis=free&anmeldung=1");
    expect(parseUrl(search, settings)).toEqual(state);
  });

  it("REQ-WEB-012: keeps the date in the URL, except for today", () => {
    expect(parseUrl("?date=2026-10-21", settings).date).toBe("2026-10-21");
    expect(parseUrl("?date=21.10.2026", settings).date).toBeNull();
    expect(toSearch({ ...parseUrl("", settings), date: "2026-10-21" }, settings, "2026-10-20")).toBe("?date=2026-10-21");
    expect(toSearch({ ...parseUrl("", settings), date: "2026-10-20" }, settings, "2026-10-20")).toBe("");
  });

  it("REQ-WEB-061: URL values override settings defaults", () => {
    expect(parseUrl("?kreis=9", settings).filters.kreis).toEqual([9]);
    expect(parseUrl("", settings).filters.kreis).toEqual([1, 2, 3, 4, 9]);
    expect(parseUrl("?alter=0", settings).filters.alter).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run apps/web/src/lib/prefs.test.ts apps/web/src/lib/urlState.test.ts`
Expected: FAIL – modules not found.

- [ ] **Step 3: Implement**

`apps/web/src/lib/prefs.ts`:
```ts
import { isValidDate } from "@zueri-kids/core";
import type { Settings } from "./filters/types";

export type View = "timeline" | "list" | "cards";
export type Group = "time" | "venue";
export type Prefs = { settings: Settings; view: View; group: Group };
export type Store = Pick<Storage, "getItem" | "setItem">;

const KEY = "zueri-kids:prefs";
const VIEWS: View[] = ["timeline", "list", "cards"];
const GROUPS: Group[] = ["time", "venue"];

export const DEFAULT_PREFS: Prefs = {
  settings: { birthDate: null, kreise: [1, 2, 3, 4, 9], favourites: [] },
  view: "timeline",
  group: "time",
};

function sanitize(raw: unknown): Prefs {
  const r = (raw ?? {}) as { settings?: Partial<Record<keyof Settings, unknown>>; view?: unknown; group?: unknown };
  const s = r.settings ?? {};
  return {
    settings: {
      birthDate: typeof s.birthDate === "string" && isValidDate(s.birthDate) ? s.birthDate : null,
      kreise: Array.isArray(s.kreise)
        ? s.kreise.filter((k): k is number => Number.isInteger(k) && k >= 0 && k <= 12)
        : [...DEFAULT_PREFS.settings.kreise],
      favourites: Array.isArray(s.favourites) ? s.favourites.filter((f): f is string => typeof f === "string") : [],
    },
    view: VIEWS.includes(r.view as View) ? (r.view as View) : DEFAULT_PREFS.view,
    group: GROUPS.includes(r.group as Group) ? (r.group as Group) : DEFAULT_PREFS.group,
  };
}

// REQ-WEB-060: never throws; missing or broken storage yields defaults.
export function loadPrefs(store: Store | null): Prefs {
  try {
    const raw = store?.getItem(KEY);
    return raw ? sanitize(JSON.parse(raw)) : sanitize(DEFAULT_PREFS);
  } catch {
    return sanitize(DEFAULT_PREFS);
  }
}

export function savePrefs(store: Store | null, prefs: Prefs): boolean {
  if (!store) return false;
  try {
    store.setItem(KEY, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}

export function toggleFavourite(settings: Settings, venueId: string): Settings {
  const favourites = settings.favourites.includes(venueId)
    ? settings.favourites.filter((f) => f !== venueId)
    : [...settings.favourites, venueId];
  return { ...settings, favourites };
}

export function browserStore(): Store | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
```

`apps/web/src/lib/urlState.ts`:
```ts
import { isValidDate } from "@zueri-kids/core";
import { FILTERS } from "./filters/registry";
import type { FilterState, Settings } from "./filters/types";

export type UrlState = { date: string | null; filters: FilterState };

export function parseUrl(search: string, settings: Settings): UrlState {
  const p = new URLSearchParams(search);
  const date = p.get("date");
  return {
    date: date && isValidDate(date) ? date : null,
    filters: Object.fromEntries(FILTERS.map((f) => [f.id, f.parse(p.get(f.id), settings)])),
  };
}

export function toSearch(state: UrlState, settings: Settings, today: string): string {
  const p = new URLSearchParams();
  if (state.date && state.date !== today) p.set("date", state.date);
  for (const f of FILTERS) {
    const value = f.serialize(state.filters[f.id], settings);
    if (value !== null) p.set(f.id, value);
  }
  const q = p.toString();
  return q ? `?${q}` : "";
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): device preferences and URL state"
```

---

### Task 5: View model – items, grouping, timeline maths, search

**Files:**
- Create: `apps/web/src/lib/model.ts`, `apps/web/src/lib/grouping.ts`, `apps/web/src/lib/timeline.ts`
- Test: `apps/web/src/lib/model.test.ts`, `apps/web/src/lib/grouping.test.ts`, `apps/web/src/lib/timeline.test.ts`

**Interfaces:**
- Consumes: `occurrences`, `isStale`, `addDays` (core); `Bundle`; `Now`, `toMinutes` (Task 2); `matchesFilters`, `Settings`, `FilterState` (Task 3)
- Produces:
  - `type DayItem = { occurrence: Occurrence; offer: Offer; venue: Venue; past: boolean; stale: boolean }`
  - `type OfferIndex = Map<string, { offer: Offer; venue: Venue }>`; `indexOffers(b: Bundle): OfferIndex`
  - `itemsBetween(b, index, from, to, now): DayItem[]`; `dayItems(b, index, date, now): DayItem[]`
  - `applyFilters(items: DayItem[], state: FilterState, settings: Settings): DayItem[]`
  - `itemKey(item: DayItem): string` (`<key>@<date>@<start>`)
  - `nextOccurrences(b, key, from, n): Occurrence[]`
  - `searchOffers(b, query, today): { offer: Offer; venue: Venue; next: Occurrence | null }[]`
  - `byPeriod(items): { id: "morning" | "afternoon" | "open"; items: DayItem[] }[]`; `byVenue(items, favourites): { venue: Venue; items: DayItem[] }[]`; `pastLast(items): DayItem[]`
  - `AXIS_START`, `AXIS_END`, `AXIS_HOURS: number[]`, `axisPercent(time: string | number): number`, `barStyle(start, end): { left: number; width: number }`

- [ ] **Step 1: Write the failing tests**

Shared fixture in each test (copy verbatim):
```ts
import type { Schedule } from "@zueri-kids/core";
import { noHolidays, offer, source, venue } from "../../../../packages/core/test/fixtures";
import type { Bundle } from "./types";

const weekly = (days: ("mon" | "tue" | "wed")[], start: string, end: string, type: "weekly" | "openingHours" = "weekly"): Schedule => ({
  type, rules: [{ days, start, end }], pausesDuringSchoolHolidays: false, pausesOnPublicHolidays: false,
});
const bundle: Bundle = {
  builtOn: "2026-09-30",
  holidays: noHolidays,
  venues: [
    venue({
      id: "gz-heuried", name: "GZ Heuried", location: { address: "Döltschiweg 130, 8055 Zürich", municipality: "Zürich", kreis: 3 },
      offers: [
        offer({ id: "rollen", title: "Rollender Montag", schedule: weekly(["mon"], "14:30", "17:00", "openingHours") }),
        offer({ id: "musik", title: "Music Together", schedule: weekly(["tue"], "09:30", "10:30"), registration: "required" }),
      ],
    }),
    venue({
      id: "pbz-sihlcity", name: "PBZ Sihlcity", location: { address: "Kalanderplatz 5, 8045 Zürich", municipality: "Zürich", kreis: 3 },
      offers: [
        offer({ id: "ryte", title: "Ryte, ryte Rössli", schedule: weekly(["tue"], "10:00", "10:45"), source: { ...source, lastVerified: "2026-05-01" } }),
        offer({ id: "ecke", title: "Kinderecke", description: "Bücher anschauen", schedule: weekly(["tue"], "12:00", "19:00", "openingHours") }),
      ],
    }),
  ],
};
```

`apps/web/src/lib/model.test.ts` (fixture block above, then):
```ts
import { describe, expect, it } from "vitest";
import { applyFilters, dayItems, indexOffers, itemsBetween, nextOccurrences, searchOffers } from "./model";
import { defaultState } from "./filters/registry";

const index = indexOffers(bundle);
const tuesday = "2026-10-20";

describe("model", () => {
  it("REQ-WEB-010: returns the day's occurrences with offer and venue", () => {
    const items = dayItems(bundle, index, tuesday, { date: "2026-09-30", minutes: 0 });
    expect(items.map((i) => i.offer.title)).toEqual(["Music Together", "Ryte, ryte Rössli", "Kinderecke"]);
    expect(items[0].venue.name).toBe("GZ Heuried");
  });

  it("REQ-WEB-013: marks ended occurrences as past only on today", () => {
    const at1030 = dayItems(bundle, index, tuesday, { date: tuesday, minutes: 630 });
    expect(at1030.map((i) => i.past)).toEqual([true, false, false]);
    const otherDay = dayItems(bundle, index, tuesday, { date: "2026-10-21", minutes: 630 });
    expect(otherDay.every((i) => !i.past)).toBe(true);
  });

  it("REQ-WEB-050: flags stale offers", () => {
    const items = dayItems(bundle, index, tuesday, { date: "2026-09-30", minutes: 0 });
    expect(items.map((i) => i.stale)).toEqual([false, true, false]);
  });

  it("REQ-WEB-010: applies the active filters", () => {
    const settings = { birthDate: null, kreise: [3], favourites: [] };
    const items = dayItems(bundle, index, tuesday, { date: "2026-09-30", minutes: 0 });
    const state = { ...defaultState(settings), anmeldung: true };
    expect(applyFilters(items, state, settings).map((i) => i.offer.id)).toEqual(["ryte", "ecke"]);
  });

  it("REQ-WEB-020: returns all items of a week", () => {
    const items = itemsBetween(bundle, index, "2026-10-19", "2026-10-25", { date: "2026-09-30", minutes: 0 });
    expect(items.map((i) => `${i.occurrence.date} ${i.offer.id}`)).toEqual([
      "2026-10-19 rollen", "2026-10-20 musik", "2026-10-20 ryte", "2026-10-20 ecke",
    ]);
  });

  it("REQ-WEB-040: lists the next occurrences of one offer", () => {
    expect(nextOccurrences(bundle, "pbz-sihlcity/ryte", tuesday, 3).map((o) => o.date)).toEqual(["2026-10-20", "2026-10-27", "2026-11-03"]);
  });

  it("REQ-WEB-030: searches title, description, venue and address, ignoring case and diacritics", () => {
    expect(searchOffers(bundle, "ROSSLI", tuesday).map((r) => r.offer.id)).toEqual(["ryte"]);
    expect(searchOffers(bundle, "bucher", tuesday).map((r) => r.offer.id)).toEqual(["ecke"]);
    expect(searchOffers(bundle, "doltschiweg", tuesday).map((r) => r.offer.id).sort()).toEqual(["musik", "rollen"]);
    const [first] = searchOffers(bundle, "zurich", tuesday);
    expect(first.next).toMatchObject({ date: tuesday });
  });
});
```

`apps/web/src/lib/grouping.test.ts` (fixture block above, then):
```ts
import { describe, expect, it } from "vitest";
import { byPeriod, byVenue } from "./grouping";
import { dayItems, indexOffers } from "./model";

const items = dayItems(bundle, indexOffers(bundle), "2026-10-20", { date: "2026-10-20", minutes: 630 });

describe("grouping", () => {
  it("REQ-WEB-011: groups into Vormittag, Nachmittag and Offen", () => {
    expect(byPeriod(items).map((g) => [g.id, g.items.map((i) => i.offer.id)])).toEqual([
      ["morning", ["ryte", "musik"]],
      ["open", ["ecke"]],
    ]);
  });

  it("REQ-WEB-013: lists past items after the others in their group", () => {
    const morning = byPeriod(items)[0].items;
    expect(morning.map((i) => [i.offer.id, i.past])).toEqual([["ryte", false], ["musik", true]]);
  });

  it("REQ-WEB-018: groups by venue, favourites first, then by earliest start", () => {
    expect(byVenue(items, []).map((g) => g.venue.id)).toEqual(["gz-heuried", "pbz-sihlcity"]);
    expect(byVenue(items, ["pbz-sihlcity"]).map((g) => g.venue.id)).toEqual(["pbz-sihlcity", "gz-heuried"]);
  });
});
```

`apps/web/src/lib/timeline.test.ts` (no fixture needed):
```ts
import { describe, expect, it } from "vitest";
import { AXIS_HOURS, axisPercent, barStyle } from "./timeline";

describe("timeline", () => {
  it("REQ-WEB-017: maps 08:00–19:00 onto 0–100%", () => {
    expect(AXIS_HOURS).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
    expect(axisPercent("08:00")).toBe(0);
    expect(axisPercent("13:30")).toBe(50);
    expect(axisPercent("19:00")).toBe(100);
    expect(axisPercent("06:00")).toBe(0);
    expect(axisPercent("21:30")).toBe(100);
    expect(axisPercent(615)).toBeCloseTo(20.45, 1); // 10:15 = 135 of 660 minutes
  });

  it("REQ-WEB-017: bars span start to end with a minimum width", () => {
    expect(barStyle("08:00", "13:30")).toEqual({ left: 0, width: 50 });
    expect(barStyle("10:00", "10:05").width).toBe(1.5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run apps/web/src/lib`
Expected: FAIL for the three new files.

- [ ] **Step 3: Implement**

`apps/web/src/lib/model.ts`:
```ts
import { addDays, isStale, occurrences, type Occurrence, type Offer, type Venue } from "@zueri-kids/core";
import { matchesFilters } from "./filters/registry";
import type { FilterState, Settings } from "./filters/types";
import { toMinutes, type Now } from "./time";
import type { Bundle } from "./types";

export type DayItem = { occurrence: Occurrence; offer: Offer; venue: Venue; past: boolean; stale: boolean };
export type OfferIndex = Map<string, { offer: Offer; venue: Venue }>;

export function indexOffers(b: Bundle): OfferIndex {
  return new Map(b.venues.flatMap((venue) => venue.offers.map((offer) => [`${venue.id}/${offer.id}`, { offer, venue }] as const)));
}

export function itemsBetween(b: Bundle, index: OfferIndex, from: string, to: string, now: Now): DayItem[] {
  return occurrences(b.venues, b.holidays, from, to).map((occurrence) => {
    const { offer, venue } = index.get(occurrence.key)!;
    return {
      occurrence, offer, venue,
      past: occurrence.date === now.date && toMinutes(occurrence.end) <= now.minutes,
      stale: isStale(offer, now.date),
    };
  });
}

export const dayItems = (b: Bundle, index: OfferIndex, date: string, now: Now): DayItem[] => itemsBetween(b, index, date, date, now);

export function applyFilters(items: DayItem[], state: FilterState, settings: Settings): DayItem[] {
  return items.filter((i) => matchesFilters({ occurrence: i.occurrence, offer: i.offer, venue: i.venue, date: i.occurrence.date, settings }, state));
}

export const itemKey = (i: DayItem): string => `${i.occurrence.key}@${i.occurrence.date}@${i.occurrence.start}`;

export function nextOccurrences(b: Bundle, key: string, from: string, n: number): Occurrence[] {
  const [venueId, offerId] = key.split("/");
  const venue = b.venues.find((v) => v.id === venueId);
  const offer = venue?.offers.find((o) => o.id === offerId);
  if (!venue || !offer) return [];
  return occurrences([{ ...venue, offers: [offer] }], b.holidays, from, addDays(from, 365)).slice(0, n);
}

const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// REQ-WEB-030
export function searchOffers(b: Bundle, query: string, today: string) {
  const q = normalize(query.trim());
  const next = new Map<string, Occurrence>();
  for (const o of occurrences(b.venues, b.holidays, today, addDays(today, 28))) if (!next.has(o.key)) next.set(o.key, o);
  return b.venues
    .flatMap((venue) =>
      venue.offers
        .filter((offer) => normalize([offer.title, offer.description ?? "", venue.name, venue.location.address].join(" ")).includes(q))
        .map((offer) => ({ offer, venue, next: next.get(`${venue.id}/${offer.id}`) ?? null })),
    )
    .sort((a, b2) => {
      if (a.next && b2.next) return cmp(a.next.date + a.next.start, b2.next.date + b2.next.start);
      if (a.next || b2.next) return a.next ? -1 : 1;
      return a.offer.title.localeCompare(b2.offer.title, "de");
    });
}
```

`apps/web/src/lib/grouping.ts`:
```ts
import type { Venue } from "@zueri-kids/core";
import type { DayItem } from "./model";
import { toMinutes } from "./time";

export const pastLast = (items: DayItem[]): DayItem[] => [...items.filter((i) => !i.past), ...items.filter((i) => i.past)];

// REQ-WEB-011, REQ-WEB-013
export function byPeriod(items: DayItem[]): { id: "morning" | "afternoon" | "open"; items: DayItem[] }[] {
  const groups = [
    { id: "morning" as const, items: items.filter((i) => i.occurrence.kind === "session" && toMinutes(i.occurrence.start) < 720) },
    { id: "afternoon" as const, items: items.filter((i) => i.occurrence.kind === "session" && toMinutes(i.occurrence.start) >= 720) },
    { id: "open" as const, items: items.filter((i) => i.occurrence.kind === "open") },
  ];
  return groups.filter((g) => g.items.length > 0).map((g) => ({ ...g, items: pastLast(g.items) }));
}

// REQ-WEB-018: favourites first, then by earliest start, then by name.
export function byVenue(items: DayItem[], favourites: string[]): { venue: Venue; items: DayItem[] }[] {
  const map = new Map<string, { venue: Venue; items: DayItem[] }>();
  for (const i of items) {
    const g = map.get(i.venue.id) ?? { venue: i.venue, items: [] };
    g.items.push(i);
    map.set(i.venue.id, g);
  }
  const fav = (v: Venue) => (favourites.includes(v.id) ? 0 : 1);
  return [...map.values()].sort(
    (a, b) => fav(a.venue) - fav(b.venue) || a.items[0].occurrence.start.localeCompare(b.items[0].occurrence.start) || a.venue.name.localeCompare(b.venue.name, "de"),
  );
}
```

`apps/web/src/lib/timeline.ts`:
```ts
import { toMinutes } from "./time";

export const AXIS_START = 8 * 60;
export const AXIS_END = 19 * 60;
export const AXIS_HOURS = Array.from({ length: (AXIS_END - AXIS_START) / 60 }, (_, i) => 8 + i);
const MIN_WIDTH = 1.5;

export function axisPercent(time: string | number): number {
  const m = typeof time === "number" ? time : toMinutes(time);
  return Math.max(0, Math.min(100, ((m - AXIS_START) / (AXIS_END - AXIS_START)) * 100));
}

export function barStyle(start: string, end: string): { left: number; width: number } {
  const left = axisPercent(start);
  return { left, width: Math.max(MIN_WIDTH, axisPercent(end) - left) };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): view model – items, grouping, timeline maths, search"
```

---

### Task 6: Day view island

**Files:**
- Create: `apps/web/src/components/hooks.ts`, `types.ts`, `Item.tsx`, `VenueHeader.tsx`, `FilterBar.tsx`, `TimelineView.tsx`, `ListView.tsx`, `CardsView.tsx`, `DayApp.tsx`
- Modify: `apps/web/src/pages/index.astro`

**Interfaces:**
- Consumes: everything from Tasks 1–5
- Produces:
  - Hooks: `useBundle(): { bundle: Bundle | null; index: OfferIndex | null; error: boolean }`, `useNow(): Now`, `usePrefs(): [Prefs, (fn: (p: Prefs) => Prefs) => void]`, `useUrlState(settings, today): [UrlState, (s: UrlState) => void]`
  - `ViewProps` (see `types.ts`), `catVar(category)`
  - `FilterBar` props `{ state; settings; date; venueName: string | null; onChange(id: string, value: unknown): void }` – reused by Task 8
  - Default export `DayApp` (no props)

Behaviour is verified by the Playwright tests in Task 10 (REQ-WEB-080,
-019, -021). The logic it uses is already unit-tested.

- [ ] **Step 1: Hooks and shared types**

`apps/web/src/components/hooks.ts`:
```ts
import { useEffect, useMemo, useState } from "preact/hooks";
import { indexOffers, type OfferIndex } from "../lib/model";
import { browserStore, loadPrefs, savePrefs, type Prefs } from "../lib/prefs";
import { nowInZurich, type Now } from "../lib/time";
import type { Bundle } from "../lib/types";
import { parseUrl, toSearch, type UrlState } from "../lib/urlState";
import type { Settings } from "../lib/filters/types";
import { href } from "./env";

export function useBundle(): { bundle: Bundle | null; index: OfferIndex | null; error: boolean } {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch(href("bundle.json"))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setBundle)
      .catch(() => setError(true));
  }, []);
  const index = useMemo(() => (bundle ? indexOffers(bundle) : null), [bundle]);
  return { bundle, index, error };
}

export function useNow(): Now {
  const [now, setNow] = useState(() => nowInZurich(new Date()));
  useEffect(() => {
    const t = setInterval(() => setNow(nowInZurich(new Date())), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function usePrefs(): [Prefs, (fn: (p: Prefs) => Prefs) => void] {
  const [prefs, setPrefs] = useState(() => loadPrefs(browserStore()));
  const update = (fn: (p: Prefs) => Prefs) =>
    setPrefs((prev) => {
      const next = fn(prev);
      savePrefs(browserStore(), next);
      return next;
    });
  return [prefs, update];
}

// Keeps date and filters in the URL (REQ-FLT-003, REQ-WEB-012).
export function useUrlState(settings: Settings, today: string): [UrlState, (s: UrlState) => void] {
  const [state, setState] = useState(() => parseUrl(location.search, settings));
  useEffect(() => {
    history.replaceState(null, "", location.pathname + toSearch(state, settings, today));
  }, [state, settings, today]);
  return [state, setState];
}
```

`apps/web/src/components/types.ts`:
```ts
import type { Now } from "../lib/time";
import type { DayItem } from "../lib/model";
import type { Group } from "../lib/prefs";

export type ViewProps = {
  items: DayItem[];
  group: Group;
  now: Now;
  date: string;
  favourites: string[];
  showVenue: boolean;
  expanded: string | null;
  onExpand(key: string): void;
  onVenue(venueId: string): void;
  onStar(venueId: string): void;
};

export const catVar = (category: string) => ({ "--cat": `var(--c-${category})` });
```

- [ ] **Step 2: Item pieces, venue header, filter bar**

`apps/web/src/components/Item.tsx`:
```tsx
import { de } from "../i18n/de";
import { ageLabel, kreisLabel, priceLabel, registrationMarker } from "../lib/labels";
import type { DayItem } from "../lib/model";
import { href } from "./env";
import type { ViewProps } from "./types";

export function ItemMeta({ item, p }: { item: DayItem; p: ViewProps }) {
  const { offer, venue } = item;
  const reg = registrationMarker(offer.registration);
  return (
    <div class="meta">
      {p.showVenue && (
        <>
          <button type="button" class="vlink" onClick={() => p.onVenue(venue.id)}>{venue.name}</button>
          <span class="k">{kreisLabel(venue.location.kreis)}</span>
        </>
      )}
      <span>{priceLabel(offer.price)}</span>
      {offer.setting === "outdoor" && <span>{de.setting.outdoor}</span>}
      {reg && <span class="tag reg">{reg}</span>}
      {item.stale && <span class="tag stale">{de.stale}</span>}
    </div>
  );
}

export function ItemDetails({ item }: { item: DayItem }) {
  const { offer, venue } = item;
  const note = "note" in offer.price ? offer.price.note : undefined;
  const website = offer.url ?? venue.website;
  const facts = [`${venue.name}, ${venue.location.address}`, ageLabel(offer.ageMonths), de.setting[offer.setting], de.category[offer.category], note];
  return (
    <div class="detail">
      {offer.description && <p>{offer.description}</p>}
      <p class="muted">{facts.filter(Boolean).join(" · ")}</p>
      <p>
        {website && <><a href={website} target="_blank" rel="noopener">{de.details.website}</a>{" · "}</>}
        <a href={href(`angebot/${venue.id}/${offer.id}/`)}>{de.details.more}</a>
      </p>
    </div>
  );
}
```

`apps/web/src/components/VenueHeader.tsx`:
```tsx
import type { Venue } from "@zueri-kids/core";
import { de } from "../i18n/de";
import { kreisLabel } from "../lib/labels";
import type { ViewProps } from "./types";

export function VenueHeader({ venue, count, p }: { venue: Venue; count: number; p: ViewProps }) {
  const fav = p.favourites.includes(venue.id);
  return (
    <div class="venuehead">
      <h3><button type="button" class="vlink" onClick={() => p.onVenue(venue.id)}>{venue.name}</button></h3>
      <span class="meta"><span class="k">{kreisLabel(venue.location.kreis)}</span><span>{de.offers(count)}</span></span>
      <button type="button" class="star" aria-pressed={fav} aria-label={fav ? de.star.remove : de.star.add} onClick={() => p.onStar(venue.id)}>
        {fav ? "★" : "☆"}
      </button>
    </div>
  );
}
```

`apps/web/src/components/FilterBar.tsx`:
```tsx
import { Fragment } from "preact";
import { de } from "../i18n/de";
import { FILTERS } from "../lib/filters/registry";
import type { FilterState, Settings } from "../lib/filters/types";

type Props = { state: FilterState; settings: Settings; date: string; venueName: string | null; onChange(id: string, value: unknown): void };

export function FilterBar({ state, settings, date, venueName, onChange }: Props) {
  return (
    <div class="chips" role="group" aria-label={de.filters.label}>
      {FILTERS.map((f) => {
        const value = state[f.id];
        if (f.control === "removable") {
          if (!f.isActive(value, settings)) return null;
          return (
            <button type="button" key={f.id} class="chip venue" aria-label={de.filters.removeVenue(venueName ?? "")} onClick={() => onChange(f.id, f.defaultValue(settings))}>
              {venueName} ✕
            </button>
          );
        }
        if (f.control === "toggle") {
          if (f.id === "alter" && settings.birthDate === null) return null;
          return (
            <button type="button" key={f.id} class="chip" aria-pressed={Boolean(value)} onClick={() => onChange(f.id, !value)}>
              {f.label(settings, date)}
            </button>
          );
        }
        if (f.control === "select") {
          return (
            <select key={f.id} id={`filter-${f.id}`} class="chip" aria-label={f.label(settings, date)} value={value as string}
              onChange={(e) => onChange(f.id, (e.currentTarget as HTMLSelectElement).value)}>
              {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          );
        }
        const selected = value as number[];
        return (
          <Fragment key={f.id}>
            <span class="sep" aria-hidden="true" />
            {f.options!.map((o) => {
              const k = Number(o.value);
              const on = selected.includes(k);
              return (
                <button type="button" key={o.value} class="chip kreis" aria-pressed={on}
                  onClick={() => onChange(f.id, on ? selected.filter((x) => x !== k) : [...selected, k])}>
                  {o.label}
                </button>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: The three views**

`apps/web/src/components/TimelineView.tsx`:
```tsx
import { Fragment } from "preact";
import { de } from "../i18n/de";
import { byVenue } from "../lib/grouping";
import { itemKey, type DayItem } from "../lib/model";
import { AXIS_END, AXIS_HOURS, AXIS_START, axisPercent, barStyle } from "../lib/timeline";
import { ItemDetails, ItemMeta } from "./Item";
import { catVar, type ViewProps } from "./types";
import { VenueHeader } from "./VenueHeader";

function Row({ item, p }: { item: DayItem; p: ViewProps }) {
  const { left, width } = barStyle(item.occurrence.start, item.occurrence.end);
  const key = itemKey(item);
  return (
    <div class={`tl-row${item.past ? " past" : ""}`} style={catVar(item.offer.category)}>
      <button type="button" class="rowbtn" aria-expanded={p.expanded === key} onClick={() => p.onExpand(key)}>
        <div class="head">
          <span class="time">{item.occurrence.start}–{item.occurrence.end}</span>
          <span class="title">{item.offer.title}</span>
        </div>
        <div class="track">
          <div class={`span${item.occurrence.kind === "open" ? " open" : ""}`} style={{ left: `${left}%`, width: `${width}%` }} />
        </div>
      </button>
      <ItemMeta item={item} p={p} />
      {p.expanded === key && <ItemDetails item={item} />}
    </div>
  );
}

export function TimelineView(p: ViewProps) {
  const showNow = p.date === p.now.date && p.now.minutes >= AXIS_START && p.now.minutes <= AXIS_END;
  const rows = (items: DayItem[]) => (
    <div class="tl-rows">
      <div class="tl-grid" aria-hidden="true">{AXIS_HOURS.map((h) => <span key={h} />)}</div>
      {showNow && <div class="nowline" data-label={de.now} style={{ left: `${axisPercent(p.now.minutes)}%` }} />}
      {items.map((item) => <Row key={itemKey(item)} item={item} p={p} />)}
    </div>
  );
  return (
    <div class="tl">
      <div class="axis" aria-hidden="true">{AXIS_HOURS.map((h) => <span key={h}>{String(h).padStart(2, "0")}</span>)}</div>
      {p.group === "venue"
        ? byVenue(p.items, p.favourites).map((g) => (
            <Fragment key={g.venue.id}>
              <VenueHeader venue={g.venue} count={g.items.length} p={p} />
              {rows(g.items)}
            </Fragment>
          ))
        : rows(p.items)}
    </div>
  );
}
```

`apps/web/src/components/ListView.tsx`:
```tsx
import { Fragment } from "preact";
import { de } from "../i18n/de";
import { byPeriod, byVenue, pastLast } from "../lib/grouping";
import { itemKey, type DayItem } from "../lib/model";
import { ItemDetails, ItemMeta } from "./Item";
import { catVar, type ViewProps } from "./types";
import { VenueHeader } from "./VenueHeader";

function Row({ item, p }: { item: DayItem; p: ViewProps }) {
  const key = itemKey(item);
  return (
    <div class={`li${item.past ? " past" : ""}`} style={catVar(item.offer.category)}>
      <div class="time">{item.occurrence.start}<small>{item.occurrence.end}</small></div>
      <span class="dot" />
      <div class="body">
        <button type="button" class="rowbtn" aria-expanded={p.expanded === key} onClick={() => p.onExpand(key)}>
          <div class="title">{item.offer.title}</div>
        </button>
        <ItemMeta item={item} p={p} />
        {p.expanded === key && <ItemDetails item={item} />}
      </div>
    </div>
  );
}

export function ListView(p: ViewProps) {
  const list = (items: DayItem[]) => <div class="list">{items.map((i) => <Row key={itemKey(i)} item={i} p={p} />)}</div>;
  if (p.group === "venue") {
    return (
      <>
        {byVenue(p.items, p.favourites).map((g) => (
          <Fragment key={g.venue.id}>
            <VenueHeader venue={g.venue} count={g.items.length} p={p} />
            {list(pastLast(g.items))}
          </Fragment>
        ))}
      </>
    );
  }
  return (
    <>
      {byPeriod(p.items).map((g) => (
        <section class="group" key={g.id}>
          <h2>{de.periods[g.id]}</h2>
          {list(g.items)}
        </section>
      ))}
    </>
  );
}
```

`apps/web/src/components/CardsView.tsx`:
```tsx
import { Fragment } from "preact";
import { byVenue, pastLast } from "../lib/grouping";
import { itemKey, type DayItem } from "../lib/model";
import { ItemDetails, ItemMeta } from "./Item";
import { catVar, type ViewProps } from "./types";
import { VenueHeader } from "./VenueHeader";

function Card({ item, p }: { item: DayItem; p: ViewProps }) {
  const key = itemKey(item);
  return (
    <div class={`card${item.past ? " past" : ""}`} style={catVar(item.offer.category)}>
      <div class="time">{item.occurrence.start}–{item.occurrence.end}</div>
      <button type="button" class="rowbtn" aria-expanded={p.expanded === key} onClick={() => p.onExpand(key)}>
        <div class="title">{item.offer.title}</div>
      </button>
      <ItemMeta item={item} p={p} />
      {p.expanded === key && <ItemDetails item={item} />}
    </div>
  );
}

// REQ-WEB-019
export function CardsView(p: ViewProps) {
  const grid = (items: DayItem[]) => <div class="cards">{pastLast(items).map((i) => <Card key={itemKey(i)} item={i} p={p} />)}</div>;
  if (p.group === "venue") {
    return (
      <>
        {byVenue(p.items, p.favourites).map((g) => (
          <Fragment key={g.venue.id}>
            <VenueHeader venue={g.venue} count={g.items.length} p={p} />
            {grid(g.items)}
          </Fragment>
        ))}
      </>
    );
  }
  return grid(p.items);
}
```

- [ ] **Step 4: DayApp and page**

`apps/web/src/components/DayApp.tsx`:
```tsx
import { addDays } from "@zueri-kids/core";
import { useState } from "preact/hooks";
import { de } from "../i18n/de";
import { dayNotice, weekOf } from "../lib/calendar";
import { relaxableLabels } from "../lib/filters/registry";
import { dayOfMonth, dayTitle, weekdayShort } from "../lib/labels";
import { applyFilters, dayItems } from "../lib/model";
import { toggleFavourite, type Group, type View } from "../lib/prefs";
import { CardsView } from "./CardsView";
import { FilterBar } from "./FilterBar";
import { useBundle, useNow, usePrefs, useUrlState } from "./hooks";
import { ListView } from "./ListView";
import { TimelineView } from "./TimelineView";
import type { ViewProps } from "./types";

const VIEWS: View[] = ["timeline", "list", "cards"];
const GROUPS: Group[] = ["time", "venue"];

export default function DayApp() {
  const { bundle, index, error } = useBundle();
  const now = useNow();
  const [prefs, updatePrefs] = usePrefs();
  const [url, setUrl] = useUrlState(prefs.settings, now.date);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (error) return <p class="empty">{de.loadError}</p>;
  if (!bundle || !index) return <p class="summary">{de.loading}</p>;

  const date = url.date ?? now.date;
  const all = dayItems(bundle, index, date, now);
  const shown = applyFilters(all, url.filters, prefs.settings);
  const venueId = (url.filters.ort as string | null) ?? null;
  const venueName = venueId ? bundle.venues.find((v) => v.id === venueId)?.name ?? venueId : null;
  const notice = dayNotice(date, bundle.holidays);
  const title = dayTitle(date, now.date);

  const setDate = (d: string) => { setExpanded(null); setUrl({ ...url, date: d }); };
  const setFilter = (id: string, value: unknown) => setUrl({ ...url, filters: { ...url.filters, [id]: value } });

  const props: ViewProps = {
    items: shown,
    group: prefs.group,
    now,
    date,
    favourites: prefs.settings.favourites,
    showVenue: prefs.group === "time" && venueId === null,
    expanded,
    onExpand: (k) => setExpanded(expanded === k ? null : k),
    onVenue: (id) => { setFilter("ort", id); window.scrollTo({ top: 0 }); },
    onStar: (id) => updatePrefs((p) => ({ ...p, settings: toggleFavourite(p.settings, id) })),
  };
  const View = prefs.view === "timeline" ? TimelineView : prefs.view === "list" ? ListView : CardsView;

  return (
    <>
      <header class="bar">
        <div class="brand">{de.brand.first} <span>{de.brand.second}</span></div>
        <div class="daynav">
          <button type="button" class="iconbtn" aria-label={de.prevDay} onClick={() => setDate(addDays(date, -1))}>‹</button>
          <h1>{title.title}<small>{title.subtitle}</small></h1>
          <button type="button" class="iconbtn" aria-label={de.nextDay} onClick={() => setDate(addDays(date, 1))}>›</button>
        </div>
        <div class="days" role="group" aria-label={de.chooseDay}>
          {weekOf(date).map((d) => (
            <button type="button" key={d} aria-pressed={d === date} onClick={() => setDate(d)}>
              {weekdayShort(d)}<b>{dayOfMonth(d)}</b>
            </button>
          ))}
        </div>
        <div class="controls">
          <div class="views" role="group" aria-label={de.views.label}>
            {VIEWS.map((v) => (
              <button type="button" key={v} aria-pressed={prefs.view === v} onClick={() => updatePrefs((p) => ({ ...p, view: v }))}>{de.views[v]}</button>
            ))}
          </div>
          <div class="groupby" role="group" aria-label={de.groups.label}>
            {GROUPS.map((g) => (
              <button type="button" key={g} aria-pressed={prefs.group === g} onClick={() => updatePrefs((p) => ({ ...p, group: g }))}>{de.groups[g]}</button>
            ))}
          </div>
        </div>
        <FilterBar state={url.filters} settings={prefs.settings} date={date} venueName={venueName} onChange={setFilter} />
      </header>

      {notice.schoolHoliday && <p class="notice">{de.notices.schoolHoliday}</p>}
      {notice.publicHoliday && <p class="notice">{de.notices.publicHoliday(notice.publicHoliday)}</p>}
      <p class="summary">{venueName ? de.summaryVenue(shown.length) : de.summary(shown.length, all.length)}</p>

      <main>
        {shown.length === 0 ? (
          <div class="empty">{de.empty}. {de.emptyHint(relaxableLabels(url.filters, prefs.settings, date, venueName))}</div>
        ) : (
          <View {...props} />
        )}
      </main>
      {prefs.view === "timeline" && shown.length > 0 && (
        <div class="legend"><span><i />{de.legend.session}</span><span><i class="open" />{de.legend.open}</span></div>
      )}
    </>
  );
}
```

Replace `apps/web/src/pages/index.astro`:
```astro
---
import Base from "../layouts/Base.astro";
import DayApp from "../components/DayApp";
import { de } from "../i18n/de";
---
<Base title={de.pageTitles.today} active="today"><DayApp client:only="preact" /></Base>
```

- [ ] **Step 5: Typecheck, build, look at it**

Run: `npm run typecheck && npm run build && npm test`
Expected: clean; build succeeds.

Run: `npm run dev` and open `http://localhost:4321/?date=2026-10-20`.
Check against the mockup: timeline with bars, switch to Liste/Karten,
"Nach Ort", tap a venue name (chip appears), star a venue, reload (view,
grouping and stars persist). Fix visible differences before committing.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): day view with timeline, list and cards"
```

---

### Task 7: Detail pages

**Files:**
- Create: `apps/web/src/components/NextDates.tsx`, `apps/web/src/components/StarToggle.tsx`
- Create: `apps/web/src/pages/angebot/[venue]/[offer].astro`

**Interfaces:**
- Consumes: `getBundle` (Task 1), labels (Task 2), `nextOccurrences` (Task 5), hooks (Task 6)
- Produces: one static page per offer at `/angebot/<venue-id>/<offer-id>/` (REQ-WEB-040/041, e2e-tested in Task 10)

- [ ] **Step 1: Islands**

`apps/web/src/components/NextDates.tsx`:
```tsx
import { de } from "../i18n/de";
import { shortDate, weekdayShort } from "../lib/labels";
import { nextOccurrences } from "../lib/model";
import { useBundle, useNow } from "./hooks";

export default function NextDates({ offerKey }: { offerKey: string }) {
  const { bundle } = useBundle();
  const now = useNow();
  if (!bundle) return <p class="muted">{de.loading}</p>;
  const next = nextOccurrences(bundle, offerKey, now.date, 5);
  if (!next.length) return <p class="muted">{de.details.noNext}</p>;
  return (
    <ul class="results">
      {next.map((o) => (
        <li key={o.date + o.start}>{weekdayShort(o.date)} {shortDate(o.date)} · {o.start}–{o.end}</li>
      ))}
    </ul>
  );
}
```

`apps/web/src/components/StarToggle.tsx`:
```tsx
import { de } from "../i18n/de";
import { toggleFavourite } from "../lib/prefs";
import { usePrefs } from "./hooks";

export default function StarToggle({ venueId }: { venueId: string }) {
  const [prefs, update] = usePrefs();
  const fav = prefs.settings.favourites.includes(venueId);
  return (
    <button type="button" class="star" aria-pressed={fav} aria-label={fav ? de.star.remove : de.star.add}
      onClick={() => update((p) => ({ ...p, settings: toggleFavourite(p.settings, venueId) }))}>
      {fav ? "★" : "☆"}
    </button>
  );
}
```

- [ ] **Step 2: Page** – `apps/web/src/pages/angebot/[venue]/[offer].astro`

```astro
---
import { isStale, type Offer, type Venue } from "@zueri-kids/core";
import Base from "../../../layouts/Base.astro";
import NextDates from "../../../components/NextDates";
import StarToggle from "../../../components/StarToggle";
import { getBundle } from "../../../data/bundle";
import { de } from "../../../i18n/de";
import { ageLabel, kreisLabel, longDate, priceLabel } from "../../../lib/labels";

export function getStaticPaths() {
  return getBundle().venues.flatMap((venue) =>
    venue.offers.map((offer) => ({ params: { venue: venue.id, offer: offer.id }, props: { venue, offer } })),
  );
}
interface Props { venue: Venue; offer: Offer }
const { venue, offer } = Astro.props;
const base = import.meta.env.BASE_URL.replace(/\/$/, "");
const stale = isStale(offer, getBundle().builtOn);
const note = "note" in offer.price ? offer.price.note : undefined;
const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.location.address)}`;
const website = offer.url ?? venue.website;
---
<Base title={offer.title}>
  <div class="stack">
    <a class="backlink" href={`${base}/`}>{de.details.back}</a>
    <div>
      <h1 class="page-title">{offer.title}</h1>
      <div class="venuehead" style="border-bottom:0;padding-top:0">
        <h3>{venue.name}</h3>
        <span class="meta"><span class="k">{kreisLabel(venue.location.kreis)}</span></span>
        <StarToggle client:only="preact" venueId={venue.id} />
      </div>
      {stale && <p class="notice">{de.stale}</p>}
    </div>
    {offer.description && <p>{offer.description}</p>}
    <dl class="facts">
      <dt>{de.details.age}</dt><dd>{ageLabel(offer.ageMonths)}</dd>
      <dt>{de.details.price}</dt><dd>{priceLabel(offer.price)}{note && ` · ${note}`}</dd>
      <dt>{de.details.registration}</dt><dd>{de.registration[offer.registration]}</dd>
      <dt>{de.details.setting}</dt><dd>{de.setting[offer.setting]}</dd>
      <dt>{de.details.category}</dt><dd>{de.category[offer.category]}</dd>
      <dt>{de.details.address}</dt><dd>{venue.location.address} · <a href={maps} target="_blank" rel="noopener">{de.details.maps}</a></dd>
      {offer.notes && <><dt>{de.details.notes}</dt><dd>{offer.notes}</dd></>}
    </dl>
    <section>
      <h2 class="group" style="font-family:var(--f-display)">{de.details.next}</h2>
      <NextDates client:only="preact" offerKey={`${venue.id}/${offer.id}`} />
    </section>
    <p>
      {website && <><a href={website} target="_blank" rel="noopener">{de.details.website}</a> · </>}
      <a href={offer.source.url} target="_blank" rel="noopener">{de.details.source}</a>
    </p>
    <p class="muted">{de.details.lastVerified(longDate(offer.source.lastVerified))}</p>
  </div>
</Base>
```

Note: `offer.notes` are English internal notes (spec 010); showing them is
acceptable for v1 but they are not translated. If this looks odd in review,
drop the `notes` row.

- [ ] **Step 3: Typecheck, build, look at it**

Run: `npm run typecheck && npm run build`
Expected: clean; `apps/web/dist/angebot/gz-heuried/rollender-donnerstag/index.html` exists.
Open one detail page in `npm run dev`; check the star and next dates.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(web): static detail page per offer"
```

---

### Task 8: Week view, search and settings

**Files:**
- Create: `apps/web/src/components/WeekApp.tsx`, `SearchApp.tsx`, `SettingsApp.tsx`
- Create: `apps/web/src/pages/woche.astro`, `suche.astro`, `einstellungen.astro`

**Interfaces:**
- Consumes: hooks, `FilterBar` (Task 6); `weekOf`, labels, `itemsBetween`, `applyFilters`, `searchOffers`, prefs helpers

- [ ] **Step 1: Week view** – `apps/web/src/components/WeekApp.tsx`

```tsx
import { addDays } from "@zueri-kids/core";
import { de } from "../i18n/de";
import { weekOf } from "../lib/calendar";
import { dayOfMonth, shortDate, weekdayShort } from "../lib/labels";
import { applyFilters, itemKey, itemsBetween } from "../lib/model";
import { href } from "./env";
import { FilterBar } from "./FilterBar";
import { useBundle, useNow, usePrefs, useUrlState } from "./hooks";
import { catVar } from "./types";

// REQ-WEB-020
export default function WeekApp() {
  const { bundle, index, error } = useBundle();
  const now = useNow();
  const [prefs] = usePrefs();
  const [url, setUrl] = useUrlState(prefs.settings, now.date);
  if (error) return <p class="empty">{de.loadError}</p>;
  if (!bundle || !index) return <p class="summary">{de.loading}</p>;

  const date = url.date ?? now.date;
  const days = weekOf(date);
  const items = applyFilters(itemsBetween(bundle, index, days[0], days[6], now), url.filters, prefs.settings);
  const venueId = (url.filters.ort as string | null) ?? null;
  const venueName = venueId ? bundle.venues.find((v) => v.id === venueId)?.name ?? venueId : null;

  return (
    <>
      <header class="bar">
        <div class="brand">{de.brand.first} <span>{de.brand.second}</span></div>
        <div class="daynav">
          <button type="button" class="iconbtn" aria-label={de.prevWeek} onClick={() => setUrl({ ...url, date: addDays(date, -7) })}>‹</button>
          <h1>{de.week.title(shortDate(days[0]), shortDate(days[6]))}</h1>
          <button type="button" class="iconbtn" aria-label={de.nextWeek} onClick={() => setUrl({ ...url, date: addDays(date, 7) })}>›</button>
        </div>
        <FilterBar state={url.filters} settings={prefs.settings} date={date} venueName={venueName}
          onChange={(id, value) => setUrl({ ...url, filters: { ...url.filters, [id]: value } })} />
      </header>
      <div class="week">
        {days.map((d) => {
          const dayItems = items.filter((i) => i.occurrence.date === d);
          return (
            <section key={d} class="weekday">
              <h2><a href={href(`?date=${d}`)} aria-label={de.week.openDay(shortDate(d))}>{weekdayShort(d)} {dayOfMonth(d)}.</a></h2>
              {dayItems.length ? (
                <ul>
                  {dayItems.map((i) => (
                    <li key={itemKey(i)} class={i.past ? "past" : ""} style={catVar(i.offer.category)}>
                      <span class="dot" />
                      <span class="time">{i.occurrence.start}</span>
                      <a class="title" href={href(`angebot/${i.venue.id}/${i.offer.id}/`)}>{i.offer.title}</a>
                      <span class="meta">{i.venue.name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p class="muted">{de.week.empty}</p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
```

`apps/web/src/pages/woche.astro`:
```astro
---
import Base from "../layouts/Base.astro";
import WeekApp from "../components/WeekApp";
import { de } from "../i18n/de";
---
<Base title={de.pageTitles.week} active="week" wide><WeekApp client:only="preact" /></Base>
```

- [ ] **Step 2: Search** – `apps/web/src/components/SearchApp.tsx`

```tsx
import { useState } from "preact/hooks";
import { de } from "../i18n/de";
import { kreisLabel, priceLabel, shortDate, weekdayShort } from "../lib/labels";
import { searchOffers } from "../lib/model";
import { href } from "./env";
import { useBundle, useNow } from "./hooks";

// REQ-WEB-030
export default function SearchApp() {
  const { bundle, error } = useBundle();
  const now = useNow();
  const [query, setQuery] = useState("");
  if (error) return <p class="empty">{de.loadError}</p>;
  if (!bundle) return <p class="summary">{de.loading}</p>;
  const results = query.trim().length >= 2 ? searchOffers(bundle, query, now.date) : null;
  return (
    <div class="stack">
      <div class="field">
        <label for="search">{de.search.label}</label>
        <input id="search" type="search" placeholder={de.search.placeholder} value={query} onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)} />
      </div>
      {results === null ? (
        <p class="muted">{de.search.hint}</p>
      ) : results.length === 0 ? (
        <p class="muted">{de.search.none}</p>
      ) : (
        <>
          <p class="summary">{de.search.results(results.length)}</p>
          <ul class="results">
            {results.map(({ offer, venue, next }) => (
              <li key={`${venue.id}/${offer.id}`}>
                <a href={href(`angebot/${venue.id}/${offer.id}/`)} class="title">{offer.title}</a>
                <div class="meta"><span>{venue.name}</span><span class="k">{kreisLabel(venue.location.kreis)}</span><span>{priceLabel(offer.price)}</span></div>
                <div class="meta">{next ? de.search.next(`${weekdayShort(next.date)} ${shortDate(next.date)}, ${next.start}`) : de.search.noNext}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
```

`apps/web/src/pages/suche.astro`:
```astro
---
import Base from "../layouts/Base.astro";
import SearchApp from "../components/SearchApp";
import { de } from "../i18n/de";
---
<Base title={de.pageTitles.search} active="search"><h1 class="page-title">{de.pageTitles.search}</h1><SearchApp client:only="preact" /></Base>
```

- [ ] **Step 3: Settings** – `apps/web/src/components/SettingsApp.tsx`

```tsx
import { useState } from "preact/hooks";
import { de } from "../i18n/de";
import { DEFAULT_PREFS, browserStore, toggleFavourite } from "../lib/prefs";
import { useBundle, usePrefs } from "./hooks";

const KREISE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0];

// REQ-WEB-060, REQ-WEB-062
export default function SettingsApp() {
  const [prefs, update] = usePrefs();
  const { bundle } = useBundle();
  const [saved, setSaved] = useState(false);
  const canStore = browserStore() !== null;
  const change = (fn: Parameters<typeof update>[0]) => { update(fn); setSaved(true); };
  const venueName = (id: string) => bundle?.venues.find((v) => v.id === id)?.name ?? id;
  const s = prefs.settings;

  return (
    <form class="stack" onSubmit={(e) => e.preventDefault()}>
      {!canStore && <p class="notice">{de.settings.storageUnavailable}</p>}
      <div class="field">
        <label for="birth">{de.settings.birthDate}</label>
        <input id="birth" type="date" value={s.birthDate ?? ""}
          onInput={(e) => { const v = (e.currentTarget as HTMLInputElement).value; change((p) => ({ ...p, settings: { ...p.settings, birthDate: v || null } })); }} />
        <p class="muted">{de.settings.birthHint}</p>
      </div>
      <fieldset>
        <legend>{de.settings.kreise}</legend>
        {KREISE.map((k) => (
          <label key={k}>
            <input type="checkbox" id={`kreis-${k}`} checked={s.kreise.includes(k)}
              onChange={() => change((p) => ({ ...p, settings: { ...p.settings, kreise: p.settings.kreise.includes(k) ? p.settings.kreise.filter((x) => x !== k) : [...p.settings.kreise, k] } }))} />
            {" "}{de.kreis(k)}
          </label>
        ))}
      </fieldset>
      <section class="field">
        <h2 class="group" style="font-family:var(--f-display);margin:0">{de.settings.favourites}</h2>
        {s.favourites.length === 0 ? (
          <p class="muted">{de.settings.noFavourites}</p>
        ) : (
          <ul class="results">
            {s.favourites.map((id) => (
              <li key={id} style="display:flex;justify-content:space-between;gap:8px;align-items:center">
                <span>★ {venueName(id)}</span>
                <button type="button" class="linkbtn" onClick={() => change((p) => ({ ...p, settings: toggleFavourite(p.settings, id) }))}>{de.settings.remove}</button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div style="display:flex;gap:12px;align-items:center">
        <button type="button" class="linkbtn" onClick={() => change(() => DEFAULT_PREFS)}>{de.settings.reset}</button>
        {saved && canStore && <span class="muted" role="status">{de.settings.saved}</span>}
      </div>
    </form>
  );
}
```

`apps/web/src/pages/einstellungen.astro`:
```astro
---
import Base from "../layouts/Base.astro";
import SettingsApp from "../components/SettingsApp";
import { de } from "../i18n/de";
---
<Base title={de.pageTitles.settings} active="settings"><h1 class="page-title">{de.pageTitles.settings}</h1><SettingsApp client:only="preact" /></Base>
```

- [ ] **Step 4: Typecheck, build, look at it**

Run: `npm run typecheck && npm run build && npm test`
Expected: clean. In `npm run dev`: set a birth date in Einstellungen, go to
Heute – the chip "Passt für … Mt." appears and is active; Woche shows 7
days; Suche "rossli" finds «Ryte, ryte Rössli».

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): week view, search and settings"
```

---

### Task 9: PWA – manifest, icons, Workbox

Implements REQ-WEB-070, -077, -078 (manual).

**Files:**
- Create: `apps/web/public/icon.svg`, `apps/web/public/manifest.webmanifest`, `apps/web/workbox-config.cjs`
- Generated: `apps/web/public/{favicon.ico,pwa-64x64.png,pwa-192x192.png,pwa-512x512.png,maskable-icon-512x512.png,apple-touch-icon-180x180.png}`

- [ ] **Step 1: Icon source** – `apps/web/public/icon.svg`

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#1f56cc"/>
  <circle cx="376" cy="136" r="48" fill="#e9a93a"/>
  <rect x="96" y="228" width="232" height="44" rx="22" fill="#ffffff"/>
  <rect x="160" y="300" width="256" height="44" rx="22" fill="#ffffff" opacity=".85"/>
  <rect x="96" y="372" width="160" height="44" rx="22" fill="#ffffff" opacity=".7"/>
</svg>
```

- [ ] **Step 2: Generate icons**

Run: `npm run icons -w @zueri-kids/web`
Expected: the six generated files listed above appear in `apps/web/public/`.
If the preset writes different file names, use those names in Base.astro
and the manifest.

- [ ] **Step 3: Manifest and Workbox config**

`apps/web/public/manifest.webmanifest`:
```json
{
  "name": "Züri Kids",
  "short_name": "Züri Kids",
  "description": "Was machen wir heute? Angebote für Kinder von 0 bis 4 Jahren in Zürich.",
  "lang": "de-CH",
  "start_url": ".",
  "scope": ".",
  "display": "standalone",
  "background_color": "#f4f7f6",
  "theme_color": "#1f56cc",
  "icons": [
    { "src": "pwa-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "pwa-512x512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "maskable-icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

`apps/web/workbox-config.cjs` (already created in Task 1; verify content):
```js
// Workbox generates dist/sw.js after `astro build` (REQ-WEB-077).
module.exports = {
  globDirectory: process.env.OUT_DIR || "dist/",
  globPatterns: ["**/*.{html,js,css,svg,png,ico,webmanifest}"],
  swDest: `${process.env.OUT_DIR || "dist"}/sw.js`,
  // Day/week/search pages are called with ?date=… and filter params.
  ignoreURLParametersMatching: [/.*/],
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      // REQ-WEB-078: fresh data when online, cached copy when offline.
      urlPattern: ({ url }) => url.pathname.endsWith("/bundle.json"),
      handler: "NetworkFirst",
      options: { cacheName: "bundle", networkTimeoutSeconds: 4 },
    },
    {
      urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
      handler: "StaleWhileRevalidate",
      options: { cacheName: "fonts" },
    },
  ],
};
```

- [ ] **Step 4: Build and inspect**

Run: `npm run build`
Expected: Workbox reports the number of precached files (> 60 pages) and
writes `apps/web/dist/sw.js`; `bundle.json` is **not** in the precache list
(`grep -c bundle.json apps/web/dist/sw.js` → only the runtime route).

Manual check (REQ-WEB-070) happens after deployment (Task 11): service
workers need HTTPS, so installing on the phone works only from GitHub Pages.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): installable PWA with Workbox service worker"
```

---

### Task 10: End-to-end tests with Playwright

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/fixtures/data/holidays.yaml`, `apps/web/e2e/fixtures/data/venues/gz-alpha.yaml`, `apps/web/e2e/fixtures/data/venues/spielhalle-beta.yaml`
- Test: `apps/web/e2e/app.spec.ts`

- [ ] **Step 1: Install the browser**

Run: `npx -w @zueri-kids/web playwright install chromium`
Expected: Chromium downloaded.

- [ ] **Step 2: Fixture data**

`apps/web/e2e/fixtures/data/holidays.yaml`:
```yaml
schoolHolidays:
  - { name: Herbstferien, from: 2026-10-05, to: 2026-10-18 }
  - { name: Weihnachtsferien, from: 2026-12-21, to: 2027-01-03 }
publicHolidays:
  - { name: Weihnachten, date: 2026-12-25 }
```

`apps/web/e2e/fixtures/data/venues/gz-alpha.yaml`:
```yaml
id: gz-alpha
name: GZ Alpha
type: community-centre
location: { address: "Alphaweg 1, 8055 Zürich", municipality: Zürich, kreis: 3 }
offers:
  - id: krabbeltreff
    title: Krabbeltreff Alpha
    description: Treff für Eltern mit Babys.
    category: meetup
    ageMonths: { min: 0, max: 36 }
    setting: indoor
    price: { type: free }
    registration: none
    schedule:
      type: weekly
      rules: [{ days: [tue], start: "09:30", end: "11:00" }]
      pausesDuringSchoolHolidays: true
      pausesOnPublicHolidays: true
    url: https://example.ch/krabbeltreff
    source: { url: "https://example.ch/krabbeltreff", lastVerified: 2026-09-30, by: human }
  - id: musikkurs
    title: Musikkurs Alpha
    category: music
    ageMonths: { min: 6, max: 48 }
    setting: indoor
    price: { type: fixed, chf: 20 }
    registration: required
    schedule:
      type: weekly
      rules: [{ days: [tue], start: "14:00", end: "15:00" }]
      pausesDuringSchoolHolidays: true
      pausesOnPublicHolidays: true
    source: { url: "https://example.ch/musik", lastVerified: 2026-09-30, by: human }
```

`apps/web/e2e/fixtures/data/venues/spielhalle-beta.yaml`:
```yaml
id: spielhalle-beta
name: Spielhalle Beta
type: indoor-playground
location: { address: "Betastrasse 2, 8048 Zürich", municipality: Zürich, kreis: 9 }
offers:
  - id: halle
    title: Spielhalle Beta
    category: play
    ageMonths: {}
    setting: indoor
    price: { type: donation }
    registration: none
    schedule:
      type: openingHours
      rules: [{ days: [tue, wed, thu, fri], start: "09:00", end: "12:00" }]
      pausesDuringSchoolHolidays: false
      pausesOnPublicHolidays: true
    source: { url: "https://example.ch/halle", lastVerified: 2026-09-30, by: human }
```

- [ ] **Step 3: Config** – `apps/web/playwright.config.ts`

```ts
import { defineConfig, devices } from "@playwright/test";

// Builds the site from fixture data into dist-e2e and serves it.
export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:4322", timezoneId: "Europe/Zurich", locale: "de-CH" },
  projects: [{ name: "phone", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "astro build && astro preview --port 4322",
    env: { DATA_DIR: "e2e/fixtures/data", OUT_DIR: "./dist-e2e", ASTRO_TELEMETRY_DISABLED: "1" },
    url: "http://localhost:4322",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
```

- [ ] **Step 4: Write the tests** – `apps/web/e2e/app.spec.ts`

```ts
import { expect, test, type Page } from "@playwright/test";

// Tuesday 20 Oct 2026, 10:15 in Zurich.
async function openDay(page: Page, path = "/") {
  await page.clock.setFixedTime(new Date("2026-10-20T08:15:00Z"));
  await page.goto(path);
  await expect(page.getByText("Krabbeltreff Alpha").first()).toBeVisible();
}

test("REQ-WEB-080 REQ-WEB-052: day view loads, filters, groups by venue and opens a detail page", async ({ page }) => {
  await openDay(page);
  await expect(page.getByText("Musikkurs Alpha").first()).toBeVisible();
  await expect(page.getByText("3 von 3 Angeboten passen zu deinen Filtern")).toBeVisible();

  await page.getByRole("button", { name: "Ohne Anmeldung" }).click();
  await expect(page.getByText("2 von 3 Angeboten passen zu deinen Filtern")).toBeVisible();
  await expect(page.getByText("Musikkurs Alpha")).toHaveCount(0);

  await page.getByRole("button", { name: "Nach Ort" }).click();
  await expect(page.getByRole("heading", { name: "GZ Alpha" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Spielhalle Beta" })).toBeVisible();

  await page.getByRole("button", { name: "Nach Zeit" }).click();
  await page.getByRole("button", { name: /Krabbeltreff Alpha/ }).click();
  await page.getByRole("link", { name: "Alle Details" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Krabbeltreff Alpha" })).toBeVisible();
});

test("REQ-WEB-019: the card view shows one card per occurrence", async ({ page }) => {
  await openDay(page);
  await page.getByRole("button", { name: "Karten" }).click();
  await expect(page.locator(".card")).toHaveCount(3);
});

test("REQ-WEB-021: tapping a venue name filters to that venue", async ({ page }) => {
  await openDay(page);
  await page.locator(".meta").getByRole("button", { name: "Spielhalle Beta" }).click();
  await expect(page.getByRole("button", { name: "Filter Spielhalle Beta entfernen" })).toBeVisible();
  await expect(page.getByText("1 Angebot an diesem Ort")).toBeVisible();
  await expect(page).toHaveURL(/ort=spielhalle-beta/);
});

test("REQ-WEB-017: the hour axis stays visible while scrolling", async ({ page }) => {
  await openDay(page);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator("header .axis")).toBeInViewport();
});

test("REQ-WEB-002: serves the data bundle", async ({ request }) => {
  const res = await request.get("/bundle.json");
  expect(res.ok()).toBe(true);
  expect((await res.json()).venues).toHaveLength(2);
});

test("REQ-WEB-041: generates one static page per offer", async ({ request }) => {
  for (const path of ["/angebot/gz-alpha/krabbeltreff/", "/angebot/gz-alpha/musikkurs/", "/angebot/spielhalle-beta/halle/"]) {
    expect((await request.get(path)).status()).toBe(200);
  }
});

test("REQ-WEB-040: the detail page shows facts and next dates", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-20T08:15:00Z"));
  await page.goto("/angebot/gz-alpha/krabbeltreff/");
  await expect(page.getByText("bis 3 J.")).toBeVisible();
  await expect(page.getByText("Keine Anmeldung nötig")).toBeVisible();
  await expect(page.getByText("Di 20.10. · 09:30–11:00")).toBeVisible();
  await expect(page.getByRole("button", { name: "Zu Meine Orte hinzufügen" })).toBeVisible();
});

test("REQ-WEB-071: no horizontal scrolling at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.clock.setFixedTime(new Date("2026-10-20T08:15:00Z"));
  for (const path of ["/", "/woche/", "/suche/", "/einstellungen/", "/angebot/gz-alpha/krabbeltreff/"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width, path).toBeLessThanOrEqual(360);
  }
});
```

- [ ] **Step 5: Run the e2e tests**

Run: `npm run e2e`
Expected: 7 tests PASS. If a selector does not match the rendered markup,
fix the component (labels come from `de.ts`), not the test's intent.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test(web): Playwright smoke tests with fixture data"
```

---

### Task 11: CI + GitHub Pages, sign-off

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`, `docs/specs/030-web-app.md` (status)

- [ ] **Step 1: Workflow** – `.github/workflows/ci.yml`

Before writing, check the latest major versions of the actions used
(`actions/checkout`, `actions/setup-node`, `actions/upload-pages-artifact`,
`actions/deploy-pages`) on their GitHub pages and use those.

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency: { group: pages, cancel-in-progress: true }

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npm test
      - run: npm run typecheck
      - run: npm run validate
      - run: npm run trace
      - run: npx -w @zueri-kids/web playwright install --with-deps chromium
      - run: npm run e2e
      - run: npm run build
        env:
          SITE_URL: https://${{ github.repository_owner }}.github.io
          BASE_PATH: /${{ github.event.repository.name }}
      - uses: actions/upload-pages-artifact@v3
        with: { path: apps/web/dist }

  deploy:
    if: github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: "${{ steps.deployment.outputs.page_url }}" }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: README**

Append to `README.md`:
````markdown
## Run it

```bash
nvm use
npm install
npm run dev        # http://localhost:4321
npm test           # unit tests
npm run e2e        # Playwright smoke tests
npm run validate   # check data
```

Deployment: pushing to `main` on GitHub runs `.github/workflows/ci.yml`
and publishes the site to GitHub Pages (Settings → Pages → Source:
GitHub Actions).
````

- [ ] **Step 3: Mark spec implemented and verify**

In `docs/specs/030-web-app.md` set `Status: Implemented · Last updated: <today>`.

Run: `npm test && npm run typecheck && npm run validate && npm run trace && npm run build && npm run e2e`
Expected: all exit 0; `trace` shows no `MISSING`. A REQ without a test that
is not tagged manual → add the test before continuing.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "ci: test, build and deploy to GitHub Pages; mark web spec implemented"
```

- [ ] **Step 5: Publish (with the user)**

The user creates a GitHub repository, adds it as `origin`, pushes `main`,
and sets Settings → Pages → Source to "GitHub Actions". After the first
green run, open the Pages URL on the phone and check REQ-WEB-070 (install
to home screen, then airplane mode: app and data still load), REQ-WEB-073,
REQ-WEB-075/076 (light and dark).
