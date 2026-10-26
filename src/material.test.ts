import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { addCapture, capturedPieces, materialCount } from "./material";
describe("material and captured pieces", () => {
  it("starts at 39 points each without an advantage", () => {
    expect(materialCount(new Chess())).toEqual({
      totals: { w: 39, b: 39 },
      advantage: { w: 0, b: 0 },
    });
  });
  it("shows net advantage only for the leading player", () => {
    const board = new Chess("4k3/7p/8/8/8/8/2B5/4K3 w - - 0 1");
    expect(materialCount(board).advantage).toEqual({ w: 2, b: 0 });
  });
  it("records captures under the player who took them and supports replay", () => {
    const board = new Chess();
    board.loadPgn("1. e4 d5 2. exd5 Qxd5 *");
    const moves = board.history({ verbose: true });
    expect(capturedPieces(moves.slice(0, 3))).toEqual({ w: ["p"], b: [] });
    expect(capturedPieces(moves)).toEqual({ w: ["p"], b: ["p"] });
    expect(materialCount(board).advantage).toEqual({ w: 0, b: 0 });
  });
  it("records en passant as a pawn capture", () => {
    const board = new Chess();
    board.loadPgn("1. e4 a6 2. e5 d5 3. exd6 *");
    expect(capturedPieces(board.history({ verbose: true }))).toEqual({
      w: ["p"],
      b: [],
    });
    expect(materialCount(board).advantage.w).toBe(1);
  });
  it("counts promotion by board value without inventing a captured pawn", () => {
    const board = new Chess("7k/P7/8/8/8/8/8/7K w - - 0 1");
    board.move("a8=Q+");
    expect(materialCount(board).advantage.w).toBe(9);
    expect(capturedPieces(board.history({ verbose: true }))).toEqual({
      w: [],
      b: [],
    });
  });
  it("records a captured promoted queen as a queen", () => {
    const board = new Chess("1r5k/P7/8/8/8/8/8/7K w - - 0 1");
    board.move("a8=Q+");
    board.move("Rxa8");
    expect(capturedPieces(board.history({ verbose: true }))).toEqual({
      w: [],
      b: ["q"],
    });
    expect(materialCount(board).advantage).toEqual({ w: 0, b: 5 });
  });
  it("does not infer earlier captures from an imported FEN", () => {
    const board = new Chess("4k3/8/8/8/8/8/8/3QK3 w - - 0 1");
    expect(capturedPieces([])).toEqual({ w: [], b: [] });
    expect(materialCount(board).advantage.w).toBe(9);
  });
  it("extends a variation capture ledger without changing the played game", () => {
    const ledger = capturedPieces([{ color: "w", captured: "p" }]);
    const next = addCapture(ledger, { color: "b", captured: "n" });
    expect(ledger).toEqual({ w: ["p"], b: [] });
    expect(next).toEqual({ w: ["p"], b: ["n"] });
  });
});
