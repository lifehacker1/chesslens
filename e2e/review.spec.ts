import { openMobileTab, clickReviewTool } from "./mobile-helpers";
import { test, expect } from "@playwright/test";
test("reviews the complete demo including the final checkmate", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Analysis complete")).toBeVisible({
    timeout: 90000,
  });
  await clickReviewTool(page, "Last position");

  await expect(page.getByLabel("White evaluation M0")).toBeVisible();
  await clickReviewTool(page, "Position details");
  await expect(page.getByText("Forced mate", { exact: true })).toBeVisible();
  await expect(page.getByText("No legal moves", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Close position details", exact: true })
    .click();
  await clickReviewTool(page, "First position");
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
    page.getByRole("region", { name: "Game board", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(page.getByLabel("e4 White p", { exact: true })).toBeVisible();
  await clickReviewTool(page, "First position");
  await page.getByLabel("e2 White p", { exact: true }).click();
  await page.getByLabel("e4", { exact: true }).click();
  await expect(
    page.getByText("Alternative preview", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Return to game" }).click();
  await openMobileTab(page, "Games");
  await page
    .getByLabel("Game PGN", { exact: true })
    .fill("1. e4 e5 2. Nf3 Nc6 *");
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await expect(page.getByText("Analysis complete")).toBeVisible({
    timeout: 90000,
  });
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await clickReviewTool(page, "Position details");
  await expect(page.getByText(/Depth 12/)).toBeVisible();
  await page
    .getByRole("button", { name: "Close position details", exact: true })
    .click();
  await openMobileTab(page, "Insights");
  await expect(
    page.getByText("Full game review", { exact: true }),
  ).toBeVisible();
  await openMobileTab(page, "Games");
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
  await openMobileTab(page, "Games");
  await page.getByLabel("Game PGN", { exact: true }).fill("1. d4 d5 *");
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Next move", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Analysis progress", exact: true }),
  ).toHaveAttribute("aria-valuemax", "3");
});

test("imports a file with a black-to-move FEN start", async ({ page }) => {
  await page.goto("/");
  await openMobileTab(page, "Games");
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
  await openMobileTab(page, "Games");
  await page.getByLabel("Game PGN", { exact: true }).fill("1. e4 e5 *");
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await expect(page.getByText("Analysis complete")).toBeVisible({
    timeout: 90000,
  });
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Game board", exact: true }),
  ).toBeVisible();
  await openMobileTab(page, "Games");
  await page.getByLabel("Game PGN", { exact: true }).fill("1. d4 d5 *");
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await expect(page.getByText("Analysis complete")).toBeVisible({
    timeout: 90000,
  });
});

test("fetches and reviews a game directly from Chess.com", async ({ page }) => {
  await page.route(
    "https://api.chess.com/pub/player/testplayer",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          username: "testplayer",
          name: "Test Player",
          title: "GM",
        }),
      });
    },
  );

  await page.route(
    "https://api.chess.com/pub/player/testplayer/games/archives",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          archives: [
            "https://api.chess.com/pub/player/testplayer/games/2026/10",
          ],
        }),
      });
    },
  );

  await page.route(
    "https://api.chess.com/pub/player/testplayer/games/2026/10",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          games: [
            {
              url: "https://www.chess.com/game/live/123456",
              pgn: '[Event "Live Chess"]\n[White "testplayer"]\n[Black "grandmaster"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O 1-0',
              time_control: "180+2",
              time_class: "blitz",
              rules: "chess",
              rated: true,
              end_time: 1792942103,
              white: { username: "testplayer", rating: 2800, result: "win" },
              black: {
                username: "grandmaster",
                rating: 2750,
                result: "resigned",
              },
              eco: "C68",
            },
          ],
        }),
      });
    },
  );

  await page.goto("/");
  await openMobileTab(page, "Games");
  const source = page.getByRole("group", { name: "Import source" });
  if (await source.isVisible())
    await source
      .getByRole("button", { name: "Chess.com", exact: true })
      .click();
  await page.getByLabel("Chess.com username").fill("testplayer");
  await page.getByRole("button", { name: "Fetch games" }).click();

  await expect(page.getByText("Test Player")).toBeVisible();
  await expect(page.locator(".outcome-badge.win")).toBeVisible();
  await expect(page.getByText("grandmaster")).toBeVisible();

  await page.getByRole("button", { name: "Review Game →" }).click();
  await expect(
    page.getByRole("button", { name: "White Bb5", exact: false }),
  ).toBeVisible();
});

test("renders visual board arrows, eval graph, critical filter, and estimated Elo ratings", async ({
  page,
}) => {
  await page.goto("/");
  // Initial board arrows overlay is present
  await expect(page.locator(".board-arrows-overlay")).toBeVisible();
  await openMobileTab(page, "Insights");
  // EvalGraph timeline is rendered
  await expect(page.locator(".eval-graph-card")).toBeVisible();
  await expect(page.locator(".eval-graph-svg")).toBeVisible();

  // Analyse short game
  await openMobileTab(page, "Games");
  await page
    .getByLabel("Game PGN", { exact: true })
    .fill("1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0");
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await expect(page.getByText("Analysis complete")).toBeVisible({
    timeout: 90000,
  });

  // Game summary tab shows performance Elo badges
  await openMobileTab(page, "Insights");
  await expect(page.locator(".summary-elo-badge").first()).toBeVisible();

  // Switch back to Moves tab
  await openMobileTab(page, "Review");

  // Test critical only toggle
  const criticalToggle = page.getByRole("button", { name: "Critical only" });
  await expect(criticalToggle).toBeVisible();
  await criticalToggle.click();
  await expect(criticalToggle).toHaveClass(/active/);

  // Blunder seek button navigation
  const nextBlunderBtn = page.getByRole("button", { name: "Next blunder" });
  await page.locator(".replay-menu summary").click();
  await expect(nextBlunderBtn).toBeVisible();
  await nextBlunderBtn.click();
  expect(
    await page.locator(".dial-heading > span:last-child").textContent(),
  ).toContain("/");

  // Tactical arrows toggle button
  const arrowsToggle = page.getByRole("button", {
    name: "Toggle tactical arrows",
  });
  await clickReviewTool(page, "Toggle tactical arrows");
  await clickReviewTool(page, "Toggle tactical arrows");
});
