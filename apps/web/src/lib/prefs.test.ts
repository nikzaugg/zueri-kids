import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, loadPrefs, savePrefs, toggleFavourite, type Store } from "./prefs";

function memoryStore(): Store & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}
const broken: Store = {
  getItem: () => { throw new Error("blocked"); },
  setItem: () => { throw new Error("blocked"); },
};

describe("prefs", () => {
  it("REQ-WEB-060: falls back to defaults when storage is missing, blocked or corrupt", () => {
    expect(loadPrefs(null)).toEqual(DEFAULT_PREFS);
    expect(loadPrefs(broken)).toEqual(DEFAULT_PREFS);
    const s = memoryStore();
    s.setItem("zueri-kids:prefs", "{not json");
    expect(loadPrefs(s)).toEqual(DEFAULT_PREFS);
    expect(savePrefs(broken, DEFAULT_PREFS)).toBe(false);
    expect(DEFAULT_PREFS.settings.kreise).toEqual([1, 2, 3, 4, 9]);
  });

  it("REQ-WEB-060: stores birth date and Kreise", () => {
    const s = memoryStore();
    const prefs = { ...DEFAULT_PREFS, settings: { ...DEFAULT_PREFS.settings, birthDate: "2025-12-28", kreise: [3, 9] } };
    expect(savePrefs(s, prefs)).toBe(true);
    expect(loadPrefs(s).settings).toEqual({ birthDate: "2025-12-28", kreise: [3, 9], favourites: [] });
  });

  it("REQ-WEB-060: drops invalid stored values", () => {
    const s = memoryStore();
    s.setItem("zueri-kids:prefs", JSON.stringify({ settings: { birthDate: "31.12.2025", kreise: [3, 99], favourites: [1, "gz-heuried"] }, view: "grid", group: 7 }));
    expect(loadPrefs(s)).toEqual({ settings: { birthDate: null, kreise: [3], favourites: ["gz-heuried"] }, view: "timeline", group: "time" });
  });

  it("REQ-WEB-016: remembers the view", () => {
    const s = memoryStore();
    savePrefs(s, { ...DEFAULT_PREFS, view: "list" });
    expect(loadPrefs(s).view).toBe("list");
    expect(DEFAULT_PREFS.view).toBe("timeline");
  });

  it("REQ-WEB-018: remembers the grouping", () => {
    const s = memoryStore();
    savePrefs(s, { ...DEFAULT_PREFS, group: "venue" });
    expect(loadPrefs(s).group).toBe("venue");
    expect(DEFAULT_PREFS.group).toBe("time");
  });

  it("REQ-WEB-062: toggles favourite venues", () => {
    const once = toggleFavourite(DEFAULT_PREFS.settings, "gz-heuried");
    expect(once.favourites).toEqual(["gz-heuried"]);
    expect(toggleFavourite(once, "gz-heuried").favourites).toEqual([]);
  });
});
