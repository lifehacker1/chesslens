import { test, expect } from "@playwright/test";
import { openMobileTab } from "./mobile-helpers";
test("CPU mode persists, runs real parallel engines and stops the whole pool", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 4 });
    Object.defineProperty(navigator, "deviceMemory", { get: () => 8 });
    const Original = window.Worker;
    const active = new Set<Worker>();
    (window as any).maxEngineWorkers = 0;
    window.Worker = class extends Original {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        active.add(this);
        (window as any).maxEngineWorkers = Math.max(
          (window as any).maxEngineWorkers,
          active.size,
        );
        (window as any).activeEngineWorkers = active.size;
      }
      terminate() {
        active.delete(this);
        (window as any).activeEngineWorkers = active.size;
        super.terminate();
      }
    };
  });
  await page.goto("/");
  await openMobileTab(page, "Settings");
  await page.getByLabel("CPU usage", { exact: true }).selectOption("maximum");
  await page
    .getByLabel("Review speed", { exact: true })
    .selectOption("battery");
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await page
    .getByLabel("Game PGN", { exact: true })
    .fill("1. d4 d5 2. c4 e6 *");
  await page.getByRole("button", { name: "Import game", exact: true }).click();
  await expect(
    page.getByText("Analysis complete", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  expect(await page.evaluate(() => (window as any).maxEngineWorkers)).toBe(4);
  await expect
    .poll(() => page.evaluate(() => (window as any).activeEngineWorkers))
    .toBe(0);
  await page.reload();
  await openMobileTab(page, "Settings");
  await expect(page.getByLabel("CPU usage", { exact: true })).toHaveValue(
    "maximum",
  );
  await page
    .getByLabel("Review speed", { exact: true })
    .selectOption("thorough");
  await openMobileTab(page, "Review");
  await expect
    .poll(() => page.evaluate(() => (window as any).activeEngineWorkers))
    .toBe(4);
  await page
    .getByRole("button", { name: "Stop analysis", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).activeEngineWorkers))
    .toBe(0);
});
