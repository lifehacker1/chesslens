import { describe, it, expect, vi, afterEach } from "vitest";
import { Chess } from "chess.js";
import { classify, accuracy, isCriticalGrade, type Evaluation } from "./game";
import {
  expectedPoints,
  expectedPointLoss,
  classifyExpectedLoss,
} from "./review";
import { readBoardPreferences } from "./BoardAppearance";
const e = (cp: number, best = "e2e4"): Evaluation => ({ cp, best, depth: 12 });
afterEach(() => vi.unstubAllGlobals());
describe("expected-points review", () => {
  it("uses the published category boundaries and normalizes to each player", () => {
    for (const [value, label] of [
      [0, "Excellent"],
      [0.02, "Excellent"],
      [0.05, "Good"],
      [0.1, "Inaccuracy"],
      [0.2, "Mistake"],
      [0.201, "Blunder"],
    ] as const)
      expect(classifyExpectedLoss(value)).toBe(label);
    expect(expectedPoints(e(0))).toBe(0.5);
    expect(expectedPointLoss(e(100), e(0), true)).toBeCloseTo(
      expectedPointLoss(e(-100), e(0), false),
    );
  });
  it("makes the same centipawn swing less costly in an already winning position", () => {
    expect(classify(e(1000), e(900), "d2d4", true)).toBe("Excellent");
    expect(classify(e(100), e(0), "d2d4", true)).toBe("Inaccuracy");
  });
  it("keeps exact best moves at 100% and leaves unanalysed summaries empty", () => {
    expect(classify(e(0), e(-300), "e2e4", true)).toBe("Best");
    expect(accuracy([])).toBeNull();
    expect(accuracy([0])).toBe(100);
    expect(accuracy([0.2])).toBe(30);
  });
  it("recognizes a verified sound non-pawn sacrifice from the actual engine line", () => {
    const board = new Chess("4k3/8/8/4p3/8/8/3R4/4K3 w - - 0 1");
    const move = board.move("Rd4");
    const before = {
      ...e(100, "d2d4"),
      pv: ["d2d4", "e5d4"],
      lines: [{ ...e(100, "d2d4"), pv: ["d2d4", "e5d4"] }, e(0, "d2d3")],
    };
    expect(classify(before, e(80), "d2d4", true, { move })).toBe("Brilliant");
    expect(
      classify({ ...before, pv: [], lines: [] }, e(80), "d2d4", true, { move }),
    ).not.toBe("Brilliant");
  });
  it("requires a clear second-choice gap for Great, not just a routine best move", () => {
    const move = new Chess().move("e4");
    expect(
      classify(
        { ...e(100), lines: [e(100), e(-250, "d2d4")] },
        e(100),
        "e2e4",
        true,
        { move },
      ),
    ).toBe("Great");
    expect(
      classify(
        { ...e(100), lines: [e(100), e(90, "d2d4")] },
        e(100),
        "e2e4",
        true,
        { move },
      ),
    ).toBe("Best");
  });
  it("only calls a Miss when a new winning chance was created by the opponent", () => {
    const move = new Chess().move("e4");
    expect(
      classify(e(400, "d2d4"), e(0), "e2e4", true, { move, previous: e(0) }),
    ).toBe("Miss");
    expect(
      classify(e(400, "d2d4"), e(0), "e2e4", true, { move, previous: e(400) }),
    ).toBe("Blunder");
    expect(isCriticalGrade("Miss")).toBe(true);
  });
  it("uses mate direction rather than a finite pawn score for expected outcome", () => {
    expect(expectedPoints({ ...e(10000), mate: 3 })).toBe(1);
    expect(expectedPoints({ ...e(-10000), mate: -2 })).toBe(0);
  });
});
describe("saved board preferences", () => {
  it("defaults to classic green with badges enabled and rejects unknown theme IDs", () => {
    vi.stubGlobal("localStorage", { getItem: () => '{"theme":"unknown"}' });
    expect(readBoardPreferences()).toEqual({
      theme: "classic",
      badges: true,
      pieceFinish: "sculpted",
    });
  });
  it("restores known themes and the badge preference", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => '{"theme":"walnut","badges":false,"pieceFinish":"flat"}',
    });
    expect(readBoardPreferences()).toEqual({
      theme: "walnut",
      badges: false,
      pieceFinish: "flat",
    });
  });
});
