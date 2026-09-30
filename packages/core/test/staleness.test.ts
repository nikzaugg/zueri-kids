import { describe, expect, it } from "vitest";
import { STALE_AFTER_DAYS, isStale } from "../src";
import { offer, source } from "./fixtures";

describe("staleness", () => {
  it("REQ-DATA-050: offers verified more than 90 days ago are stale", () => {
    expect(STALE_AFTER_DAYS).toBe(90);
    const o = offer({ source: { ...source, lastVerified: "2026-07-01" } });
    expect(isStale(o, "2026-09-29")).toBe(false); // 90 days
    expect(isStale(o, "2026-09-30")).toBe(true); // 91 days
  });
});
