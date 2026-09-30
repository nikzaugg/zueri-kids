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
