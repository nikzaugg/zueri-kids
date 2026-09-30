import { isValidDate } from "@zueri-kids/core";
import type { Settings } from "./filters/types";

export type View = "timeline" | "list" | "cards";
export type Group = "time" | "venue";
export type Prefs = { settings: Settings; view: View; group: Group };
export type Store = Pick<Storage, "getItem" | "setItem">;

const KEY = "zueri-kids:prefs";
const VIEWS: View[] = ["timeline", "list", "cards"];
const GROUPS: Group[] = ["time", "venue"];

export const DEFAULT_PREFS: Prefs = {
  settings: { birthDate: null, kreise: [1, 2, 3, 4, 9], favourites: [] },
  view: "timeline",
  group: "time",
};

function sanitize(raw: unknown): Prefs {
  const r = (raw ?? {}) as { settings?: Partial<Record<keyof Settings, unknown>>; view?: unknown; group?: unknown };
  const s = r.settings ?? {};
  return {
    settings: {
      birthDate: typeof s.birthDate === "string" && isValidDate(s.birthDate) ? s.birthDate : null,
      kreise: Array.isArray(s.kreise)
        ? s.kreise.filter((k): k is number => Number.isInteger(k) && k >= 0 && k <= 12)
        : [...DEFAULT_PREFS.settings.kreise],
      favourites: Array.isArray(s.favourites) ? s.favourites.filter((f): f is string => typeof f === "string") : [],
    },
    view: VIEWS.includes(r.view as View) ? (r.view as View) : DEFAULT_PREFS.view,
    group: GROUPS.includes(r.group as Group) ? (r.group as Group) : DEFAULT_PREFS.group,
  };
}

// REQ-WEB-060: never throws; missing or broken storage yields defaults.
export function loadPrefs(store: Store | null): Prefs {
  try {
    const raw = store?.getItem(KEY);
    return raw ? sanitize(JSON.parse(raw)) : sanitize(DEFAULT_PREFS);
  } catch {
    return sanitize(DEFAULT_PREFS);
  }
}

export function savePrefs(store: Store | null, prefs: Prefs): boolean {
  if (!store) return false;
  try {
    store.setItem(KEY, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}

export function toggleFavourite(settings: Settings, venueId: string): Settings {
  const favourites = settings.favourites.includes(venueId)
    ? settings.favourites.filter((f) => f !== venueId)
    : [...settings.favourites, venueId];
  return { ...settings, favourites };
}

export function browserStore(): Store | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
