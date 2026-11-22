import { Chess, type Move } from "chess.js";
import type { Evaluation, Grade } from "./game";
import { pieceValues } from "./material";
export interface ReviewContext {
  move: Move;
  previous?: Evaluation;
}
/** Transparent fixed-strength estimate; not Chess.com's rating-trained model. */
export function expectedPoints(evaluation: Evaluation, white = true) {
  const whitePoints =
    evaluation.mate !== undefined
      ? evaluation.cp >= 0
        ? 1
        : 0
      : 1 /
        (1 + Math.exp(-Math.max(-10000, Math.min(10000, evaluation.cp)) / 250));
  return white ? whitePoints : 1 - whitePoints;
}
export const REVIEW_MODEL = "chesslens-expected-score-v2";
/** Compare alternatives from the same search before falling back to two searches. */
export function compareMove(
  before: Evaluation,
  after: Evaluation,
  white: boolean,
  uci?: string,
) {
  const candidate =
    uci &&
    before.lines?.find(
      (line) =>
        line.best === uci &&
        line.depth === before.depth &&
        Number.isFinite(line.cp) &&
        (!line.pv?.length || line.pv[0] === uci),
    );
  const best = !!uci && before.best === uci;
  const played = best ? before : candidate || after;
  const source = best
    ? "best-move"
    : candidate
      ? "same-position"
      : "position-pair";
  return {
    loss: Math.max(
      0,
      expectedPoints(before, white) - expectedPoints(played, white),
    ),
    source,
    depth:
      source === "position-pair"
        ? Math.min(before.depth, after.depth)
        : before.depth,
    depthGap:
      source === "position-pair" ? Math.abs(before.depth - after.depth) : 0,
    engineMismatch:
      source === "position-pair" &&
      !!before.engine &&
      !!after.engine &&
      before.engine !== after.engine,
    played,
  };
}
export function expectedPointLoss(
  before: Evaluation,
  after: Evaluation,
  white: boolean,
  uci?: string,
) {
  return compareMove(before, after, white, uci).loss;
}
export function expectedAccuracy(losses: number[]) {
  return losses.length
    ? Math.round(
        losses.reduce(
          (sum, loss) =>
            sum + 100 * Math.exp(-6 * Math.max(0, Math.min(1, loss))),
          0,
        ) / losses.length,
      )
    : null;
}
export function classifyExpectedLoss(value: number): Grade {
  return value <= 0.02
    ? "Excellent"
    : value <= 0.05
      ? "Good"
      : value <= 0.1
        ? "Inaccuracy"
        : value <= 0.2
          ? "Mistake"
          : "Blunder";
}
function verifiedSacrifice(
  before: Evaluation,
  after: Evaluation,
  uci: string,
  white: boolean,
  context: ReviewContext,
) {
  const line =
    before.lines?.find((line) => line.best === uci) ||
    (before.best === uci ? before : undefined);
  if (
    !line?.pv?.[1] ||
    line.pv[0] !== uci ||
    expectedPoints(after, white) < 0.5
  )
    return false;
  const alternatives =
    before.lines?.filter((candidate) => candidate.best !== uci) || [];
  if (
    alternatives.length
      ? alternatives.every(
          (candidate) => expectedPoints(candidate, white) > 0.85,
        )
      : expectedPoints(before, white) > 0.85
  )
    return false;
  try {
    const board = new Chess(context.move.before);
    const offered = board.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4],
    });
    if (offered.piece === "p") return false;
    const reply = line.pv[1];
    const taken = board.move({
      from: reply.slice(0, 2),
      to: reply.slice(2, 4),
      promotion: reply[4],
    });
    return (
      taken.to === offered.to &&
      !!taken.captured &&
      taken.captured !== "p" &&
      pieceValues[taken.captured] >
        (offered.captured ? pieceValues[offered.captured] : 0) + 1
    );
  } catch {
    return false;
  }
}
export function classifyReview(
  before: Evaluation,
  after: Evaluation,
  uci: string,
  white: boolean,
  context?: ReviewContext,
): Grade {
  const comparison = compareMove(before, after, white, uci);
  const played = comparison.played;
  const delta = comparison.loss,
    best = before.best === uci;
  if (
    context &&
    delta <= 0.02 &&
    verifiedSacrifice(before, played, uci, white, context)
  )
    return "Brilliant";
  if (best) {
    const runners = before.lines?.filter((line) => line.best !== uci) || [];
    if (context && runners.length && expectedPoints(played, white) >= 0.5) {
      const second = Math.max(
        ...runners.map((line) => expectedPoints(line, white)),
      );
      const top = expectedPoints(before, white);
      if (top >= 0.5 && second < 0.45 && top - second >= 0.15) return "Great";
    }
    return "Best";
  }
  if (
    context?.previous &&
    expectedPoints(context.previous, white) <= 0.6 &&
    expectedPoints(before, white) >= 0.75 &&
    expectedPoints(played, white) <= 0.55 &&
    delta >= 0.1
  )
    return "Miss";
  return classifyExpectedLoss(delta);
}
