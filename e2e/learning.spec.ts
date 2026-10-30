import { test, expect } from "@playwright/test";
import { openMobileTab } from "./mobile-helpers";
test("learn: compare roots, retry hidden solution, persist practice and lessons", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await openMobileTab(page, "Settings");
  await page
    .getByLabel("Review speed", { exact: true })
    .selectOption("battery");
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await page
    .getByLabel("Game PGN", { exact: true })
    .fill('[White "Learner"]\n[Black "Partner"]\n\n1. e4 e5 2. Nf3 Nc6 *');
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await expect(
    page.getByText("Analysis complete", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await openMobileTab(page, "Learn");
  await expect(
    page.getByRole("heading", { name: "Explain this move", exact: true }),
  ).toBeVisible();
  const own = page.getByRole("group", {
      name: "Your move position",
      exact: true,
    }),
    best = page.getByRole("group", {
      name: "Engine recommendation position",
      exact: true,
    });
  expect(
    await own
      .getByRole("button")
      .evaluateAll((es) => es.map((e) => e.getAttribute("aria-label"))),
  ).toEqual(
    await best
      .getByRole("button")
      .evaluateAll((es) => es.map((e) => e.getAttribute("aria-label"))),
  );
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(own.locator(".last")).toHaveCount(2);
  await expect(best.locator(".last")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Reset comparison", exact: true })
    .click();
  await page.screenshot({
    path: testInfo.outputPath("learn.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Retry this position", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reveal solution", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Saved solution:/)).toHaveCount(0);
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  await expect(page.getByText(/Hint: consider the piece/)).toBeVisible();
  await page
    .getByRole("button", { name: "Reveal solution", exact: true })
    .click();
  await expect(page.getByText(/1 attempts/)).toBeVisible();
  await page.reload();
  await openMobileTab(page, "Learn");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(page.getByText(/1 attempts/)).toBeVisible();
  await page.getByRole("button", { name: "Endgames", exact: true }).click();
  const study = page.getByRole("group", {
    name: "Study position",
    exact: true,
  });
  await study.getByRole("button", { name: "e3 White k", exact: true }).click();
  await study.getByRole("button", { name: "e4 empty", exact: true }).click();
  await expect(
    page.getByText("1 of 5 lessons completed on this device."),
  ).toBeVisible();
  await page.reload();
  await openMobileTab(page, "Learn");
  await page.getByRole("button", { name: "Endgames", exact: true }).click();
  await expect(
    page.getByText("1 of 5 lessons completed on this device."),
  ).toBeVisible();
});

test("learning storage failure preserves future-version data", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".app").waitFor();
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open("chesslens-learning", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("data");
      r.onerror = () => reject(r.error);
      r.onsuccess = () => {
        const db = r.result;
        const t = db.transaction("data", "readwrite");
        t.objectStore("data").put(
          { version: 99, puzzles: [], completed: [] },
          "current",
        );
        t.oncomplete = () => {
          db.close();
          resolve();
        };
      };
    });
  });
  await openMobileTab(page, "Learn");
  await expect(
    page.getByRole("alert").filter({ hasText: "Unsupported learning data" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save for practice", exact: true }),
  ).toBeDisabled();
  const version = await page.evaluate(
    async () =>
      new Promise<number>((resolve) => {
        const r = indexedDB.open("chesslens-learning", 1);
        r.onsuccess = () => {
          const db = r.result;
          const q = db.transaction("data").objectStore("data").get("current");
          q.onsuccess = () => {
            db.close();
            resolve(q.result.version);
          };
        };
      }),
  );
  expect(version).toBe(99);
});

test("saved games dashboard isolates the selected player", async ({ page }) => {
  await page.goto("/");
  await openMobileTab(page, "Settings");
  await page
    .getByLabel("Review speed", { exact: true })
    .selectOption("battery");
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await page
    .getByLabel("Game PGN", { exact: true })
    .fill('[White "Learner"]\n[Black "Partner"]\n\n1. f3 e5 2. g4 Qh4# 0-1');
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await expect(
    page.getByText("Analysis complete", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Save game", exact: true }).click();
  await expect(
    page.getByText("Game saved. Saving again updates this game.", {
      exact: true,
    }),
  ).toBeVisible();
  await openMobileTab(page, "Insights");
  const dashboard = page.getByRole("region", {
    name: "Personal weakness dashboard",
  });
  await expect(
    dashboard.getByText(/2 analysed moves across 1 games/),
  ).toBeVisible();
  await dashboard.getByLabel("Dashboard player").selectOption("Partner");
  await expect(
    dashboard.getByText(/2 analysed moves across 1 games/),
  ).toBeVisible();
  await expect(dashboard.getByText("0 / 2", { exact: true })).toBeVisible();
});

test("practice verifies an unlisted legal alternative with the real engine", async ({
  page,
}) => {
  await page.goto("/");
  await openMobileTab(page, "Settings");
  await page
    .getByLabel("Review speed", { exact: true })
    .selectOption("battery");
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await page.getByLabel("Game PGN", { exact: true }).fill("1. e4 e5 *");
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await expect(
    page.getByText("Analysis complete", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await openMobileTab(page, "Learn");
  await page
    .getByRole("button", { name: "Retry this position", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reveal solution", exact: true }),
  ).toBeVisible();
  const candidate = await page.evaluate(
    async () =>
      new Promise<string>((resolve) => {
        const r = indexedDB.open("chesslens-learning", 1);
        r.onsuccess = () => {
          const db = r.result;
          const q = db.transaction("data").objectStore("data").get("current");
          q.onsuccess = () => {
            const p = q.result.puzzles[0];
            const known = [
              p.before.best,
              ...(p.before.lines || []).map((e: { best: string }) => e.best),
            ];
            resolve(
              [
                "a2a3",
                "b2b3",
                "c2c3",
                "d2d3",
                "e2e3",
                "f2f3",
                "g2g3",
                "h2h3",
              ].find((m) => !known.includes(m))!,
            );
            db.close();
          };
        };
      }),
  );
  const board = page.getByRole("group", {
    name: "Study position",
    exact: true,
  });
  await board
    .getByRole("button", {
      name: `${candidate.slice(0, 2)} White p`,
      exact: true,
    })
    .click();
  await board
    .getByRole("button", {
      name: `${candidate.slice(2, 4)} empty`,
      exact: true,
    })
    .click();
  await expect(
    page.getByText(/It is unverified, not marked wrong/),
  ).toBeVisible();
  await expect(page.getByText(/Hint: consider/)).toHaveCount(0);
  await page.getByRole("button", { name: /Verify this move with/ }).click();
  await expect(
    page.getByText(/Engine verified:|The new engine check prefers/),
  ).toBeVisible({ timeout: 30000 });
});
