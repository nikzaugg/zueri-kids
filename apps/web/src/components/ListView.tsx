import { Fragment } from "preact";
import { de } from "../i18n/de";
import { byPeriod, byVenue, pastLast } from "../lib/grouping";
import { itemKey, type DayItem } from "../lib/model";
import { ItemDetails, ItemMeta } from "./Item";
import { catVar, type ViewProps } from "./types";
import { VenueHeader } from "./VenueHeader";

function Row({ item, p }: { item: DayItem; p: ViewProps }) {
  const key = itemKey(item);
  return (
    <div class={`li${item.past ? " past" : ""}`} style={catVar(item.offer.category)}>
      <div class="time">{item.occurrence.start}<small>{item.occurrence.end}</small></div>
      <span class="dot" />
      <div class="body">
        <button type="button" class="rowbtn" aria-expanded={p.expanded === key} onClick={() => p.onExpand(key)}>
          <div class="title">{item.offer.title}</div>
        </button>
        <ItemMeta item={item} p={p} />
        {p.expanded === key && <ItemDetails item={item} />}
      </div>
    </div>
  );
}

export function ListView(p: ViewProps) {
  const list = (items: DayItem[]) => <div class="list">{items.map((i) => <Row key={itemKey(i)} item={i} p={p} />)}</div>;
  if (p.group === "venue") {
    return (
      <>
        {byVenue(p.items, p.favourites).map((g) => (
          <Fragment key={g.venue.id}>
            <VenueHeader venue={g.venue} count={g.items.length} p={p} />
            {list(pastLast(g.items))}
          </Fragment>
        ))}
      </>
    );
  }
  return (
    <>
      {byPeriod(p.items).map((g) => (
        <section class="group" key={g.id}>
          <h2>{de.periods[g.id]}</h2>
          {list(g.items)}
        </section>
      ))}
    </>
  );
}
