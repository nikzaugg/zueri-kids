import { addDays } from "@zueri-kids/core";
import { useState } from "preact/hooks";
import { de } from "../i18n/de";
import { dayNotice, weekOf } from "../lib/calendar";
import { relaxableLabels } from "../lib/filters/registry";
import { dayOfMonth, dayTitle, weekdayShort } from "../lib/labels";
import { applyFilters, dayItems } from "../lib/model";
import { toggleFavourite, type Group, type View } from "../lib/prefs";
import { CardsView } from "./CardsView";
import { FilterBar } from "./FilterBar";
import { useBundle, useNow, usePrefs, useUrlState } from "./hooks";
import { ListView } from "./ListView";
import { Axis, TimelineView } from "./TimelineView";
import type { ViewProps } from "./types";

const VIEWS: View[] = ["timeline", "list", "cards"];
const GROUPS: Group[] = ["time", "venue"];

export default function DayApp() {
  const { bundle, index, error } = useBundle();
  const now = useNow();
  const [prefs, updatePrefs] = usePrefs();
  const [url, setUrl] = useUrlState(prefs.settings, now.date);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (error) return <p class="empty">{de.loadError}</p>;
  if (!bundle || !index) return <p class="summary">{de.loading}</p>;

  const date = url.date ?? now.date;
  const all = dayItems(bundle, index, date, now);
  const shown = applyFilters(all, url.filters, prefs.settings);
  const venueId = (url.filters.ort as string | null) ?? null;
  const venueName = venueId ? bundle.venues.find((v) => v.id === venueId)?.name ?? venueId : null;
  const notice = dayNotice(date, bundle.holidays);
  const title = dayTitle(date, now.date);

  const setDate = (d: string) => { setExpanded(null); setUrl({ ...url, date: d }); };
  const setFilter = (id: string, value: unknown) => setUrl({ ...url, filters: { ...url.filters, [id]: value } });

  const props: ViewProps = {
    items: shown,
    group: prefs.group,
    now,
    date,
    favourites: prefs.settings.favourites,
    showVenue: prefs.group === "time" && venueId === null,
    expanded,
    onExpand: (k) => setExpanded(expanded === k ? null : k),
    onVenue: (id) => { setFilter("ort", id); window.scrollTo({ top: 0 }); },
    onStar: (id) => updatePrefs((p) => ({ ...p, settings: toggleFavourite(p.settings, id) })),
  };
  const View = prefs.view === "timeline" ? TimelineView : prefs.view === "list" ? ListView : CardsView;

  return (
    <>
      <header class="bar">
        <div class="brand">{de.brand.first} <span>{de.brand.second}</span></div>
        <div class="daynav">
          <button type="button" class="iconbtn" aria-label={de.prevDay} onClick={() => setDate(addDays(date, -1))}>‹</button>
          <h1>{title.title}<small>{title.subtitle}</small></h1>
          <button type="button" class="iconbtn" aria-label={de.nextDay} onClick={() => setDate(addDays(date, 1))}>›</button>
        </div>
        <div class="days" role="group" aria-label={de.chooseDay}>
          {weekOf(date).map((d) => (
            <button type="button" key={d} aria-pressed={d === date} onClick={() => setDate(d)}>
              {weekdayShort(d)}<b>{dayOfMonth(d)}</b>
            </button>
          ))}
        </div>
        {prefs.view === "timeline" && shown.length > 0 && <Axis />}
      </header>

      <div class="toolbar">
        <div class="controls">
          <div class="views" role="group" aria-label={de.views.label}>
            {VIEWS.map((v) => (
              <button type="button" key={v} aria-pressed={prefs.view === v} onClick={() => updatePrefs((p) => ({ ...p, view: v }))}>{de.views[v]}</button>
            ))}
          </div>
          <div class="groupby" role="group" aria-label={de.groups.label}>
            {GROUPS.map((g) => (
              <button type="button" key={g} aria-pressed={prefs.group === g} onClick={() => updatePrefs((p) => ({ ...p, group: g }))}>{de.groups[g]}</button>
            ))}
          </div>
        </div>
        <FilterBar state={url.filters} settings={prefs.settings} date={date} venueName={venueName} onChange={setFilter} />
      </div>

      {notice.schoolHoliday && <p class="notice">{de.notices.schoolHoliday}</p>}
      {notice.publicHoliday && <p class="notice">{de.notices.publicHoliday(notice.publicHoliday)}</p>}
      <p class="summary">{venueName ? de.summaryVenue(shown.length) : de.summary(shown.length, all.length)}</p>

      <main>
        {shown.length === 0 ? (
          <div class="empty">{de.empty}. {de.emptyHint(relaxableLabels(url.filters, prefs.settings, date, venueName))}</div>
        ) : (
          <View {...props} />
        )}
      </main>
      {prefs.view === "timeline" && shown.length > 0 && (
        <div class="legend"><span><i />{de.legend.session}</span><span><i class="open" />{de.legend.open}</span></div>
      )}
    </>
  );
}
