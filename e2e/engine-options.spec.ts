import { test, expect } from "@playwright/test";
import { openMobileTab } from "./mobile-helpers";
test("advanced engine controls configure limits, cache and registered engines", async ({
  page,
}) => {
  await page.goto("/");
  await openMobileTab(page, "Settings");
  const speed = page.getByLabel("Review speed", { exact: true });
  await speed.selectOption("battery");
  await expect(page.locator(".engine-budget")).toContainText(
    "0.25s per position",
  );
  await speed.selectOption("thorough");
  await expect(page.locator(".engine-budget")).toContainText("depth 22");
  await speed.selectOption("custom");
  await page.getByLabel("Maximum depth", { exact: true }).selectOption("14");
  await page
    .getByLabel("Time per position", { exact: true })
    .selectOption("1000");
  await page.getByLabel("Candidate lines", { exact: true }).selectOption("5");
  await page.getByLabel("Engine memory", { exact: true }).selectOption("128");
  await expect(speed).toHaveValue("custom");
  await expect(page.locator(".engine-budget")).toContainText(
    "depth 14 · 1s per position · 5 candidate lines",
  );
  await page.getByLabel("Reuse analysed positions", { exact: false }).uncheck();
  await page
    .getByRole("button", { name: "Clear analysis cache", exact: true })
    .click();
  await expect(
    page.getByText(
      "Analysis cache cleared. Existing review results are kept.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reset engine options", exact: true })
    .click();
  await expect(speed).toHaveValue("balanced");
  await expect(page.getByLabel("Candidate lines", { exact: true })).toHaveValue(
    "3",
  );
  await expect(page.getByLabel("Engine memory", { exact: true })).toHaveValue(
    "16",
  );
  await expect(
    page.getByLabel("Reuse analysed positions", { exact: false }),
  ).toBeChecked();
  await page.getByText("Add another engine", { exact: true }).click();
  await page.getByLabel("Engine name", { exact: true }).fill("My engine");
  await page
    .getByLabel("Worker path", { exact: true })
    .fill("./engine/custom.js");
  await page
    .getByRole("button", { name: "Register engine", exact: true })
    .click();
  await expect(
    page.getByLabel("Analysis engine", { exact: true }),
  ).not.toHaveValue("stockfish-19-lite");
  await page
    .getByRole("button", { name: "Remove engine My engine", exact: true })
    .click();
  await expect(page.getByLabel("Analysis engine", { exact: true })).toHaveValue(
    "stockfish-19-lite",
  );
  await page.screenshot({
    path: "test-results/engine-settings-" + test.info().project.name + ".png",
    fullPage: true,
  });
});
