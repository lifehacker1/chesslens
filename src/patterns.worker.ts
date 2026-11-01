import { identifyOpening, tacticalEvidence } from "./insightAnalysis";
import { parseGame } from "./game";
import { criticalMoments, phase } from "./learning";
import type { SavedGame } from "./reviewStorage";
export function preparePatternGame(saved: SavedGame) {
  const game = parseGame(saved.session.pgn);
  const moments = criticalMoments(game, saved.session.evaluations);
  return {
    saved,
    game,
    opening: identifyOpening(game),
    evidence: moments.map((m) => ({
      ply: m.ply,
      color: m.move.color,
      loss: m.loss,
      depth: saved.session.evaluations[m.ply].depth,
      facts: tacticalEvidence(m.move.after, saved.session.evaluations[m.ply]),
    })),
    phases: game.moves.map((move, i) => phase(move, i + 1)),
    moments,
  };
}
export type PatternGame = ReturnType<typeof preparePatternGame>;
self.onmessage = (event: MessageEvent<SavedGame[]>) => {
  try {
    self.postMessage({ games: event.data.map(preparePatternGame) });
  } catch {
    self.postMessage({
      error:
        "Could not prepare game patterns. Check saved games and try again.",
    });
  }
};
