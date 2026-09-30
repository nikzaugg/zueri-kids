import { de } from "../../i18n/de";
import type { Filter } from "./types";

const MAX = /^max:\d+$/;

// REQ-FLT-012
export const priceFilter: Filter<string> = {
  id: "preis",
  control: "select",
  label: () => de.filters.price,
  options: [
    { value: "all", label: de.filters.priceOptions.all },
    { value: "free", label: de.filters.priceOptions.free },
    { value: "max:10", label: de.filters.priceOptions.max10 },
    { value: "max:20", label: de.filters.priceOptions.max20 },
  ],
  defaultValue: () => "all",
  parse: (p) => (p === "free" || (p !== null && MAX.test(p)) ? p : "all"),
  serialize: (v) => (v === "all" ? null : v),
  isActive: (v) => v !== "all",
  matches: ({ offer }, v) => {
    const p = offer.price;
    if (v === "free") return p.type === "free" || p.type === "donation";
    const max = Number(v.slice(4));
    switch (p.type) {
      case "free":
      case "donation": return true;
      case "fixed": return p.chf <= max;
      case "range": return p.minChf <= max;
      case "unknown": return false;
    }
  },
};
