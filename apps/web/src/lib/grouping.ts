import type { Venue } from "@zueri-kids/core";
import type { DayItem } from "./model";
import { toMinutes } from "./time";

export const pastLast = (items: DayItem[]): DayItem[] => [...items.filter((i) => !i.past), ...items.filter((i) => i.past)];

// REQ-WEB-011, REQ-WEB-013
export function byPeriod(items: DayItem[]): { id: "morning" | "afternoon" | "open"; items: DayItem[] }[] {
  const groups = [
    { id: "morning" as const, items: items.filter((i) => i.occurrence.kind === "session" && toMinutes(i.occurrence.start) < 720) },
    { id: "afternoon" as const, items: items.filter((i) => i.occurrence.kind === "session" && toMinutes(i.occurrence.start) >= 720) },
    { id: "open" as const, items: items.filter((i) => i.occurrence.kind === "open") },
  ];
  return groups.filter((g) => g.items.length > 0).map((g) => ({ ...g, items: pastLast(g.items) }));
}

// REQ-WEB-018: favourites first, then by earliest start, then by name.
export function byVenue(items: DayItem[], favourites: string[]): { venue: Venue; items: DayItem[] }[] {
  const map = new Map<string, { venue: Venue; items: DayItem[] }>();
  for (const i of items) {
    const g = map.get(i.venue.id) ?? { venue: i.venue, items: [] };
    g.items.push(i);
    map.set(i.venue.id, g);
  }
  const fav = (v: Venue) => (favourites.includes(v.id) ? 0 : 1);
  return [...map.values()].sort(
    (a, b) => fav(a.venue) - fav(b.venue) || a.items[0].occurrence.start.localeCompare(b.items[0].occurrence.start) || a.venue.name.localeCompare(b.venue.name, "de"),
  );
}
