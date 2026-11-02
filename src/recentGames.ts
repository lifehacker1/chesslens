import {
  fetchPlayerArchives,
  fetchMonthGames,
  type ChessComGame,
} from "./chesscom";
export async function fetchRecentGames(
  user: string,
  refresh = false,
  signal?: AbortSignal,
  limit = 100,
) {
  const clean = user.trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,100}$/.test(clean))
    throw new Error("Enter a valid Chess.com username.");
  const archives = await fetchPlayerArchives(clean, refresh, signal),
    games = new Map<string, ChessComGame>();
  for (const path of [...new Set(archives)].sort().reverse()) {
    signal?.throwIfAborted();
    const url = new URL(path);
    if (
      url.origin !== "https://api.chess.com" ||
      !new RegExp("^/pub/player/" + clean + "/games/\\d{4}/\\d{2}$").test(
        url.pathname,
      )
    )
      throw new Error("Invalid archive address.");
    for (const game of await fetchMonthGames(path, refresh, signal))
      games.set(game.url, game);
    if (games.size >= limit) break;
  }
  signal?.throwIfAborted();
  return [...games.values()]
    .sort((a, b) => b.end_time - a.end_time)
    .slice(0, limit);
}
export const RECENT_PLAYERS_KEY = "chesslens-recent-players-v1";
export function readRecentPlayers(): string[] {
  try {
    const names = JSON.parse(localStorage.getItem(RECENT_PLAYERS_KEY) || "[]");
    return Array.isArray(names)
      ? names
          .filter(
            (n) => typeof n === "string" && /^[a-z0-9_-]{1,100}$/i.test(n),
          )
          .slice(0, 10)
      : [];
  } catch {
    return [];
  }
}
export function rememberPlayer(user: string) {
  const names = [user, ...readRecentPlayers().filter((n) => n !== user)].slice(
    0,
    10,
  );
  localStorage.setItem(RECENT_PLAYERS_KEY, JSON.stringify(names));
  return names;
}
