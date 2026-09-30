import { z } from "zod";
import { IsoDate } from "./common";

const SchoolHoliday = z
  .strictObject({ name: z.string().min(1), from: IsoDate, to: IsoDate })
  .superRefine((h, ctx) => {
    if (h.from > h.to) ctx.addIssue({ code: "custom", path: ["to"], message: "must not be before from" });
  });

export const Holidays = z.strictObject({
  schoolHolidays: z.array(SchoolHoliday),
  publicHolidays: z.array(z.strictObject({ name: z.string().min(1), date: IsoDate })),
});
export type Holidays = z.output<typeof Holidays>;
