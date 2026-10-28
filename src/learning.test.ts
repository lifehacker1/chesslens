import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { parseGame, type Evaluation } from "./game";
import {
  criticalMoments,
  legalLine,
  lessons,
  nextPractice,
  solvesLesson,
  explainMove,
} from "./learning";
import openings from "./openings.json";
const e = (cp: number, best: string): Evaluation => ({ cp, best, depth: 12 });
describe("learning chess rules", () => {
  it("retains only the legal prefix of an engine variation", () => {
    const c = new Chess();
    const line = legalLine(c.fen(), ["e2e4", "e7e5", "e1e8", "g1f3"]);
    expect(line.map((m) => m.san)).toEqual(["e4", "e5"]);
    expect(new Chess(line[1].fen).turn()).toBe("w");
  });
  it("preserves castling, en passant and underpromotion", () => {
    const promotion = legalLine("7k/P7/8/8/8/8/8/7K w - - 0 1", ["a7a8n"]);
    expect(new Chess(promotion[0].fen).get("a8")?.type).toBe("n");
    expect(
      legalLine("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", ["e1g1"])[0].san,
    ).toBe("O-O");
    expect(legalLine("7k/8/8/3pP3/8/8/8/7K w - d6 0 1", ["e5d6"])[0].san).toBe(
      "exd6",
    );
  });
  it("only flags analysed moves and normalises losses for both colours", () => {
    const g = parseGame("1. e4 e5 *");
    const result = criticalMoments(g, {
      0: e(300, "d2d4"),
      1: e(-300, "c7c5"),
      2: e(300, "g1f3"),
    });
    expect(result).toHaveLength(2);
    expect(result[0].loss).toBeCloseTo(result[1].loss);
    expect(criticalMoments(g, { 0: e(300, "d2d4") })).toEqual([]);
  });
  it("does not invent engine commentary before results exist", () => {
    const facts = explainMove(parseGame("1. e4 *"), 1, {}).join(" ");
    expect(facts).toContain("Analyse both positions");
    expect(facts).not.toContain("engine prefers");
  });
  it("gives each curated lesson a legal working solution", () => {
    const answers = ["e3e4", "e5e6", "a3e3", "g6g7", "a7a8"];
    lessons.forEach((l, i) => {
      expect(solvesLesson(l, answers[i]), l.name).toBe(true);
      expect(solvesLesson(l, "a1a8")).toBe(false);
    });
  });
  it("schedules assisted practice sooner and increases successful intervals", () => {
    expect(nextPractice(0, false, 0)).toEqual({ streak: 1, due: 86400000 });
    expect(nextPractice(1, false, 0).due).toBe(3 * 86400000);
    expect(nextPractice(4, true, 0)).toEqual({ streak: 0, due: 600000 });
  });
  it("vendors reproducible legal opening positions", () => {
    for (const o of openings) {
      const line = legalLine(new Chess().fen(), o.moves);
      expect(line.length, o.name).toBe(o.moves.length);
      expect(line.at(-1)?.fen.split(" ").slice(0, 4).join(" "), o.name).toBe(
        o.position,
      );
    }
  }, 30000);
});

import { validateLearning } from "./learningStorage";
describe("learning storage validation", () => {
  it("rejects future versions and discards corrupt source evidence", () => {
    expect(() =>
      validateLearning({ version: 2, puzzles: [], completed: [] }),
    ).toThrow("Unsupported");
    const before = { cp: 0, best: "e2e4", depth: 12 };
    const p = {
      id: "one",
      fen: new Chess().fen(),
      pgn: "1. e4 *",
      ply: 1,
      title: "Test",
      before,
      attempts: 0,
      streak: 0,
      due: 0,
    };
    expect(
      validateLearning({
        version: 1,
        puzzles: [p],
        completed: ["opposition", "opposition", "unknown"],
      }).completed,
    ).toEqual(["opposition"]);
    expect(
      validateLearning({
        version: 1,
        puzzles: [{ ...p, fen: "invalid" }],
        completed: [],
      }).puzzles,
    ).toEqual([]);
    expect(
      validateLearning({
        version: 1,
        puzzles: [{ ...p, before: { ...before, lines: "invalid" } }],
        completed: [],
      }).puzzles,
    ).toEqual([]);
  });
});
