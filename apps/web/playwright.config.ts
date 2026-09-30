import { defineConfig, devices } from "@playwright/test";

// Builds the site from fixture data into dist-e2e and serves it.
// --ignore-lock keeps `astro preview` in the foreground even when Astro
// detects an AI agent (it would otherwise auto-background and exit).
export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:4322", timezoneId: "Europe/Zurich", locale: "de-CH" },
  projects: [{ name: "phone", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "npx astro build && npx astro preview --port 4322 --ignore-lock",
    env: { DATA_DIR: "e2e/fixtures/data", OUT_DIR: "./dist-e2e", ASTRO_TELEMETRY_DISABLED: "1" },
    url: "http://localhost:4322",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
