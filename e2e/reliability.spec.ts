import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { openMobileTab } from "./mobile-helpers";
test("Games remains usable when remembered username storage is denied", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(() => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key === "chesslens_cc_user")
        throw new DOMException("Storage denied", "SecurityError");
      return original.call(this, key);
    };
  });
  await openMobileTab(page, "Games");
  await expect(
    page.getByRole("button", { name: "Import PGN", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await page.getByLabel("Game PGN", { exact: true }).fill("1. e4 e5 *");
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await expect(page.locator(".board")).toBeVisible();
  expect(errors).toEqual([]);
});
test("editable accounts clear stale games and remember recent players", async ({
  page,
}) => {
  await page.route("https://api.chess.com/**", (r) => {
    const user = r.request().url().split("/player/")[1].split("/")[0];
    return r.fulfill({
      json: r.request().url().endsWith("/archives")
        ? {
            archives: [
              "https://api.chess.com/pub/player/" + user + "/games/2026/10",
            ],
          }
        : { games: [] },
    });
  });
  await page.goto("/");
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Chess.com", exact: true }).click();
  await page.getByLabel("Chess.com username").fill("alpha");
  await page.getByRole("button", { name: "Fetch games", exact: true }).click();
  await expect(page.getByText("@alpha", { exact: true })).toBeVisible();
  await page.getByLabel("Chess.com username").fill("beta");
  await page.getByRole("button", { name: "Fetch games", exact: true }).click();
  await expect(page.getByText("@beta", { exact: true })).toBeVisible();
  await expect(page.getByText("@alpha", { exact: true })).toHaveCount(0);
  await page.getByLabel("Chess.com username").fill("gamma");
  await page.getByRole("button", { name: "Fetch games", exact: true }).click();
  await expect(page.getByText("@gamma", { exact: true })).toBeVisible();
  await expect(page.locator("#recent-chess-players option")).toHaveCount(3);
  await page.reload();
  await expect(page.getByText("@gamma", { exact: true })).toBeVisible();
});
test("review exploration permits knight promotion and highlights its move", async ({
  page,
}) => {
  await page.goto("/");
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await page
    .getByLabel("Game PGN", { exact: true })
    .fill('[SetUp "1"]\n[FEN "7k/P7/8/8/8/8/8/7K w - - 0 1"]\n\n1. a8=Q+ *');
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await page.getByLabel("a7 White p", { exact: true }).click();
  expect(
    (await page.getByLabel("Review promotion piece").boundingBox())!.height,
  ).toBeGreaterThanOrEqual(44);
  await page.getByLabel("Review promotion piece").selectOption("n");
  await page.getByLabel("a8", { exact: true }).click();
  await expect(page.getByLabel("a8 White n", { exact: true })).toBeVisible();
  await expect(page.locator(".move-origin")).toHaveAttribute(
    "data-square",
    "a7",
  );
  await expect(page.locator(".move-destination")).toHaveAttribute(
    "data-square",
    "a8",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("weakness export separates matching games from analysed games", async ({
  page,
}) => {
  await page.goto("/");
  // Finish auto-analysis before replacing stored results for this fixture.
  await expect(
    page.getByText("Analysis complete", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Save game", exact: true }).click();
  await expect(page.locator(".saved-game-card")).toHaveCount(1);
  // An unanalysed saved game must count in the library, not analysis coverage.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open("chesslens-reviews", 1);
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction("games", "readwrite");
          const store = tx.objectStore("games");
          const q = store.getAll();
          q.onsuccess = () => {
            for (const game of q.result) {
              // Use a different game so active-review navigation cannot repopulate this fixture.
              store.delete(game.id);
              game.session.pgn = game.session.pgn.replace(
                '[White "',
                '[White "Unanalysed ',
              );
              game.id = game.session.pgn;
              game.session.evaluations = {};
              game.session.updatedAt = Date.now() + 60000;
              store.put(game);
            }
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await openMobileTab(page, "Insights");
  await expect(
    page.getByRole("region", { name: "Personal weakness dashboard" }),
  ).toContainText("0 analysed moves");
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export weakness report (.md)", exact: true })
    .click();
  const download = await pending;
  const text = await readFile((await download.path())!, "utf8");
  expect(text).toContain("Matching games: 1");
  expect(text).toContain("Games with analysed player moves: 0");
  expect(text).toContain("Analysed player moves: 0");
});
