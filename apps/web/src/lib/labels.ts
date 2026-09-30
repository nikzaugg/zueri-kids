import { weekday, type Offer, type Price } from "@zueri-kids/core";
import { de } from "../i18n/de";

export function priceLabel(p: Price): string {
  switch (p.type) {
    case "free": return de.price.free;
    case "fixed": return `CHF ${p.chf}`;
    case "range": return `CHF ${p.minChf}–${p.maxChf}`;
    case "donation": return de.price.donation;
    case "unknown": return de.price.unknown;
  }
}

export const monthsLabel = (m: number): string => (m >= 24 && m % 12 === 0 ? de.age.years(m / 12) : de.age.months(m));

export function ageLabel(a: Offer["ageMonths"]): string {
  const min = a.min ?? 0;
  if (a.max === undefined) return min === 0 ? de.age.all : de.age.from(monthsLabel(min));
  if (min === 0) return de.age.to(monthsLabel(a.max));
  return `${monthsLabel(min)} – ${monthsLabel(a.max)}`;
}

export function registrationMarker(r: Offer["registration"]): string | null {
  if (r === "required") return de.registrationMarker.required;
  if (r === "unknown") return de.registrationMarker.unknown;
  return null;
}

export const kreisLabel = (k: number | undefined): string => de.kreis(k);

const parts = (date: string) => date.split("-").map(Number) as [number, number, number];
export const dayOfMonth = (date: string): number => parts(date)[2];
export const weekdayShort = (date: string): string => de.weekdaysShort[weekday(date)];
export const shortDate = (date: string): string => `${parts(date)[2]}.${parts(date)[1]}.`;
export const longDate = (date: string): string => {
  const [y, m, d] = parts(date);
  return `${d}. ${de.months[m - 1]} ${y}`;
};

export function dayTitle(date: string, today: string): { title: string; subtitle: string } {
  const name = de.weekdays[weekday(date)];
  return { title: date === today ? `${de.todayPrefix}${name}` : name, subtitle: longDate(date) };
}
