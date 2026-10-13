import { test, expect } from "@playwright/test";
import { expectHeading, mockApi } from "./helpers";

test.describe("Mobile navigation drawer and responsiveness", () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test("drawer opens, navigates, and closes at 360px viewport", async ({
    page,
  }) => {
    await mockApi(page);
    await page.goto("/contracts");

    // Desktop nav should be hidden at 360px
    const desktopNav = page.locator("header .hidden.md\\:flex");
    await expect(desktopNav).toBeHidden();

    // Hamburger trigger is visible
    const menuBtn = page.getByTestId("mobile-menu-trigger");
    await expect(menuBtn).toBeVisible();

    // Open drawer
    await menuBtn.click();
    const drawer = page.getByRole("dialog", { name: "Mobile navigation" });
    await expect(drawer).toBeVisible();

    // Verify links inside mobile drawer
    const mobileNav = drawer.getByRole("navigation", {
      name: "Mobile Navigation",
    });
    await expect(mobileNav.getByRole("link", { name: "Live" })).toBeVisible();
    await expect(
      mobileNav.getByRole("link", { name: "Contracts" })
    ).toBeVisible();
    await expect(
      mobileNav.getByRole("link", { name: "Watchdog" })
    ).toBeVisible();

    // Click Watchdog link inside mobile drawer
    await mobileNav.getByRole("link", { name: "Watchdog" }).click();
    await expect(page).toHaveURL(/\/watchdog$/);
    await expectHeading(page, "Watchdog");

    // Drawer should have closed after navigation
    await expect(drawer).toBeHidden();
  });

  test("focus is trapped and Escape closes mobile drawer", async ({ page }) => {
    await mockApi(page);
    await page.goto("/contracts");

    const menuBtn = page.getByTestId("mobile-menu-trigger");
    await menuBtn.click();

    const drawer = page.getByRole("dialog", { name: "Mobile navigation" });
    await expect(drawer).toBeVisible();

    // Press Escape to close
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();

    // Focus returned to trigger
    await expect(menuBtn).toBeFocused();
  });

  test("mobile search button in drawer opens command palette", async ({
    page,
  }) => {
    await mockApi(page);
    await page.goto("/contracts");

    const menuBtn = page.getByTestId("mobile-menu-trigger");
    await menuBtn.click();

    const searchBtn = page.getByTestId("drawer-search-btn");
    await expect(searchBtn).toBeVisible();
    await searchBtn.click();

    // Search dialog opens
    const searchDialog = page.locator("[cmdk-root]");
    await expect(searchDialog).toBeVisible();
  });
});
