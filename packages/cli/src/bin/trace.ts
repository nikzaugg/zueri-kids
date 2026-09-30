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
