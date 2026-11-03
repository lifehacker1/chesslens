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
    expect(initial!.width).toBeGreaterThan(
      (page.viewportSize()!.width - 48) * 0.93,
    );
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

  const pieceDesign = page.getByLabel("Piece finish", { exact: true });
  const preview = page.getByRole("group", {
    name: "Piece design preview",
    exact: true,
  });
  await expect(preview).toBeVisible();
  await expect(preview.locator(".finish-sculpted")).toHaveCount(12);
  await pieceDesign.focus();
  await pieceDesign.press("ArrowDown");
  await pieceDesign.press("Enter");
  await expect(pieceDesign).toHaveValue("flat");
  await expect(preview.locator(".finish-flat")).toHaveCount(12);
  await expect(preview.locator(".piece-highlight").first()).toHaveCSS(
    "opacity",
    "0",
  );
  await expect(page.locator(".board .finish-flat")).toHaveCount(32);
  await page.getByRole("button", { name: "Walnut", exact: true }).click();
  await expect(page.locator(".app")).toHaveAttribute(
    "data-board-theme",
    "walnut",
  );
  await page.reload();
  await expect(pieceDesign).toHaveValue("flat");
  await expect(preview.locator(".finish-flat")).toHaveCount(12);
  await expect(page.locator(".board .finish-flat")).toHaveCount(32);
  await pieceDesign.selectOption("sculpted");
  await expect(preview.locator(".finish-sculpted")).toHaveCount(12);
  await expect(page.locator(".board .finish-sculpted")).toHaveCount(32);
  await expect(preview.locator(".piece-highlight").first()).toHaveCSS(
    "opacity",
    "0.9",
  );
  await expect(page.locator(".app")).toHaveAttribute(
    "data-board-theme",
    "walnut",
  );
  const shapes = page.getByLabel("Piece design", { exact: true });
  let previousShape = await preview.locator("svg g").first().innerHTML();
  for (const design of ["tournament", "minimal"]) {
    await shapes.selectOption(design);
    await expect(preview.locator(".design-" + design)).toHaveCount(12);
    await expect(page.locator(".board .design-" + design)).toHaveCount(32);
    const nextShape = await preview.locator("svg g").first().innerHTML();
    expect(nextShape).not.toBe(previousShape);
    previousShape = nextShape;
  }
  await page.reload();
  await expect(shapes).toHaveValue("minimal");
  await expect(pieceDesign).toHaveValue("sculpted");
  await expect(page.locator(".board .design-minimal")).toHaveCount(32);
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await page
    .getByLabel("Game PGN", { exact: true })
    .fill("1. e4 e5 2. Nf3 Nc6 *");
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await expect(page.getByText("Analysis complete")).toBeVisible({
    timeout: 90000,
  });
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

  await page
    .getByLabel("Move quality on the board", { exact: false })
    .uncheck();
  await openMobileTab(page, "Review");
  await expect(page.locator(".board-move-badge")).toHaveCount(0);
});
