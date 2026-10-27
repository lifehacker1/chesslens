import { test, expect } from "@playwright/test";
import { openMobileTab } from "./mobile-helpers";
test("per-move accuracy and alternatives work with stable board sizing", async ({
  page,
}) => {
  await page.goto("/");
  await openMobileTab(page, "Games");
  await page
    .getByLabel("Game PGN", { exact: true })
    .fill("1. f3 e5 2. g4 Qh4# *");
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await openMobileTab(page, "Settings");
  await page.getByLabel("Review speed", { exact: true }).selectOption("quick");
  await page.getByLabel("Candidate lines", { exact: true }).selectOption("3");
  await openMobileTab(page, "Review");
  await expect(
    page.getByText("Analysis complete", { exact: true }),
  ).toBeVisible({ timeout: 90000 });
  const cursor = page.locator(".app");
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(page.locator(".board-move-badge")).toHaveAttribute(
    "aria-label",
    /\d+% accuracy/,
  );
  await expect(page.locator(".move-cell .move-accuracy").first()).toHaveText(
    /\d+% accuracy/,
  );
  const width = (await page.locator(".board").boundingBox())!.width;
  await page.getByRole("button", { name: "Better move", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Preview alternative 1", exact: true }),
  ).toBeVisible();
  expect(await page.locator(".alternative-line").count()).toBeGreaterThan(1);
  await page.getByRole("button", { name: /Alternative 1 step 2:/ }).click();
  expect((await page.locator(".board").boundingBox())!.width).toBeCloseTo(
    width,
    0,
  );
  await page
    .getByRole("button", { name: "Return to game", exact: true })
    .click();
  await expect(page.locator(".moves")).toBeVisible();
  await openMobileTab(page, "Settings");
  await page.getByLabel("Candidate lines", { exact: true }).selectOption("1");
  await openMobileTab(page, "Review");
  await expect(
    page.getByText("Analysis complete", { exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await page.getByRole("button", { name: "Better move", exact: true }).click();
  await expect(page.locator(".alternative-line")).toHaveCount(1);
});
