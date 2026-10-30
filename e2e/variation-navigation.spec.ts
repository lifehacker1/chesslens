import { test, expect } from "@playwright/test";
import { openMobileTab, clickReviewTool } from "./mobile-helpers";
test("compare cycles candidates and navigation stays within predicted line", async ({
  page,
}) => {
  await page.goto("/");
  await openMobileTab(page, "Settings");
  await page
    .getByLabel("Review speed", { exact: true })
    .selectOption("battery");
  await page.getByLabel("Candidate lines", { exact: true }).selectOption("3");
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await page
    .getByLabel("Game PGN", { exact: true })
    .fill("1. f3 e5 2. g4 Qh4# *");
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await expect(
    page.getByText("Analysis complete", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  const compare = page.getByRole("button", {
    name: "Better move",
    exact: true,
  });
  await compare.click();
  const count = await page.locator(".alternative-line").count();
  expect(count).toBeGreaterThan(1);
  await expect(page.locator(".variation-counter")).toHaveText("1/" + count);
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Alternative 1 step 2:/ }),
  ).toHaveAttribute("aria-current", "step");
  await expect(page.locator(".app")).toHaveAttribute("data-current-ply", "1");
  await expect(page.locator(".square.move-origin")).toHaveCount(1);
  await expect(page.locator(".square.move-destination")).toHaveCount(1);
  await page.keyboard.press("ArrowLeft");
  await expect(
    page.getByRole("button", { name: /Alternative 1 step 1:/ }),
  ).toHaveAttribute("aria-current", "step");
  await compare.click();
  await expect(page.locator(".variation-counter")).toHaveText("2/" + count);
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Alternative 2 step 2:/ }),
  ).toHaveAttribute("aria-current", "step");
  await expect(page.locator(".variation-label")).toContainText(
    /Accuracy \d+%/,
    { timeout: 30000 },
  );
  await expect(page.locator(".board-move-badge")).toHaveAttribute(
    "aria-label",
    /accuracy/,
  );
  await page.reload();
  await expect(page.locator(".variation-counter")).toHaveText("2/" + count);
  await expect(
    page.getByRole("button", { name: /Alternative 2 step 2:/ }),
  ).toHaveAttribute("aria-current", "step");
  await clickReviewTool(page, "First position");
  await expect(
    page.getByRole("button", { name: "Previous move", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.locator(".variation-counter")).toHaveText("2/" + count);
  await clickReviewTool(page, "Last position");
  await expect(
    page.getByRole("button", { name: "Next move", exact: true }),
  ).toBeDisabled();
  for (let i = 0; i < count; i++) {
    await compare.click();
    await expect(page.locator(".variation-counter")).toHaveText(
      ((2 + i) % count) + 1 + "/" + count,
    );
  }
  await page
    .getByRole("button", { name: "Auto-play review", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Alternative 2 step 2:/ }),
  ).toHaveAttribute("aria-current", "step");
  const pause = page.getByRole("button", { name: "Pause review", exact: true });
  if (await pause.isVisible()) await pause.click();
  await expect(page.locator(".app")).toHaveAttribute("data-current-ply", "1");
  await page
    .getByRole("button", { name: "Return to game", exact: true })
    .click();
  await expect(page.locator('[data-square="f2"]')).toHaveClass(/move-origin/);
  await expect(page.locator('[data-square="f3"]')).toHaveClass(
    /move-destination/,
  );
});
