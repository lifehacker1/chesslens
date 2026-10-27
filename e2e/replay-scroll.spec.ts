import { test, expect } from "@playwright/test";
test("list and roller share one bounded move cursor", async ({ page }) => {
  await page.goto("/");
  const content = page.getByLabel("Review content", { exact: true }),
    dial = page.getByRole("slider", { name: "Move dial" });
  await content.dispatchEvent("wheel", { deltaY: 1000 });
  await expect(dial).toHaveValue("3");
  await dial.dispatchEvent("wheel", { deltaY: -40 });
  await expect(dial).toHaveValue("2");
  await dial.focus();
  await dial.press("End");
  await expect(dial).toHaveValue("33");
  await expect(page.locator(".moves button.current")).toBeInViewport();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await dial.press("Home");
  await expect(dial).toHaveValue("0");
  const box = (await dial.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 2, {
    steps: 8,
  });
  await page.mouse.up();
  expect(Number(await dial.inputValue())).toBeLessThanOrEqual(3);
  expect(Number(await dial.inputValue())).toBeGreaterThan(0);
  await expect(page.locator(".move-feedback")).toHaveCount(0);
  await expect(
    page.locator(".replay-navigation .replay-better svg"),
  ).toHaveCount(1);
  await expect(content).toHaveCSS("overflow-y", "hidden");
});
