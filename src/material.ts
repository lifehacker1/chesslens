import { type Chess, type Color, type Move, type PieceSymbol } from "chess.js";
export type CapturedPiece = Exclude<PieceSymbol, "k">;
export type CaptureLedger = Record<Color, CapturedPiece[]>;
export const pieceValues: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};
export function addCapture(
  ledger: CaptureLedger,
  move: Pick<Move, "color" | "captured">,
): CaptureLedger {
  if (!move.captured || move.captured === "k") return ledger;
  return { ...ledger, [move.color]: [...ledger[move.color], move.captured] };
}
export function capturedPieces(
  moves: Pick<Move, "color" | "captured">[],
): CaptureLedger {
  return moves.reduce(addCapture, { w: [], b: [] } as CaptureLedger);
}
export function materialCount(board: Chess) {
  const totals = { w: 0, b: 0 };
  for (const row of board.board())
    for (const piece of row)
      if (piece) totals[piece.color] += pieceValues[piece.type];
  return {
    totals,
    advantage: {
      w: Math.max(0, totals.w - totals.b),
      b: Math.max(0, totals.b - totals.w),
    },
  };
}
