import { de } from "../../i18n/de";
import { monthsLabel } from "../labels";
import { ageInMonths } from "../time";
import type { Filter } from "./types";

// REQ-FLT-010
export const ageFilter: Filter<boolean> = {
  id: "alter",
  control: "toggle",
  label: (s, date) => de.filters.ageFits(s.birthDate ? monthsLabel(Math.max(0, ageInMonths(s.birthDate, date))) : ""),
  defaultValue: (s) => s.birthDate !== null,
  parse: (p, s) => (p === "1" ? true : p === "0" ? false : s.birthDate !== null),
  serialize: (v, s) => (v === (s.birthDate !== null) ? null : v ? "1" : "0"),
  isActive: (v, s) => v && s.birthDate !== null,
  matches: ({ offer, date, settings }) => {
    const age = ageInMonths(settings.birthDate!, date);
    return age >= (offer.ageMonths.min ?? 0) && age <= (offer.ageMonths.max ?? Number.POSITIVE_INFINITY);
  },
};
