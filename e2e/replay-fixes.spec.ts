import { test, expect } from "@playwright/test";
import { clickReviewTool } from "./mobile-helpers";

test("navigation, autoplay and direct selection request haptics", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "chesslens-touch",
      JSON.stringify({ haptics: true, sounds: false }),
    );
    (window as any).vibrations = [];
    Object.defineProperty(navigator, "vibrate", {
      value: (value: number) => {
        (window as any).vibrations.push(value);
        return true;
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await page
    .getByRole("button", { name: "Previous move", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Auto-play review", exact: true })
    .click();
  await page.getByRole("button", { name: "Pause review", exact: true }).click();
  expect(await page.evaluate(() => (window as any).vibrations.length)).toBe(4);
  const before = await page.evaluate(() => (window as any).vibrations.length);
  await page.getByRole("button", { name: /^White e4/ }).click();
  expect(await page.evaluate(() => (window as any).vibrations.length)).toBe(
    before + 1,
  );
  await expect(page.locator('[data-square="e2"]')).toHaveClass(/move-origin/);
  await expect(page.locator('[data-square="e4"]')).toHaveClass(
    /move-destination/,
  );
});

test("variation highlights follow each preview and restore recorded move", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Analysis complete", { exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await page.getByRole("button", { name: "Better move", exact: true }).click();
  await expect(page.locator(".square.move-origin")).toHaveCount(1);
  await expect(page.locator(".square.move-destination")).toHaveCount(1);
  const first = await page
    .locator(".square.move-destination")
    .getAttribute("data-square");
  await page.getByRole("button", { name: /Alternative 1 step 2:/ }).click();
  await expect(page.locator(".square.move-destination")).not.toHaveAttribute(
    "data-square",
    first!,
  );
  await clickReviewTool(page, "Flip board");
  await expect(page.locator(".square.move-origin")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Return to game", exact: true })
    .click();
  await expect(page.locator('[data-square="e2"]')).toHaveClass(/move-origin/);
  await expect(page.locator('[data-square="e4"]')).toHaveClass(
    /move-destination/,
  );
  await clickReviewTool(page, "First position");
  await page.getByLabel("e2 White p", { exact: true }).click();
  await page.getByLabel("e4", { exact: true }).click();
  await expect(page.locator('[data-square="e2"]')).toHaveClass(/move-origin/);
  await expect(page.locator('[data-square="e4"]')).toHaveClass(
    /move-destination/,
  );
});
