import { describe, expect, it } from "vitest";
import type { Settings } from "./filters/types";
import { parseUrl, toSearch } from "./urlState";

const settings: Settings = { birthDate: "2025-12-28", kreise: [1, 2, 3, 4, 9], favourites: [] };

describe("urlState", () => {
  it("REQ-FLT-003: round-trips active filters through the URL", () => {
    const state = parseUrl("?preis=free&anmeldung=1&ort=gz-heuried", settings);
    expect(state.filters).toMatchObject({ preis: "free", anmeldung: true, ort: "gz-heuried", alter: true });
    const search = toSearch(state, settings, "2026-10-20");
    expect(search).toBe("?ort=gz-heuried&preis=free&anmeldung=1");
    expect(parseUrl(search, settings)).toEqual(state);
  });

  it("REQ-WEB-012: keeps the date in the URL, except for today", () => {
    expect(parseUrl("?date=2026-10-21", settings).date).toBe("2026-10-21");
    expect(parseUrl("?date=21.10.2026", settings).date).toBeNull();
    expect(toSearch({ ...parseUrl("", settings), date: "2026-10-21" }, settings, "2026-10-20")).toBe("?date=2026-10-21");
    expect(toSearch({ ...parseUrl("", settings), date: "2026-10-20" }, settings, "2026-10-20")).toBe("");
  });

  it("REQ-WEB-061: URL values override settings defaults", () => {
    expect(parseUrl("?kreis=9", settings).filters.kreis).toEqual([9]);
    expect(parseUrl("", settings).filters.kreis).toEqual([1, 2, 3, 4, 9]);
    expect(parseUrl("?alter=0", settings).filters.alter).toBe(false);
  });
});
