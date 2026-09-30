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
