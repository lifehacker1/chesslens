import { test, expect } from "@playwright/test";
import { openMobileTab } from "./mobile-helpers";
test("remembered user automatically fetches latest, saves analysis and reuses it after reload", async ({
  page,
}) => {
  const base = "https://api.chess.com/pub/player/latestuser/games/";
  let requests = 0;
  await page.route(base + "archives", (r) => {
    requests++;
    return r.fulfill({
      json: { archives: [base + "2026/09", base + "2026/10"] },
    });
  });
  const game = (id: number) => ({
    url: "https://www.chess.com/game/live/" + id,
    pgn: '[White "latestuser"]\n[Black "opponent' + id + '"]\n\n1. e4 e5 *',
    rules: "chess",
    end_time: id,
    time_class: "blitz",
  });
  await page.route(base + "2026/10", (r) =>
    r.fulfill({ json: { games: [game(1), game(2)] } }),
  );
  await page.addInitScript(() => {
    (window as any).engineStarts = 0;
    const Original = window.Worker;
    window.Worker = class extends Original {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        if (!String(url).includes("patterns.worker"))
          (window as any).engineStarts++;
      }
    };
  });
  await page.goto("/");
  await openMobileTab(page, "Settings");
  await page
    .getByLabel("Review speed", { exact: true })
    .selectOption("battery");
  await page.evaluate(() =>
    localStorage.setItem("chesslens_cc_user", "latestuser"),
  );
  await page.reload();
  const sync = page.getByRole("complementary", { name: "Latest game sync" });
  await expect(sync).toContainText("Latest game analysed and saved", {
    timeout: 30000,
  });
  expect(await page.evaluate(() => (window as any).engineStarts)).toBe(1);
  const saved = () =>
    page.evaluate(
      () =>
        new Promise<any[]>((resolve) => {
          const r = indexedDB.open("chesslens-reviews", 1);
          r.onsuccess = () => {
            const db = r.result;
            const q = db.transaction("games").objectStore("games").getAll();
            q.onsuccess = () => {
              resolve(q.result);
              db.close();
            };
          };
        }),
    );
  const entries = await saved();
  expect(entries).toHaveLength(1);
  expect(entries[0].sourceUrl).toBe("https://www.chess.com/game/live/2");
  expect(Object.keys(entries[0].session.evaluations)).toHaveLength(3);
  // The current review is not replaced by the background sync.
  await openMobileTab(page, "Review");
  await expect(page.getByText("Paul Morphy", { exact: true })).toBeVisible();
  await openMobileTab(page, "Settings");
  await page.reload();
  await expect(sync).toContainText("Latest game analysed and saved", {
    timeout: 30000,
  });
  expect(await page.evaluate(() => (window as any).engineStarts)).toBe(0);
  expect(await saved()).toHaveLength(1);
  expect(requests).toBe(2);
  await page.route(base + "archives", (r) => r.abort());
  await page.reload();
  await expect(sync).toContainText("Latest game sync could not finish");
  expect(await saved()).toHaveLength(1);
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page.locator(".saved-game-card")).toHaveCount(1);
});
