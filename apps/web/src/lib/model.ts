import { addDays, isStale, occurrences, type Occurrence, type Offer, type Venue } from "@zueri-kids/core";
import { matchesFilters } from "./filters/registry";
import type { FilterState, Settings } from "./filters/types";
import { toMinutes, type Now } from "./time";
import type { Bundle } from "./types";

export type DayItem = { occurrence: Occurrence; offer: Offer; venue: Venue; past: boolean; stale: boolean };
export type OfferIndex = Map<string, { offer: Offer; venue: Venue }>;

export function indexOffers(b: Bundle): OfferIndex {
  return new Map(b.venues.flatMap((venue) => venue.offers.map((offer) => [`${venue.id}/${offer.id}`, { offer, venue }] as const)));
}

export function itemsBetween(b: Bundle, index: OfferIndex, from: string, to: string, now: Now): DayItem[] {
  return occurrences(b.venues, b.holidays, from, to).map((occurrence) => {
    const { offer, venue } = index.get(occurrence.key)!;
    return {
      occurrence, offer, venue,
      past: occurrence.date === now.date && toMinutes(occurrence.end) <= now.minutes,
      stale: isStale(offer, now.date),
    };
  });
}

export const dayItems = (b: Bundle, index: OfferIndex, date: string, now: Now): DayItem[] => itemsBetween(b, index, date, date, now);

export function applyFilters(items: DayItem[], state: FilterState, settings: Settings): DayItem[] {
  return items.filter((i) => matchesFilters({ occurrence: i.occurrence, offer: i.offer, venue: i.venue, date: i.occurrence.date, settings }, state));
}

export const itemKey = (i: DayItem): string => `${i.occurrence.key}@${i.occurrence.date}@${i.occurrence.start}`;

export function nextOccurrences(b: Bundle, key: string, from: string, n: number): Occurrence[] {
  const [venueId, offerId] = key.split("/");
  const venue = b.venues.find((v) => v.id === venueId);
  const offer = venue?.offers.find((o) => o.id === offerId);
  if (!venue || !offer) return [];
  return occurrences([{ ...venue, offers: [offer] }], b.holidays, from, addDays(from, 365)).slice(0, n);
}

const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// REQ-WEB-030
export function searchOffers(b: Bundle, query: string, today: string) {
  const q = normalize(query.trim());
  const next = new Map<string, Occurrence>();
  for (const o of occurrences(b.venues, b.holidays, today, addDays(today, 28))) if (!next.has(o.key)) next.set(o.key, o);
  return b.venues
    .flatMap((venue) =>
      venue.offers
        .filter((offer) => normalize([offer.title, offer.description ?? "", venue.name, venue.location.address].join(" ")).includes(q))
        .map((offer) => ({ offer, venue, next: next.get(`${venue.id}/${offer.id}`) ?? null })),
    )
    .sort((a, b2) => {
      if (a.next && b2.next) return cmp(a.next.date + a.next.start, b2.next.date + b2.next.start);
      if (a.next || b2.next) return a.next ? -1 : 1;
      return a.offer.title.localeCompare(b2.offer.title, "de");
    });
}
