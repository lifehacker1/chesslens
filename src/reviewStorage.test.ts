import { afterEach, expect, it, vi } from "vitest";
import {
  canonicalPgn,
  validateSession,
  sameOptions,
  validOptions,
  checkpoint,
  readAnalysisSettings,
  writeAnalysisSettings,
  type ReviewSession,
} from "./reviewStorage";
import { defaultOptions } from "./engine";
const session: ReviewSession = {
  version: 1,
  pgn: "1. e4 e5 *",
  ply: 1,
  flipped: true,
  view: "review",
  source: "pgn",
  options: defaultOptions,
  evaluations: { 0: { cp: 12, depth: 12, best: "e2e4" } },
  running: false,
  updatedAt: 1,
  branch: null,
  branchMove: null,
  branchCaptures: null,
  betterMovesOpen: false,
};
afterEach(() => vi.unstubAllGlobals());
it("rejects corrupt or future records and illegal PGNs", () => {
  expect(validateSession({ ...session, version: 2 })).toBeNull();
  expect(validateSession({ ...session, pgn: "garbage" })).toBeNull();
  expect(validateSession(null)).toBeNull();
});
it("clamps navigation and drops malformed analysis", () => {
  const restored = validateSession({
    ...session,
    ply: 999,
    evaluations: {
      0: session.evaluations[0],
      1: { cp: NaN },
      99: session.evaluations[0],
    },
  })!;
  expect(restored.ply).toBe(2);
  expect(Object.keys(restored.evaluations)).toEqual(["0"]);
});
it("distinguishes engine versions and search options", () => {
  expect(sameOptions(defaultOptions, { ...defaultOptions, depth: 18 })).toBe(
    false,
  );
  expect(
    sameOptions(defaultOptions, {
      ...defaultOptions,
      engine: { ...defaultOptions.engine, id: "new-version" },
    }),
  ).toBe(false);
  expect(validOptions({ depth: -1 })).toEqual(defaultOptions);
});
it("deduplicates formatting variations", () => {
  expect(canonicalPgn("1. e4 e5 *")).toBe(canonicalPgn("1. e4   e5 *"));
});
it("stores settings independently of recovery checkpoint and excludes bulky analysis", () => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k),
    setItem: (k: string, v: string) => store.set(k, v),
  });
  writeAnalysisSettings({ ...defaultOptions, depth: 18 });
  checkpoint(session);
  expect(readAnalysisSettings().depth).toBe(18);
  expect(
    JSON.parse(store.get("chesslens-review-checkpoint-v1")!).evaluations,
  ).toEqual({});
});

it("analysis identity ignores player labels but separates settings and game positions", async () => {
  const { analysisKey } = await import("./reviewStorage");
  expect(analysisKey('[White "A"]\n\n1. e4 e5 *', defaultOptions)).toBe(
    analysisKey('[White "B"]\n\n1. e4 e5 *', defaultOptions),
  );
  expect(analysisKey("1. e4 e5 *", defaultOptions)).not.toBe(
    analysisKey("1. d4 d5 *", defaultOptions),
  );
  expect(analysisKey("1. e4 e5 *", defaultOptions)).not.toBe(
    analysisKey("1. e4 e5 *", { ...defaultOptions, depth: 18 }),
  );
});

it("preserves deeper saved analysis when an older active review is updated", async () => {
  const { mergeSavedAnalysis } = await import("./reviewStorage");
  const previous = {
    ...session,
    evaluations: {
      0: { cp: 25, depth: 18, best: "e2e4" },
      1: { cp: 10, depth: 12, best: "e7e5" },
    },
  };
  const merged = mergeSavedAnalysis(previous, session);
  expect(merged.evaluations[0].depth).toBe(18);
  expect(merged.evaluations[1].cp).toBe(10);
  expect(
    mergeSavedAnalysis(previous, {
      ...session,
      options: { ...session.options, depth: 20 },
    }).evaluations,
  ).toEqual(session.evaluations);
});
