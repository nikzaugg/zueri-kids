import type { Filter } from "./types";

// REQ-FLT-015 – the chip shows the venue name, supplied by the view.
export const venueFilter: Filter<string | null> = {
  id: "ort",
  control: "removable",
  label: () => "",
  defaultValue: () => null,
  parse: (p) => (p ? p : null),
  serialize: (v) => v,
  isActive: (v) => v !== null,
  matches: ({ venue }, v) => venue.id === v,
  overrides: ["kreis", "meine"],
};
