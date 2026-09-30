import { de } from "../../i18n/de";
import type { Filter } from "./types";

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0]; // 0 = outside the city
const sorted = (v: number[]) => [...v].sort((a, b) => a - b);
const same = (a: number[], b: number[]) => sorted(a).join(",") === sorted(b).join(",");

// REQ-FLT-014
export const kreisFilter: Filter<number[]> = {
  id: "kreis",
  control: "multiselect",
  label: () => de.filters.kreis,
  options: ALL.map((k) => ({ value: String(k), label: de.kreis(k) })),
  defaultValue: (s) => sorted(s.kreise),
  parse: (p, s) => {
    if (p === null) return sorted(s.kreise);
    if (p === "") return [];
    return sorted([...new Set(p.split(",").map(Number).filter((k) => ALL.includes(k)))]);
  },
  serialize: (v, s) => (same(v, s.kreise) ? null : sorted(v).join(",")),
  isActive: (v) => v.length < ALL.length,
  matches: ({ venue }, v) => v.includes(venue.location.kreis ?? 0),
};
