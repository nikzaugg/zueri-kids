import { expect, test, type Page } from "@playwright/test";

// Tuesday 20 Oct 2026, 10:15 in Zurich.
async function openDay(page: Page, path = "/") {
  await page.clock.setFixedTime(new Date("2026-10-20T08:15:00Z"));
  await page.goto(path);
  await expect(page.getByText("Krabbeltreff Alpha").first()).toBeVisible();
}

test("REQ-WEB-080 REQ-WEB-052: day view loads, filters, groups by venue and opens a detail page", async ({ page }) => {
  await openDay(page);
  await expect(page.getByText("Musikkurs Alpha").first()).toBeVisible();
  await expect(page.getByText("3 von 3 Angeboten passen zu deinen Filtern")).toBeVisible();

  await page.getByRole("button", { name: "Ohne Anmeldung" }).click();
  await expect(page.getByText("2 von 3 Angeboten passen zu deinen Filtern")).toBeVisible();
  await expect(page.getByText("Musikkurs Alpha")).toHaveCount(0);

  await page.getByRole("button", { name: "Nach Ort" }).click();
  await expect(page.getByRole("heading", { name: "GZ Alpha" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Spielhalle Beta" })).toBeVisible();

  await page.getByRole("button", { name: "Nach Zeit" }).click();
  await page.getByRole("button", { name: /Krabbeltreff Alpha/ }).click();
  await page.getByRole("link", { name: "Alle Details" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Krabbeltreff Alpha" })).toBeVisible();
});

test("REQ-WEB-019: the card view shows one card per occurrence", async ({ page }) => {
  await openDay(page);
  await page.getByRole("button", { name: "Karten" }).click();
  await expect(page.locator(".card")).toHaveCount(3);
});

test("REQ-WEB-021: tapping a venue name filters to that venue", async ({ page }) => {
  await openDay(page);
  await page.locator(".meta").getByRole("button", { name: "Spielhalle Beta" }).click();
  await expect(page.getByRole("button", { name: "Filter Spielhalle Beta entfernen" })).toBeVisible();
  await expect(page.getByText("1 Angebot an diesem Ort")).toBeVisible();
  await expect(page).toHaveURL(/ort=spielhalle-beta/);
});

test("REQ-WEB-017: the hour axis stays visible while scrolling", async ({ page }) => {
  await openDay(page);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator("header .axis")).toBeInViewport();
});

test("REQ-WEB-002: serves the data bundle", async ({ request }) => {
  const res = await request.get("/bundle.json");
  expect(res.ok()).toBe(true);
  expect((await res.json()).venues).toHaveLength(2);
});

test("REQ-WEB-041: generates one static page per offer", async ({ request }) => {
  for (const path of ["/angebot/gz-alpha/krabbeltreff/", "/angebot/gz-alpha/musikkurs/", "/angebot/spielhalle-beta/halle/"]) {
    expect((await request.get(path)).status()).toBe(200);
  }
});

test("REQ-WEB-040: the detail page shows facts and next dates", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-20T08:15:00Z"));
  await page.goto("/angebot/gz-alpha/krabbeltreff/");
  await expect(page.getByText("bis 3 J.")).toBeVisible();
  await expect(page.getByText("Keine Anmeldung nötig")).toBeVisible();
  await expect(page.getByText("Di 20.10. · 09:30–11:00")).toBeVisible();
  await expect(page.getByRole("button", { name: "Zu Meine Orte hinzufügen" })).toBeVisible();
});

test("REQ-WEB-071: no horizontal scrolling at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.clock.setFixedTime(new Date("2026-10-20T08:15:00Z"));
  for (const path of ["/", "/woche/", "/suche/", "/einstellungen/", "/angebot/gz-alpha/krabbeltreff/"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width, path).toBeLessThanOrEqual(360);
  }
});
