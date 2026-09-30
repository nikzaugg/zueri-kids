import { de } from "../../i18n/de";
import type { Filter } from "./types";

// REQ-FLT-013
export const registrationFilter: Filter<boolean> = {
  id: "anmeldung",
  control: "toggle",
  label: () => de.filters.noRegistration,
  defaultValue: () => false,
  parse: (p) => p === "1",
  serialize: (v) => (v ? "1" : null),
  isActive: (v) => v,
  matches: ({ offer }) => offer.registration === "none",
};
