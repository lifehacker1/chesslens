import { test, expect, type Page } from "@playwright/test";
import { openMobileTab } from "./mobile-helpers";
async function importReview(page: Page, white: string, black: string) {
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await page
    .getByLabel("Game PGN", { exact: true })
    .fill(
      `[White "${white}"]\n[Black "${black}"]\n\n1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0`,
    );
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await expect(
    page.getByText("Analysis complete", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
}
test("transparent category evidence replaces Elo and survives reload", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("chesslens-auto-sync-v1", "false");
    localStorage.setItem("chesslens_cc_user", "bob");
  });
  await page.goto("/");
  await openMobileTab(page, "Settings");
  await page
    .getByLabel("Review speed", { exact: true })
    .selectOption("battery");
  await importReview(page, "Alice", "Bob");
  await openMobileTab(page, "Insights");
  const profile = page.getByRole("region", {
    name: "Game performance profile",
    exact: true,
  });
  await expect(profile.getByLabel("Performance profile player")).toHaveValue(
    "b",
  );
  await expect(profile).toContainText("3/3 moves analysed");
  await expect(page.locator(".summary-elo-badge")).toHaveCount(0);
  const endgame = profile.getByRole("article", {
    name: "Endgame move quality",
    exact: true,
  });
  await expect(endgame).toContainText("Not enough data");
  await expect(endgame.locator("progress")).toHaveCount(0);
  await profile.getByLabel("Performance profile player").selectOption("w");
  await expect(profile).toContainText("4/4 moves analysed");
  const opening = profile.getByRole("article", {
    name: "Opening move quality",
    exact: true,
  });
  await expect(opening).toContainText("Limited sample");
  await opening.getByText("Evidence and meaning", { exact: true }).click();
  const evidence = opening.getByRole("button").first();
  await expect(evidence).toBeVisible();
  await evidence.click();
  await expect(page.locator(".app")).toHaveAttribute(
    "data-mobile-view",
    "review",
  );
  await expect(page.locator(".move-origin")).toHaveCount(1);
  await expect(page.locator(".move-destination")).toHaveCount(1);
  await openMobileTab(page, "Insights");
  await expect(profile.getByLabel("Performance profile player")).toHaveValue(
    "w",
  );
  const scores = await page.locator(".accuracy-cards").innerText();
  await page.reload();
  await openMobileTab(page, "Insights");
  await expect(page.locator(".accuracy-cards")).toHaveText(scores, {
    useInnerText: true,
  });
  await expect(profile).toContainText("4/4 moves analysed");
  await profile
    .getByText("Analysis quality and scoring method", { exact: true })
    .click();
  await expect(profile).toContainText("chesslens-expected-score-v2");
  await expect(profile).toContainText("requested depth 6");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("historical scope warns about another player and switches only on request", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("chesslens-auto-sync-v1", "false");
    localStorage.setItem("chesslens_cc_user", "bob");
  });
  await page.goto("/");
  await openMobileTab(page, "Settings");
  await page
    .getByLabel("Review speed", { exact: true })
    .selectOption("battery");
  await importReview(page, "Cara", "Dan");
  await importReview(page, "Alice", "Bob");
  await openMobileTab(page, "Insights");
  const dashboard = page.getByRole("region", {
    name: "Personal weakness dashboard",
  });
  await dashboard.getByLabel("Dashboard player").selectOption("Cara");
  const scope = dashboard.getByLabel("Historical insight scope");
  await expect(scope).toContainText("different player from the current review");
  await expect(dashboard.getByLabel("Dashboard player")).toHaveValue("Cara");
  await scope
    .getByRole("button", { name: "Use current-game player", exact: true })
    .click();
  await expect(dashboard.getByLabel("Dashboard player")).toHaveValue("Bob");
  await expect(scope).not.toContainText("different player");
  await expect(page.getByLabel("Current game details")).toContainText(
    "Alice vs Bob",
  );
});

test("setup positions keep their actual move number in evidence", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("chesslens-auto-sync-v1", "false");
    localStorage.setItem("chesslens_cc_user", "bob");
  });
  await page.goto("/");
  await openMobileTab(page, "Settings");
  await page
    .getByLabel("Review speed", { exact: true })
    .selectOption("battery");
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await page
    .getByLabel("Game PGN", { exact: true })
    .fill(
      '[White "Alice"]\n[Black "Bob"]\n[SetUp "1"]\n[FEN "8/8/8/8/8/5k2/6p1/4K3 b - - 0 15"]\n\n15... g1=Q+ *',
    );
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await expect(
    page.getByText("Analysis complete", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await openMobileTab(page, "Insights");
  const endgame = page.getByRole("article", {
    name: "Endgame move quality",
    exact: true,
  });
  await endgame.getByText("Evidence and meaning", { exact: true }).click();
  await expect(
    endgame.getByRole("button", { name: /15\.\.\. g1=Q\+/ }),
  ).toBeVisible();
});
