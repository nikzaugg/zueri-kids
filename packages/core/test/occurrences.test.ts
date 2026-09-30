import { describe, expect, it } from "vitest";
import { type Holidays, type Schedule, occurrences } from "../src";
import { noHolidays, offer, venue } from "./fixtures";

const weekly = (fields: Partial<Extract<Schedule, { type: "weekly" }>> = {}): Schedule => ({
  type: "weekly",
  rules: [{ days: ["tue"], start: "09:30", end: "11:30" }],
  pausesDuringSchoolHolidays: false,
  pausesOnPublicHolidays: false,
  ...fields,
});

function datesOf(schedule: Schedule, from: string, to: string, holidays: Holidays = noHolidays): string[] {
  return occurrences([venue({ offers: [offer({ schedule })] })], holidays, from, to).map((o) => o.date);
}

const autumn: Holidays = {
  schoolHolidays: [{ name: "Herbstferien", from: "2026-10-05", to: "2026-10-18" }],
  publicHolidays: [{ name: "Testfeiertag", date: "2026-10-13" }],
};

describe("occurrences", () => {
  it("REQ-OCC-001: includes both range bounds", () => {
    expect(datesOf(weekly(), "2026-10-06", "2026-10-20")).toEqual(["2026-10-06", "2026-10-13", "2026-10-20"]);
  });

  it("REQ-OCC-002: produces one occurrence per matching weekday", () => {
    const s = weekly({ rules: [{ days: ["mon", "wed"], start: "09:00", end: "10:00" }] });
    expect(datesOf(s, "2026-10-05", "2026-10-11")).toEqual(["2026-10-05", "2026-10-07"]);
  });

  it("REQ-OCC-003: respects validFrom and validUntil inclusively", () => {
    const s = weekly({ validFrom: "2026-10-13", validUntil: "2026-10-20" });
    expect(datesOf(s, "2026-10-01", "2026-10-31")).toEqual(["2026-10-13", "2026-10-20"]);
  });

  it("REQ-OCC-004: skips school holidays only when the schedule pauses", () => {
    const h = { ...autumn, publicHolidays: [] };
    expect(datesOf(weekly({ pausesDuringSchoolHolidays: true }), "2026-10-01", "2026-10-31", h)).toEqual([
      "2026-10-20",
      "2026-10-27",
    ]);
    expect(datesOf(weekly(), "2026-10-01", "2026-10-31", h)).toEqual([
      "2026-10-06",
      "2026-10-13",
      "2026-10-20",
      "2026-10-27",
    ]);
  });

  it("REQ-OCC-005: skips public holidays only when the schedule pauses", () => {
    const h = { ...autumn, schoolHolidays: [] };
    expect(datesOf(weekly({ pausesOnPublicHolidays: true }), "2026-10-06", "2026-10-20", h)).toEqual([
      "2026-10-06",
      "2026-10-20",
    ]);
    expect(datesOf(weekly(), "2026-10-06", "2026-10-20", h)).toContain("2026-10-13");
  });

  it("REQ-OCC-006: skips cancelled dates", () => {
    expect(datesOf(weekly({ cancelled: ["2026-10-13"] }), "2026-10-06", "2026-10-20")).toEqual([
      "2026-10-06",
      "2026-10-20",
    ]);
  });

  it("REQ-OCC-007: returns listed dates within range as sessions, ignoring holidays", () => {
    const s: Schedule = {
      type: "dates",
      dates: [
        { date: "2026-09-01", start: "10:00", end: "11:00" },
        { date: "2026-10-13", start: "14:00", end: "15:00" },
        { date: "2026-11-01", start: "10:00", end: "11:00" },
      ],
    };
    const result = occurrences([venue({ offers: [offer({ schedule: s })] })], autumn, "2026-10-01", "2026-10-31");
    expect(result).toEqual([
      { key: "gz-test/treff", date: "2026-10-13", start: "14:00", end: "15:00", kind: "session" },
    ]);
  });

  it("REQ-OCC-008: sorts by date, start, key", () => {
    const b = venue({
      id: "b-venue",
      offers: [offer({ schedule: weekly({ rules: [{ days: ["tue"], start: "09:30", end: "10:00" }] }) })],
    });
    const a = venue({
      id: "a-venue",
      offers: [
        offer({ id: "late", schedule: weekly({ rules: [{ days: ["tue"], start: "14:00", end: "15:00" }] }) }),
        offer({ id: "early", schedule: weekly({ rules: [{ days: ["tue"], start: "09:30", end: "10:00" }] }) }),
      ],
    });
    const keys = occurrences([b, a], noHolidays, "2026-10-06", "2026-10-13").map((o) => `${o.date} ${o.start} ${o.key}`);
    expect(keys).toEqual([
      "2026-10-06 09:30 a-venue/early",
      "2026-10-06 09:30 b-venue/treff",
      "2026-10-06 14:00 a-venue/late",
      "2026-10-13 09:30 a-venue/early",
      "2026-10-13 09:30 b-venue/treff",
      "2026-10-13 14:00 a-venue/late",
    ]);
  });

  it("REQ-OCC-009: is unaffected by DST transitions", () => {
    const sunday = weekly({ rules: [{ days: ["sun"], start: "10:00", end: "12:00" }] });
    expect(datesOf(sunday, "2026-10-18", "2026-11-01")).toEqual(["2026-10-18", "2026-10-25", "2026-11-01"]);
    expect(datesOf(sunday, "2027-03-21", "2027-04-04")).toEqual(["2027-03-21", "2027-03-28", "2027-04-04"]);
    const result = occurrences([venue({ offers: [offer({ schedule: sunday })] })], noHolidays, "2026-10-25", "2026-10-25");
    expect(result[0]).toMatchObject({ start: "10:00", end: "12:00" });
  });

  it("REQ-OCC-010: allows several occurrences of one offer per day; openingHours are 'open'", () => {
    const s: Schedule = {
      type: "openingHours",
      rules: [
        { days: ["tue"], start: "09:00", end: "11:00" },
        { days: ["tue"], start: "14:00", end: "17:00" },
      ],
      pausesDuringSchoolHolidays: false,
      pausesOnPublicHolidays: false,
    };
    const result = occurrences([venue({ offers: [offer({ schedule: s })] })], noHolidays, "2026-10-06", "2026-10-06");
    expect(result).toEqual([
      { key: "gz-test/treff", date: "2026-10-06", start: "09:00", end: "11:00", kind: "open" },
      { key: "gz-test/treff", date: "2026-10-06", start: "14:00", end: "17:00", kind: "open" },
    ]);
  });
});
