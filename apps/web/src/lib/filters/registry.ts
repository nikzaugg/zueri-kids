import { ageFilter } from "./age";
import { kreisFilter } from "./kreis";
import { mineFilter } from "./mine";
import { priceFilter } from "./price";
import { registrationFilter } from "./registration";
import { settingFilter } from "./setting";
import type { Filter, FilterContext, FilterState, Settings } from "./types";
import { venueFilter } from "./venue";

// REQ-FLT-001: the single registry. Order = order in the filter bar.
export const FILTERS: Filter<any>[] = [venueFilter, mineFilter, ageFilter, settingFilter, priceFilter, registrationFilter, kreisFilter];

export function defaultState(settings: Settings): FilterState {
  return Object.fromEntries(FILTERS.map((f) => [f.id, f.defaultValue(settings)]));
}

// REQ-FLT-002: active filters minus those overridden by another active filter.
export function activeFilters(state: FilterState, settings: Settings) {
  const active = FILTERS.filter((f) => f.isActive(state[f.id], settings));
  const overridden = new Set(active.flatMap((f) => f.overrides ?? []));
  return active.filter((f) => !overridden.has(f.id));
}

export function matchesFilters(ctx: FilterContext, state: FilterState): boolean {
  return activeFilters(state, ctx.settings).every((f) => f.matches(ctx, state[f.id]));
}

// REQ-WEB-051: human-readable names of the active filters.
export function relaxableLabels(state: FilterState, settings: Settings, date: string, venueName: string | null): string[] {
  return activeFilters(state, settings).map((f) => {
    if (f.control === "removable") return venueName ?? String(state[f.id]);
    if (f.control === "select") return f.options!.find((o) => o.value === state[f.id])?.label ?? f.label(settings, date);
    return f.label(settings, date);
  });
}
