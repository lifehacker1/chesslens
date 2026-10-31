import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { openMobileTab } from "./mobile-helpers";
let bundle = "";
test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents:
        'export * from "./src/reviewStorage.ts"; export * from "./src/backgroundJobs.ts"; export * from "./src/archiveLibrary.ts";',
      resolveDir: process.cwd(),
    },
    bundle: true,
    format: "esm",
    write: false,
  });
  bundle = result.outputFiles[0].text;
});
test.beforeEach(async ({ context }) => {
  // Test-only module route; no test hooks ship in the app.
  await context.route("**/__storage-harness.js", (r) =>
    r.fulfill({ contentType: "text/javascript", body: bundle }),
  );
  await context.route("**/__storage-harness.html", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Storage regression</title>",
    }),
  );
});
test("competing tabs preserve analysis, collections and manual saves", async ({
  context,
  page,
}) => {
  await page.goto("/__storage-harness.html");
  const other = await context.newPage();
  await other.goto("/__storage-harness.html");
  const session = {
    version: 1,
    pgn: '[White "Concurrent Alice"]\n[Black "Concurrent Bob"]\n\n1. e4 e5 *',
    ply: 0,
    flipped: false,
    view: "review",
    source: "pgn",
    options: {
      depth: 12,
      movetime: 2000,
      hash: 16,
      multiPV: 3,
      engine: {
        id: "stockfish-19-lite",
        name: "Stockfish 19 Lite",
        url: "./engine/stockfish-19-lite-single.js",
      },
    },
    evaluations: {},
    running: false,
    updatedAt: 1,
    branch: null,
    branchMove: null,
    branchCaptures: null,
    betterMovesOpen: false,
  };
  await page.evaluate(async (s) => {
    const api = await import("/__storage-harness.js");
    await api.saveGame(s);
  }, session);
  await Promise.all(
    [page, other].map((tab, index) =>
      tab.evaluate(
        async ({ session, index }) => {
          const api = await import("/__storage-harness.js");
          await Promise.all(
            Array.from({ length: 12 }, (_, i) =>
              api.saveGame(
                {
                  ...session,
                  ply: index,
                  updatedAt: 100 + i * 2 + index,
                  evaluations: {
                    [index]: {
                      cp: 10,
                      depth: i + 10,
                      best: index ? "e7e5" : "e2e4",
                    },
                  },
                },
                undefined,
                { collections: [index ? "b" : "a"], downloadOnly: true },
              ),
            ),
          );
        },
        { session, index },
      ),
    ),
  );
  const saved = await page.evaluate(async () => {
    const api = await import("/__storage-harness.js");
    return (await api.listSavedGames())[0];
  });
  expect(Object.keys(saved.session.evaluations)).toEqual(["0", "1"]);
  expect(saved.session.evaluations[0].depth).toBe(21);
  expect(saved.session.evaluations[1].depth).toBe(21);
  expect(saved.collections.sort()).toEqual(["a", "b"]);
  expect(saved.downloadOnly).toBe(false);
  expect(saved.session.updatedAt).toBe(123);
  expect(saved.session.ply).toBe(1);
  const app = await context.newPage();
  await app.goto("/");
  await openMobileTab(app, "Games");
  await expect(app.locator(".saved-game-card")).toContainText(
    "Concurrent Alice",
  );
  await page.evaluate(async () => {
    const api = await import("/__storage-harness.js");
    const g = (await api.listSavedGames())[0];
    await api.saveGame(g.session, "Renamed from another tab", {
      downloadOnly: false,
    });
  });
  await expect(app.locator(".saved-game-card")).toContainText(
    "Renamed from another tab",
  );
  await page.evaluate(async () => {
    const api = await import("/__storage-harness.js");
    const g = (await api.listSavedGames())[0];
    await Promise.all([
      api.removeGameCollection(g.id, "a"),
      api.removeGameCollection(g.id, "b"),
    ]);
  });
  const remaining = await page.evaluate(async () => {
    const api = await import("/__storage-harness.js");
    return await api.listSavedGames();
  });
  expect(remaining).toHaveLength(1);
  expect(remaining[0].collections).toEqual([]);
});
test("background jobs wait across tabs and queued cancellation releases cleanly", async ({
  context,
  page,
}) => {
  await page.goto("/__storage-harness.html");
  const other = await context.newPage();
  await other.goto("/__storage-harness.html");
  const first = page.evaluate(async () => {
    const api = await import("/__storage-harness.js");
    return api.withBackgroundJob(new AbortController().signal, async () => {
      (window as any).jobStarted = true;
      await new Promise<void>(
        (resolve) => ((window as any).releaseJob = resolve),
      );
      return "first";
    });
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).jobStarted))
    .toBe(true);
  const second = other.evaluate(async () => {
    const api = await import("/__storage-harness.js");
    const c = new AbortController();
    (window as any).cancelJob = () => c.abort();
    try {
      return await api.withBackgroundJob(c.signal, async () => {
        (window as any).secondStarted = true;
        return "second";
      });
    } catch (e) {
      return (e as Error).name;
    }
  });
  await expect
    .poll(() =>
      other.evaluate(
        async () => (await navigator.locks.query()).pending?.length,
      ),
    )
    .toBe(1);
  expect(
    await other.evaluate(() => (window as any).secondStarted),
  ).toBeUndefined();
  await other.evaluate(() => (window as any).cancelJob());
  expect(await second).toBe("AbortError");
  await page.evaluate(() => (window as any).releaseJob());
  expect(await first).toBe("first");
  expect(
    await other.evaluate(async () => {
      const api = await import("/__storage-harness.js");
      return api.withBackgroundJob(
        new AbortController().signal,
        async () => "resumed",
      );
    }),
  ).toBe("resumed");
});

