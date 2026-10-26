import { test, expect } from "@playwright/test";
import { openMobileTab, clickReviewTool } from "./mobile-helpers";
test("full-width board, focus view, saved themes and destination-square grades", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  const board = page.locator(".board");
  const initial = await board.boundingBox();
  if (isMobile)
    expect(initial!.width).toBeGreaterThan(page.viewportSize()!.width * 0.93);
  await clickReviewTool(page, "Expand board");
  await expect(
    page.getByRole("dialog", { name: "Game board", exact: true }),
  ).toBeVisible();
  const overlay = await page
    .getByRole("dialog", { name: "Game board", exact: true })
    .boundingBox();
  expect(overlay!.height).toBeGreaterThanOrEqual(
    page.viewportSize()!.height - 1,
  );
  expect(overlay!.y).toBe(0);
  const focus = await board.boundingBox();
  expect(focus!.width).toBeGreaterThan(0);
  expect(focus!.y).toBeGreaterThanOrEqual(0);
  expect(focus!.y + focus!.height).toBeLessThan(page.viewportSize()!.height);
  await page.screenshot({
    path: `test-results/board-focus-${test.info().project.name}.png`,
    fullPage: false,
  });
  const exit = page.getByRole("button", {
    name: "Exit focus view",
    exact: true,
  });
  await expect(exit).toBeVisible();
  await exit.click();
  await expect(page.locator(".board-focused")).toHaveCount(0);
  await openMobileTab(page, "Settings");
  if (!isMobile)
    await page.getByText("Board & review appearance", { exact: true }).click();
  await page.getByRole("button", { name: "Walnut", exact: true }).click();
  await expect(page.locator(".app")).toHaveAttribute(
    "data-board-theme",
    "walnut",
  );
  await page.reload();
  await expect(page.locator(".app")).toHaveAttribute(
    "data-board-theme",
    "walnut",
  );
  await openMobileTab(page, "Games");
  await page
    .getByLabel("Game PGN", { exact: true })
    .fill("1. e4 e5 2. Nf3 Nc6 *");
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await page.getByRole("button", { name: "Analyse game", exact: true }).click();
  await expect(
    page.getByText("Analysis complete. Explore your game below."),
  ).toBeVisible({ timeout: 90000 });
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(page.locator(".square.last .board-move-badge")).toHaveCount(1);
  await expect(page.locator(".board-move-badge")).toHaveAttribute(
    "aria-label",
    /accuracy/,
  );
  const square = await page
    .locator(".board-move-badge")
    .evaluate((el) => el.closest("button")?.getAttribute("aria-label"));
  expect(square).toContain("e4 White p");
  await clickReviewTool(page, "Flip board");
  await expect(page.locator(".board-move-badge")).toHaveCount(1);
  await page.screenshot({
    path: `test-results/board-theme-${test.info().project.name}.png`,
    fullPage: false,
  });
  await openMobileTab(page, "Settings");
  if (!isMobile)
    await page.getByText("Board & review appearance", { exact: true }).click();
  await page
    .getByLabel("Move quality on the board", { exact: false })
    .uncheck();
  await openMobileTab(page, "Review");
  await expect(page.locator(".board-move-badge")).toHaveCount(0);
});
