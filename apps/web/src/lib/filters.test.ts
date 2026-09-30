import { describe, expect, it } from "vitest";
import type { Offer, Venue } from "@zueri-kids/core";
import { offer as makeOffer, venue as makeVenue } from "../../../../packages/core/test/fixtures";
import { FILTERS, activeFilters, defaultState, matchesFilters, relaxableLabels } from "./filters/registry";
import type { FilterContext, Settings } from "./filters/types";

const settings: Settings = { birthDate: "2025-12-28", kreise: [1, 2, 3, 4, 9], favourites: ["gz-test"] };
const noChild: Settings = { ...settings, birthDate: null };

function ctx(o: Partial<Offer> = {}, v: Partial<Venue> = {}, s: Settings = settings): FilterContext {
  const offer = makeOffer(o);
  const venue = makeVenue({ offers: [offer], ...v });
  return {
    occurrence: { key: `${venue.id}/${offer.id}`, date: "2026-10-20", start: "09:30", end: "11:30", kind: "session" },
    offer, venue, date: "2026-10-20", settings: s,
  };
}
const byId = (id: string) => FILTERS.find((f) => f.id === id)!;
const match = (id: string, value: unknown, c: FilterContext) => byId(id).matches(c, value);

describe("filters", () => {
  it("REQ-FLT-001: registers every filter once, in bar order, with the common interface", () => {
    expect(FILTERS.map((f) => f.id)).toEqual(["ort", "meine", "alter", "lage", "preis", "anmeldung", "kreis"]);
    for (const f of FILTERS) {
      expect(typeof f.parse).toBe("function");
      expect(typeof f.serialize).toBe("function");
      expect(typeof f.matches).toBe("function");
      expect(["toggle", "select", "multiselect", "removable"]).toContain(f.control);
    }
  });

  it("REQ-FLT-002: requires all active filters; the venue filter overrides kreis and mine", () => {
    const state = { ...defaultState(settings), anmeldung: true };
    expect(matchesFilters(ctx({ registration: "required" }), state)).toBe(false);
    expect(matchesFilters(ctx({ registration: "none" }), state)).toBe(true);

    const outside = ctx({}, { id: "spielhalle", location: { address: "x", municipality: "Zürich", kreis: 11 } });
    const mineOnly = { ...defaultState(settings), meine: true };
    expect(matchesFilters(outside, mineOnly)).toBe(false);
    const venueState = { ...mineOnly, ort: "spielhalle" };
    expect(activeFilters(venueState, settings).map((f) => f.id)).not.toContain("kreis");
    expect(activeFilters(venueState, settings).map((f) => f.id)).not.toContain("meine");
    expect(matchesFilters(outside, venueState)).toBe(true);
  });

  it("REQ-FLT-010: age filter uses the child's age on the occurrence date", () => {
    expect(byId("alter").label(settings, "2026-10-20")).toBe("Passt für 9 Mt.");
    expect(byId("alter").defaultValue(settings)).toBe(true);
    expect(byId("alter").defaultValue(noChild)).toBe(false);
    expect(byId("alter").isActive(true, noChild)).toBe(false);
    expect(match("alter", true, ctx({ ageMonths: { min: 9, max: 24 } }))).toBe(true);
    expect(match("alter", true, ctx({ ageMonths: { min: 12 } }))).toBe(false);
    expect(match("alter", true, ctx({ ageMonths: { max: 8 } }))).toBe(false);
    expect(match("alter", true, ctx({ ageMonths: {} }))).toBe(true);
    expect(byId("alter").parse(null, settings)).toBe(true);
    expect(byId("alter").parse("0", settings)).toBe(false);
    expect(byId("alter").serialize(true, settings)).toBeNull();
    expect(byId("alter").serialize(false, settings)).toBe("0");
  });

  it("REQ-FLT-011: setting filter", () => {
    expect(match("lage", "indoor", ctx({ setting: "indoor" }))).toBe(true);
    expect(match("lage", "indoor", ctx({ setting: "both" }))).toBe(true);
    expect(match("lage", "indoor", ctx({ setting: "outdoor" }))).toBe(false);
    expect(match("lage", "outdoor", ctx({ setting: "outdoor" }))).toBe(true);
    expect(match("lage", "outdoor", ctx({ setting: "both" }))).toBe(true);
    expect(byId("lage").isActive("all", settings)).toBe(false);
  });

  it("REQ-FLT-012: price filter treats donations as free", () => {
    expect(match("preis", "free", ctx({ price: { type: "free" } }))).toBe(true);
    expect(match("preis", "free", ctx({ price: { type: "donation" } }))).toBe(true);
    expect(match("preis", "free", ctx({ price: { type: "fixed", chf: 3 } }))).toBe(false);
    expect(match("preis", "max:10", ctx({ price: { type: "fixed", chf: 8 } }))).toBe(true);
    expect(match("preis", "max:10", ctx({ price: { type: "fixed", chf: 12 } }))).toBe(false);
    expect(match("preis", "max:10", ctx({ price: { type: "range", minChf: 5, maxChf: 20 } }))).toBe(true);
    expect(match("preis", "max:10", ctx({ price: { type: "unknown" } }))).toBe(false);
    expect(byId("preis").parse("cheap", settings)).toBe("all");
    expect(byId("preis").parse("max:20", settings)).toBe("max:20");
  });

  it("REQ-FLT-013: registration filter", () => {
    expect(match("anmeldung", true, ctx({ registration: "none" }))).toBe(true);
    expect(match("anmeldung", true, ctx({ registration: "recommended" }))).toBe(false);
    expect(match("anmeldung", true, ctx({ registration: "unknown" }))).toBe(false);
  });

  it("REQ-FLT-014: kreis filter defaults to the settings and handles 'Ausserhalb'", () => {
    expect(byId("kreis").defaultValue(settings)).toEqual([1, 2, 3, 4, 9]);
    expect(match("kreis", [3], ctx())).toBe(true);
    expect(match("kreis", [9], ctx())).toBe(false);
    const outside = ctx({}, { location: { address: "x", municipality: "Dietikon" } });
    expect(match("kreis", [0], outside)).toBe(true);
    expect(byId("kreis").parse("", settings)).toEqual([]);
    expect(byId("kreis").parse("9,3", settings)).toEqual([3, 9]);
    expect(byId("kreis").parse(null, settings)).toEqual([1, 2, 3, 4, 9]);
    expect(byId("kreis").serialize([9, 4, 3, 2, 1], settings)).toBeNull();
    expect(byId("kreis").serialize([9, 3], settings)).toBe("3,9");
  });

  it("REQ-FLT-015: venue filter matches one venue and round-trips through the URL", () => {
    expect(match("ort", "gz-test", ctx())).toBe(true);
    expect(match("ort", "other", ctx())).toBe(false);
    expect(byId("ort").parse("gz-heuried", settings)).toBe("gz-heuried");
    expect(byId("ort").parse(null, settings)).toBeNull();
    expect(byId("ort").serialize("gz-heuried", settings)).toBe("gz-heuried");
    expect(byId("ort").overrides).toEqual(["kreis", "meine"]);
  });

  it("REQ-FLT-016: 'Meine Orte' matches favourite venues", () => {
    expect(match("meine", true, ctx())).toBe(true);
    expect(match("meine", true, ctx({}, { id: "elsewhere" }))).toBe(false);
  });

  it("REQ-WEB-051: names the active filters that can be relaxed", () => {
    const state = { ...defaultState(settings), preis: "free", anmeldung: true, ort: "gz-test" };
    expect(relaxableLabels(state, settings, "2026-10-20", "GZ Test")).toEqual([
      "GZ Test", "Passt für 9 Mt.", "Gratis / Kollekte", "Ohne Anmeldung",
    ]);
  });
});
