import { addDays, weekday } from "./dates";
import type { Holidays } from "./schema/holidays";
import type { Venue } from "./schema/venue";

export type Occurrence = {
  key: string; // "<venue-id>/<offer-id>"
  date: string;
  start: string;
  end: string;
  kind: "session" | "open";
};

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// Expands all schedules into concrete occurrences for [from, to] (inclusive).
// Pure: no clock, no I/O. ISO date strings compare correctly as strings.
export function occurrences(venues: Venue[], holidays: Holidays, from: string, to: string): Occurrence[] {
  const publicHolidays = new Set(holidays.publicHolidays.map((h) => h.date));
  const isSchoolHoliday = (d: string) => holidays.schoolHolidays.some((h) => h.from <= d && d <= h.to);
  const out: Occurrence[] = [];

  for (const venue of venues) {
    for (const offer of venue.offers) {
      const key = `${venue.id}/${offer.id}`;
      const s = offer.schedule;

      if (s.type === "dates") {
        for (const e of s.dates) {
          if (from <= e.date && e.date <= to) out.push({ key, date: e.date, start: e.start, end: e.end, kind: "session" });
        }
        continue;
      }

      const kind = s.type === "openingHours" ? "open" : "session";
      const cancelled = new Set(s.cancelled ?? []);
      const first = s.validFrom && s.validFrom > from ? s.validFrom : from;
      const last = s.validUntil && s.validUntil < to ? s.validUntil : to;

      for (let d = first; d <= last; d = addDays(d, 1)) {
        if (cancelled.has(d)) continue;
        if (s.pausesOnPublicHolidays && publicHolidays.has(d)) continue;
        if (s.pausesDuringSchoolHolidays && isSchoolHoliday(d)) continue;
        const wd = weekday(d);
        for (const r of s.rules) {
          if (r.days.includes(wd)) out.push({ key, date: d, start: r.start, end: r.end, kind });
        }
      }
    }
  }

  return out.sort((a, b) => cmp(a.date, b.date) || cmp(a.start, b.start) || cmp(a.key, b.key));
}
