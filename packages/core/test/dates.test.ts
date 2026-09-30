import { describe, expect, it } from "vitest";
import { addDays, daysBetween, isValidDate, todayInZurich, weekday } from "../src";

describe("dates", () => {
  it("validates ISO calendar dates", () => {
    expect(isValidDate("2026-02-28")).toBe(true);
    expect(isValidDate("2028-02-29")).toBe(true);
    expect(isValidDate("2026-02-29")).toBe(false);
    expect(isValidDate("2026-13-01")).toBe(false);
    expect(isValidDate("2026-1-01")).toBe(false);
    expect(isValidDate("01.10.2026")).toBe(false);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("REQ-OCC-009: adds days across DST transitions without drift", () => {
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(addDays("2027-03-27", 2)).toBe("2027-03-29");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-09-30", "2026-10-30")).toBe(30);
    expect(daysBetween("2026-10-30", "2026-09-30")).toBe(-30);
  });

  it("returns the weekday", () => {
    expect(weekday("2026-09-30")).toBe("wed");
    expect(weekday("2026-10-04")).toBe("sun");
    expect(weekday("2026-10-05")).toBe("mon");
  });

  it("REQ-WEB-003: determines today in Europe/Zurich", () => {
    // 23:30 UTC on 30 Sep = 01:30 on 1 Oct in Zurich (CEST, UTC+2)
    expect(todayInZurich(new Date("2026-09-30T23:30:00Z"))).toBe("2026-10-01");
    expect(todayInZurich(new Date("2026-09-30T12:00:00Z"))).toBe("2026-09-30");
  });
});
