import { daysBetween } from "./dates";
import type { Offer } from "./schema/venue";

export const STALE_AFTER_DAYS = 90;

export function isStale(offer: Offer, today: string): boolean {
  return daysBetween(offer.source.lastVerified, today) > STALE_AFTER_DAYS;
}
