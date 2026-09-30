import { describe, expect, it } from "vitest";
import { formatTrace, parseRequirements, trace } from "../src/trace";

// Fake IDs are built by concatenation so this file does not reference
// requirements that do not exist.
const R = (suffix: string) => "REQ" + "-" + suffix;

const spec = (status: string, body: string) => ({ file: "docs/specs/x.md", content: `# X\n\nStatus: ${status}\n\n${body}` });

describe("trace", () => {
  it("REQ-CLI-020: parses definitions, markers and spec status", () => {
    const s = spec(
      "Implemented · Last updated: 2026-09-30",
      [
        `- **${R("XMP-001")}:** Something testable that mentions (manual) in the middle`,
        `  and continues here.`,
        `- **${R("XMP-002")}:** Reviewed by hand. (manual)`,
        `- **${R("XMP-003")} (label):** Retired.`,
        `  (removed)`,
        ``,
        `Text mentioning ${R("XMP-001")} is not a definition.`,
      ].join("\n"),
    );
    expect(parseRequirements(s)).toEqual([
      { id: R("XMP-001"), file: s.file, manual: false, removed: false, enforced: true },
      { id: R("XMP-002"), file: s.file, manual: true, removed: false, enforced: true },
      { id: R("XMP-003"), file: s.file, manual: false, removed: true, enforced: true },
    ]);
    expect(parseRequirements(spec("Draft", `- **${R("XMP-001")}:** x`))[0].enforced).toBe(false);
  });

  it("REQ-META-004: errors on untested REQs in implemented specs only", () => {
    const implemented = spec("Implemented", `- **${R("XMP-001")}:** a\n- **${R("XMP-002")}:** b (manual)`);
    const draft = { ...spec("Draft", `- **${R("DRF-001")}:** c`), file: "docs/specs/y.md" };
    const result = trace([implemented, draft], []);
    expect(result.errors).toEqual([`${R("XMP-001")} (docs/specs/x.md) has no test`]);
    expect(formatTrace(result)).toContain(`${R("DRF-001")}  docs/specs/y.md  pending`);
  });

  it("REQ-META-004: records which tests cover a REQ", () => {
    const s = spec("Implemented", `- **${R("XMP-001")}:** a`);
    const result = trace([s], [{ file: "a.test.ts", content: `it("${R("XMP-001")}: works")` }]);
    expect(result.errors).toEqual([]);
    expect(result.coverage.get(R("XMP-001"))).toEqual(["a.test.ts"]);
    expect(formatTrace(result)).toContain(`${R("XMP-001")}  docs/specs/x.md  a.test.ts`);
  });

  it("REQ-CLI-021: reports test references to unknown REQs", () => {
    const result = trace([spec("Draft", "")], [{ file: "a.test.ts", content: `it("${R("NOPE-001")}: x")` }]);
    expect(result.errors).toEqual([`a.test.ts references unknown ${R("NOPE-001")}`]);
  });

  it("REQ-CLI-022 REQ-META-001: reports duplicate definitions", () => {
    const a = spec("Draft", `- **${R("XMP-001")}:** a`);
    const b = { ...spec("Draft", `- **${R("XMP-001")}:** b`), file: "docs/specs/y.md" };
    expect(trace([a, b], []).errors).toEqual([
      `${R("XMP-001")} is defined twice (docs/specs/x.md, docs/specs/y.md)`,
    ]);
  });
});
