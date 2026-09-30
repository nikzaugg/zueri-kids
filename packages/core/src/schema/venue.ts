import { z } from "zod";
import { WEEKDAYS } from "../dates";
import { HttpsUrl, Id, IsoDate, Time } from "./common";

type TimeRange = { start: string; end: string };

function endAfterStart(v: TimeRange, ctx: z.RefinementCtx) {
  if (v.end <= v.start) ctx.addIssue({ code: "custom", path: ["end"], message: "must be later than start" });
}

const Rule = z
  .strictObject({ days: z.array(z.enum(WEEKDAYS)).min(1), start: Time, end: Time })
  .superRefine(endAfterStart);

const DateEntry = z.strictObject({ date: IsoDate, start: Time, end: Time }).superRefine(endAfterStart);

const recurringFields = {
  rules: z.array(Rule).min(1),
  validFrom: IsoDate.optional(),
  validUntil: IsoDate.optional(),
  pausesDuringSchoolHolidays: z.boolean(),
  pausesOnPublicHolidays: z.boolean(),
  cancelled: z.array(IsoDate).optional(),
};

export const Schedule = z
  .discriminatedUnion("type", [
    z.strictObject({ type: z.literal("weekly"), ...recurringFields }),
    z.strictObject({ type: z.literal("openingHours"), ...recurringFields }),
    z.strictObject({ type: z.literal("dates"), dates: z.array(DateEntry).min(1) }),
  ])
  .superRefine((s, ctx) => {
    if (s.type !== "dates" && s.validFrom && s.validUntil && s.validFrom > s.validUntil) {
      ctx.addIssue({ code: "custom", path: ["validUntil"], message: "must not be before validFrom" });
    }
  });
export type Schedule = z.output<typeof Schedule>;

const note = z.string().optional();
const chf = z.number().min(0);

export const Price = z
  .discriminatedUnion("type", [
    z.strictObject({ type: z.literal("free") }),
    z.strictObject({ type: z.literal("fixed"), chf, note }),
    z.strictObject({ type: z.literal("range"), minChf: chf, maxChf: chf, note }),
    z.strictObject({ type: z.literal("donation"), note }),
    z.strictObject({ type: z.literal("unknown") }),
  ])
  .superRefine((p, ctx) => {
    if (p.type === "range" && p.maxChf < p.minChf) {
      ctx.addIssue({ code: "custom", path: ["maxChf"], message: "must not be less than minChf" });
    }
  });
export type Price = z.output<typeof Price>;

const AgeMonths = z
  .strictObject({ min: z.number().int().min(0).optional(), max: z.number().int().min(0).optional() })
  .superRefine((a, ctx) => {
    if (a.min !== undefined && a.max !== undefined && a.min > a.max) {
      ctx.addIssue({ code: "custom", path: ["max"], message: "must not be less than min" });
    }
  });

const Source = z.strictObject({ url: HttpsUrl, lastVerified: IsoDate, by: z.enum(["ai", "human"]) });

export const Offer = z.strictObject({
  id: Id,
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(["meetup", "play", "music", "movement", "culture", "crafts", "nature", "course", "play-corner", "advice", "other"]),
  ageMonths: AgeMonths,
  setting: z.enum(["indoor", "outdoor", "both"]),
  price: Price,
  registration: z.enum(["none", "recommended", "required", "unknown"]),
  schedule: Schedule,
  url: HttpsUrl.optional(),
  source: Source,
  notes: z.string().optional(),
});
export type Offer = z.output<typeof Offer>;

const Location = z
  .strictObject({
    address: z.string().min(1),
    municipality: z.string().min(1),
    kreis: z.number().int().min(1).max(12).optional(),
  })
  .superRefine((l, ctx) => {
    if (l.municipality === "Zürich" && l.kreis === undefined) {
      ctx.addIssue({ code: "custom", path: ["kreis"], message: "is required in Zürich" });
    }
    if (l.municipality !== "Zürich" && l.kreis !== undefined) {
      ctx.addIssue({ code: "custom", path: ["kreis"], message: "must be absent outside Zürich" });
    }
  });

const YesNoUnknown = z.enum(["yes", "no", "unknown"]).default("unknown");

const Amenities = z
  .strictObject({
    stroller: z.enum(["yes", "partial", "no", "unknown"]).default("unknown"),
    changingTable: YesNoUnknown,
    cafe: YesNoUnknown,
  })
  .default({ stroller: "unknown", changingTable: "unknown", cafe: "unknown" });

export const Venue = z
  .strictObject({
    id: Id,
    name: z.string().min(1),
    type: z.enum(["community-centre", "club", "library", "indoor-playground", "museum", "cafe", "church", "other"]),
    location: Location,
    website: HttpsUrl.optional(),
    amenities: Amenities,
    notes: z.string().optional(),
    offers: z.array(Offer).min(1),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.offers.forEach((o, i) => {
      if (seen.has(o.id)) {
        ctx.addIssue({ code: "custom", path: ["offers", i, "id"], message: `duplicate offer id "${o.id}"` });
      }
      seen.add(o.id);
    });
  });
export type Venue = z.output<typeof Venue>;
