import { describe, expect, it } from "vitest";
import { VALID_HOLIDAYS_YAML, VALID_VENUE_YAML, writeDataDir } from "../../../../packages/core/test/tmp-data";
import { toBundle } from "./bundle";

describe("toBundle", () => {
  it("REQ-WEB-001: returns venues and holidays for valid data", () => {
    const dir = writeDataDir({ "venues/gz-test.yaml": VALID_VENUE_YAML, "holidays.yaml": VALID_HOLIDAYS_YAML });
    const bundle = toBundle(dir, "2026-09-30");
    expect(bundle.builtOn).toBe("2026-09-30");
    expect(bundle.venues.map((v) => v.id)).toEqual(["gz-test"]);
    expect(bundle.holidays.publicHolidays).toHaveLength(1);
  });

  it("REQ-WEB-001: fails with validate-style messages for invalid data", () => {
    const yaml = VALID_VENUE_YAML.replace('end: "11:30"', 'end: "09:00"');
    const dir = writeDataDir({ "venues/gz-test.yaml": yaml, "holidays.yaml": VALID_HOLIDAYS_YAML });
    expect(() => toBundle(dir, "2026-09-30")).toThrow(/offers\[0\]\.schedule\.rules\[0\]\.end: must be later than start/);
  });
});
