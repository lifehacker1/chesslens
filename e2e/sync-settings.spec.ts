import { test, expect } from "@playwright/test";
import { openMobileTab } from "./mobile-helpers";
test("sync opt-out persists and explicit checks fetch newer games without enabling automation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("sync-test-initialized")) {
      localStorage.setItem("chesslens-auto-sync-v1", "false");
      localStorage.setItem("chesslens_cc_user", "syncuser");
      localStorage.setItem("sync-test-initialized", "yes");
    }
  });
  const base = "https://api.chess.com/pub/player/syncuser/games/";
  let calls = 0,
    latest = 1,
    hold = false,
    release = () => {};
  await page.route(base + "archives", async (r) => {
    calls++;
    if (hold) await new Promise<void>((resolve) => (release = resolve));
    await r.fulfill({ json: { archives: [base + "2026/11"] } }).catch(() => {});
  });
  await page.route(base + "2026/11", (r) =>
    r.fulfill({
      json: {
        games: [
          {
            url: "https://www.chess.com/game/live/" + latest,
            pgn:
              '[White "syncuser"]\n[Black "Opponent' +
              latest +
              '"]\n\n1. e4 e5 *',
            rules: "chess",
            end_time: latest,
            time_class: "blitz",
          },
        ],
      },
    }),
  );
  await page.goto("/");
  await openMobileTab(page, "Settings");
  await page
    .getByLabel("Review speed", { exact: true })
    .selectOption("battery");
  const controls = page.getByRole("region", {
    name: "Latest game sync settings",
  });
  const toggle = controls.getByLabel(
    "Automatically fetch and analyse my latest game",
  );
  await expect(toggle).not.toBeChecked();
  await expect(
    controls.getByRole("button", { name: "Check again", exact: true }),
  ).toBeEnabled();
  expect(calls).toBe(0);
  await controls
    .getByRole("button", { name: "Check again", exact: true })
    .click();
  await expect(controls).toContainText("Latest game analysed and saved", {
    timeout: 30000,
  });
  await expect(toggle).not.toBeChecked();
  expect(calls).toBe(1);
  latest = 2;
  await controls
    .getByRole("button", { name: "Check again", exact: true })
    .click();
  await expect(
    controls.getByRole("button", { name: "Check again", exact: true }),
  ).toBeEnabled({ timeout: 30000 });
  expect(calls).toBe(2);
  await page.reload();
  await expect(toggle).not.toBeChecked();
  await expect(
    controls.getByRole("button", { name: "Check again", exact: true }),
  ).toBeEnabled();
  expect(calls).toBe(2);
  hold = true;
  await controls
    .getByRole("button", { name: "Check again", exact: true })
    .click();
  await expect.poll(() => calls).toBe(3);
  await controls
    .getByRole("button", { name: "Stop latest sync", exact: true })
    .click();
  release();
  hold = false;
  await expect(controls).toContainText("Latest sync stopped");
  await toggle.check();
  await expect(controls).toContainText("Latest game analysed and saved", {
    timeout: 30000,
  });
  expect(calls).toBe(4);
  await toggle.uncheck();
  await page.reload();
  await expect(toggle).not.toBeChecked();
  await expect(
    controls.getByRole("button", { name: "Check again", exact: true }),
  ).toBeEnabled();
  expect(calls).toBe(4);
  await openMobileTab(page, "Games");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page.locator(".saved-game-card")).toHaveCount(2);
});
