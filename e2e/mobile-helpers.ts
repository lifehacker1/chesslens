import type { Page } from "@playwright/test";
export async function openMobileTab(
  page: Page,
  tab: "Review" | "Games" | "Insights" | "Settings",
) {
  await page.locator(".app").waitFor({ state: "visible" });
  const nav = page.getByRole("navigation", { name: "App navigation" });
  if (await nav.isVisible())
    await nav.getByRole("button", { name: tab, exact: true }).click();
}
export async function clickReviewTool(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true });
  if (!(await button.isVisible()))
    await page.locator(".replay-menu summary").click();
  await button.click();
}
