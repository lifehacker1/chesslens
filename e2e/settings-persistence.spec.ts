import { test, expect } from "@playwright/test";
import { openMobileTab, clickReviewTool } from "./mobile-helpers";
test("settings restores expanded sections, scroll position, drafts and all engine controls", async ({
  page,
}) => {
  await page.goto("/");
  await openMobileTab(page, "Settings");
  await page.getByLabel("Review speed", { exact: true }).selectOption("deep");
  await page.getByLabel("Candidate lines", { exact: true }).selectOption("5");
  await page.getByLabel("Engine memory", { exact: true }).selectOption("64");
  await page.getByLabel("Reuse analysed positions", { exact: false }).uncheck();
  await page.locator('[data-setting-section="appearance"] > summary').click();
  await page.locator('[data-setting-section="registration"] > summary').click();
  await page.getByLabel("Engine name", { exact: true }).fill("My engine draft");
  await page
    .getByLabel("Worker path", { exact: true })
    .fill("./engine/draft.js");
  const oldScroll = await page.evaluate(() => scrollY);
  await page.reload();
  await expect(page.locator(".app")).toHaveAttribute(
    "data-mobile-view",
    "settings",
  );
  await expect(
    page.locator('[data-setting-section="appearance"]'),
  ).not.toHaveAttribute("open");
  await expect(
    page.locator('[data-setting-section="registration"]'),
  ).toHaveAttribute("open");
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeGreaterThan(Math.max(0, oldScroll - 100));
  await expect(page.getByLabel("Engine name", { exact: true })).toHaveValue(
    "My engine draft",
  );
  await expect(page.getByLabel("Worker path", { exact: true })).toHaveValue(
    "./engine/draft.js",
  );
  await expect(page.getByLabel("Review speed", { exact: true })).toHaveValue(
    "deep",
  );
  await expect(page.getByLabel("Candidate lines", { exact: true })).toHaveValue(
    "5",
  );
  await expect(page.getByLabel("Engine memory", { exact: true })).toHaveValue(
    "64",
  );
  await expect(
    page.getByLabel("Reuse analysed positions", { exact: false }),
  ).not.toBeChecked();
  await openMobileTab(page, "Games");
  await openMobileTab(page, "Settings");
  await expect(page.getByLabel("Engine name", { exact: true })).toHaveValue(
    "My engine draft",
  );
});
test("review display preferences survive reload and reset settings keeps the game", async ({
  page,
}) => {
  await page.goto("/");
  await clickReviewTool(page, "Toggle tactical arrows");
  await page
    .getByRole("button", { name: "Critical only", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Critical only", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.locator(".replay-menu summary").click();
  await expect(
    page.getByRole("button", { name: "Toggle tactical arrows", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await openMobileTab(page, "Settings");
  await page
    .getByRole("button", { name: "Reset settings", exact: true })
    .click();
  await openMobileTab(page, "Review");
  await expect(
    page.getByRole("button", { name: "Critical only", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});
