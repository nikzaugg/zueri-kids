import type { Holidays, Offer, Venue } from "../src";

export const source = {
  url: "https://example.ch/angebote",
  lastVerified: "2026-09-01",
  by: "ai" as const,
};

export function offer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: "treff",
    title: "Treff",
    category: "meetup",
    ageMonths: {},
    setting: "indoor",
    price: { type: "free" },
    registration: "none",
    schedule: {
      type: "weekly",
      rules: [{ days: ["tue"], start: "09:30", end: "11:30" }],
      pausesDuringSchoolHolidays: false,
      pausesOnPublicHolidays: false,
    },
    source,
    ...overrides,
  };
}

export function venue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: "gz-test",
    name: "GZ Test",
    type: "community-centre",
    location: { address: "Teststrasse 1, 8003 Zürich", municipality: "Zürich", kreis: 3 },
    amenities: { stroller: "unknown", changingTable: "unknown", cafe: "unknown" },
    offers: [offer()],
    ...overrides,
  };
}

export const noHolidays: Holidays = { schoolHolidays: [], publicHolidays: [] };
