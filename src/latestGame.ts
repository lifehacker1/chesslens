import { fetchMonthGames, fetchPlayerArchives } from "./chesscom";
import { archiveUrl, newSession } from "./archiveLibrary";
import { analyse, type AnalysisOptions } from "./engine";
import { parseGame } from "./game";
import {
  cacheGameAnalysis,
  canonicalPgn,
  listSavedGames,
  loadGameAnalysis,
  sameOptions,
  saveGame,
  type ReviewSession,
} from "./reviewStorage";
export function rememberedUsername() {
  try {
    const value = JSON.parse(
      localStorage.getItem("chesslens-games-username") || "null",
    );
    const user = (
      typeof value === "string"
        ? value
        : localStorage.getItem("chesslens_cc_user") || ""
    )
      .trim()
      .toLowerCase();
    return /^[a-z0-9_-]{1,100}$/.test(user) ? user : "";
  } catch {
    return "";
  }
}
function check(signal: AbortSignal) {
  signal.throwIfAborted();
}
/** Refresh once per app session; keep the active board separate from the saved latest game. */
export async function syncLatestGame(
  user: string,
  options: AnalysisOptions,
  signal: AbortSignal,
  progress: (text: string) => void,
): Promise<ReviewSession | null> {
  progress("Fetching latest games for @" + user + "...");
  const archives = (await fetchPlayerArchives(user, true, signal))
    .map((url) => archiveUrl(url, user))
    .sort()
    .reverse();
  let latest: Awaited<ReturnType<typeof fetchMonthGames>>[number] | undefined;
  for (const url of archives) {
    check(signal);
    const games = await fetchMonthGames(url, true, signal);
    latest = games.find((g) => {
      try {
        parseGame(g.pgn);
        return Number.isFinite(g.end_time);
      } catch {
        return false;
      }
    });
    if (latest) break;
  }
  check(signal);
  if (!latest) {
    progress("No completed standard-chess games found for @" + user + ".");
    return null;
  }
  const id = canonicalPgn(latest.pgn);
  const existing = (await listSavedGames()).find(
    (g) => g.sourceUrl === latest!.url || g.id === id,
  );
  check(signal);
  const base = existing?.session || newSession(latest.pgn, options);
  if (existing && !sameOptions(base.options, options))
    await cacheGameAnalysis(base);
  const evaluations = {
    ...(await loadGameAnalysis(base.pgn, options)),
    ...(sameOptions(base.options, options) ? base.evaluations : {}),
  };
  const snapshot = (): ReviewSession => ({
    ...base,
    options,
    evaluations: { ...evaluations },
    running: false,
    updatedAt: Date.now(),
  });
  const metadata = {
    sourceUrl: latest.url,
    playedAt: latest.end_time * 1000,
    timeClass: latest.time_class,
    downloadOnly: existing?.downloadOnly ?? false,
  };
  check(signal);
  await saveGame(snapshot(), undefined, metadata);
  const fens = parseGame(base.pgn).fens;
  let checkpoint = Promise.resolve();
  let checkpointError: unknown;
  let received = 0;
  try {
    await analyse(
      fens,
      (index, evaluation) => {
        evaluations[index] = evaluation;
        progress(
          "Analysing latest game: " +
            Object.keys(evaluations).length +
            "/" +
            fens.length +
            " positions - " +
            options.engine.name,
        );
        if (++received % 5 === 0) {
          const value = snapshot();
          checkpoint = checkpoint
            .then(() => saveGame(value, undefined, metadata))
            .catch((error) => {
              checkpointError = error;
            });
        }
      },
      signal,
      options,
      evaluations,
    );
  } finally {
    await checkpoint;
    await saveGame(snapshot(), undefined, metadata);
    await cacheGameAnalysis(snapshot());
    if (checkpointError) throw checkpointError;
  }
  check(signal);
  progress("Latest game analysed and saved for @" + user + ".");
  return snapshot();
}
