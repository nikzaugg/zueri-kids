import { de } from "../i18n/de";
import { toggleFavourite } from "../lib/prefs";
import { usePrefs } from "./hooks";

export default function StarToggle({ venueId }: { venueId: string }) {
  const [prefs, update] = usePrefs();
  const fav = prefs.settings.favourites.includes(venueId);
  return (
    <button type="button" class="star" aria-pressed={fav} aria-label={fav ? de.star.remove : de.star.add}
      onClick={() => update((p) => ({ ...p, settings: toggleFavourite(p.settings, venueId) }))}>
      {fav ? "★" : "☆"}
    </button>
  );
}
