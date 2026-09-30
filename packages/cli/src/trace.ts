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
