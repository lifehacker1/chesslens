import { expect, it } from "vitest";
import { parseBackup } from "./backup";
import { defaultOptions } from "./engine";
const review = {
  version: 1,
  pgn: "1. e4 e5 *",
  ply: 1,
  flipped: false,
  view: "review",
  source: "pgn",
  options: defaultOptions,
  evaluations: { 0: { cp: 0, depth: 12, best: "e2e4" } },
  running: false,
  updatedAt: 1,
  branch: null,
  branchMove: null,
  branchCaptures: null,
  betterMovesOpen: false,
};
const data = () => ({
  format: "chesslens-backup",
  version: 1,
  createdAt: "2026-10-31",
  games: [{ id: "untrusted-id", name: "Game", session: review }],
  current: review,
  analyses: [review],
  learning: { version: 1, puzzles: [], completed: [] },
  collections: [],
  preferences: {},
});
it("validates full backups and recalculates game identities", () => {
  const backup = parseBackup(JSON.stringify(data()));
  expect(backup.games[0].id).not.toBe("untrusted-id");
  expect(backup.current?.ply).toBe(1);
  expect(backup.analyses[0].evaluations[0].depth).toBe(12);
});
it("rejects future formats and malformed analysis before writes", () => {
  expect(() => parseBackup("{bad")).toThrow();
  expect(() => parseBackup(JSON.stringify({ ...data(), version: 2 }))).toThrow(
    "unsupported",
  );
  expect(() =>
    parseBackup(
      JSON.stringify({
        ...data(),
        games: [
          {
            name: "Bad",
            session: { ...review, evaluations: { 0: { cp: "bad" } } },
          },
        ],
      }),
    ),
  ).toThrow("corrupt analysis");
});
it("rejects unsafe engines, unknown preferences and invalid practice records", () => {
  expect(() =>
    parseBackup(
      JSON.stringify({ ...data(), preferences: { "other-app": "123" } }),
    ),
  ).toThrow();
  expect(() =>
    parseBackup(
      JSON.stringify({ ...data(), preferences: { "chesslens-touch": "null" } }),
    ),
  ).toThrow();
  expect(() =>
    parseBackup(
      JSON.stringify({
        ...data(),
        analyses: [
          {
            ...review,
            options: {
              ...defaultOptions,
              engine: {
                id: "external",
                name: "External",
                url: "https://bad.example/engine.js",
              },
            },
          },
        ],
      }),
    ),
  ).toThrow();
  expect(() =>
    parseBackup(
      JSON.stringify({
        ...data(),
        learning: { version: 1, puzzles: [{}], completed: [] },
      }),
    ),
  ).toThrow();
});
it("accepts earlier collection exports and pauses restored jobs", () => {
  const c = {
    version: 1,
    id: "alice",
    username: "alice",
    archives: ["https://api.chess.com/pub/player/alice/games/2026/10"],
    finished: [],
    state: "downloading",
    analysis: "running",
    skipped: 0,
  };
  const backup = parseBackup(
    JSON.stringify({ version: 1, collection: c, games: data().games }),
  );
  expect(backup.collections[0].state).toBe("paused");
  expect(backup.collections[0].analysis).toBe("paused");
  expect(() =>
    parseBackup(
      JSON.stringify({
        version: 1,
        collection: { ...c, archives: ["https://bad.example/2026/10"] },
        games: [],
      }),
    ),
  ).toThrow();
});

it("accepts disabled automatic sync in preferences without coercing it", () => {
  const backup = parseBackup(
    JSON.stringify({
      ...data(),
      preferences: { "chesslens-auto-sync-v1": "false" },
    }),
  );
  expect(backup.preferences["chesslens-auto-sync-v1"]).toBe("false");
});

it("preserves current practice progress when restoring an older matching puzzle", async () => {
  const { mergeLearningData } = await import("./learningStorage");
  const puzzle = {
    id: "p",
    fen: "",
    pgn: "",
    ply: 1,
    title: "Practice",
    before: { cp: 0, depth: 12, best: "e2e4" },
    attempts: 4,
    streak: 2,
    due: 500,
  };
  const current = {
    version: 1 as const,
    puzzles: [puzzle],
    completed: ["opposition"],
  };
  const incoming = {
    version: 1 as const,
    puzzles: [
      { ...puzzle, attempts: 1, due: 10 },
      { ...puzzle, id: "new" },
    ],
    completed: ["passed"],
  };
  const merged = mergeLearningData(current, incoming);
  expect(merged.puzzles).toHaveLength(2);
  expect(merged.puzzles.find((p) => p.id === "p")).toEqual(puzzle);
  expect(merged.completed).toEqual(["opposition", "passed"]);
});
