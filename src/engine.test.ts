import { describe, it, expect } from "vitest";
import { parseInfo, engineUrl } from "./engine";
import { moveAccuracy, pvToSan, reviewLoss } from "./game";
const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
describe("engine review protocol", () => {
  it("keeps candidate ranks and converts Black scores to White perspective", () => {
    const line = parseInfo(
      "info depth 12 multipv 2 score cp 35 nodes 60 pv e7e5 g1f3",
      fen.replace(" w ", " b "),
    );
    expect(line?.rank).toBe(2);
    expect(line?.cp).toBe(-35);
    expect(line?.best).toBe("e7e5");
    expect(line?.pv).toEqual(["e7e5", "g1f3"]);
  });
  it("ignores bounds and unrelated engine output", () => {
    expect(
      parseInfo("info depth 12 score cp 70 lowerbound pv e2e4", fen),
    ).toBeNull();
    expect(parseInfo("info string worker ready", fen)).toBeNull();
  });
  it("preserves mate direction including terminal mate", () => {
    expect(
      parseInfo("info depth 0 score mate 0", fen.replace(" w ", " b "))?.cp,
    ).toBe(10000);
    expect(parseInfo("info depth 8 score mate -3 pv e2e4", fen)?.mate).toBe(-3);
  });
  it("does not invent accuracy before both positions are analysed", () => {
    const before = { cp: 0, best: "e2e4", depth: 8 };
    expect(moveAccuracy(before, undefined, true)).toBeNull();
    expect(moveAccuracy(before, { ...before, cp: -220 }, true)).toBe(37);
    expect(moveAccuracy(before, { ...before, cp: 220 }, false)).toBe(37);
  });
  it("replays candidate lines from the position before the played move", () => {
    const line = pvToSan(fen, ["d2d4", "d7d5"]);
    expect(line.map((m) => m.san)).toEqual(["d4", "d5"]);
    expect(line[0].fen).toContain(" b ");
  });
  it("limits registered workers to same-site JavaScript paths", () => {
    expect(
      engineUrl("./engine/custom.js", "https://example.com/chesslens/").href,
    ).toBe("https://example.com/chesslens/engine/custom.js");
    expect(() =>
      engineUrl("https://other.com/engine.js", "https://example.com/"),
    ).toThrow();
    expect(() =>
      engineUrl("./not-wasm.wasm", "https://example.com/"),
    ).toThrow();
  });
});

describe("consistent optimal move accuracy", () => {
  it("assigns zero loss and 100% to an engine-best move despite search noise", () => {
    const before = { cp: 120, best: "e2e4", depth: 8 },
      after = { cp: 40, best: "e7e5", depth: 8 };
    expect(reviewLoss(before, after, true, "e2e4")).toBe(0);
    expect(moveAccuracy(before, after, true, "e2e4")).toBe(100);
    expect(moveAccuracy(before, after, true, "d2d4")).toBeLessThan(100);
  });
});
