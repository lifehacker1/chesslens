import { test, expect } from "@playwright/test";
import { openMobileTab } from "./mobile-helpers";
test("unified review keeps selected move when visiting Insights", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  const cursor = page.locator(".app");
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(cursor).toHaveAttribute("data-current-ply", "2");
  await expect(
    page.getByRole("dialog", { name: "Position details", exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("region", { name: "Game summary", exact: true }),
  ).toBeHidden();
  if (isMobile) {
    const board = await page.locator(".board").boundingBox(),
      rail = await page.locator(".replay-navigation").boundingBox();
    expect(rail!.y).toBeGreaterThanOrEqual(board!.y + board!.height);
  }
  await openMobileTab(page, "Insights");
  await expect(
    page.getByRole("region", { name: "Game summary", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".eval-graph-card")).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Move navigation", exact: true }),
  ).toBeHidden();
  await openMobileTab(page, "Review");
  await expect(cursor).toHaveAttribute("data-current-ply", "2");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
