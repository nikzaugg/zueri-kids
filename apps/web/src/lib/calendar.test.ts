import { describe, expect, it } from "vitest";
import { dayNotice, weekOf } from "./calendar";

const holidays = {
  schoolHolidays: [
    { name: "Herbstferien", from: "2026-10-05", to: "2026-10-18" },
    { name: "Weihnachtsferien", from: "2026-12-21", to: "2027-01-03" },
  ],
  publicHolidays: [{ name: "Weihnachten", date: "2026-12-25" }],
};

describe("calendar", () => {
  it("REQ-WEB-012: returns Monday to Sunday of the week", () => {
    const week = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"];
    expect(weekOf("2026-10-19")).toEqual(week);
    expect(weekOf("2026-10-21")).toEqual(week);
    expect(weekOf("2026-10-25")).toEqual(week);
  });

  it("REQ-WEB-014: names school and public holidays of a day", () => {
    expect(dayNotice("2026-10-06", holidays)).toEqual({ schoolHoliday: "Herbstferien" });
    expect(dayNotice("2026-12-25", holidays)).toEqual({ schoolHoliday: "Weihnachtsferien", publicHoliday: "Weihnachten" });
    expect(dayNotice("2026-10-20", holidays)).toEqual({});
  });
});
