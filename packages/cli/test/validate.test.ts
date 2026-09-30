import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VALID_HOLIDAYS_YAML, VALID_VENUE_YAML, venueYaml, writeDataDir } from "../../core/test/tmp-data";
import { runValidate } from "../src/validate";

const TODAY = "2026-09-30";

describe("validate", () => {
  it("REQ-CLI-001: exits 0 for valid data and 1 for invalid data", () => {
    const ok = writeDataDir({ "venues/gz-test.yaml": VALID_VENUE_YAML, "holidays.yaml": VALID_HOLIDAYS_YAML });
    expect(runValidate(ok, TODAY)).toEqual({
      exitCode: 0,
      output: "1 valid venues, 1 offers, 0 errors, 0 warnings",
    });
    const bad = writeDataDir({ "venues/gz-test.yaml": "id: gz-test", "holidays.yaml": VALID_HOLIDAYS_YAML });
    expect(runValidate(bad, TODAY).exitCode).toBe(1);
  });

  it("REQ-CLI-002: names file, field path and problem", () => {
    const yaml = VALID_VENUE_YAML.replace('end: "11:30"', 'end: "09:00"');
    const dir = writeDataDir({ "venues/gz-test.yaml": yaml, "holidays.yaml": VALID_HOLIDAYS_YAML });
    expect(runValidate(dir, TODAY).output).toContain(
      `ERROR ${join(dir, "venues", "gz-test.yaml")}: offers[0].schedule.rules[0].end: must be later than start`,
    );
  });

  it("REQ-CLI-003: reports errors of all files", () => {
    const dir = writeDataDir({
      "venues/a.yaml": "id: a",
      "venues/b.yaml": "id: b",
      "holidays.yaml": VALID_HOLIDAYS_YAML,
    });
    const output = runValidate(dir, TODAY).output;
    expect(output).toContain(join(dir, "venues", "a.yaml"));
    expect(output).toContain(join(dir, "venues", "b.yaml"));
  });

  it("REQ-CLI-004: checks file name and duplicate offer IDs", () => {
    const duplicate = VALID_VENUE_YAML + VALID_VENUE_YAML.slice(VALID_VENUE_YAML.indexOf("  - id: treff"));
    const dir = writeDataDir({
      "venues/wrong-name.yaml": VALID_VENUE_YAML,
      "venues/gz-dup.yaml": duplicate.replace("id: gz-test", "id: gz-dup"),
      "holidays.yaml": VALID_HOLIDAYS_YAML,
    });
    const output = runValidate(dir, TODAY).output;
    expect(output).toContain('id: must match file name "wrong-name"');
    expect(output).toContain('offers[1].id: duplicate offer id "treff"');
  });

  it("REQ-CLI-005: prints warnings without failing", () => {
    const dir = writeDataDir({ "venues/gz-test.yaml": venueYaml("gz-test", "2026-06-01"), "holidays.yaml": VALID_HOLIDAYS_YAML });
    const result = runValidate(dir, TODAY);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("WARN  ");
    expect(result.output).toContain("stale: last verified 2026-06-01");
  });
});
