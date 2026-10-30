import { test, expect } from "@playwright/test";
import { openMobileTab, clickReviewTool } from "./mobile-helpers";
const pgn =
  '[White "Persistent Alice"]\n[Black "Persistent Bob"]\n\n1. d4 d5 2. c4 e6 *';
async function importGame(page: import("@playwright/test").Page) {
  await page.goto("/");
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await page.getByLabel("Game PGN", { exact: true }).fill(pgn);
  await page.getByRole("button", { name: "Import game", exact: true }).click();
}
test("restores imported review and stopped analysis without saving an invalid draft", async ({
  page,
}) => {
  await importGame(page);
  await page
    .getByRole("button", { name: "Stop analysis", exact: true })
    .click();
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(page.getByLabel("d4 White p", { exact: true })).toBeVisible();
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await page.getByLabel("Game PGN", { exact: true }).fill("invalid draft");
  await page.reload();
  await expect(page.getByLabel("Game PGN", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Continue reviewing", exact: true })
    .click();
  await expect(page.getByLabel("d4 White p", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Stop analysis", exact: true }),
  ).toHaveCount(0);
});
test("saved library survives reload and opens original game after importing another", async ({
  page,
}) => {
  await importGame(page);
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Save game", exact: true }).click();
  await expect(page.locator(".saved-game-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Save game", exact: true }).click();
  await expect(page.locator(".saved-game-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await page.getByLabel("Game PGN", { exact: true }).fill("1. e4 e5 *");
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await openMobileTab(page, "Games");
  await page.reload();
  await expect(page.locator(".saved-game-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Open review", exact: true }).click();
  await expect(page.getByLabel("d4 White p", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Persistent Alice", { exact: true }),
  ).toBeVisible();
});
test("restores alternative position and both square highlights", async ({
  page,
}) => {
  await importGame(page);
  await page.getByLabel("e2 White p", { exact: true }).click();
  await page.getByLabel("e4", { exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("e4 White p", { exact: true })).toBeVisible();
  await expect(page.locator(".move-origin")).toHaveAttribute(
    "data-square",
    "e2",
  );
  await expect(page.locator(".move-destination")).toHaveAttribute(
    "data-square",
    "e4",
  );
});
test("persists engine and appearance preferences", async ({ page }) => {
  await page.goto("/");
  await openMobileTab(page, "Settings");
  await page.getByRole("button", { name: "Walnut", exact: true }).click();
  const engine = page.getByLabel("Analysis engine", { exact: true });
  await engine.selectOption("lozza-12.1-hce");
  await page.reload();
  await expect(engine).toHaveValue("lozza-12.1-hce");
  await expect(
    page.getByRole("button", { name: "Walnut", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("keeps completed analysis on offline reload", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await openMobileTab(page, "Settings");
  await page
    .getByLabel("Review speed", { exact: true })
    .selectOption("battery");
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await page.getByLabel("Game PGN", { exact: true }).fill(pgn);
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await expect(
    page.getByText("Analysis complete", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  // Wait for the actual durable record, not an arbitrary timeout.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            const request = indexedDB.open("chesslens-reviews", 1);
            request.onsuccess = () => {
              const db = request.result;
              const read = db
                .transaction("sessions")
                .objectStore("sessions")
                .get("active");
              read.onsuccess = () => {
                resolve(Object.keys(read.result?.evaluations || {}).length);
                db.close();
              };
            };
          }),
      ),
    )
    .toBe(5);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByLabel("d4 White p", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Analysis complete", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Stop analysis", exact: true }),
  ).toHaveCount(0);
});

test("shows an actionable warning when review storage is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      get: () => {
        throw new Error("Storage disabled");
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Game board", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".storage-warning")).toBeVisible();
});
