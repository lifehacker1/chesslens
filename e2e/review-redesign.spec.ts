import { test, expect } from "@playwright/test";
import { openMobileTab } from "./mobile-helpers";
test("automatic review runs once and survives navigation without duplicate jobs", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Original = window.Worker;
    (window as any).engineStarts = 0;
    window.Worker = class extends Original {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        (window as any).engineStarts++;
      }
    };
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Stop analysis", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Stop analysis", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop analysis", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/Analysis stopped/)).toBeVisible();
  await openMobileTab(page, "Insights");
  await openMobileTab(page, "Review");
  expect(await page.evaluate(() => (window as any).engineStarts)).toBe(1);
  await openMobileTab(page, "Games");
  await page
    .getByLabel("Game PGN", { exact: true })
    .fill("1. f3 e5 2. g4 Qh4# *");
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await expect(
    page.getByText("Analysis complete", { exact: true }),
  ).toBeVisible({ timeout: 90000 });
  expect(await page.evaluate(() => (window as any).engineStarts)).toBe(2);
  await expect(
    page.getByRole("progressbar", { name: "Analysis progress", exact: true }),
  ).toHaveAttribute("aria-valuemax", "5");
  await expect(
    page.getByRole("progressbar", { name: "Analysis progress", exact: true }),
  ).toHaveAttribute("aria-valuenow", "5");
});
test("vertical dial, compact feedback and optional details preserve a stable board", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Analysis complete", { exact: true }),
  ).toBeVisible({ timeout: 90000 });
  const dial = page.getByRole("slider", { name: "Move dial" });
  await expect(dial).toHaveAttribute("aria-orientation", "vertical");
  const board = await page.locator(".board").boundingBox(),
    rail = await page.locator(".review-rail").boundingBox();
  if (isMobile)
    expect(rail!.y).toBeGreaterThanOrEqual(board!.y + board!.height);
  await expect(
    page.getByRole("dialog", { name: "Position details", exact: true }),
  ).toBeHidden();
  await dial.focus();
  await dial.press("ArrowDown");
  await expect(dial).toHaveValue("1");
  await page
    .getByRole("button", { name: "Position details", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Position details", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(dial).toHaveValue("1");
  await page
    .getByRole("button", { name: "Close position details", exact: true })
    .click();
  await page.getByRole("button", { name: "Better move", exact: true }).click();
  await expect(
    page.getByText("Alternative preview", { exact: true }),
  ).toBeVisible();
  expect((await page.locator(".board").boundingBox())!.width).toBeCloseTo(
    board!.width,
    0,
  );
  await page.getByRole("button", { name: /Alternative 1 step 2:/ }).click();
  await expect(
    page.getByRole("button", { name: "Return to game", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Return to game", exact: true })
    .click();
  await expect(page.locator(".moves")).toBeVisible();
  const content = page.getByLabel("Review content", { exact: true });
  const initial = await content.evaluate((el) => el.scrollTop);
  await content.hover();
  await page.mouse.wheel(0, 250);
  await expect
    .poll(() => content.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(initial);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.screenshot({
    path: `test-results/review-redesign-${test.info().project.name}.png`,
  });
  await openMobileTab(page, "Insights");
  await expect(
    page.getByRole("region", { name: "Game summary", exact: true }),
  ).toBeVisible();
  await expect(dial).toBeHidden();
});
