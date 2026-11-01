import { Chess, type Square } from "chess.js";
import openings from "./openings.json";
import { engineLine, legalLine, type Game } from "./learning";
import type { Evaluation } from "./game";
import type { PatternGame } from "./patterns.worker";
import type { Puzzle } from "./learningStorage";
const openingPositions = new Map(openings.map((o) => [o.position, o]));
export function identifyOpening(game: Game) {
  for (let i = game.fens.length - 1; i >= 0; i--) {
    const match = openingPositions.get(
      game.fens[i].split(" ").slice(0, 4).join(" "),
    );
    if (match) return { eco: match.eco, name: match.name };
  }
  return {
    eco: game.headers.ECO || "Unknown",
    name: game.headers.Opening || "Unclassified opening",
  };
}
export function openingResults(games: PatternGame[], player: string) {
  const groups = new Map<
    string,
    {
      eco: string;
      name: string;
      games: number;
      wins: number;
      draws: number;
      losses: number;
      unknown: number;
    }
  >();
  for (const { game, opening } of games) {
    const white = game.headers.White?.toLowerCase() === player.toLowerCase(),
      black = game.headers.Black?.toLowerCase() === player.toLowerCase();
    if (!white && !black) continue;
    const entry = groups.get(opening.eco) || {
      ...opening,
      games: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      unknown: 0,
    };
    entry.games++;
    const result = game.headers.Result;
    if (result === "1/2-1/2") entry.draws++;
    else if (result === "1-0" || result === "0-1") {
      if ((result === "1-0") === white) entry.wins++;
      else entry.losses++;
    } else entry.unknown++;
    groups.set(opening.eco, entry);
  }
  return [...groups.values()].sort(
    (a, b) => b.games - a.games || a.eco.localeCompare(b.eco),
  );
}
/** Facts about a legal saved engine reply, not a claim of forced tactical causality. */
export function tacticalEvidence(
  fen: string,
  evaluation?: Evaluation,
): { family: string; detail: string }[] {
  const line = legalLine(fen, engineLine(evaluation));
  if (!line.length) return [];
  const board = new Chess(fen),
    reply = board.move(line[0].uci),
    facts: { family: string; detail: string }[] = [];
  if (board.isCheckmate())
    facts.push({
      family: "Allows mate in one",
      detail: `${reply.san} is legal checkmate.`,
    });
  else if (board.isCheck())
    facts.push({
      family: "Allows a checking reply",
      detail: `${reply.san} gives check.`,
    });
  if (reply.captured)
    facts.push({
      family: "Allows a capture",
      detail: `${reply.san} captures ${reply.captured.toUpperCase()} on ${reply.to}; exchanges may compensate.`,
    });
  if (reply.promotion)
    facts.push({
      family: "Allows promotion",
      detail: `${reply.san} promotes to ${reply.promotion.toUpperCase()}.`,
    });
  const targets = board
    .board()
    .flat()
    .filter(
      (p) =>
        p &&
        p.color !== reply.color &&
        p.type !== "p" &&
        board.attackers(p.square as Square, reply.color).includes(reply.to),
    );
  if (targets.length >= 2)
    facts.push({
      family: "Allows a fork shape",
      detail: `After ${reply.san}, the piece on ${reply.to} attacks ${targets.map((p) => p!.square).join(" and ")}. This geometry does not prove both targets can be won.`,
    });
  return facts;
}
export function criticalPuzzle(
  game: Game,
  ply: number,
  evaluations: Record<number, Evaluation>,
  title: string,
  pgn: string,
): Puzzle | null {
  const move = game.moves[ply - 1],
    before = evaluations[ply - 1];
  if (!move || !before || !legalLine(move.before, engineLine(before)).length)
    return null;
  return {
    id: move.before,
    fen: move.before,
    pgn,
    ply,
    title,
    before,
    attempts: 0,
    streak: 0,
    due: Date.now(),
  };
}
export function adaptiveIndices(
  moments: { ply: number; loss: number }[],
  limit = 8,
) {
  return [
    ...new Set(
      [...moments]
        .sort((a, b) => b.loss - a.loss)
        .slice(0, limit)
        .flatMap((m) => [m.ply - 1, m.ply]),
    ),
  ].sort((a, b) => a - b);
}
