import { test, expect } from "@playwright/test";
import { openMobileTab } from "./mobile-helpers";
test("tab visits reuse results without archive requests; reload and Load remain available", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("chesslens-auto-sync-v1", "false");
    localStorage.setItem("chesslens-games-username", '"tabuser"');
    localStorage.setItem("chesslens-games-section", '"chesscom"');
  });
  const base = "https://api.chess.com/pub/player/tabuser/games/";
  let requests = 0;
  await page.route(base + "archives", (r) => {
    requests++;
    return r.fulfill({ json: { archives: [base + "2026/11"] } });
  });
  await page.route(base + "2026/11", (r) =>
    r.fulfill({
      json: {
        games: [
          {
            url: "https://www.chess.com/game/live/1",
            pgn: '[White "tabuser"]\n[Black "opponent"]\n\n1. e4 e5 *',
            white: { username: "tabuser", result: "win" },
            black: { username: "opponent", result: "resigned" },
            end_time: 1,
            time_control: "180",
            time_class: "blitz",
            rules: "chess",
          },
        ],
      },
    }),
  );
  await page.goto("/");
  await openMobileTab(page, "Settings");
  await page
    .getByLabel("Review speed", { exact: true })
    .selectOption("battery");
  await openMobileTab(page, "Games");
  await expect(page.locator(".cc-game-card")).toHaveCount(1);
  expect(requests).toBe(1);
  // Expire persistent API data: switching tabs must still use the page snapshot.
  await page.evaluate(() => {
    const key = "chesslens-games-v1";
    const cache = JSON.parse(localStorage.getItem(key) || "{}");
    Object.values(cache).forEach((v: any) => (v.savedAt = 1));
    localStorage.setItem(key, JSON.stringify(cache));
  });
  for (const tab of ["Review", "Settings", "Insights"]) {
    await openMobileTab(page, tab);
    await openMobileTab(page, "Games");
    await expect(page.locator(".cc-game-card")).toHaveCount(1);
  }
  expect(requests).toBe(1);
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "Chess.com", exact: true }).click();
  await expect(page.locator(".cc-game-card")).toHaveCount(1);
  expect(requests).toBe(1);
  await page.getByRole("button", { name: "Load games", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Load games", exact: true }),
  ).toBeEnabled();
  expect(requests).toBe(2);
  await page.evaluate(() => {
    const key = "chesslens-games-v1";
    const cache = JSON.parse(localStorage.getItem(key) || "{}");
    Object.values(cache).forEach((v: any) => (v.savedAt = 1));
    localStorage.setItem(key, JSON.stringify(cache));
  });
  await page.reload();
  await expect(page.locator(".cc-game-card")).toHaveCount(1);
  expect(requests).toBe(3);
});

test("failed automatic load waits for manual retry instead of retrying on tab entry", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("chesslens-auto-sync-v1", "false");
    localStorage.setItem("chesslens-games-username", '"faileduser"');
    localStorage.setItem("chesslens-games-section", '"chesscom"');
  });
  let requests = 0;
  await page.route("https://api.chess.com/**", (r) => {
    requests++;
    return r.fulfill({ status: 503, body: "temporarily unavailable" });
  });
  await page.goto("/");
  await openMobileTab(page, "Settings");
  await page
    .getByLabel("Review speed", { exact: true })
    .selectOption("battery");
  await openMobileTab(page, "Games");
  await expect(page.getByRole("alert")).toBeVisible();
  expect(requests).toBe(1);
  await openMobileTab(page, "Settings");
  await openMobileTab(page, "Games");
  await expect(page.getByRole("alert")).toBeVisible();
  expect(requests).toBe(1);
  await page.getByRole("button", { name: "Load games", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Load games", exact: true }),
  ).toBeEnabled();
  expect(requests).toBe(2);
  await page.getByLabel("Chess.com username").fill("anotheruser");
  await openMobileTab(page, "Settings");
  await openMobileTab(page, "Games");
  await expect(page.getByLabel("Chess.com username")).toHaveValue(
    "anotheruser",
  );
  await expect(
    page.getByRole("button", { name: "Load games", exact: true }),
  ).toBeEnabled();
  expect(requests).toBe(2);
});
