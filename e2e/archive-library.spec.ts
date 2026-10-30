import { test, expect } from "@playwright/test";
import { openMobileTab } from "./mobile-helpers";
test("archive download deduplicates, resumes after a rate limit, exports and persists analysis", async ({
  page,
}) => {
  const base = "https://api.chess.com/pub/player/archiveuser/games/";
  let fail = true;
  const game = (id: number) => ({
    url: "https://www.chess.com/game/live/" + id,
    pgn:
      '[White "archiveuser"]\n[Black "opponent' +
      id +
      '"]\n[Date "2026.01.02"]\n\n1. e4 e5 *',
    rules: "chess",
    end_time: 1700000000,
    time_class: "blitz",
  });
  await page.route(base + "archives", (r) =>
    r.fulfill({ json: { archives: [base + "2026/01", base + "2026/02"] } }),
  );
  let firstMonth = 0;
  await page.route(base + "2026/01", (r) => {
    firstMonth++;
    return r.fulfill({ json: { games: [game(1)] } });
  });
  await page.route(base + "2026/02", (r) =>
    fail
      ? r.fulfill({ status: 429, body: "rate limited" })
      : r.fulfill({ json: { games: [game(1), game(2)] } }),
  );
  await page.goto("/");
  await openMobileTab(page, "Settings");
  await page
    .getByLabel("Review speed", { exact: true })
    .selectOption("battery");
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Downloads", exact: true }).click();
  await page.getByLabel("Download username").fill("archiveuser");
  await page
    .getByRole("button", { name: "Download all games", exact: true })
    .click();
  const card = page.locator(".download-card");
  await expect(card).toContainText("1/2 months");
  await expect(card).toContainText("error");
  fail = false;
  await page
    .getByRole("button", { name: "Resume download", exact: true })
    .click();
  await expect(card).toContainText("2 games");
  await expect(card).toContainText("Download: complete");
  expect(firstMonth).toBe(1);
  await page
    .getByRole("button", { name: "Analyse downloaded games", exact: true })
    .click();
  await expect(card).toContainText("2 analysed", { timeout: 60000 });
  await page.reload();
  await expect(card).toContainText("2 analysed");
  await card.getByText("Export / manage", { exact: true }).click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export all PGN", exact: true })
    .click();
  expect((await pending).suggestedFilename()).toMatch(/\.pgn$/);
  await page
    .getByRole("button", { name: "Refresh downloads", exact: true })
    .click();
  await expect(card).toContainText("2 games");
  await expect(card).toContainText("2 analysed");
  await openMobileTab(page, "Insights");
  await page.getByLabel("Dashboard player").selectOption("archiveuser");
  await expect(
    page.getByRole("region", { name: "Personal weakness dashboard" }),
  ).toContainText("2 analysed moves across 2 games");

  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page
    .getByRole("button", { name: "Open review", exact: true })
    .first()
    .click();
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Save game", exact: true }).click();
  await expect(
    page.getByText("Game saved. Saving again updates this game.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Downloads", exact: true }).click();
  await card.getByText("Export / manage", { exact: true }).click();
  await page
    .getByRole("button", { name: "Remove download", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove downloaded games", exact: true })
    .click();
  await expect(card).toHaveCount(0);
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page.locator(".saved-game-card")).toHaveCount(1);
});
