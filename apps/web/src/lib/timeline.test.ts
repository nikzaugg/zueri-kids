import { describe, expect, it } from "vitest";
import { AXIS_HOURS, axisPercent, barStyle } from "./timeline";

describe("timeline", () => {
  it("REQ-WEB-017: maps 08:00–19:00 onto 0–100%", () => {
    expect(AXIS_HOURS).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
    expect(axisPercent("08:00")).toBe(0);
    expect(axisPercent("13:30")).toBe(50);
    expect(axisPercent("19:00")).toBe(100);
    expect(axisPercent("06:00")).toBe(0);
    expect(axisPercent("21:30")).toBe(100);
    expect(axisPercent(615)).toBeCloseTo(20.45, 1); // 10:15 = 135 of 660 minutes
  });

  it("REQ-WEB-017: bars span start to end with a minimum width", () => {
    expect(barStyle("08:00", "13:30")).toEqual({ left: 0, width: 50 });
    expect(barStyle("10:00", "10:05").width).toBe(1.5);
  });
});
