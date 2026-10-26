import type { Page } from "@playwright/test";
export async function openMobileTab(
  page: Page,
  tab: "Review" | "Games" | "Insights" | "Settings",
) {
  const nav = page.getByRole("navigation", { name: "App navigation" });
  if (await nav.isVisible())
    await nav.getByRole("button", { name: tab, exact: true }).click();
}
