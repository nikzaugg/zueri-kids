import { joinBase } from "../lib/paths";

export const href = (path: string): string => joinBase(import.meta.env.BASE_URL, path);
