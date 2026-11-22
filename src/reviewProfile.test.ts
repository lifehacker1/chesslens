import { describe, it, expect } from "vitest";
import { compareMove, expectedPointLoss } from "./review";
import { parseGame, type Evaluation } from "./game";
import { reviewProfile, reviewMoveLabel } from "./reviewProfile";
import { uci } from "./learning";
const e = (cp: number, best = "e2e4", depth = 12): Evaluation => ({
  cp,
  best,
  depth,
});
describe("consistent search comparisons", () => {
  it("uses a same-position candidate instead of a contradictory later search", () => {
    const before = { ...e(100), lines: [e(100), e(90, "d2d4")] };
    const result = compareMove(before, e(-600), true, "d2d4");
    expect(result.source).toBe("same-position");
    expect(result.loss).toBeLessThan(0.02);
    expect(
      compareMove(
        { ...e(-100, "e7e5"), lines: [e(-90, "d7d5")] },
        e(600),
        false,
        "d7d5",
      ).loss,
    ).toBeCloseTo(result.loss);
  });
  it("rejects stale-depth candidates and mismatched principal variations", () => {
    const before = { ...e(100), lines: [e(90, "d2d4", 8)] };
    expect(compareMove(before, e(-600), true, "d2d4").source).toBe(
      "position-pair",
    );
    expect(
      compareMove(
        { ...before, lines: [{ ...e(90, "d2d4"), pv: ["g1f3"] }] },
        e(-600),
        true,
        "d2d4",
      ).source,
    ).toBe("position-pair");
    expect(expectedPointLoss(before, e(-600), true, "d2d4")).toBeGreaterThan(
      0.2,
    );
  });
  it("reports cross-engine and search-depth uncertainty", () => {
    const comparison = compareMove(
      { ...e(100), engine: "A" },
      { ...e(0, "", 6), engine: "B" },
      true,
      "d2d4",
    );
    expect(comparison.engineMismatch).toBe(true);
    expect(comparison.depthGap).toBe(6);
  });
});
describe("game category profiles", () => {
  const game = parseGame(
    '[White "Alice"]\n[Black "Bob"]\n\n1. e4 e5 2. Nf3 Nc6 *',
  );
  const evaluations = Object.fromEntries(
    game.fens.map((_, i) => [
      i,
      e(0, game.moves[i] ? uci(game.moves[i]) : "", 6),
    ]),
  );
  it("keeps absent categories empty and excludes missing analysis from scores", () => {
    const profile = reviewProfile(game, {}, "w");
    expect(profile.expected).toBe(2);
    expect(profile.available).toBe(0);
    expect(profile.categories.every((c) => c.score === null)).toBe(true);
    const complete = reviewProfile(game, evaluations, "w");
    expect(complete.available).toBe(2);
    expect(complete.categories.find((c) => c.key === "opening")?.score).toBe(
      100,
    );
    expect(
      complete.categories.find((c) => c.key === "endgame")?.score,
    ).toBeNull();
    expect(
      complete.categories
        .find((c) => c.key === "opening")
        ?.samples.map((s) => s.ply),
    ).toEqual([1, 3]);
  });
  it("attributes the selected players moves and excludes mixed-engine pairs", () => {
    expect(
      reviewProfile(game, evaluations, "b")
        .categories.find((c) => c.key === "opening")
        ?.samples.map((s) => s.ply),
    ).toEqual([2, 4]);
    const mixed = {
      ...evaluations,
      0: { ...evaluations[0], best: "d2d4", engine: "A" },
      1: { ...evaluations[1], engine: "B" },
    };
    const profile = reviewProfile(game, mixed, "w");
    expect(profile.available).toBe(1);
    expect(profile.engineMismatch).toBe(1);
  });
  it("requires legal forcing recommendations before labelling a tactical decision", () => {
    const quiet = reviewProfile(game, { ...evaluations, 0: e(0, "a1a8") }, "w");
    expect(
      quiet.categories.find((c) => c.key === "tactics")?.samples,
    ).toHaveLength(0);
    const tactical = parseGame("1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0");
    const result = reviewProfile(
      tactical,
      { 6: e(900, "h5f7"), 7: { ...e(10000, ""), mate: 0 } },
      "w",
    );
    expect(
      result.categories
        .find((c) => c.key === "tactics")
        ?.evidence.map((s) => s.san),
    ).toContain("Qxf7#");
  });
});

it("keeps actual move numbers for Black-to-move setup games", () => {
  const game = parseGame(
    '[SetUp "1"]\n[FEN "8/8/8/8/8/5k2/6p1/4K3 b - - 0 15"]\n\n15... g1=Q+ *',
  );
  expect(reviewMoveLabel(game, 1)).toBe("15... g1=Q+");
});
