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
