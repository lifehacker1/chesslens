import { test, expect } from "@playwright/test";
test("reviews the complete demo including the final checkmate", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Analyse game", exact: true }).click();
  await expect(
    page.getByText("Analysis complete. Explore your game below."),
  ).toBeVisible({ timeout: 90000 });
  await page
    .getByRole("button", { name: "Last position", exact: true })
    .click();
  await expect(page.getByText("Forced mate", { exact: true })).toBeVisible();
  await expect(page.getByLabel("White evaluation M0")).toBeVisible();
  await expect(page.getByText("No legal moves", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "First position", exact: true })
    .click();
  await page.getByRole("button", { name: "White Qb3", exact: false }).click();
  await page.screenshot({
    path: `test-results/demo-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("imports, replays, explores and analyses with real WASM", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Every move has a story." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(page.getByLabel("e4 White p", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "First position", exact: true })
    .click();
  await page.getByLabel("e2 White p", { exact: true }).click();
  await page.getByLabel("e4", { exact: true }).click();
  await expect(
    page.getByText("Exploring a variation", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Return to game" }).click();
  await page
    .getByLabel("Game PGN", { exact: true })
    .fill("1. e4 e5 2. Nf3 Nc6 *");
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await page.getByRole("button", { name: "Analyse game", exact: true }).click();
  await expect(
    page.getByText("Analysis complete. Explore your game below."),
  ).toBeVisible({ timeout: 90000 });
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(page.getByText("Depth 12", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Game summary", exact: true }).click();
  await expect(
    page.getByText("Full game review", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Game PGN", { exact: true }).fill("bad PGN");
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: `test-results/review-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("cancels stale analysis on import", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Analyse game", exact: true }).click();
  await page.getByLabel("Game PGN", { exact: true }).fill("1. d4 d5 *");
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Analyse game", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
});

test("imports a file with a black-to-move FEN start", async ({ page }) => {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "position.pgn",
    mimeType: "text/plain",
    buffer: Buffer.from(
      '[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/8/4K3 b - - 0 20"]\n\n20... Kf7 21. Kf2 *',
    ),
  });
  const rows = page.locator(".move-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("20.");
  await expect(rows.nth(0).getByRole("button")).toHaveAccessibleName(
    "Black Kf7",
  );
  await expect(rows.nth(1).getByRole("button")).toHaveAccessibleName(
    "White Kf2",
  );
});

test("loads and analyses offline after caching the app and engine", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await page.getByLabel("Game PGN", { exact: true }).fill("1. e4 e5 *");
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await page.getByRole("button", { name: "Analyse game", exact: true }).click();
  await expect(
    page.getByText("Analysis complete. Explore your game below."),
  ).toBeVisible({ timeout: 90000 });
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Every move has a story." }),
  ).toBeVisible();
  await page.getByLabel("Game PGN", { exact: true }).fill("1. d4 d5 *");
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await page.getByRole("button", { name: "Analyse game", exact: true }).click();
  await expect(
    page.getByText("Analysis complete. Explore your game below."),
  ).toBeVisible({ timeout: 90000 });
});