test("large library loads bounded rows and prepares dashboard coverage", async ({
  page,
}, testInfo) => {
  await page.goto("/__storage-harness.html");
  await page.evaluate(async () => {
    const api = await import("/__storage-harness.js");
    const games = Array.from({ length: 1000 }, (_, i) => {
      const pgn =
        '[Event "Benchmark ' +
        i +
        '"]\n[White "Benchmark Alice"]\n[Black "Benchmark Bob"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 *';
      return {
        id: api.canonicalPgn(pgn),
        name: "Benchmark " + i,
        session: {
          version: 1,
          pgn,
          ply: 0,
          flipped: false,
          view: "review",
          source: "pgn",
          options: {
            depth: 12,
            movetime: 2000,
            hash: 16,
            multiPV: 3,
            engine: {
              id: "stockfish-19-lite",
              name: "Stockfish Lite",
              url: "./engine/stockfish-19-lite-single.js",
            },
          },
          evaluations: Object.fromEntries(
            Array.from({ length: 11 }, (_, j) => [
              j,
              { cp: 0, depth: 12, best: "" },
            ]),
          ),
          running: false,
          updatedAt: i + 1,
          branch: null,
          branchMove: null,
          branchCaptures: null,
          betterMovesOpen: false,
        },
      };
    });
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open("chesslens-reviews", 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore("sessions");
        r.result.createObjectStore("games", { keyPath: "id" });
      };
      r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction("games", "readwrite");
        games.forEach((g) => tx.objectStore("games").put(g));
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onabort = () => reject(tx.error);
      };
    });
  });
  await page.goto("/");
  const start = Date.now();
  await openMobileTab(page, "Games");
  await expect(page.locator(".game-row.saved-game-card")).toHaveCount(30, {
    timeout: 30000,
  });
  const libraryMs = Date.now() - start;
  const patternsStart = Date.now();
  await openMobileTab(page, "Insights");
  await expect(
    page.getByRole("region", { name: "Personal weakness dashboard" }),
  ).toContainText("5000 analysed moves across 1000 games", { timeout: 60000 });
  const metrics = {
    games: 1000,
    pliesPerGame: 10,
    libraryMs,
    dashboardMs: Date.now() - patternsStart,
    project: testInfo.project.name,
  };
  console.log("Library benchmark", JSON.stringify(metrics));
  await testInfo.attach("library-benchmark", {
    body: JSON.stringify(metrics, null, 2),
    contentType: "application/json",
  });
});

test("queued analysis uses the current collection manifest", async ({
  page,
  context,
}) => {
  await page.goto("/__storage-harness.html");
  const other = await context.newPage();
  await other.goto("/__storage-harness.html");
  const collection = {
    version: 1,
    id: "queued",
    username: "queued",
    archives: [],
    finished: [],
    state: "complete",
    analysis: "paused",
    updatedAt: 1,
    error: "",
    skipped: 0,
  };
  await page.evaluate(async (c) => {
    const api = await import("/__storage-harness.js");
    await api.storeCollection(c);
  }, collection);
  const holder = page.evaluate(async () => {
    const api = await import("/__storage-harness.js");
    await api.withBackgroundJob(
      new AbortController().signal,
      () =>
        new Promise<void>((resolve) => {
          (window as any).releaseJob = resolve;
        }),
    );
  });
  await expect
    .poll(() => page.evaluate(() => typeof (window as any).releaseJob))
    .toBe("function");
  const queued = other.evaluate(async (c) => {
    const api = await import("/__storage-harness.js");
    await api.analyseCollection(
      c,
      {
        depth: 12,
        movetime: 2000,
        hash: 16,
        multiPV: 3,
        engine: {
          id: "stockfish-19-lite",
          name: "Stockfish Lite",
          url: "./engine/stockfish-19-lite-single.js",
        },
      },
      new AbortController().signal,
      () => {},
    );
  }, collection);
  await expect
    .poll(() =>
      other.evaluate(
        async () => (await navigator.locks.query()).pending?.length,
      ),
    )
    .toBe(1);
  await page.evaluate(async (c) => {
    const api = await import("/__storage-harness.js");
    await api.storeCollection({
      ...c,
      archives: ["new-month"],
      finished: ["new-month"],
      updatedAt: 2,
    });
    (window as any).releaseJob();
  }, collection);
  await Promise.all([holder, queued]);
  const current = await page.evaluate(async () => {
    const api = await import("/__storage-harness.js");
    return (await api.collections())[0];
  });
  expect(current.finished).toEqual(["new-month"]);
  expect(current.analysis).toBe("complete");
});
