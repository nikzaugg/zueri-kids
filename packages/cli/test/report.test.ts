import { describe, expect, it } from "vitest";
import { noHolidays, offer, source, venue } from "../../core/test/fixtures";
import { buildReport } from "../src/report";

describe("report", () => {
  it("REQ-CLI-010: counts per kreis and category, lists stale offers and unknowns", () => {
    const dataset = {
      holidays: noHolidays,
      venues: [
        venue({
          id: "gz-heuried",
          amenities: { stroller: "yes", changingTable: "unknown", cafe: "yes" },
          offers: [
            offer({ id: "krabbeltreff", source: { ...source, lastVerified: "2026-05-01" } }),
            offer({ id: "singen", category: "music", price: { type: "unknown" }, registration: "unknown" }),
          ],
        }),
        venue({
          id: "spielhalle",
          type: "indoor-playground",
          location: { address: "Hauptstrasse 1, 8953 Dietikon", municipality: "Dietikon" },
          offers: [offer({ id: "halle", category: "play", source: { ...source, lastVerified: "2026-06-01" } })],
        }),
        venue({ id: "gz-wipkingen", location: { address: "x", municipality: "Zürich", kreis: 10 } }),
      ],
    };
    expect(buildReport(dataset, "2026-09-30")).toBe(
      [
        "Venues: 3 · Offers: 4",
        "",
        "By kreis:",
        "  Kreis 3: 1 venues, 2 offers",
        "  Kreis 10: 1 venues, 1 offers",
        "  Outside Zurich: 1 venues, 1 offers",
        "",
        "By category:",
        "  meetup: 2",
        "  music: 1",
        "  play: 1",
        "",
        "Stale offers (2):",
        "  2026-05-01  gz-heuried/krabbeltreff",
        "  2026-06-01  spielhalle/halle",
        "",
        "Unknown values:",
        "  amenities.cafe: 2",
        "  amenities.changingTable: 3",
        "  amenities.stroller: 2",
        "  price: 1",
        "  registration: 1",
      ].join("\n"),
    );
  });
});
