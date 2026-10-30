import { test, expect } from "@playwright/test";
import { openMobileTab, clickReviewTool } from "./mobile-helpers";
test("reimported games reuse stored analysis without launching a worker", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Original = window.Worker;
    (window as any).engineStarts = 0;
    window.Worker = class extends Original {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        (window as any).engineStarts++;
      }
    };
  });
  await page.goto("/");
  await openMobileTab(page, "Settings");
  await page
    .getByLabel("Review speed", { exact: true })
    .selectOption("battery");
  const load = async (pgn: string) => {
    await openMobileTab(page, "Games");
    await page.getByRole("button", { name: "Import PGN", exact: true }).click();
    await page.getByLabel("Game PGN", { exact: true }).fill(pgn);
    await page
      .getByRole("button", { name: "Import game", exact: true })
      .click();
    await expect(
      page.getByText("Analysis complete", { exact: true }),
    ).toBeVisible({ timeout: 30000 });
  };
  await load("1. d4 d5 2. c4 e6 *");
  await load("1. e4 e5 *");
  await page.reload();
  await expect(
    page.getByText("Analysis complete", { exact: true }),
  ).toBeVisible();
  await load('[White "Renamed player"]\n\n1. d4 d5 2. c4 e6 *');
  await expect(
    page.getByText("Saved analysis restored · no engine run needed", {
      exact: true,
    }),
  ).toBeAttached();
  expect(await page.evaluate(() => (window as any).engineStarts)).toBe(0);
  await clickReviewTool(page, "Analyse again");
  await expect
    .poll(() => page.evaluate(() => (window as any).engineStarts))
    .toBe(1);
});
