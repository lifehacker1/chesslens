import { test, expect } from "@playwright/test";
import { openMobileTab } from "./mobile-helpers";
test("unified review uses a full-width scrollbar below the board and keeps game summary exclusively in Insights", async ({
  page,
}) => {
  await page.goto("/");
  const rail = page.locator(".review-rail");
  const dial = page.getByRole("slider", { name: "Move dial" });
  const box = await rail.boundingBox();
  const board = await page.locator(".board").boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(board!.y + board!.height);
  expect(box!.width).toBeGreaterThan(board!.width * 0.9);
  expect(box!.height).toBeLessThan(80);
  await expect(page.locator(".replay-navigation input")).toHaveCount(0);
  await expect(page.locator(".unified-review .replay-navigation")).toHaveCount(
    1,
  );
  await expect(page.locator(".unified-review .evaluation")).toBeVisible();
  await expect(page.locator(".unified-review .moves")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Game summary", exact: true }),
  ).toBeHidden();
  await dial.focus();
  await dial.press("End");
  await expect(dial).toHaveValue("33");
  await dial.press("Home");
  await expect(dial).toHaveValue("0");
  await dial.scrollIntoViewIfNeeded();
  const inputBox = await dial.boundingBox();
  await page.mouse.click(
    inputBox!.x + inputBox!.width / 2,
    inputBox!.y + inputBox!.height / 2,
  );
  await expect
    .poll(async () => Number(await dial.inputValue()))
    .toBeGreaterThan(10);
  const ply = await dial.inputValue();
  await openMobileTab(page, "Insights");
  await expect(
    page.getByRole("region", { name: "Game summary", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".eval-graph-card")).toBeVisible();
  await expect(rail).toBeHidden();
  await page.screenshot({
    path: `test-results/organized-insights-${test.info().project.name}.png`,
    fullPage: true,
  });
  await openMobileTab(page, "Review");
  await expect(dial).toHaveValue(ply);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/unified-review-${test.info().project.name}.png`,
    fullPage: false,
  });
  await page.locator(".move-row").last().scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "Next move", exact: true }),
  ).toBeInViewport();
  const after = await rail.boundingBox();
  const pinnedBoard = await page.locator(".board").boundingBox();
  expect(after!.y).toBeGreaterThanOrEqual(pinnedBoard!.y + pinnedBoard!.height);
  expect(after!.height).toBe(box!.height);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
