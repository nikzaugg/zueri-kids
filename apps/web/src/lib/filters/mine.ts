import { de } from "../../i18n/de";
import type { Filter } from "./types";

// REQ-FLT-016
export const mineFilter: Filter<boolean> = {
  id: "meine",
  control: "toggle",
  label: () => de.filters.mine,
  defaultValue: () => false,
  parse: (p) => p === "1",
  serialize: (v) => (v ? "1" : null),
  isActive: (v) => v,
  matches: ({ venue, settings }) => settings.favourites.includes(venue.id),
};
