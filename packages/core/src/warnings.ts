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
