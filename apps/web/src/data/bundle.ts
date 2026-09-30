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
