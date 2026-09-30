import { isStale } from "@zueri-kids/core";
import type { Dataset } from "@zueri-kids/core/node";

function countBy(items: string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

export function buildReport(dataset: Dataset, today: string): string {
  const { venues } = dataset;
  const offers = venues.flatMap((v) => v.offers.map((o) => ({ venue: v, offer: o })));
  const lines = [`Venues: ${venues.length} · Offers: ${offers.length}`, "", "By kreis:"];

  const OUTSIDE = 99; // sorts after Kreis 1–12
  const kreise = [...new Set(venues.map((v) => v.location.kreis ?? OUTSIDE))].sort((a, b) => a - b);
  for (const k of kreise) {
    const inKreis = venues.filter((v) => (v.location.kreis ?? OUTSIDE) === k);
    const label = k === OUTSIDE ? "Outside Zurich" : `Kreis ${k}`;
    const offerCount = inKreis.reduce((n, v) => n + v.offers.length, 0);
    lines.push(`  ${label}: ${inKreis.length} venues, ${offerCount} offers`);
  }

  lines.push("", "By category:");
  for (const [category, n] of countBy(offers.map(({ offer }) => offer.category))) lines.push(`  ${category}: ${n}`);

  const stale = offers
    .filter(({ offer }) => isStale(offer, today))
    .map(({ venue, offer }) => ({ date: offer.source.lastVerified, key: `${venue.id}/${offer.id}` }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  lines.push("", `Stale offers (${stale.length}):`, ...stale.map((s) => `  ${s.date}  ${s.key}`));

  const unknownFields = [
    ...venues.flatMap((v) =>
      Object.entries(v.amenities)
        .filter(([, value]) => value === "unknown")
        .map(([field]) => `amenities.${field}`),
    ),
    ...offers.filter(({ offer }) => offer.price.type === "unknown").map(() => "price"),
    ...offers.filter(({ offer }) => offer.registration === "unknown").map(() => "registration"),
  ];
  const unknowns = countBy(unknownFields);
  lines.push("", "Unknown values:", ...(unknowns.length ? unknowns.map(([f, n]) => `  ${f}: ${n}`) : ["  none"]));

  return lines.join("\n");
}
