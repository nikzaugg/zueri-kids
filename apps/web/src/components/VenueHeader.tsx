import type { Venue } from "@zueri-kids/core";
import { de } from "../i18n/de";
import { kreisLabel } from "../lib/labels";
import type { ViewProps } from "./types";

export function VenueHeader({ venue, count, p }: { venue: Venue; count: number; p: ViewProps }) {
  const fav = p.favourites.includes(venue.id);
  return (
    <div class="venuehead">
      <h3><button type="button" class="vlink" onClick={() => p.onVenue(venue.id)}>{venue.name}</button></h3>
      <span class="meta"><span class="k">{kreisLabel(venue.location.kreis)}</span><span>{de.offers(count)}</span></span>
      <button type="button" class="star" aria-pressed={fav} aria-label={fav ? de.star.remove : de.star.add} onClick={() => p.onStar(venue.id)}>
        {fav ? "★" : "☆"}
      </button>
    </div>
  );
}
