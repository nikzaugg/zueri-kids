import { useEffect, useMemo, useState } from "preact/hooks";
import { indexOffers, type OfferIndex } from "../lib/model";
import { browserStore, loadPrefs, savePrefs, type Prefs } from "../lib/prefs";
import { nowInZurich, type Now } from "../lib/time";
import type { Bundle } from "../lib/types";
import { parseUrl, toSearch, type UrlState } from "../lib/urlState";
import type { Settings } from "../lib/filters/types";
import { href } from "./env";

export function useBundle(): { bundle: Bundle | null; index: OfferIndex | null; error: boolean } {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch(href("bundle.json"))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setBundle)
      .catch(() => setError(true));
  }, []);
  const index = useMemo(() => (bundle ? indexOffers(bundle) : null), [bundle]);
  return { bundle, index, error };
}

export function useNow(): Now {
  const [now, setNow] = useState(() => nowInZurich(new Date()));
  useEffect(() => {
    const t = setInterval(() => setNow(nowInZurich(new Date())), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function usePrefs(): [Prefs, (fn: (p: Prefs) => Prefs) => void] {
  const [prefs, setPrefs] = useState(() => loadPrefs(browserStore()));
  const update = (fn: (p: Prefs) => Prefs) =>
    setPrefs((prev) => {
      const next = fn(prev);
      savePrefs(browserStore(), next);
      return next;
    });
  return [prefs, update];
}

// Keeps date and filters in the URL (REQ-FLT-003, REQ-WEB-012).
export function useUrlState(settings: Settings, today: string): [UrlState, (s: UrlState) => void] {
  const [state, setState] = useState(() => parseUrl(location.search, settings));
  useEffect(() => {
    history.replaceState(null, "", location.pathname + toSearch(state, settings, today));
  }, [state, settings, today]);
  return [state, setState];
}
