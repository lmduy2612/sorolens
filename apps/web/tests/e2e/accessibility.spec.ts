import { test } from "@playwright/test";
import { checkA11y, mockApi } from "./helpers";

test.describe("Automated Accessibility Audits (Axe Core)", () => {
  test("landing page meets WCAG accessibility guidelines", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await checkA11y(page);
  });

  test("contracts dashboard meets WCAG accessibility guidelines", async ({
    page,
  }) => {
    await mockApi(page);
    await page.goto("/contracts");
    await page.waitForLoadState("domcontentloaded");
    await checkA11y(page);
  });

  test("contract detail page meets WCAG accessibility guidelines", async ({
    page,
  }) => {
    await mockApi(page);
    await page.goto(
      "/contracts/CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    );
    await page.waitForLoadState("domcontentloaded");
    await checkA11y(page);
  });

  test("live activity page meets WCAG accessibility guidelines", async ({
    page,
  }) => {
    await mockApi(page);
    await page.goto("/live");
    await page.waitForLoadState("domcontentloaded");
    await checkA11y(page);
  });

  test("settings page meets WCAG accessibility guidelines", async ({
    page,
  }) => {
    await mockApi(page);
    await page.goto("/settings");
    await page.waitForLoadState("domcontentloaded");
    await checkA11y(page);
  });

  test("watchdog alerts page meets WCAG accessibility guidelines", async ({
    page,
  }) => {
    await mockApi(page);
    await page.goto("/watchdog");
    await page.waitForLoadState("domcontentloaded");
    await checkA11y(page);
  });

  test("watchdog notifications page meets WCAG accessibility guidelines", async ({
    page,
  }) => {
    await mockApi(page);
    await page.goto("/watchdog/notifications");
    await page.waitForLoadState("domcontentloaded");
    await checkA11y(page);
  });

  test("integrations page meets WCAG accessibility guidelines", async ({
    page,
  }) => {
    await mockApi(page);
    await page.goto("/integrations");
    await page.waitForLoadState("domcontentloaded");
    await checkA11y(page);
  });
});
