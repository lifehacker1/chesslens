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
export type EngineLine = {
  cp: number;
  mate?: number;
  best: string;
  depth: number;
  pv?: string[];
};
export type Evaluation = EngineLine & {
  lines?: EngineLine[];
  engine?: string;
  cached?: boolean;
};
export function moveAccuracy(
  before: Evaluation | undefined,
  after: Evaluation | undefined,
  white: boolean,
) {
  return before && after ? accuracy([loss(before, after, white)]) : null;
}
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

export function estimateElo(
  accuracyVal: number | null,
  losses: number[] = [],
  gradeCounts: Partial<Record<Grade, number>> = {},
): number | null {
  if (accuracyVal === null || !losses.length) return null;
  const blunders = gradeCounts["Blunder"] || 0;
  const mistakes = gradeCounts["Mistake"] || 0;
  const inaccuracies = gradeCounts["Inaccuracy"] || 0;
  const totalMoves = losses.length;

  const normalizedAcc = Math.max(0, Math.min(100, accuracyVal));
  const baseElo = 400 + 2600 * Math.pow(normalizedAcc / 100, 1.85);

  const moveFactor = Math.max(1, totalMoves / 25);
  const penalty =
    (blunders * 40 + mistakes * 18 + inaccuracies * 5) / moveFactor;

  const rawRating = Math.round(baseElo - penalty);
  const clamped = Math.max(400, Math.min(3100, rawRating));
  return Math.round(clamped / 25) * 25;
}

export interface PvMove {
  uci: string;
  san: string;
  fen: string;
  moveNum?: number;
}

export function pvToSan(startFen: string, uciMoves: string[] = []): PvMove[] {
  if (!uciMoves.length) return [];
  try {
    const game = new Chess(startFen);
    const result: PvMove[] = [];
    for (const uci of uciMoves) {
      if (!uci || uci.length < 4) break;
      const turn = game.turn();
      const moveNumber = Number(game.fen().split(" ")[5]);
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci[4];
      const m = game.move({ from, to, promotion });
      if (!m) break;
      result.push({
        uci,
        san: m.san,
        fen: game.fen(),
        moveNum: turn === "w" ? moveNumber : undefined,
      });
    }
    return result;
  } catch {
    return [];
  }
}

export interface TacticalDescription {
  heading: string;
  detail: string;
  deltaText: string;
  betterMoveUci?: string;
}

export function describeEvaluation(
  before: Evaluation | undefined,
  after: Evaluation | undefined,
  grade: Grade | null,
  whiteTurn: boolean,
): TacticalDescription {
  if (!before || !after || !grade) {
    return {
      heading: "In-game review",
      detail: "Evaluation updates with Stockfish calculation.",
      deltaText: "",
    };
  }

  const cpLoss = loss(before, after, whiteTurn);
  const deltaFormatted = Math.round(cpLoss).toString();
  const betterUci =
    before.best && before.best !== "(none)" ? before.best : undefined;

  if (grade === "Best") {
    return {
      heading: "Best move",
      detail: "Stockfish's top recommendation for this position.",
      deltaText: "Optimal line",
    };
  }

  if (grade === "Excellent") {
    return {
      heading: "Excellent move",
      detail: "Strong choice that maintains position quality.",
      deltaText: `−${deltaFormatted} cp`,
    };
  }

  if (grade === "Good") {
    return {
      heading: "Good move",
      detail: "Solid move though slightly conceding engine perfection.",
      deltaText: `−${deltaFormatted} cp`,
    };
  }

  if (grade === "Inaccuracy") {
    return {
      heading: "Inaccuracy",
      detail: "Gives away minor initiative. A stronger move was available.",
      deltaText: `−${deltaFormatted} cp swing`,
      betterMoveUci: betterUci,
    };
  }

  if (grade === "Mistake") {
    return {
      heading: "Mistake",
      detail: "Significantly damages position or hands opponent initiative.",
      deltaText: `−${deltaFormatted} cp swing`,
      betterMoveUci: betterUci,
    };
  }

  const mateVal = after.mate;
  const detail =
    mateVal !== undefined
      ? `Allows a forced mate in ${Math.abs(mateVal)}!`
      : cpLoss >= 400
        ? "Severe blunder resulting in decisive material or tactical loss."
        : "Severe blunder that shifts game momentum.";

  return {
    heading: "Blunder",
    detail,
    deltaText: `−${deltaFormatted} cp swing`,
    betterMoveUci: betterUci,
  };
}

export const demo = `[Event "Opera Game"]\n[White "Paul Morphy"]\n[Black "Duke & Count"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;
