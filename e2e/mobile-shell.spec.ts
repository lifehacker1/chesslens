import { test, expect } from "@playwright/test";
test("mobile tabs organise screens, preserve the game and persist comfort preferences", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "The app navigation is specific to mobile layouts.");
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "App navigation" });
  await expect(nav).toBeVisible();
  await expect(
    nav.getByRole("button", { name: "Review", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByLabel("Game PGN", { exact: true })).toBeHidden();
  await nav.getByRole("button", { name: "Games", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your games, all in one place." }),
  ).toBeVisible();
  const source = page.getByRole("group", { name: "Import source" });
  await source.getByRole("button", { name: "Chess.com", exact: true }).click();
  await expect(page.getByLabel("Chess.com username")).toBeVisible();
  await expect(page.getByLabel("Game PGN", { exact: true })).toBeHidden();
  await source.getByRole("button", { name: "PGN import", exact: true }).click();
  await page.screenshot({
    path: "test-results/mobile-games.png",
    fullPage: false,
  });
  await page
    .getByLabel("Game PGN", { exact: true })
    .fill("1. d4 d5 2. c4 e6 *");
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await expect(
    nav.getByRole("button", { name: "Review", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("status")).toContainText("Game loaded");
  await expect(
    page.getByRole("button", { name: "Better move", exact: true }),
  ).toBeVisible();
  const dial = page.getByRole("slider", { name: "Move dial" });
  await dial.focus();
  await dial.press("ArrowRight");
  await expect(dial).toHaveValue("1");
  await expect(page.locator(".move-dial")).toHaveClass(/is-scrubbing/);
  await expect(page.locator(".dial-feedback")).toHaveText("Move 1 of 4");
  await dial.press("End");
  await expect(page.locator(".dial-feedback")).toHaveText("End of game");
  await nav.getByRole("button", { name: "Insights", exact: true }).click();
  await expect(page.locator(".eval-graph-card")).toBeVisible();
  await expect(page.getByRole("region", { name: "Game board" })).toBeHidden();
  await nav.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByLabel("Analysis engine", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Reduce animations", { exact: false }),
  ).not.toBeChecked();
  await page.getByLabel("Reduce animations", { exact: false }).check();
  await page.getByLabel("Haptic move ticks", { exact: false }).check();
  await nav.getByRole("button", { name: "Review", exact: true }).click();
  await expect(dial).toHaveValue("4");
  await expect(page.locator(".app")).toHaveClass(/reduce-motion/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const box = await nav.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height + 1,
  );
  await page.reload();
  await nav.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByLabel("Reduce animations", { exact: false }),
  ).toBeChecked();
  await expect(
    page.getByLabel("Haptic move ticks", { exact: false }),
  ).toBeChecked();
  await page.screenshot({
    path: "test-results/mobile-settings.png",
    fullPage: true,
  });
  await nav.getByRole("button", { name: "Review", exact: true }).click();
  await page.screenshot({
    path: "test-results/mobile-app-navigation.png",
    fullPage: false,
  });
});

test("small phones keep controls and navigation within the viewport", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Small-screen layout test.");
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const nav = page.getByRole("navigation", { name: "App navigation" });
  for (const button of await nav.getByRole("button").all()) {
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  for (const button of await page
    .locator(".replay-navigation > button")
    .all()) {
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await nav.getByRole("button", { name: "Games", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
