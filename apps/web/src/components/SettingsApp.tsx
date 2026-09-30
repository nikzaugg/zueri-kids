import { useState } from "preact/hooks";
import { de } from "../i18n/de";
import { DEFAULT_PREFS, browserStore, toggleFavourite } from "../lib/prefs";
import { useBundle, usePrefs } from "./hooks";

const KREISE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0];

// REQ-WEB-060, REQ-WEB-062
export default function SettingsApp() {
  const [prefs, update] = usePrefs();
  const { bundle } = useBundle();
  const [saved, setSaved] = useState(false);
  const canStore = browserStore() !== null;
  const change = (fn: Parameters<typeof update>[0]) => { update(fn); setSaved(true); };
  const venueName = (id: string) => bundle?.venues.find((v) => v.id === id)?.name ?? id;
  const s = prefs.settings;

  return (
    <form class="stack" onSubmit={(e) => e.preventDefault()}>
      {!canStore && <p class="notice">{de.settings.storageUnavailable}</p>}
      <div class="field">
        <label for="birth">{de.settings.birthDate}</label>
        <input id="birth" type="date" value={s.birthDate ?? ""}
          onInput={(e) => { const v = (e.currentTarget as HTMLInputElement).value; change((p) => ({ ...p, settings: { ...p.settings, birthDate: v || null } })); }} />
        <p class="muted">{de.settings.birthHint}</p>
      </div>
      <fieldset>
        <legend>{de.settings.kreise}</legend>
        {KREISE.map((k) => (
          <label key={k}>
            <input type="checkbox" id={`kreis-${k}`} checked={s.kreise.includes(k)}
              onChange={() => change((p) => ({ ...p, settings: { ...p.settings, kreise: p.settings.kreise.includes(k) ? p.settings.kreise.filter((x) => x !== k) : [...p.settings.kreise, k] } }))} />
            {" "}{de.kreis(k)}
          </label>
        ))}
      </fieldset>
      <section class="field">
        <h2 class="group" style="font-family:var(--f-display);margin:0">{de.settings.favourites}</h2>
        {s.favourites.length === 0 ? (
          <p class="muted">{de.settings.noFavourites}</p>
        ) : (
          <ul class="results">
            {s.favourites.map((id) => (
              <li key={id} style="display:flex;justify-content:space-between;gap:8px;align-items:center">
                <span>★ {venueName(id)}</span>
                <button type="button" class="linkbtn" onClick={() => change((p) => ({ ...p, settings: toggleFavourite(p.settings, id) }))}>{de.settings.remove}</button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div style="display:flex;gap:12px;align-items:center">
        <button type="button" class="linkbtn" onClick={() => change(() => DEFAULT_PREFS)}>{de.settings.reset}</button>
        {saved && canStore && <span class="muted" role="status">{de.settings.saved}</span>}
      </div>
    </form>
  );
}
