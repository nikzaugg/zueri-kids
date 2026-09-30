import { Fragment } from "preact";
import { de } from "../i18n/de";
import { byVenue } from "../lib/grouping";
import { itemKey, type DayItem } from "../lib/model";
import { AXIS_END, AXIS_HOURS, AXIS_START, axisPercent, barStyle } from "../lib/timeline";
import { ItemDetails, ItemMeta } from "./Item";
import { catVar, type ViewProps } from "./types";
import { VenueHeader } from "./VenueHeader";

function Row({ item, p }: { item: DayItem; p: ViewProps }) {
  const { left, width } = barStyle(item.occurrence.start, item.occurrence.end);
  const key = itemKey(item);
  return (
    <div class={`tl-row${item.past ? " past" : ""}`} style={catVar(item.offer.category)}>
      <button type="button" class="rowbtn" aria-expanded={p.expanded === key} onClick={() => p.onExpand(key)}>
        <div class="head">
          <span class="time">{item.occurrence.start}–{item.occurrence.end}</span>
          <span class="title">{item.offer.title}</span>
        </div>
        <div class="track">
          <div class={`span${item.occurrence.kind === "open" ? " open" : ""}`} style={{ left: `${left}%`, width: `${width}%` }} />
        </div>
      </button>
      <ItemMeta item={item} p={p} />
      {p.expanded === key && <ItemDetails item={item} />}
    </div>
  );
}

// Pinned in the day view header so the time of day stays visible (REQ-WEB-017).
export function Axis() {
  return <div class="axis" aria-hidden="true">{AXIS_HOURS.map((h) => <span key={h}>{String(h).padStart(2, "0")}</span>)}</div>;
}

export function TimelineView(p: ViewProps) {
  const showNow = p.date === p.now.date && p.now.minutes >= AXIS_START && p.now.minutes <= AXIS_END;
  const rows = (items: DayItem[]) => (
    <div class="tl-rows">
      <div class="tl-grid" aria-hidden="true">{AXIS_HOURS.map((h) => <span key={h} />)}</div>
      {showNow && <div class="nowline" data-label={de.now} style={{ left: `${axisPercent(p.now.minutes)}%` }} />}
      {items.map((item) => <Row key={itemKey(item)} item={item} p={p} />)}
    </div>
  );
  return (
    <div class="tl">
      {p.group === "venue"
        ? byVenue(p.items, p.favourites).map((g) => (
            <Fragment key={g.venue.id}>
              <VenueHeader venue={g.venue} count={g.items.length} p={p} />
              {rows(g.items)}
            </Fragment>
          ))
        : rows(p.items)}
    </div>
  );
}
