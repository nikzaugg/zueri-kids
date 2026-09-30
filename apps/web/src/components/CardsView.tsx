import { Fragment } from "preact";
import { byVenue, pastLast } from "../lib/grouping";
import { itemKey, type DayItem } from "../lib/model";
import { ItemDetails, ItemMeta } from "./Item";
import { catVar, type ViewProps } from "./types";
import { VenueHeader } from "./VenueHeader";

function Card({ item, p }: { item: DayItem; p: ViewProps }) {
  const key = itemKey(item);
  return (
    <div class={`card${item.past ? " past" : ""}`} style={catVar(item.offer.category)}>
      <div class="time">{item.occurrence.start}–{item.occurrence.end}</div>
      <button type="button" class="rowbtn" aria-expanded={p.expanded === key} onClick={() => p.onExpand(key)}>
        <div class="title">{item.offer.title}</div>
      </button>
      <ItemMeta item={item} p={p} />
      {p.expanded === key && <ItemDetails item={item} />}
    </div>
  );
}

// REQ-WEB-019
export function CardsView(p: ViewProps) {
  const grid = (items: DayItem[]) => <div class="cards">{pastLast(items).map((i) => <Card key={itemKey(i)} item={i} p={p} />)}</div>;
  if (p.group === "venue") {
    return (
      <>
        {byVenue(p.items, p.favourites).map((g) => (
          <Fragment key={g.venue.id}>
            <VenueHeader venue={g.venue} count={g.items.length} p={p} />
            {grid(g.items)}
          </Fragment>
        ))}
      </>
    );
  }
  return grid(p.items);
}
