import { de } from "../../i18n/de";
import type { Filter } from "./types";

type Setting = "all" | "indoor" | "outdoor";
const VALUES: Setting[] = ["all", "indoor", "outdoor"];

// REQ-FLT-011
export const settingFilter: Filter<Setting> = {
  id: "lage",
  control: "select",
  label: () => de.filters.setting,
  options: VALUES.map((v) => ({ value: v, label: de.filters.settingOptions[v] })),
  defaultValue: () => "all",
  parse: (p) => (VALUES.includes(p as Setting) ? (p as Setting) : "all"),
  serialize: (v) => (v === "all" ? null : v),
  isActive: (v) => v !== "all",
  matches: ({ offer }, v) => offer.setting === v || offer.setting === "both",
};
