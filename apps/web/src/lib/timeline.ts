import { toMinutes } from "./time";

export const AXIS_START = 8 * 60;
export const AXIS_END = 19 * 60;
export const AXIS_HOURS = Array.from({ length: (AXIS_END - AXIS_START) / 60 }, (_, i) => 8 + i);
const MIN_WIDTH = 1.5;

export function axisPercent(time: string | number): number {
  const m = typeof time === "number" ? time : toMinutes(time);
  return Math.max(0, Math.min(100, ((m - AXIS_START) / (AXIS_END - AXIS_START)) * 100));
}

export function barStyle(start: string, end: string): { left: number; width: number } {
  const left = axisPercent(start);
  return { left, width: Math.max(MIN_WIDTH, axisPercent(end) - left) };
}
