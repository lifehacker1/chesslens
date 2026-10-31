import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { openMobileTab } from "./mobile-helpers";
test("full backup restores games, analysis, preferences and learning without duplicates", async ({
  page,
  browser,
}, info) => {
  await page.goto("/");
  await openMobileTab(page, "Settings");
  await page
    .getByLabel("Review speed", { exact: true })
    .selectOption("battery");
  await page.getByRole("button", { name: "Walnut", exact: true }).click();
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await page
    .getByLabel("Game PGN", { exact: true })
    .fill(
      '[White "Backup Alice"]\n[Black "Backup Bob"]\n\n1. e4 e5 2. Nf3 Nc6 *',
    );
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await expect(
    page.getByText("Analysis complete", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Save game", exact: true }).click();
  await expect(page.locator(".saved-game-card")).toHaveCount(1);
  await openMobileTab(page, "Learn");
  await page
    .getByRole("button", { name: "Retry this position", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reveal solution", exact: true })
    .click();
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
  await openMobileTab(page, "Settings");
  const exportPending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download full backup", exact: true })
    .click();
  const file = await exportPending;
  const text = await readFile((await file.path())!, "utf8");
  const data = JSON.parse(text);
  expect(data.games).toHaveLength(1);
  expect(Object.keys(data.games[0].session.evaluations)).toHaveLength(5);
  expect(data.learning.puzzles).toHaveLength(1);
  expect(data.learning.completed).toContain("opposition");
  const targetContext = await browser.newContext({
    viewport: page.viewportSize()!,
    isMobile: info.project.name === "mobile",
  });
  try {
    const target = await targetContext.newPage();
    await target.goto("/");
    await openMobileTab(target, "Settings");
    await target
      .getByLabel("Review speed", { exact: true })
      .selectOption("battery");
    const panel = target.getByRole("region", { name: "Backup and restore" });
    const input = panel.getByLabel("Choose backup JSON");
    const upload = () =>
      input.setInputFiles({
        name: "backup.json",
        mimeType: "application/json",
        buffer: Buffer.from(text),
      });
    await upload();
    await expect(
      panel.getByText("Restore preview", { exact: true }),
    ).toBeVisible();
    await expect(
      panel.getByRole("button", { name: "Merge backup into this device" }),
    ).toBeDisabled();
    await panel
      .getByLabel("Restore app preferences too (takes effect after reload)")
      .check();
    const recoveryPending = target.waitForEvent("download");
    await panel.getByRole("button", { name: "Download full backup" }).click();
    await recoveryPending;
    await panel
      .getByRole("button", { name: "Merge backup into this device" })
      .click();
    await expect(panel).toContainText("Restore complete");
    await panel.getByRole("button", { name: "Reload app" }).click();
    await expect(
      target.getByRole("button", { name: "Walnut", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await openMobileTab(target, "Games");
    await expect(target.locator(".saved-game-card")).toHaveCount(1);
    await target
      .getByRole("button", { name: "Open review", exact: true })
      .click();
    await expect(
      target.getByText("Analysis complete", { exact: true }),
    ).toBeVisible();
    await openMobileTab(target, "Learn");
    await target.getByRole("button", { name: "Practice", exact: true }).click();
    await expect(target.getByText(/1 attempts/)).toBeVisible();
    await target.getByRole("button", { name: "Endgames", exact: true }).click();
    await expect(
      target.getByText("1 of 5 lessons completed on this device."),
    ).toBeVisible();
    await openMobileTab(target, "Settings");
    await upload();
    const secondRecovery = target.waitForEvent("download");
    await panel.getByRole("button", { name: "Download full backup" }).click();
    await secondRecovery;
    await panel
      .getByRole("button", { name: "Merge backup into this device" })
      .click();
    await expect(panel).toContainText("Restore complete");
    await input.setInputFiles({
      name: "future.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ ...data, version: 99 })),
    });
    await expect(panel.getByRole("alert")).toContainText("unsupported");
    await expect(
      panel.getByRole("button", { name: "Merge backup into this device" }),
    ).toHaveCount(0);
    await openMobileTab(target, "Games");
    await expect(target.locator(".saved-game-card")).toHaveCount(1);
  } finally {
    await targetContext.close();
  }
});
