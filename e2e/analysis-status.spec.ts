import { test, expect } from "@playwright/test";
import { openMobileTab } from "./mobile-helpers";
test("analysis details show live engine settings and hide after stop or completion", async ({
  page,
}) => {
  await page.goto("/");
  const details = page.getByRole("group", {
    name: "Engine analysis details",
    exact: true,
  });
  await expect(details).toContainText("Stockfish 19");
  await expect(details).toContainText("left");
  await expect(details).toContainText("Depth 12");
  await expect(details).toContainText("16 MB");
  await page
    .getByRole("button", { name: "Stop analysis", exact: true })
    .click();
  await expect(details).toHaveCount(0);
  await openMobileTab(page, "Settings");
  await page
    .getByLabel("Review speed", { exact: true })
    .selectOption("battery");
  await openMobileTab(page, "Games");
  await page.getByLabel("Game PGN", { exact: true }).fill("1. d4 d5 *");
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await expect(
    page.getByText("Analysis complete", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await expect(details).toHaveCount(0);
});
