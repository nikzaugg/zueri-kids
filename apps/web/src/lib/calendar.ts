import { WEEKDAYS, addDays, weekday, type Holidays } from "@zueri-kids/core";

export function weekOf(date: string): string[] {
  const monday = addDays(date, -WEEKDAYS.indexOf(weekday(date)));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function dayNotice(date: string, holidays: Holidays): { schoolHoliday?: string; publicHoliday?: string } {
  const notice: { schoolHoliday?: string; publicHoliday?: string } = {};
  const school = holidays.schoolHolidays.find((h) => h.from <= date && date <= h.to);
  if (school) notice.schoolHoliday = school.name;
  const pub = holidays.publicHolidays.find((h) => h.date === date);
  if (pub) notice.publicHoliday = pub.name;
  return notice;
}
