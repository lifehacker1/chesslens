import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { openMobileTab } from "./mobile-helpers";
test("recent game filters control downloads, export and auto-saved analysis", async ({
  page,
}) => {
  const base = "https://api.chess.com/pub/player/recentuser/games/";
  const game = (id: number, speed: string) => ({
    url: "https://www.chess.com/game/live/" + id,
    pgn: `[White "recentuser"]\n[Black "Opponent${id}"]\n\n1. e4 e5 *`,
    white: { username: "recentuser", result: "win" },
    black: { username: "Opponent" + id, result: "resigned" },
    rules: "chess",
    end_time: 1700000000 + id,
    time_control: "180",
    time_class: speed,
  });
  await page.route(base + "archives", (r) =>
    r.fulfill({ json: { archives: [base + "2026/09", base + "2026/10"] } }),
  );
  await page.route(base + "2026/10", (r) =>
    r.fulfill({ json: { games: [game(2, "rapid")] } }),
  );
  await page.route(base + "2026/09", (r) =>
    r.fulfill({ json: { games: [game(1, "blitz")] } }),
  );
  await page.addInitScript(() =>
    localStorage.setItem("chesslens-auto-sync-v1", "false"),
  );
  await page.goto("/");
  await openMobileTab(page, "Settings");
  await page
    .getByLabel("Review speed", { exact: true })
    .selectOption("battery");
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Chess.com", exact: true }).click();
  await page.getByLabel("Chess.com username").fill("recentuser");
  await page.getByRole("button", { name: "Fetch games", exact: true }).click();
  await expect(page.locator(".cc-game-card")).toHaveCount(2);
  await expect(page.getByLabel("Select archive month")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Downloads", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Search games", { exact: true }).fill("Opponent1");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export filtered games PGN", exact: true })
    .click();
  const file = await download;
  const text = await readFile((await file.path())!, "utf8");
  expect(text).toContain("Opponent1");
  expect(text).not.toContain("Opponent2");
  await page
    .getByRole("button", { name: "Analyse filtered games", exact: true })
    .click();
  await expect(
    page.getByText("Filtered games analysed and saved in Library.", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page.locator(".saved-game-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Open review", exact: true }).click();
  await openMobileTab(page, "Insights");
  const summary = page.getByRole("region", {
    name: "Game summary",
    exact: true,
  });
  await expect(summary).toContainText("recentuser vs Opponent1");
  await expect(summary).toContainText("Full game review");
  const before = await summary.locator(".summary").innerText();
  expect(
    await page.evaluate(() => {
      const s = document.querySelector(".game-summary-panel")!,
        g = document.querySelector(".eval-graph-card")!,
        d = document.querySelector(
          '[aria-label="Personal weakness dashboard"]',
        )!;
      return (
        !!(s.compareDocumentPosition(g) & Node.DOCUMENT_POSITION_FOLLOWING) &&
        !!(g.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING)
      );
    }),
  ).toBe(true);
  await page.reload();
  await expect(summary.locator(".summary")).toHaveText(before, {
    useInnerText: true,
  });
  await expect(summary).toContainText("recentuser vs Opponent1");
  await openMobileTab(page, "Games");
  await expect(page.locator(".saved-game-card.is-current")).toHaveCount(1);
  await expect(page.locator(".saved-game-card.is-current")).toBeInViewport();
});
