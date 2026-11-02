import { analyse, type AnalysisOptions } from "./engine";
import { parseGame } from "./game";
import { withBackgroundJob } from "./backgroundJobs";
import { jobCheckpoint, jobProgress } from "./jobs";
import { newSession } from "./archiveLibrary";
import {
  saveGame,
  listSavedGames,
  canonicalPgn,
  sameOptions,
  loadGameAnalysis,
  cacheGameAnalysis,
} from "./reviewStorage";
import type { ChessComGame } from "./chesscom";
export function saveFilteredGames(
  games: ChessComGame[],
  options: AnalysisOptions,
  analyseGames: boolean,
  signal: AbortSignal,
  progress: (text: string) => void,
) {
  return withBackgroundJob(
    signal,
    async (managed) => {
      const saved = new Map((await listSavedGames()).map((g) => [g.id, g]));
      let done = 0;
      for (const game of games) {
        await jobCheckpoint(managed);
        const existing = saved.get(canonicalPgn(game.pgn));
        const session = existing?.session || {
          ...newSession(game.pgn, options),
          source: "chesscom" as const,
        };
        const metadata = {
          sourceUrl: game.url,
          playedAt: game.end_time * 1000,
          timeClass: game.time_class,
          downloadOnly: false,
        };
        await saveGame(session, undefined, metadata);
        if (analyseGames) {
          if (!sameOptions(session.options, options))
            await cacheGameAnalysis(session);
          const evaluations = sameOptions(session.options, options)
            ? { ...session.evaluations }
            : await loadGameAnalysis(game.pgn, options);
          try {
            await analyse(
              parseGame(game.pgn).fens,
              (i, e) => {
                evaluations[i] = e;
              },
              managed,
              options,
              evaluations,
            );
          } finally {
            const value = {
              ...session,
              options,
              evaluations,
              running: false,
              updatedAt: Date.now(),
            };
            await saveGame(value, undefined, metadata);
            await cacheGameAnalysis(value);
          }
        }
        const text = `${analyseGames ? "Analysed and saved" : "Saved"} ${++done}/${games.length} games`;
        progress(text);
        jobProgress(managed, text);
      }
    },
    analyseGames ? "Analyse filtered games" : "Save filtered games",
    true,
  );
}
