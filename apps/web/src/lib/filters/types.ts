import type { Occurrence, Offer, Venue } from "@zueri-kids/core";

export type Settings = { birthDate: string | null; kreise: number[]; favourites: string[] };

export type FilterContext = { occurrence: Occurrence; offer: Offer; venue: Venue; date: string; settings: Settings };

// REQ-FLT-001
export interface Filter<V> {
  id: string; // also the URL param name
  control: "toggle" | "select" | "multiselect" | "removable";
  label(settings: Settings, date: string): string;
  options?: { value: string; label: string }[];
  defaultValue(settings: Settings): V;
  parse(param: string | null, settings: Settings): V;
  serialize(value: V, settings: Settings): string | null;
  isActive(value: V, settings: Settings): boolean;
  matches(ctx: FilterContext, value: V): boolean;
  overrides?: string[];
}

export type FilterState = Record<string, unknown>;
