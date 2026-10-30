import { test, expect } from "@playwright/test";
import { openMobileTab } from "./mobile-helpers";
test("Full Stockfish downloads on demand, survives reload, and analyses offline", async ({
  page,
  context,
}) => {
  const fullRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("stockfish-19-single.")) fullRequests.push(r.url());
  });
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await openMobileTab(page, "Settings");
  expect(fullRequests).toEqual([]);
  await page
    .getByLabel("Analysis engine", { exact: true })
    .selectOption("stockfish-19-full");
  await page
    .getByLabel("Review speed", { exact: true })
    .selectOption("battery");
  const download = page.getByRole("region", {
    name: "Engine download",
    exact: true,
  });
  await expect(download).toContainText("99 MB");
  await download
    .getByRole("button", { name: "Download engine", exact: true })
    .click();
  await expect(
    download.getByRole("button", { name: "Remove download", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await page.reload();
  await expect(
    download.getByRole("button", { name: "Remove download", exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await page
    .getByLabel("Game PGN", { exact: true })
    .fill("1. f3 e5 2. g4 Qh4# *");
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await expect(
    page.getByText("Analysis complete", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await openMobileTab(page, "Settings");
  await download
    .getByRole("button", { name: "Remove download", exact: true })
    .click();
  await expect(
    download.getByRole("button", { name: "Download engine", exact: true }),
  ).toBeVisible();
  await expect(download).toContainText("Saved reviews are kept");
});

test.describe("download failure", () => {
  test.use({ serviceWorkers: "block" });
  test("failed full download reports an error and can be retried", async ({
    page,
  }) => {
    await page.route("**/sw.js", (route) => route.abort());
    await page.goto("/");
    await openMobileTab(page, "Settings");
    await page
      .getByLabel("Analysis engine", { exact: true })
      .selectOption("stockfish-19-full");
    await page.route("**/engine/stockfish-19-single.wasm", (route) =>
      route.fulfill({ status: 503, body: "Unavailable" }),
    );
    const panel = page.getByRole("region", {
      name: "Engine download",
      exact: true,
    });
    await panel
      .getByRole("button", { name: "Download engine", exact: true })
      .click();
    await expect(panel).toContainText("Engine file is unavailable");
    await expect(
      panel.getByRole("button", { name: "Download engine", exact: true }),
    ).toBeEnabled();
    await expect(
      panel.getByRole("button", { name: "Remove download", exact: true }),
    ).toHaveCount(0);
  });
});
