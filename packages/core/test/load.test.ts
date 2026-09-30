import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatIssue } from "../src";
import { collectWarnings, loadDataset } from "../src/node";
import { VALID_HOLIDAYS_YAML, VALID_VENUE_YAML, venueYaml, writeDataDir } from "./tmp-data";

const TODAY = "2026-09-30";

describe("loadDataset", () => {
  it("REQ-DATA-001: loads venues from data/venues/<id>.yaml", () => {
    const dir = writeDataDir({ "venues/gz-test.yaml": VALID_VENUE_YAML, "holidays.yaml": VALID_HOLIDAYS_YAML });
    const { dataset, errors } = loadDataset(dir, TODAY);
    expect(errors).toEqual([]);
    expect(dataset.venues.map((v) => v.id)).toEqual(["gz-test"]);
    // yaml 1.2: unquoted dates and times stay strings
    expect(dataset.venues[0].offers[0].source.lastVerified).toBe("2026-09-01");
  });

  it("REQ-DATA-001: reports a file name that does not match the id", () => {
    const dir = writeDataDir({ "venues/gz-other.yaml": VALID_VENUE_YAML, "holidays.yaml": VALID_HOLIDAYS_YAML });
    const { dataset, errors } = loadDataset(dir, TODAY);
    expect(errors.map(formatIssue)).toEqual([
      `${join(dir, "venues", "gz-other.yaml")}: id: must match file name "gz-other"`,
    ]);
    expect(dataset.venues).toEqual([]);
  });

  it("REQ-DATA-003: loads holidays from data/holidays.yaml and reports a missing file", () => {
    const ok = loadDataset(writeDataDir({ "holidays.yaml": VALID_HOLIDAYS_YAML }), TODAY);
    expect(ok.dataset.holidays.publicHolidays).toEqual([{ name: "Weihnachten", date: "2026-12-25" }]);
    const dir = writeDataDir({});
    expect(loadDataset(dir, TODAY).errors.map(formatIssue)).toEqual([`${join(dir, "holidays.yaml")}: file not found`]);
  });

  it("REQ-DATA-026: rejects lastVerified in the future", () => {
    const dir = writeDataDir({ "venues/gz-test.yaml": venueYaml("gz-test", "2026-10-01"), "holidays.yaml": VALID_HOLIDAYS_YAML });
    expect(loadDataset(dir, TODAY).errors.map((e) => `${e.path}: ${e.message}`)).toEqual([
      "offers[0].source.lastVerified: must not be in the future",
    ]);
  });

  it("reports YAML syntax errors and keeps loading other files", () => {
    const dir = writeDataDir({
      "venues/a-broken.yaml": "id: [unclosed",
      "venues/gz-test.yaml": VALID_VENUE_YAML,
      "holidays.yaml": VALID_HOLIDAYS_YAML,
    });
    const { dataset, errors } = loadDataset(dir, TODAY);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/^YAML syntax error/);
    expect(dataset.venues.map((v) => v.id)).toEqual(["gz-test"]);
  });
});

describe("collectWarnings", () => {
  it("REQ-CLI-005: warns about stale offers", () => {
    const dir = writeDataDir({ "venues/gz-test.yaml": venueYaml("gz-test", "2026-06-01"), "holidays.yaml": VALID_HOLIDAYS_YAML });
    const { dataset } = loadDataset(dir, TODAY);
    expect(collectWarnings(dataset, dir, TODAY).map(formatIssue)).toEqual([
      `${join(dir, "venues", "gz-test.yaml")}: offers[0].source.lastVerified: stale: last verified 2026-06-01 (121 days ago)`,
    ]);
  });

  it("REQ-CLI-005: warns when no school holidays end more than 60 days from today", () => {
    const dir = writeDataDir({ "holidays.yaml": VALID_HOLIDAYS_YAML });
    const { dataset } = loadDataset(dir, "2026-11-10");
    expect(collectWarnings(dataset, dir, "2026-11-10").map(formatIssue)).toEqual([
      `${join(dir, "holidays.yaml")}: schoolHolidays: no school holidays ending after 2027-01-09; add the next school year`,
    ]);
    expect(collectWarnings(dataset, dir, TODAY)).toEqual([]);
  });
});
