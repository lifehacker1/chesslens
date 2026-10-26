import { test, expect } from "@playwright/test";
test("one replay bar and page-owned scrolling avoid nested scroll traps", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("group", { name: "Move navigation", exact: true }),
  ).toHaveCount(1);
  await expect(page.locator(".move-counter-badge")).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Move dial" })).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Better move", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Show better move", exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    const list = document.querySelector(".moves")!;
    window.scrollTo(0, list.getBoundingClientRect().top + scrollY - 120);
  });
  const style = await page.locator(".moves").evaluate((el) => ({
    overflow: getComputedStyle(el).overflowY,
    inner: el.clientHeight,
    content: el.scrollHeight,
  }));
  expect(style.overflow).toBe("visible");
  expect(style.content).toBeLessThanOrEqual(style.inner + 1);
  const board = await page.locator(".board-section").boundingBox();
  const x = Math.round(page.viewportSize()!.width * 0.65),
    y = Math.min(
      page.viewportSize()!.height - 100,
      Math.round(board!.y + board!.height + 65),
    );
  expect(
    await page.evaluate(
      ({ x, y }) => !!document.elementFromPoint(x, y)?.closest(".moves"),
      { x, y },
    ),
  ).toBe(true);
  await page.mouse.move(x, y);
  const before = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 180);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);
  expect(await page.locator(".moves").evaluate((el) => el.scrollTop)).toBe(0);
  const dial = page.getByRole("slider", { name: "Move dial" });
  await expect(dial).toHaveAttribute("aria-orientation", "vertical");
  await dial.hover();
  const top = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 60);
  await expect(dial).toHaveValue("1");
  expect(await page.evaluate(() => scrollY)).toBe(top);
  await dial.press("ArrowDown");
  await expect(dial).toHaveValue("2");
  await dial.press("ArrowUp");
  await expect(dial).toHaveValue("1");
  await expect(page.locator(".evaluation .replay-better")).toHaveCount(1);
  await expect(page.locator(".replay-navigation .replay-better")).toHaveCount(
    0,
  );
  await page.screenshot({
    path: `test-results/compact-replay-${test.info().project.name}.png`,
    fullPage: false,
  });
});
