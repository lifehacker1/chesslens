import { test, expect } from "@playwright/test";
import { openMobileTab } from "./mobile-helpers";
test("one Load action refreshes results and card save/export need no menu", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("chesslens-auto-sync-v1", "false"),
  );
  let loads = 0;
  const base = "https://api.chess.com/pub/player/buttonuser/games/";
  await page.route(base + "archives", (r) => {
    loads++;
    return r.fulfill({ json: { archives: [base + "2026/11"] } });
  });
  await page.route(base + "2026/11", (r) =>
    r.fulfill({
      json: {
        games: [
          {
            url: "https://www.chess.com/game/live/" + loads,
            pgn: `[White "buttonuser"]\n[Black "Opponent${loads}"]\n\n1. e4 e5 *`,
            white: { username: "buttonuser", result: "win" },
            black: { username: "Opponent" + loads, result: "resigned" },
            rules: "chess",
            time_class: "blitz",
            time_control: "180",
            end_time: 1700000000,
          },
        ],
      },
    }),
  );
  await page.goto("/");
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Chess.com", exact: true }).click();
  await page.getByLabel("Chess.com username").fill("buttonuser");
  await page.getByRole("button", { name: "Load games", exact: true }).click();
  const card = page.locator(".cc-game-card");
  await expect(card).toContainText("Opponent1");
  await page.getByRole("button", { name: "Load games", exact: true }).click();
  await expect(card).toContainText("Opponent2");
  expect(loads).toBe(2);
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("@buttonuser", { exact: true })).toHaveCount(0);
  await expect(
    card.getByRole("button", { name: "Save game", exact: true }),
  ).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Export PGN", exact: true }),
  ).toBeVisible();
  await expect(card.locator("details")).toHaveCount(0);
  await card.getByRole("button", { name: "Save game", exact: true }).click();
  await expect(page.getByText("Game saved.", { exact: true })).toBeVisible();
  const pending = page.waitForEvent("download");
  await card.getByRole("button", { name: "Export PGN", exact: true }).click();
  expect((await pending).suggestedFilename()).toBe("game.pgn");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  const saved = page
    .locator(".saved-game-card")
    .filter({ hasText: "Opponent2" });
  await expect(
    saved.getByRole("button", { name: "Export PGN", exact: true }),
  ).toBeVisible();
  await expect(
    saved.locator("details button").filter({ hasText: "Export PGN" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
