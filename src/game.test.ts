import { describe, it, expect } from "vitest";
import {
  accuracy,
  classify,
  demo,
  loss,
  parseGame,
  type Evaluation,
} from "./game";
const e = (cp: number, best = "e2e4"): Evaluation => ({ cp, best, depth: 12 });
describe("PGN replay", () => {
  it("replays all demo moves through checkmate", () => {
    const g = parseGame(demo);
    expect(g.moves).toHaveLength(33);
    expect(g.fens).toHaveLength(34);
    expect(g.moves.at(-1)?.san).toBe("Rd8#");
    expect(g.headers.White).toBe("Paul Morphy");
  });
  it("rejects empty and illegal input", () => {
    expect(() => parseGame("")).toThrow();
    expect(() => parseGame("1. e5")).toThrow();
    expect(() => parseGame('[Event "No moves"]')).toThrow();
  });
  it("supports FEN starts and black-to-move games", () => {
    const g = parseGame(
      '[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/8/4K3 b - - 0 20"]\n\n20... Kf7 *',
    );
    expect(g.moves[0].color).toBe("b");
    expect(g.fens[0].split(" ")[5]).toBe("20");
  });
  it("handles castling and promotion", () => {
    expect(
      parseGame("1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. O-O").moves.at(-1)?.san,
    ).toBe("O-O");
    expect(
      parseGame('[SetUp "1"]\n[FEN "7k/P7/8/8/8/8/8/7K w - - 0 1"]\n\n1. a8=Q+')
        .moves[0].promotion,
    ).toBe("q");
  });
});
describe("review estimates", () => {
  it("normalizes loss to the mover and never rewards negative loss", () => {
    expect(loss(e(100), e(-150), true)).toBe(250);
    expect(loss(e(-100), e(150), false)).toBe(250);
    expect(loss(e(0), e(100), true)).toBe(0);
  });
  it("classifies exact best moves and every loss band", () => {
    expect(classify(e(0), e(-800), "e2e4", true)).toBe("Best");
    for (const [cp, label] of [
      [15, "Excellent"],
      [50, "Good"],
      [100, "Inaccuracy"],
      [200, "Mistake"],
      [201, "Blunder"],
    ] as const)
      expect(classify(e(0), e(-cp), "d2d4", true)).toBe(label);
  });
  it("does not invent accuracy before analysis", () => {
    expect(accuracy([])).toBeNull();
    expect(accuracy([0, 0])).toBe(100);
    expect(accuracy([220])).toBe(37);
  });
});
