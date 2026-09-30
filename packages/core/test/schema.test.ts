import { describe, expect, it } from "vitest";
import { Holidays, Venue, formatPath } from "../src";
import { offer, venue } from "./fixtures";

type Raw = Record<string, unknown>;

function venuePaths(input: unknown): string[] {
  const r = Venue.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => formatPath(i.path));
}

// Replace fields of the first offer.
function withOffer(fields: Raw): Raw {
  return { ...venue(), offers: [{ ...offer(), ...fields }] };
}

// Replace fields of the first offer's schedule.
function withSchedule(fields: Raw): Raw {
  return withOffer({ schedule: { ...offer().schedule, ...fields } });
}

describe("Venue schema", () => {
  it("accepts a valid venue", () => {
    expect(venuePaths(venue())).toEqual([]);
  });

  it("REQ-DATA-002: rejects IDs that are not kebab-case", () => {
    expect(venuePaths({ ...venue(), id: "GZ_Heuried" })).toContain("id");
    expect(venuePaths(withOffer({ id: "Krabbel Treff" }))).toContain("offers[0].id");
  });

  it("REQ-DATA-002: rejects duplicate offer IDs within a venue", () => {
    const v = { ...venue(), offers: [offer({ id: "a" }), offer({ id: "a" })] };
    expect(venuePaths(v)).toContain("offers[1].id");
  });

  it("REQ-DATA-010: requires name and at least one offer, rejects unknown keys", () => {
    const { name: _name, ...noName } = venue();
    expect(venuePaths(noName)).toContain("name");
    expect(venuePaths({ ...venue(), offers: [] })).toContain("offers");
    expect(Venue.safeParse({ ...venue(), foo: 1 }).success).toBe(false);
  });

  it("REQ-DATA-011: restricts venue type", () => {
    expect(venuePaths({ ...venue(), type: "zoo" })).toContain("type");
    expect(venuePaths({ ...venue(), type: "cafe" })).toEqual([]);
  });

  it("REQ-DATA-012: requires kreis 1–12 in Zürich and forbids it elsewhere", () => {
    const loc = venue().location;
    expect(venuePaths({ ...venue(), location: { ...loc, kreis: undefined } })).toContain("location.kreis");
    expect(venuePaths({ ...venue(), location: { ...loc, kreis: 13 } })).toContain("location.kreis");
    const outside = { address: "Hauptstrasse 1, 8953 Dietikon", municipality: "Dietikon" };
    expect(venuePaths({ ...venue(), location: outside })).toEqual([]);
    expect(venuePaths({ ...venue(), location: { ...outside, kreis: 3 } })).toContain("location.kreis");
  });

  it("REQ-DATA-013: validates amenities and defaults missing ones to unknown", () => {
    expect(venuePaths({ ...venue(), amenities: { stroller: "maybe" } })).toContain("amenities.stroller");
    const { amenities: _a, ...noAmenities } = venue();
    expect(Venue.parse(noAmenities).amenities).toEqual({
      stroller: "unknown",
      changingTable: "unknown",
      cafe: "unknown",
    });
    expect(Venue.parse({ ...venue(), amenities: { stroller: "partial" } }).amenities).toEqual({
      stroller: "partial",
      changingTable: "unknown",
      cafe: "unknown",
    });
  });

  it("REQ-DATA-020: requires offer source", () => {
    const { source: _s, ...noSource } = offer();
    expect(venuePaths({ ...venue(), offers: [noSource] })).toContain("offers[0].source");
  });

  it("REQ-DATA-021: restricts offer category", () => {
    expect(venuePaths(withOffer({ category: "party" }))).toContain("offers[0].category");
    expect(venuePaths(withOffer({ category: "play-corner" }))).toEqual([]);
  });

  it("REQ-DATA-022: validates age range in whole months", () => {
    expect(venuePaths(withOffer({ ageMonths: { min: 24, max: 12 } }))).toContain("offers[0].ageMonths.max");
    expect(venuePaths(withOffer({ ageMonths: { min: 1.5 } }))).toContain("offers[0].ageMonths.min");
    expect(venuePaths(withOffer({ ageMonths: { min: 0, max: 48 } }))).toEqual([]);
    expect(venuePaths(withOffer({ ageMonths: {} }))).toEqual([]);
  });

  it("REQ-DATA-023: restricts setting", () => {
    expect(venuePaths(withOffer({ setting: "inside" }))).toContain("offers[0].setting");
    expect(venuePaths(withOffer({ setting: "both" }))).toEqual([]);
  });

  it("REQ-DATA-024: accepts the five price shapes and rejects invalid ones", () => {
    for (const price of [
      { type: "free" },
      { type: "fixed", chf: 5, note: "pro Kind" },
      { type: "range", minChf: 5, maxChf: 12 },
      { type: "donation" },
      { type: "unknown" },
    ]) {
      expect(venuePaths(withOffer({ price }))).toEqual([]);
    }
    expect(venuePaths(withOffer({ price: { type: "fixed" } }))).toContain("offers[0].price.chf");
    expect(venuePaths(withOffer({ price: { type: "fixed", chf: -1 } }))).toContain("offers[0].price.chf");
    expect(venuePaths(withOffer({ price: { type: "range", minChf: 10, maxChf: 5 } }))).toContain(
      "offers[0].price.maxChf",
    );
    expect(venuePaths(withOffer({ price: { type: "cheap" } }))).not.toEqual([]);
  });

  it("REQ-DATA-025: restricts registration", () => {
    expect(venuePaths(withOffer({ registration: "maybe" }))).toContain("offers[0].registration");
    expect(venuePaths(withOffer({ registration: "unknown" }))).toEqual([]);
  });

  it("REQ-DATA-026: validates source fields", () => {
    expect(venuePaths(withOffer({ source: { ...offer().source, by: "robot" } }))).toContain("offers[0].source.by");
    expect(venuePaths(withOffer({ source: { ...offer().source, lastVerified: "2026-13-01" } }))).toContain(
      "offers[0].source.lastVerified",
    );
  });

  it("REQ-DATA-027: requires absolute https URLs", () => {
    expect(venuePaths({ ...venue(), website: "http://example.ch" })).toContain("website");
    expect(venuePaths(withOffer({ url: "/angebote" }))).toContain("offers[0].url");
    expect(venuePaths({ ...venue(), website: "https://example.ch" })).toEqual([]);
  });

  it("REQ-DATA-030: validates weekly rules", () => {
    expect(venuePaths(withSchedule({ rules: [] }))).toContain("offers[0].schedule.rules");
    expect(venuePaths(withSchedule({ rules: [{ days: [], start: "09:00", end: "10:00" }] }))).toContain(
      "offers[0].schedule.rules[0].days",
    );
    expect(venuePaths(withSchedule({ rules: [{ days: ["tues"], start: "09:00", end: "10:00" }] }))).toContain(
      "offers[0].schedule.rules[0].days[0]",
    );
    expect(venuePaths(withSchedule({ rules: [{ days: ["tue"], start: "9:30", end: "10:00" }] }))).toContain(
      "offers[0].schedule.rules[0].start",
    );
    expect(venuePaths(withSchedule({ cancelled: ["2026-12-22"] }))).toEqual([]);
  });

  it("REQ-DATA-031: accepts openingHours with the same fields", () => {
    expect(venuePaths(withSchedule({ type: "openingHours" }))).toEqual([]);
  });

  it("REQ-DATA-032: validates dates schedules", () => {
    const dates = { type: "dates", dates: [{ date: "2026-10-10", start: "14:00", end: "15:00" }] };
    expect(venuePaths(withOffer({ schedule: dates }))).toEqual([]);
    expect(venuePaths(withOffer({ schedule: { type: "dates", dates: [] } }))).toContain(
      "offers[0].schedule.dates",
    );
  });

  it("REQ-DATA-033: requires end later than start", () => {
    expect(venuePaths(withSchedule({ rules: [{ days: ["tue"], start: "10:00", end: "10:00" }] }))).toContain(
      "offers[0].schedule.rules[0].end",
    );
    const dates = { type: "dates", dates: [{ date: "2026-10-10", start: "15:00", end: "14:00" }] };
    expect(venuePaths(withOffer({ schedule: dates }))).toContain("offers[0].schedule.dates[0].end");
  });

  it("REQ-DATA-034: requires validFrom <= validUntil", () => {
    expect(venuePaths(withSchedule({ validFrom: "2026-10-10", validUntil: "2026-10-01" }))).toContain(
      "offers[0].schedule.validUntil",
    );
    expect(venuePaths(withSchedule({ validFrom: "2026-10-01", validUntil: "2026-10-01" }))).toEqual([]);
  });

  it("REQ-DATA-035: requires explicit holiday behaviour", () => {
    const { pausesDuringSchoolHolidays: _p, ...schedule } = offer().schedule as Raw;
    expect(venuePaths(withOffer({ schedule }))).toContain("offers[0].schedule.pausesDuringSchoolHolidays");
  });
});

describe("Holidays schema", () => {
  it("REQ-DATA-040: validates school holiday ranges", () => {
    const valid = {
      schoolHolidays: [{ name: "Herbstferien", from: "2026-10-05", to: "2026-10-18" }],
      publicHolidays: [{ name: "Weihnachten", date: "2026-12-25" }],
    };
    expect(Holidays.safeParse(valid).success).toBe(true);
    const r = Holidays.safeParse({
      ...valid,
      schoolHolidays: [{ name: "X", from: "2026-10-18", to: "2026-10-05" }],
    });
    expect(r.success ? [] : r.error.issues.map((i) => formatPath(i.path))).toContain("schoolHolidays[0].to");
  });
});
