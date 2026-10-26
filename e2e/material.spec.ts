import { test, expect } from "@playwright/test";
import { openMobileTab, clickReviewTool } from "./mobile-helpers";
test("captured rows and material lead follow replay, flip and variations", async ({
  page,
}) => {
  await page.goto("/");
  await openMobileTab(page, "Games");
  await page
    .getByLabel("Game PGN", { exact: true })
    .fill("1. e4 d5 2. exd5 Qxd5 *");
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await expect(page.locator(".material-advantage")).toHaveCount(0);
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Next move", exact: true }).click();
  const white = page.getByRole("group", {
    name: "White captured pieces",
    exact: true,
  });
  const black = page.getByRole("group", {
    name: "Black captured pieces",
    exact: true,
  });
  await expect(
    white.getByRole("img", { name: "1 Black pawn captured" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("White material advantage +1", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".material-advantage")).toHaveCount(1);
  await clickReviewTool(page, "Flip board");
  await expect(
    page
      .locator(".player")
      .first()
      .getByRole("group", { name: "White captured pieces", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("White material advantage +1", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("d8 Black q", { exact: true }).click();
  await page.getByLabel("d5 White p", { exact: true }).click();
  await expect(
    black.getByRole("img", { name: "1 White pawn captured" }),
  ).toBeVisible();
  await expect(page.locator(".material-advantage")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Return to game", exact: true })
    .click();
  await expect(black.getByRole("img")).toHaveCount(0);
  await expect(
    page.getByLabel("White material advantage +1", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/material-${test.info().project.name}.png`,
    fullPage: false,
  });
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(
    black.getByRole("img", { name: "1 White pawn captured" }),
  ).toBeVisible();
  await expect(page.locator(".material-advantage")).toHaveCount(0);
  await clickReviewTool(page, "First position");
  await expect(white.getByRole("img")).toHaveCount(0);
  await expect(black.getByRole("img")).toHaveCount(0);
});
