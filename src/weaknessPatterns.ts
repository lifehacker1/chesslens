import type { SavedGame } from "./reviewStorage";
/** Use the played date, never the last time the review was opened. */
export function playedDate(
  saved: SavedGame,
  headers: Record<string, string>,
): number | null {
  if (Number.isFinite(saved.playedAt) && saved.playedAt! > 0)
    return saved.playedAt!;
  const date = headers.UTCDate || headers.Date;
  if (!/^\d{4}\.\d{2}\.\d{2}$/.test(date || "")) return null;
  const value = Date.parse(date.replaceAll(".", "-") + "T00:00:00Z");
  return Number.isFinite(value) &&
    new Date(value).toISOString().slice(0, 10) === date.replaceAll(".", "-")
    ? value
    : null;
}
export type PositionEvidence = {
  saved: SavedGame;
  move: { before: string; san: string };
  ply: number;
  loss: number;
};
/** Keep castling/en-passant rights; ignore only halfmove/fullmove counters. */
export function recurringPositions<T extends PositionEvidence>(moments: T[]) {
  const groups = new Map<string, T[]>();
  for (const moment of moments) {
    const key = moment.move.before.split(" ").slice(0, 4).join(" ");
    const group = groups.get(key) || [];
    const identity = moment.saved.sourceUrl || moment.saved.id;
    if (!group.some((m) => (m.saved.sourceUrl || m.saved.id) === identity))
      group.push(moment);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .filter(([, evidence]) => evidence.length > 1)
    .map(([fen, evidence]) => ({ fen, evidence }))
    .sort((a, b) => b.evidence.length - a.evidence.length);
}
