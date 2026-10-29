import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { reviewAlternatives, restoredAlternative } from "./alternatives";
describe("review variations", () => {
  const fen = new Chess().fen();
  const e = {
    cp: 15,
    depth: 10,
    best: "e2e4",
    pv: ["e2e4", "e7e5", "e1e8"],
    lines: [
      { cp: 15, depth: 10, best: "e2e4", pv: ["e2e4", "e7e5", "e1e8"] },
      { cp: 10, depth: 10, best: "d2d4", pv: ["d2d4", "d7d5"] },
      { cp: 15, depth: 10, best: "e2e4" },
      { cp: 0, depth: 10, best: "0000" },
    ],
  };
  it("keeps candidates unique and truncates only an illegal tail", () => {
    const lines = reviewAlternatives(fen, e);
    expect(lines).toHaveLength(2);
    expect(lines[0].moves.map((m) => m.san)).toEqual(["e4", "e5"]);
    expect(lines[1].moves[0].san).toBe("d4");
  });
  it("restores selected candidate and step from persisted position", () => {
    const lines = reviewAlternatives(fen, e);
    expect(restoredAlternative(fen, e, lines[1].moves[1].fen)).toEqual({
      index: 1,
      step: 2,
    });
    expect(restoredAlternative(fen, e, fen)).toEqual({ index: 0, step: 0 });
  });
});

it("preserves the chosen candidate at a shared root", () => {
  const fen = new Chess().fen();
  const e = {
    cp: 0,
    depth: 10,
    best: "e2e4",
    lines: [
      { cp: 0, depth: 10, best: "e2e4" },
      { cp: 0, depth: 10, best: "d2d4" },
    ],
  };
  expect(restoredAlternative(fen, e, fen, { best: "d2d4", step: 0 })).toEqual({
    index: 1,
    step: 0,
  });
  expect(restoredAlternative(fen, e, fen, { best: "d2d4", step: 999 })).toEqual(
    { index: 0, step: 0 },
  );
});
