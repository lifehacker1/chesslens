import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { openMobileTab } from "./mobile-helpers";
async function importAndSave(
  page: import("@playwright/test").Page,
  name: string,
) {
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await page
    .getByLabel("Game PGN", { exact: true })
    .fill(`[White "${name}"]\n[Black "Opponent"]\n\n1. e4 e5 *`);
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await expect(
    page.getByText("Analysis complete", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Save game", exact: true }).click();
  await expect(page.locator(".games-list")).toContainText(name);
}
test("current game remains manageable and filters match visible results", async ({
  page,
}) => {
  await page.goto("/");
  await openMobileTab(page, "Settings");
  await page
    .getByLabel("Review speed", { exact: true })
    .selectOption("battery");
  await importAndSave(page, "Alpha");
  const row = page.locator(".game-row.saved-game-card");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Current review");
  await row.getByLabel(/Actions for/).click();
  await row.getByRole("button", { name: "Rename", exact: true }).click();
  await page.getByLabel("Game name", { exact: true }).fill("My study");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(row).toContainText("My study");
  await page.getByLabel("Search saved games").fill("absent");
  await expect(row).toHaveCount(0);
  await expect(page.getByText("No matches.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Reset library filters" }).click();
  await expect(row).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("unfinished drafts survive reload and selected export includes only chosen games", async ({
  page,
}) => {
  await page.goto("/");
  await openMobileTab(page, "Settings");
  await page
    .getByLabel("Review speed", { exact: true })
    .selectOption("battery");
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await page.getByLabel("Game PGN", { exact: true }).fill("unfinished study");
  await page
    .getByRole("button", { name: "Close Import PGN", exact: true })
    .click();
  await page.reload();
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await expect(page.getByLabel("Game PGN", { exact: true })).toHaveValue(
    "unfinished study",
  );
  await page.getByRole("button", { name: "Discard PGN draft" }).click();
  await expect(page.getByLabel("Game PGN", { exact: true })).toHaveValue("");
  await page
    .getByRole("button", { name: "Close Import PGN", exact: true })
    .click();
  await importAndSave(page, "Alpha");
  await importAndSave(page, "Beta");
  await page.getByRole("button", { name: "Select games", exact: true }).click();
  await page.getByRole("checkbox", { name: /Select Alpha/ }).check();
  await page.getByLabel("Search saved games").fill("Beta");
  await expect(page.getByText("1 selected", { exact: true })).toBeVisible();
  const event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export selected PGN", exact: true })
    .click();
  const download = await event;
  const pgn = await readFile((await download.path())!, "utf8");
  expect(pgn).toContain("Alpha");
  expect(pgn).not.toContain("Beta");
  expect(
    await page.evaluate(() => localStorage.getItem("chesslens-pgn-draft-v1")),
  ).toBeNull();
});
test("download refresh failure releases job controls and reports failure", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let reads = 0;
    const original = IDBObjectStore.prototype.getAll;
    IDBObjectStore.prototype.getAll = function (
      ...args: Parameters<typeof original>
    ) {
      if (this.name === "collections" && ++reads >= 3)
        throw new Error("Simulated collection read failure");
      return original.apply(this, args);
    };
  });
  await page.route(
    "https://api.chess.com/pub/player/recordfailure/games/archives",
    (r) => r.fulfill({ json: { archives: [] } }),
  );
  await page.goto("/");
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Downloads", exact: true }).click();
  await page
    .getByLabel("Download username", { exact: true })
    .fill("recordfailure");
  await page
    .getByRole("button", { name: "Download all games", exact: true })
    .click();
  await expect(
    page.getByText(
      "Could not refresh download records. Retry from Downloads.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download all games", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Pause job", exact: true }),
  ).toHaveCount(0);
});
