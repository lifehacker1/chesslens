import { openMobileTab, clickReviewTool } from "./mobile-helpers";
import { test, expect } from "@playwright/test";
test("sticky board, dial, per-move accuracy, options and alternatives", async ({
  page,
}) => {
  await page.goto("/");
  await openMobileTab(page, "Games");
  await page
    .getByLabel("Game PGN", { exact: true })
    .fill("1. f3 e5 2. g4 Qh4# *");
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await page.getByText("Engine & analysis options", { exact: true }).click();
  await page.getByLabel("Review speed", { exact: true }).selectOption("quick");
  await page.getByLabel("Candidate lines", { exact: true }).selectOption("3");
  await page.getByRole("button", { name: "Analyse game", exact: true }).click();
  await expect(
    page.getByText("Analysis complete. Explore your game below."),
  ).toBeVisible({ timeout: 90000 });
  const dial = page.getByRole("slider", { name: "Move dial" });
  await dial.focus();
  await dial.press("ArrowRight");
  await expect(dial).toHaveValue("1");
  await expect(page.getByLabel("Selected move accuracy")).toHaveText(
    /\d+% accuracy/,
  );
  await expect(page.locator(".move-cell .move-accuracy").first()).toHaveText(
    /\d+% accuracy/,
  );
  await page.getByRole("button", { name: "Better move", exact: true }).click();
  await expect(
    page.getByText("Compare engine choices", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview alternative 1", exact: true }),
  ).toBeVisible();
  expect(await page.locator(".alternative-line").count()).toBeGreaterThan(1);
  await page.getByRole("button", { name: /Alternative 1 step 2:/ }).click();
  await expect(
    page.getByText("Exploring a variation", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Return to played position", exact: true })
    .click();
  await expect(
    page.getByText("Exploring a variation", { exact: false }),
  ).toHaveCount(0);
  const better = page.getByRole("button", { name: "Better move", exact: true });
  await better.click();
  await expect(
    page.getByRole("region", { name: "Alternative moves", exact: true }),
  ).toBeHidden();
  await expect(better).toHaveAttribute("aria-expanded", "false");
  await better.click();
  await expect(better).toHaveAttribute("aria-expanded", "true");
  await page
    .getByRole("button", { name: "Return to played position", exact: true })
    .click();
  await page.evaluate(() => {
    const workspace = document.querySelector(".workspace")!;
    window.scrollTo(
      0,
      workspace.getBoundingClientRect().top + window.scrollY + 100,
    );
  });
  const board = page.getByRole("region", { name: "Game board" });
  const before = await board.boundingBox();
  await page.mouse.move((page.viewportSize()?.width || 390) - 8, 650);
  await page.mouse.wheel(0, 100);
  await expect
    .poll(async () => Math.round((await board.boundingBox())!.y))
    .toBe(Math.round(before!.y));
  const nav = await page.locator(".navigation").boundingBox();
  expect(nav!.y + nav!.height).toBeLessThan(page.viewportSize()!.height);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/sticky-review-${test.info().project.name}.png`,
    fullPage: false,
  });
  await page.getByLabel("Candidate lines", { exact: true }).selectOption("1");
  await expect(
    page.getByRole("progressbar", { name: "Analysis progress", exact: true }),
  ).toHaveAttribute("aria-valuenow", "0");
});
