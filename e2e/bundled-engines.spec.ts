import { test, expect } from "@playwright/test";
import { openMobileTab, clickReviewTool } from "./mobile-helpers";
for (const engine of ["lozza-12.1-nnue", "lozza-12.1-hce"])
  test(`${engine} reviews a complete game offline with real local worker`, async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true);
    await openMobileTab(page, "Games");
    await page
      .getByLabel("Game PGN", { exact: true })
      .fill("1. f3 e5 2. g4 Qh4# *");
    await page
      .getByRole("button", { name: "Import game", exact: true })
      .click();
    await openMobileTab(page, "Settings");
    await page
      .getByLabel("Analysis engine", { exact: true })
      .selectOption(engine);
    await page
      .getByLabel("Review speed", { exact: true })
      .selectOption("quick");
    await page.getByLabel("Candidate lines", { exact: true }).selectOption("3");
    await openMobileTab(page, "Review");
    await context.setOffline(true);
    await expect(
      page.getByText("Analysis complete", {
        exact: true,
      }),
    ).toBeVisible({ timeout: 90000 });
    const cursor = page.locator(".app");
    await clickReviewTool(page, "Last position");
    await expect(page.locator(".eval-number")).toContainText("Forced mate");
    await clickReviewTool(page, "First position");
    await page.getByRole("button", { name: "Next move", exact: true }).click();
    await page
      .getByRole("button", { name: "Better move", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Preview alternative 1", exact: true }),
    ).toBeVisible();
    expect(await page.locator(".alternative-line").count()).toBeGreaterThan(1);
    await context.setOffline(false);
  });
