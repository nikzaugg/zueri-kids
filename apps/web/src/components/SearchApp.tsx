import { useState } from "preact/hooks";
import { de } from "../i18n/de";
import { kreisLabel, priceLabel, shortDate, weekdayShort } from "../lib/labels";
import { searchOffers } from "../lib/model";
import { href } from "./env";
import { useBundle, useNow } from "./hooks";

// REQ-WEB-030
export default function SearchApp() {
  const { bundle, error } = useBundle();
  const now = useNow();
  const [query, setQuery] = useState("");
  if (error) return <p class="empty">{de.loadError}</p>;
  if (!bundle) return <p class="summary">{de.loading}</p>;
  const results = query.trim().length >= 2 ? searchOffers(bundle, query, now.date, now.minutes) : null;
  return (
    <div class="stack">
      <div class="field">
        <label for="search">{de.search.label}</label>
        <input id="search" type="search" placeholder={de.search.placeholder} value={query} onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)} />
      </div>
      {results === null ? (
        <p class="muted">{de.search.hint}</p>
      ) : results.length === 0 ? (
        <p class="muted">{de.search.none}</p>
      ) : (
        <>
          <p class="summary">{de.search.results(results.length)}</p>
          <ul class="results">
            {results.map(({ offer, venue, next }) => (
              <li key={`${venue.id}/${offer.id}`}>
                <a href={href(`angebot/${venue.id}/${offer.id}/`)} class="title">{offer.title}</a>
                <div class="meta"><span>{venue.name}</span><span class="k">{kreisLabel(venue.location.kreis)}</span><span>{priceLabel(offer.price)}</span></div>
                <div class="meta">{next ? de.search.next(`${weekdayShort(next.date)} ${shortDate(next.date)}, ${next.start}`) : de.search.noNext}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
