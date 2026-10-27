import { test, expect } from "@playwright/test";
import { clickReviewTool } from "./mobile-helpers";
test("native move-list scrolling does not change the position", async ({
  page,
}) => {
  await page.goto("/");
  const content = page.getByLabel("Review content", { exact: true });
  await expect(content).toBeVisible();
  await expect(page.getByRole("slider", { name: "Move dial" })).toHaveCount(0);
  await expect(content).toHaveCSS("overflow-y", "auto");
  await expect(content).toHaveCSS("touch-action", "pan-y");
  await content.hover();
  await page.mouse.wheel(0, 1000);
  await expect
    .poll(() => content.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  await expect(page.locator(".app")).toHaveAttribute("data-current-ply", "0");
  await clickReviewTool(page, "Last position");
  await expect(page.locator(".app")).toHaveAttribute("data-current-ply", "33");
  await expect(page.locator(".moves button.current")).toBeInViewport();
  await page
    .getByRole("button", { name: "Previous move", exact: true })
    .click();
  await expect(page.locator(".app")).toHaveAttribute("data-current-ply", "32");
});
