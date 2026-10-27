import { test, expect } from "@playwright/test";
import { openMobileTab } from "./mobile-helpers";
test("review keeps engine options in settings and animates adjacent moves accessibly", async ({
  page,
  isMobile,
}) => {
  await page.addInitScript(() => {
    const original = Element.prototype.animate;
    (window as any).moveAnimations = [];
    Element.prototype.animate = function (frames, options) {
      if (this.classList.contains("piece"))
        (window as any).moveAnimations.push({
          square: this.parentElement?.getAttribute("data-square"),
          duration: (options as KeyframeAnimationOptions)?.duration,
        });
      return original.call(this, frames, options);
    };
  });
  await page.goto("/");
  await expect(page.locator(".evaluation .engine-settings")).toHaveCount(0);
  if (isMobile)
    await expect(
      page.getByLabel("Analysis engine", { exact: true }),
    ).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Stop analysis", exact: true }),
  ).toBeVisible();
  const cursor = page.locator(".app");
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(cursor).toHaveAttribute("data-current-ply", "1");
  expect(
    await page.evaluate(() => (window as any).moveAnimations),
  ).toContainEqual({ square: "e4", duration: 420 });
  await expect(page.locator('[data-square="e4"]')).toHaveClass(
    /move-destination/,
  );
  await expect(page.locator('[data-square="e2"]')).toHaveClass(/move-origin/);
  await page
    .getByRole("button", { name: "Previous move", exact: true })
    .click();
  expect(
    await page.evaluate(() => (window as any).moveAnimations),
  ).toContainEqual({ square: "e2", duration: 420 });
  await openMobileTab(page, "Settings");
  await expect(
    page.getByLabel("Analysis engine", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Reduce animations", { exact: false }).check();
  await openMobileTab(page, "Review");
  await page.evaluate(() => ((window as any).moveAnimations = []));
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  expect(await page.evaluate(() => (window as any).moveAnimations)).toEqual([]);
});
