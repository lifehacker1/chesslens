import { test, expect } from "@playwright/test";
test("review content owns scrolling and the vertical dial owns scrubbing", async ({
  page,
}) => {
  await page.goto("/");
  const content = page.getByLabel("Review content", { exact: true }),
    dial = page.getByRole("slider", { name: "Move dial" });
  await expect(dial).toHaveAttribute("aria-orientation", "vertical");
  await content.hover();
  await page.mouse.wheel(0, 250);
  await expect
    .poll(() => content.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  const top = await content.evaluate((el) => el.scrollTop);
  await dial.hover();
  await page.mouse.wheel(0, 60);
  await expect(dial).toHaveValue("1");
  expect(await content.evaluate((el) => el.scrollTop)).toBe(top);
  await dial.focus();
  await dial.press("End");
  await expect(dial).toHaveValue("33");
  await dial.press("Home");
  await expect(dial).toHaveValue("0");
  await expect(page.locator(".replay-navigation .replay-better")).toHaveCount(
    1,
  );
  await expect(page.locator(".review-content .engine-settings")).toHaveCount(0);
});
