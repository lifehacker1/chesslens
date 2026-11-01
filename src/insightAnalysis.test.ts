import { it, expect } from "vitest";
import { parseGame } from "./game";
import {
  identifyOpening,
  openingResults,
  tacticalEvidence,
  adaptiveIndices,
} from "./insightAnalysis";
import {
  emptyLearning,
  mergeLearningEdit,
  validateLearning,
  type Puzzle,
} from "./learningStorage";
import { practiceProgress } from "./PracticeProgress";
import type { PatternGame } from "./patterns.worker";
it("finds opening positions and counts results from the selected side", () => {
  const game = parseGame(
    '[White "Alice"]\n[Black "Bob"]\n[Result "1-0"]\n\n1. e4 e5 1-0',
  );
  const opening = identifyOpening(game);
  const records = [{ game, opening }] as PatternGame[];
  expect(opening.eco).not.toBe("Unknown");
  expect(openingResults(records, "bob")[0].losses).toBe(1);
  expect(openingResults(records, "alice")[0].wins).toBe(1);
  expect(openingResults(records, "other")).toEqual([]);
});
it("requires a legal reply and distinguishes mate, checks and captures", () => {
  expect(
    tacticalEvidence(parseGame("1. e4 *").fens[1], {
      cp: 0,
      depth: 10,
      best: "a1a8",
    }),
  ).toEqual([]);
  const fen = parseGame("1. f3 e5 2. g4 *").fens.at(-1)!;
  expect(
    tacticalEvidence(fen, { cp: -10000, depth: 10, best: "d8h4" }).map(
      (f) => f.family,
    ),
  ).toContain("Allows mate in one");
});
it("bounds adaptive analysis and includes both positions around each loss", () => {
  expect(
    adaptiveIndices(
      [
        { ply: 2, loss: 0.2 },
        { ply: 3, loss: 0.9 },
      ],
      1,
    ),
  ).toEqual([2, 3]);
  expect(
    adaptiveIndices(
      [
        { ply: 2, loss: 0.2 },
        { ply: 3, loss: 0.9 },
      ],
      2,
    ),
  ).toEqual([1, 2, 3]);
});
const puzzle: Puzzle = {
  id: "one",
  fen: parseGame("1. e4 *").fens[0],
  pgn: "1. e4 *",
  ply: 1,
  title: "one",
  before: { cp: 0, depth: 10, best: "e2e4" },
  attempts: 0,
  streak: 0,
  due: 0,
};
it("preserves concurrent practice additions and increments attempts atomically", () => {
  const base = { ...emptyLearning(), puzzles: [puzzle] },
    current = {
      ...base,
      puzzles: [
        { ...puzzle, attempts: 1 },
        { ...puzzle, id: "two" },
      ],
    };
  const result = mergeLearningEdit(
    current,
    {
      ...base,
      puzzles: [
        { ...puzzle, attempts: 1, history: [{ at: 100, assisted: false }] },
      ],
    },
    base,
  );
  expect(result.puzzles).toHaveLength(2);
  expect(result.puzzles[0].attempts).toBe(2);
  expect(result.puzzles[0].streak).toBe(1);
});
it("counts recorded reviews without inventing history for legacy attempts", () => {
  const now = 100 * 86400000;
  const p = {
    ...puzzle,
    attempts: 20,
    streak: 3,
    history: [
      { at: now - 86400000, assisted: false },
      { at: now, assisted: true },
    ],
  };
  expect(practiceProgress([p], now)).toEqual({
    due: 1,
    established: 1,
    reviews: 2,
    unassisted: 1,
    days: 2,
  });
  expect(practiceProgress([puzzle], now).reviews).toBe(0);
  expect(
    validateLearning({
      ...emptyLearning(),
      puzzles: [{ ...puzzle, history: [{ at: -1, assisted: false }] }],
    }).puzzles,
  ).toHaveLength(0);
});
