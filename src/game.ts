import { Chess } from "chess.js";
export const labels = [
  "Best",
  "Excellent",
  "Good",
  "Inaccuracy",
  "Mistake",
  "Blunder",
] as const;
export type Grade = (typeof labels)[number];
export type Evaluation = {
  cp: number;
  mate?: number;
  best: string;
  depth: number;
};
export function parseGame(pgn: string) {
  if (!pgn.trim()) throw new Error("Paste a PGN first.");
  const game = new Chess();
  game.loadPgn(pgn);
  const moves = game.history({ verbose: true });
  if (!moves.length) throw new Error("This PGN has no moves to review.");
  return {
    headers: game.getHeaders(),
    moves,
    fens: [moves[0].before, ...moves.map((m) => m.after)],
  };
}
export function loss(before: Evaluation, after: Evaluation, white: boolean) {
  return Math.max(0, (before.cp - after.cp) * (white ? 1 : -1));
}
export function classify(
  before: Evaluation,
  after: Evaluation,
  uci: string,
  white: boolean,
): Grade {
  if (before.best === uci) return "Best";
  const value = loss(before, after, white);
  return value <= 15
    ? "Excellent"
    : value <= 50
      ? "Good"
      : value <= 100
        ? "Inaccuracy"
        : value <= 200
          ? "Mistake"
          : "Blunder";
}
export function accuracy(values: number[]) {
  return values.length
    ? Math.round(
        values.reduce((s, v) => s + 100 * Math.exp(-v / 220), 0) /
          values.length,
      )
    : null;
}
export const demo = `[Event "Opera Game"]\n[White "Paul Morphy"]\n[Black "Duke & Count"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;
