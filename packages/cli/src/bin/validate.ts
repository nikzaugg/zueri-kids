import { todayInZurich } from "@zueri-kids/core";
import { runValidate } from "../validate";

const result = runValidate(process.argv[2] ?? "data", todayInZurich(new Date()));
console.log(result.output);
process.exit(result.exitCode);
