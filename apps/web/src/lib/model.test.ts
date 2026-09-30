import { describe, expect, it } from "vitest";
import { applyFilters, dayItems, indexOffers, itemsBetween, nextOccurrences, searchOffers } from "./model";
import { defaultState } from "./filters/registry";
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

const index = indexOffers(bundle);
const tuesday = "2026-10-20";

describe("model", () => {
  it("REQ-WEB-010: returns the day's occurrences with offer and venue", () => {
    const items = dayItems(bundle, index, tuesday, { date: "2026-09-30", minutes: 0 });
    expect(items.map((i) => i.offer.title)).toEqual(["Music Together", "Ryte, ryte Rössli", "Kinderecke"]);
    expect(items[0].venue.name).toBe("GZ Heuried");
  });

  it("REQ-WEB-013: marks ended occurrences as past only on today", () => {
    const at1030 = dayItems(bundle, index, tuesday, { date: tuesday, minutes: 630 });
    expect(at1030.map((i) => i.past)).toEqual([true, false, false]);
    const otherDay = dayItems(bundle, index, tuesday, { date: "2026-10-21", minutes: 630 });
    expect(otherDay.every((i) => !i.past)).toBe(true);
  });

  it("REQ-WEB-050: flags stale offers", () => {
    const items = dayItems(bundle, index, tuesday, { date: "2026-09-30", minutes: 0 });
    expect(items.map((i) => i.stale)).toEqual([false, true, false]);
  });

  it("REQ-WEB-010: applies the active filters", () => {
    const settings = { birthDate: null, kreise: [3], favourites: [] };
    const items = dayItems(bundle, index, tuesday, { date: "2026-09-30", minutes: 0 });
    const state = { ...defaultState(settings), anmeldung: true };
    expect(applyFilters(items, state, settings).map((i) => i.offer.id)).toEqual(["ryte", "ecke"]);
  });

  it("REQ-WEB-020: returns all items of a week", () => {
    const items = itemsBetween(bundle, index, "2026-10-19", "2026-10-25", { date: "2026-09-30", minutes: 0 });
    expect(items.map((i) => `${i.occurrence.date} ${i.offer.id}`)).toEqual([
      "2026-10-19 rollen", "2026-10-20 musik", "2026-10-20 ryte", "2026-10-20 ecke",
    ]);
  });

  it("REQ-WEB-040: lists the next occurrences of one offer", () => {
    expect(nextOccurrences(bundle, "pbz-sihlcity/ryte", tuesday, 3).map((o) => o.date)).toEqual(["2026-10-20", "2026-10-27", "2026-11-03"]);
  });

  it("REQ-WEB-030: searches title, description, venue and address, ignoring case and diacritics", () => {
    expect(searchOffers(bundle, "ROSSLI", tuesday).map((r) => r.offer.id)).toEqual(["ryte"]);
    expect(searchOffers(bundle, "bucher", tuesday).map((r) => r.offer.id)).toEqual(["ecke"]);
    expect(searchOffers(bundle, "doltschiweg", tuesday).map((r) => r.offer.id).sort()).toEqual(["musik", "rollen"]);
    const [first] = searchOffers(bundle, "zurich", tuesday);
    expect(first.next).toMatchObject({ date: tuesday });
  });
});