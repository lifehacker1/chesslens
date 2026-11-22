import { type Color } from "chess.js";
import { type Game, legalLine, uci } from "./learning";
import { type Evaluation } from "./game";
import { compareMove, expectedAccuracy } from "./review";
export const categoryInfo = {
  opening: {
    name: "Opening",
    detail: "Move quality in the first 20 plies, excluding endgame positions.",
  },
  tactics: {
    name: "Tactics",
    detail:
      "Move quality around legal checks, captures or promotions. These are forcing decisions, not proof of a tactical combination.",
  },
  strategy: {
    name: "Positional play",
    detail:
      "Quiet middlegame move quality. A limited proxy for strategy, not a rating of planning or pawn-structure skill.",
  },
  endgame: {
    name: "Endgame",
    detail:
      "Move quality with at most four non-pawn, non-king pieces remaining.",
  },
} as const;
export type ReviewCategory = keyof typeof categoryInfo;
export function reviewProfile(
  game: Game,
  evaluations: Record<number, Evaluation>,
  color: Color,
) {
  const buckets = Object.fromEntries(
    Object.keys(categoryInfo).map((key) => [
      key,
      {
        eligible: 0,
        samples: [] as {
          ply: number;
          san: string;
          loss: number;
          depth: number;
          source: string;
        }[],
      },
    ]),
  ) as Record<
    ReviewCategory,
    {
      eligible: number;
      samples: {
        ply: number;
        san: string;
        loss: number;
        depth: number;
        source: string;
      }[];
    }
  >;
  let available = 0,
    expected = 0,
    rootComparisons = 0,
    depthMismatch = 0,
    engineMismatch = 0;
  const depths: number[] = [];
  const forcing = (fen: string, e?: Evaluation) => {
    if (!e?.best) return false;
    const move = legalLine(fen, [e.best])[0];
    return !!move && /[x+#=]/.test(move.san);
  };
  game.moves.forEach((move, i) => {
    if (move.color !== color) return;
    expected++;
    const before = evaluations[i],
      after = evaluations[i + 1];
    const nonPawns = move.before
      .split(" ")[0]
      .replace(/[kpKP1-8/]/g, "").length;
    const phase = nonPawns <= 4 ? "endgame" : i < 20 ? "opening" : "middlegame";
    const tactical =
      /[x+#=]/.test(move.san) ||
      forcing(move.before, before) ||
      forcing(move.after, after);
    const categories: ReviewCategory[] = [];
    if (phase === "opening") categories.push("opening");
    if (phase === "endgame") categories.push("endgame");
    if (tactical) categories.push("tactics");
    else if (phase === "middlegame") categories.push("strategy");
    categories.forEach((k) => buckets[k].eligible++);
    if (!before || !after) return;
    const comparison = compareMove(before, after, color === "w", uci(move));
    if (comparison.engineMismatch) {
      engineMismatch++;
      return;
    }
    available++;
    depths.push(comparison.depth);
    if (comparison.source !== "position-pair") rootComparisons++;
    if (comparison.depthGap >= 4) depthMismatch++;
    for (const key of categories)
      buckets[key].samples.push({
        ply: i + 1,
        san: move.san,
        loss: comparison.loss,
        depth: comparison.depth,
        source: comparison.source,
      });
  });
  return {
    expected,
    available,
    rootComparisons,
    depthMismatch,
    engineMismatch,
    minDepth: depths.length ? Math.min(...depths) : null,
    maxDepth: depths.length ? Math.max(...depths) : null,
    categories: (Object.keys(categoryInfo) as ReviewCategory[]).map((key) => ({
      key,
      ...categoryInfo[key],
      ...buckets[key],
      score: expectedAccuracy(buckets[key].samples.map((s) => s.loss)),
      meanLoss: buckets[key].samples.length
        ? (100 * buckets[key].samples.reduce((n, s) => n + s.loss, 0)) /
          buckets[key].samples.length
        : null,
      evidence: [...buckets[key].samples]
        .sort((a, b) => b.loss - a.loss)
        .slice(0, 3),
    })),
  };
}

export interface ProfileSelection {
  white: string;
  black: string;
  side: Color;
}
export function isProfileSelection(value: unknown): value is ProfileSelection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Partial<ProfileSelection>;
  return (
    typeof v.white === "string" &&
    v.white.length <= 2000 &&
    typeof v.black === "string" &&
    v.black.length <= 2000 &&
    (v.side === "w" || v.side === "b")
  );
}

export function reviewMoveLabel(game: Game, ply: number) {
  const move = game.moves[ply - 1];
  return move
    ? `${move.before.split(" ")[5]}${move.color === "w" ? "." : "..."} ${move.san}`
    : "Starting position";
}
