import { describe, expect, it } from "vitest";
import { ageLabel, dayTitle, kreisLabel, longDate, priceLabel, registrationMarker, shortDate, weekdayShort } from "./labels";

describe("labels", () => {
  it("REQ-WEB-015: labels prices", () => {
    expect(priceLabel({ type: "free" })).toBe("gratis");
    expect(priceLabel({ type: "fixed", chf: 5 })).toBe("CHF 5");
    expect(priceLabel({ type: "range", minChf: 2, maxChf: 7 })).toBe("CHF 2–7");
    expect(priceLabel({ type: "donation" })).toBe("Kollekte");
    expect(priceLabel({ type: "unknown" })).toBe("Preis unbekannt");
  });

  it("REQ-WEB-015: labels age ranges", () => {
    expect(ageLabel({})).toBe("alle Altersstufen");
    expect(ageLabel({ min: 0 })).toBe("alle Altersstufen");
    expect(ageLabel({ max: 48 })).toBe("bis 4 J.");
    expect(ageLabel({ min: 0, max: 72 })).toBe("bis 6 J.");
    expect(ageLabel({ min: 36 })).toBe("ab 3 J.");
    expect(ageLabel({ min: 9, max: 24 })).toBe("9 Mt. – 2 J.");
    expect(ageLabel({ min: 30, max: 48 })).toBe("30 Mt. – 4 J.");
  });

  it("REQ-WEB-015: marks registration only when required or unknown", () => {
    expect(registrationMarker("required")).toBe("Anmeldung");
    expect(registrationMarker("unknown")).toBe("Anmeldung?");
    expect(registrationMarker("none")).toBeNull();
    expect(registrationMarker("recommended")).toBeNull();
  });

  it("REQ-WEB-015: labels kreis and dates", () => {
    expect(kreisLabel(3)).toBe("K3");
    expect(kreisLabel(undefined)).toBe("Ausserhalb");
    expect(dayTitle("2026-10-20", "2026-10-20")).toEqual({ title: "Heute, Dienstag", subtitle: "20. Oktober 2026" });
    expect(dayTitle("2026-10-21", "2026-10-20")).toEqual({ title: "Mittwoch", subtitle: "21. Oktober 2026" });
    expect(weekdayShort("2026-10-25")).toBe("So");
    expect(shortDate("2026-10-05")).toBe("5.10.");
    expect(longDate("2027-01-01")).toBe("1. Januar 2027");
  });
});
