import { parseGame } from "./game";
import { criticalMoments } from "./learning";
import type { SavedGame } from "./reviewStorage";
export function preparePatternGame(saved: SavedGame) {
  const game = parseGame(saved.session.pgn);
  return {
    saved,
    game,
    moments: criticalMoments(game, saved.session.evaluations),
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
