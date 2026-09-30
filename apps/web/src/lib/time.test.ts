import { describe, expect, it } from "vitest";
import { ageInMonths, nowInZurich, toMinutes } from "./time";

describe("time", () => {
  it("REQ-WEB-003: reads date and minutes in Europe/Zurich", () => {
    expect(nowInZurich(new Date("2026-10-20T08:15:00Z"))).toEqual({ date: "2026-10-20", minutes: 615 }); // CEST
    expect(nowInZurich(new Date("2026-11-20T08:15:00Z"))).toEqual({ date: "2026-11-20", minutes: 555 }); // CET
    expect(nowInZurich(new Date("2026-09-30T22:30:00Z"))).toEqual({ date: "2026-10-01", minutes: 30 });
  });

  it("converts HH:MM to minutes", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("13:45")).toBe(825);
  });

  it("REQ-FLT-010: computes age in whole months", () => {
    expect(ageInMonths("2025-12-28", "2025-12-28")).toBe(0);
    expect(ageInMonths("2025-12-28", "2026-09-27")).toBe(8);
    expect(ageInMonths("2025-12-28", "2026-09-28")).toBe(9);
    expect(ageInMonths("2025-12-28", "2026-09-30")).toBe(9);
  });
});
