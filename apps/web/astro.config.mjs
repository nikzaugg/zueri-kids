import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";

// SITE_URL / BASE_PATH are set by CI for GitHub Pages; OUT_DIR lets e2e
// tests build fixture data without touching dist/.
export default defineConfig({
  site: process.env.SITE_URL || "http://localhost:4321",
  base: process.env.BASE_PATH || "/",
  outDir: process.env.OUT_DIR || "./dist",
  integrations: [preact()],
});
