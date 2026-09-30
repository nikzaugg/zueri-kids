import { de } from "../i18n/de";
import { shortDate, weekdayShort } from "../lib/labels";
import { nextOccurrences } from "../lib/model";
import { useBundle, useNow } from "./hooks";

export default function NextDates({ offerKey }: { offerKey: string }) {
  const { bundle } = useBundle();
  const now = useNow();
  if (!bundle) return <p class="muted">{de.loading}</p>;
  const next = nextOccurrences(bundle, offerKey, now.date, 5);
  if (!next.length) return <p class="muted">{de.details.noNext}</p>;
  return (
    <ul class="results">
      {next.map((o) => (
        <li key={o.date + o.start}>{weekdayShort(o.date)} {shortDate(o.date)} · {o.start}–{o.end}</li>
      ))}
    </ul>
  );
}
