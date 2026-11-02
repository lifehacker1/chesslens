import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { openMobileTab } from "./mobile-helpers";
let bundle = "";
test.beforeAll(async () => {
  bundle = (
    await build({
      stdin: {
        contents:
          'export * from "./src/reviewStorage.ts"; export * from "./src/archiveLibrary.ts";',
        resolveDir: process.cwd(),
      },
      bundle: true,
      format: "esm",
      write: false,
    })
  ).outputFiles[0].text;
});
test("library shows accurate completion, one current card and selection-scoped export", async ({
  page,
}) => {
  await page.route("**/__library-seed.js", (r) =>
    r.fulfill({ contentType: "text/javascript", body: bundle }),
  );
  await page.route("**/__library-seed.html", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Library fixture</title>",
    }),
  );
  await page.goto("/__library-seed.html");
  await page.evaluate(async () => {
    const api = await import(/* @vite-ignore */ "/__library-seed.js");
    const options = api.readAnalysisSettings();
    for (const [name, n] of [
      ["Complete", 3],
      ["Partial", 1],
      ["Pending", 0],
    ] as const) {
      const session = api.newSession(
        `[White "${name}"]\n[Black "Opponent"]\n\n1. e4 e5 *`,
        options,
      );
      for (let i = 0; i < n; i++)
        session.evaluations[i] = { cp: 0, depth: 6, best: "e2e4" };
      await api.saveGame(session, undefined, { collections: ["fixture"] });
    }
    await api.storeCollection({
      version: 1,
      id: "fixture",
      username: "fixture",
      archives: [],
      finished: [],
      state: "complete",
      analysis: "paused",
      updatedAt: Date.now(),
      error: "",
      skipped: 0,
    });
  });
  await page.goto("/");
  await openMobileTab(page, "Games");
  const progress = page.getByRole("region", {
    name: "Library review progress",
  });
  await expect(progress).toContainText("33% reviewed");
  await expect(progress).toContainText(
    "1 complete / 1 partial / 1 not analysed",
  );
  const complete = page
    .locator(".saved-game-card")
    .filter({ hasText: "Complete vs Opponent" });
  await complete
    .getByRole("button", { name: "Open review", exact: true })
    .click();
  await openMobileTab(page, "Games");
  await expect(page.locator(".saved-game-current")).toHaveCount(0);
  await expect(page.locator(".saved-game-card.is-current")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Save game", exact: true }),
  ).toHaveCount(0);
  const actions = complete.locator(".library-card-actions");
  const boxes = await actions
    .locator(":scope > button, :scope > details > summary")
    .evaluateAll((items) => items.map((el) => el.getBoundingClientRect().top));
  expect(Math.max(...boxes) - Math.min(...boxes)).toBeLessThan(8);
  await expect(
    complete.getByText("100% analysed", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Select games", exact: true }).click();
  await page
    .getByRole("button", { name: "Select all matching (3)", exact: true })
    .click();
  await expect(page.getByText("3 selected", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export filtered PGN", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Export selected PGN", exact: true }),
  ).toHaveCount(1);
  await page.getByText("Filters & sort", { exact: true }).click();
  await page.getByLabel("Library status").selectOption("analysed");
  await page.getByLabel("Library collection").selectOption("fixture");
  await expect(page.locator(".saved-game-card")).toHaveCount(1);
  await expect(progress).toContainText("33% reviewed");
  await page.reload();
  await expect(page.getByLabel("Library status")).toHaveValue("analysed");
  await expect(page.getByLabel("Library collection")).toHaveValue("fixture");
  await expect(page.locator(".saved-game-card")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
