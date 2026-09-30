import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts"],
    // Run tests in a time zone far from Zurich to prove date logic is
    // time-zone independent (REQ-OCC-009, REQ-WEB-003).
    env: { TZ: "America/Los_Angeles" },
  },
});
