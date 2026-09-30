import { z } from "zod";
import { isValidDate } from "../dates";

export const Id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be lowercase kebab-case");

export const IsoDate = z.string().refine(isValidDate, "must be a valid date YYYY-MM-DD");

export const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:MM (24h)");

export const HttpsUrl = z.string().refine((s) => {
  try {
    return new URL(s).protocol === "https:";
  } catch {
    return false;
  }
}, "must be an absolute https:// URL");
