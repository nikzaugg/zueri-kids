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
