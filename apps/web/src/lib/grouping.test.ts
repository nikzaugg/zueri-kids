import { describe, expect, it } from "vitest";
import { byPeriod, byVenue } from "./grouping";
import { dayItems, indexOffers } from "./model";
import type { Schedule } from "@zueri-kids/core";
import { noHolidays, offer, source, venue } from "../../../../packages/core/test/fixtures";
import type { Bundle } from "./types";

const weekly = (days: ("mon" | "tue" | "wed")[], start: string, end: string, type: "weekly" | "openingHours" = "weekly"): Schedule => ({
  type, rules: [{ days, start, end }], pausesDuringSchoolHolidays: false, pausesOnPublicHolidays: false,
});
const bundle: Bundle = {
  builtOn: "2026-09-30",
  holidays: noHolidays,
  venues: [
    venue({
      id: "gz-heuried", name: "GZ Heuried", location: { address: "Döltschiweg 130, 8055 Zürich", municipality: "Zürich", kreis: 3 },
      offers: [
        offer({ id: "rollen", title: "Rollender Montag", schedule: weekly(["mon"], "14:30", "17:00", "openingHours") }),
        offer({ id: "musik", title: "Music Together", schedule: weekly(["tue"], "09:30", "10:30"), registration: "required" }),
      ],
    }),
    venue({
      id: "pbz-sihlcity", name: "PBZ Sihlcity", location: { address: "Kalanderplatz 5, 8045 Zürich", municipality: "Zürich", kreis: 3 },
      offers: [
        offer({ id: "ryte", title: "Ryte, ryte Rössli", schedule: weekly(["tue"], "10:00", "10:45"), source: { ...source, lastVerified: "2026-05-01" } }),
        offer({ id: "ecke", title: "Kinderecke", description: "Bücher anschauen", schedule: weekly(["tue"], "12:00", "19:00", "openingHours") }),
      ],
    }),
  ],
};

const items = dayItems(bundle, indexOffers(bundle), "2026-10-20", { date: "2026-10-20", minutes: 630 });

describe("grouping", () => {
  it("REQ-WEB-011: groups into Vormittag, Nachmittag and Offen", () => {
    expect(byPeriod(items).map((g) => [g.id, g.items.map((i) => i.offer.id)])).toEqual([
      ["morning", ["ryte", "musik"]],
      ["open", ["ecke"]],
    ]);
  });

  it("REQ-WEB-013: lists past items after the others in their group", () => {
    const morning = byPeriod(items)[0].items;
    expect(morning.map((i) => [i.offer.id, i.past])).toEqual([["ryte", false], ["musik", true]]);
  });

  it("REQ-WEB-018: groups by venue, favourites first, then by earliest start", () => {
    expect(byVenue(items, []).map((g) => g.venue.id)).toEqual(["gz-heuried", "pbz-sihlcity"]);
    expect(byVenue(items, ["pbz-sihlcity"]).map((g) => g.venue.id)).toEqual(["pbz-sihlcity", "gz-heuried"]);
  });
});