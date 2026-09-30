import type { APIRoute } from "astro";
import { getBundle } from "../data/bundle";

export const GET: APIRoute = () =>
  new Response(JSON.stringify(getBundle()), { headers: { "Content-Type": "application/json" } });
