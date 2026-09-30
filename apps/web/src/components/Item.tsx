import { de } from "../i18n/de";
import { ageLabel, kreisLabel, priceLabel, registrationMarker } from "../lib/labels";
import type { DayItem } from "../lib/model";
import { href } from "./env";
import type { ViewProps } from "./types";

export function ItemMeta({ item, p }: { item: DayItem; p: ViewProps }) {
  const { offer, venue } = item;
  const reg = registrationMarker(offer.registration);
  return (
    <div class="meta">
      {p.showVenue && (
        <>
          <button type="button" class="vlink" onClick={() => p.onVenue(venue.id)}>{venue.name}</button>
          <span class="k">{kreisLabel(venue.location.kreis)}</span>
        </>
      )}
      <span>{priceLabel(offer.price)}</span>
      {offer.setting === "outdoor" && <span>{de.setting.outdoor}</span>}
      {reg && <span class="tag reg">{reg}</span>}
      {item.stale && <span class="tag stale">{de.stale}</span>}
    </div>
  );
}

export function ItemDetails({ item }: { item: DayItem }) {
  const { offer, venue } = item;
  const note = "note" in offer.price ? offer.price.note : undefined;
  const website = offer.url ?? venue.website;
  const facts = [`${venue.name}, ${venue.location.address}`, ageLabel(offer.ageMonths), de.setting[offer.setting], de.category[offer.category], note];
  return (
    <div class="detail">
      {offer.description && <p>{offer.description}</p>}
      <p class="muted">{facts.filter(Boolean).join(" · ")}</p>
      <p>
        {website && <><a href={website} target="_blank" rel="noopener">{de.details.website}</a>{" · "}</>}
        <a href={href(`angebot/${venue.id}/${offer.id}/`)}>{de.details.more}</a>
      </p>
    </div>
  );
}
