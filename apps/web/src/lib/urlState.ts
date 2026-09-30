import { isValidDate } from "@zueri-kids/core";
import { FILTERS } from "./filters/registry";
import type { FilterState, Settings } from "./filters/types";

export type UrlState = { date: string | null; filters: FilterState };

export function parseUrl(search: string, settings: Settings): UrlState {
  const p = new URLSearchParams(search);
  const date = p.get("date");
  return {
    date: date && isValidDate(date) ? date : null,
    filters: Object.fromEntries(FILTERS.map((f) => [f.id, f.parse(p.get(f.id), settings)])),
  };
}

export function toSearch(state: UrlState, settings: Settings, today: string): string {
  const p = new URLSearchParams();
  if (state.date && state.date !== today) p.set("date", state.date);
  for (const f of FILTERS) {
    const value = f.serialize(state.filters[f.id], settings);
    if (value !== null) p.set(f.id, value);
  }
  const q = p.toString();
  return q ? `?${q}` : "";
}
