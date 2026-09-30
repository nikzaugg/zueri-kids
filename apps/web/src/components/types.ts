import type { Now } from "../lib/time";
import type { DayItem } from "../lib/model";
import type { Group } from "../lib/prefs";

export type ViewProps = {
  items: DayItem[];
  group: Group;
  now: Now;
  date: string;
  favourites: string[];
  showVenue: boolean;
  expanded: string | null;
  onExpand(key: string): void;
  onVenue(venueId: string): void;
  onStar(venueId: string): void;
};

export const catVar = (category: string) => ({ "--cat": `var(--c-${category})` });
