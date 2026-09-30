import { addDays } from "@zueri-kids/core";
import { de } from "../i18n/de";
import { weekOf } from "../lib/calendar";
import { dayOfMonth, shortDate, weekdayShort } from "../lib/labels";
import { applyFilters, itemKey, itemsBetween } from "../lib/model";
import { href } from "./env";
import { FilterBar } from "./FilterBar";
import { useBundle, useNow, usePrefs, useUrlState } from "./hooks";
import { catVar } from "./types";

// REQ-WEB-020
export default function WeekApp() {
  const { bundle, index, error } = useBundle();
  const now = useNow();
  const [prefs] = usePrefs();
  const [url, setUrl] = useUrlState(prefs.settings, now.date);
  if (error) return <p class="empty">{de.loadError}</p>;
  if (!bundle || !index) return <p class="summary">{de.loading}</p>;

  const date = url.date ?? now.date;
  const days = weekOf(date);
  const items = applyFilters(itemsBetween(bundle, index, days[0], days[6], now), url.filters, prefs.settings);
  const venueId = (url.filters.ort as string | null) ?? null;
  const venueName = venueId ? bundle.venues.find((v) => v.id === venueId)?.name ?? venueId : null;

  return (
    <>
      <header class="bar">
        <div class="brand">{de.brand.first} <span>{de.brand.second}</span></div>
        <div class="daynav">
          <button type="button" class="iconbtn" aria-label={de.prevWeek} onClick={() => setUrl({ ...url, date: addDays(date, -7) })}>‹</button>
          <h1>{de.week.title(shortDate(days[0]), shortDate(days[6]))}</h1>
          <button type="button" class="iconbtn" aria-label={de.nextWeek} onClick={() => setUrl({ ...url, date: addDays(date, 7) })}>›</button>
        </div>
      </header>
      <div class="toolbar">
        <FilterBar state={url.filters} settings={prefs.settings} date={date} venueName={venueName}
          onChange={(id, value) => setUrl({ ...url, filters: { ...url.filters, [id]: value } })} />
      </div>
      <div class="week">
        {days.map((d) => {
          const dayItems = items.filter((i) => i.occurrence.date === d);
          return (
            <section key={d} class="weekday">
              <h2><a href={href(`?date=${d}`)} aria-label={de.week.openDay(shortDate(d))}>{weekdayShort(d)} {dayOfMonth(d)}.</a></h2>
              {dayItems.length ? (
                <ul>
                  {dayItems.map((i) => (
                    <li key={itemKey(i)} class={i.past ? "past" : ""} style={catVar(i.offer.category)}>
                      <span class="dot" />
                      <span class="time">{i.occurrence.start}</span>
                      <a class="title" href={href(`angebot/${i.venue.id}/${i.offer.id}/`)}>{i.offer.title}</a>
                      <span class="meta">{i.venue.name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p class="muted">{de.week.empty}</p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
