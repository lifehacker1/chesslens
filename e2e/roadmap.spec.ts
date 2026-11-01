import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { openMobileTab } from "./mobile-helpers";
let bundle = "";
test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents:
        'export * from "./src/reviewStorage.ts"; export * from "./src/archiveLibrary.ts"; export * from "./src/engine.ts"; export * from "./src/learningStorage.ts"; export * from "./src/jobs.ts";',
      resolveDir: process.cwd(),
    },
    bundle: true,
    format: "esm",
    write: false,
  });
  bundle = result.outputFiles[0].text;
});
test.beforeEach(async ({ context }) => {
  await context.route("**/__roadmap.js", (r) =>
    r.fulfill({ contentType: "text/javascript", body: bundle }),
  );
  await context.route("**/__roadmap.html", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Roadmap tests</title>",
    }),
  );
});
async function seed(page: import("@playwright/test").Page) {
  await page.goto("/__roadmap.html");
  await page.evaluate(async () => {
    const api = await import("/__roadmap.js");
    localStorage.setItem("chesslens-auto-sync-v1", "false");
    const options = {
      ...api.defaultOptions,
      depth: 4,
      movetime: 30,
      hash: 16,
      multiPV: 1,
    };
    const session = api.newSession(
      '[White "Alice"]\n[Black "Bob"]\n[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1',
      options,
    );
    session.evaluations = {
      0: { cp: 0, depth: 4, best: "e2e4" },
      1: { cp: 0, depth: 4, best: "e7e5" },
      2: { cp: 0, depth: 4, best: "g2g3" },
      3: { cp: -10000, mate: -1, depth: 4, best: "d8h4", pv: ["d8h4"] },
      4: { cp: -10000, mate: -0, depth: 4, best: "(none)" },
    };
    await api.saveGame(session, "Learning test");
    await api.persistReview(session);
    for (const depth of [5, 6, 7])
      await api.cacheGameAnalysis({
        ...session,
        options: { ...options, depth },
      });
  });
}
test("storage retention keeps saved games, active review and preferences", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/");
  await openMobileTab(page, "Settings");
  const storage = page.getByRole("region", { name: "Storage management" });
  await expect(storage).toContainText("1 saved games");
  await page.getByLabel("Analysis cache retention").selectOption("0");
  await storage
    .getByRole("button", { name: "Trim recent analysis cache" })
    .click();
  await expect(storage).toContainText("Recent analysis cache trimmed");
  const counts = await page.evaluate(async () => {
    const api = await import("/__roadmap.js");
    return {
      games: (await api.listSavedGames()).length,
      cache: (await api.listAnalysisBackups()).length,
    };
  });
  expect(counts.games).toBe(1);
  expect(counts.cache).toBe(1);
  await page.reload();
  await openMobileTab(page, "Settings");
  await expect(page.getByLabel("Analysis cache retention")).toHaveValue("0");
});
test("opening outcomes, tactical evidence, practice sets and deeper analysis work together", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/");
  await openMobileTab(page, "Insights");
  await page.getByLabel("Dashboard player").selectOption("Alice");
  const openings = page.getByRole("region", {
    name: "Personal opening results",
  });
  await expect(openings).toContainText("0 / 0 / 1");
  const tactics = page.getByRole("region", { name: "Tactical evidence" });
  await tactics.getByText(/Allows mate in one  - /).click();
  await expect(tactics).toContainText("Qh4# is legal checkmate");
  await tactics
    .getByRole("button", { name: "Practise allows mate in one" })
    .click();
  await expect(tactics).toContainText("Practice set saved");
  await openMobileTab(page, "Learn");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Practice progress" }),
  ).toContainText("1 due");
  await page.locator(".practice-list article > button").first().click();
  await page
    .getByRole("button", { name: "Reveal solution", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Practice progress" }),
  ).toContainText("1 recorded reviews");
  await page.getByRole("button", { name: "Move coach", exact: true }).click();
  await page
    .getByRole("button", { name: "Deepen critical positions", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Adaptive critical analysis" }),
  ).toContainText("Deeper critical positions saved", { timeout: 60000 });
  await openMobileTab(page, "Settings");
  await expect(page.getByRole("region", { name: "Job manager" })).toContainText(
    "Deepen critical positions",
  );
  await expect(page.getByRole("region", { name: "Job manager" })).toContainText(
    "completed",
  );
  await page.reload();
  await openMobileTab(page, "Learn");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Practice progress" }),
  ).toContainText("1 recorded reviews");
});
test("practice edits from competing tabs preserve attempts and new puzzles", async ({
  page,
  context,
}) => {
  await seed(page);
  const other = await context.newPage();
  await other.goto("/__roadmap.html");
  const base = await page.evaluate(async () => {
    const api = await import("/__roadmap.js");
    const s = (await api.listSavedGames())[0].session;
    const puzzle = {
      id: "position",
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      pgn: s.pgn,
      ply: 1,
      title: "position",
      before: s.evaluations[0],
      attempts: 0,
      streak: 0,
      due: 0,
    };
    const base = { version: 1, puzzles: [puzzle], completed: [] };
    await api.saveLearning(base);
    return base;
  });
  await Promise.all(
    [page, other].map((tab, i) =>
      tab.evaluate(
        async ({ base, i }) => {
          const api = await import("/__roadmap.js");
          await api.editLearning(
            {
              ...base,
              puzzles: [
                {
                  ...base.puzzles[0],
                  attempts: 1,
                  history: [{ at: 100 + i, assisted: false }],
                },
                { ...base.puzzles[0], id: "new" + i },
              ],
            },
            base,
          );
        },
        { base, i },
      ),
    ),
  );
  const result = await page.evaluate(async () => {
    const api = await import("/__roadmap.js");
    return api.loadLearning();
  });
  expect(result.puzzles).toHaveLength(3);
  expect(result.puzzles.find((p: any) => p.id === "position").attempts).toBe(2);
});
test("job controls pause, resume and cancel active sync from Settings", async ({
  page,
}) => {
  await seed(page);
  await page.evaluate(() =>
    localStorage.setItem("chesslens_cc_user", "queueuser"),
  );
  let release = () => {};
  await page.route(
    "https://api.chess.com/pub/player/queueuser/games/archives",
    async (r) => {
      await new Promise<void>((resolve) => (release = resolve));
      await r.fulfill({ json: { archives: [] } }).catch(() => {});
    },
  );
  await page.goto("/");
  await openMobileTab(page, "Settings");
  await page
    .getByRole("region", { name: "Latest game sync settings" })
    .getByRole("button", { name: "Check again", exact: true })
    .click();
  const row = page
    .getByRole("region", { name: "Job manager" })
    .locator(".job-row")
    .filter({ hasText: "Latest game: queueuser" });
  await expect(row).toContainText("running");
  await row.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(row).toContainText("paused");
  await row.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(row).toContainText("running");
  await row.getByRole("button", { name: "Cancel", exact: true }).click();
  release();
  await expect(row).toContainText("cancelled");
});
