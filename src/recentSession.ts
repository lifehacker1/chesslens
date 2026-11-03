import { canonicalPgn } from "./reviewStorage";
import { rememberedUsername } from "./latestGame";
import type { ChessComGame } from "./chesscom";
interface RecentSession {
  games: ChessComGame[];
  profile: string;
  error: string;
}
const startupUser = rememberedUsername();
const attempted = new Set<string>();
const results = new Map<string, RecentSession>();
const key = (user: string) => user.trim().toLowerCase();
export const readRecentSession = (user: string) => results.get(key(user));
export const hasLoadedRecentSession = (user: string) =>
  attempted.has(key(user));
export const canAutoLoadRecentSession = (user: string) =>
  key(user) === startupUser && !hasLoadedRecentSession(user);
export function beginRecentSession(user: string) {
  attempted.add(key(user));
}
/** Page-lifetime snapshots avoid network/storage reconstruction on tab visits. */
export function saveRecentSession(user: string, value: RecentSession) {
  const id = key(user);
  attempted.add(id);
  results.delete(id);
  results.set(id, value);
  let size = [...results.values()].reduce(
    (n, v) => n + v.games.reduce((n, g) => n + g.pgn.length, 0),
    0,
  );
  for (const [old, snapshot] of results) {
    if (results.size <= 5 && size <= 1_500_000) break;
    size -= snapshot.games.reduce((n, g) => n + g.pgn.length, 0);
    results.delete(old);
  }
}

const identities = new WeakMap<ChessComGame[], Map<string, string>>();
export function recentGameIdentities(games: ChessComGame[]) {
  let ids = identities.get(games);
  if (!ids) {
    ids = new Map(
      games.map((game) => {
        try {
          return [game.url, canonicalPgn(game.pgn)];
        } catch {
          return [game.url, ""];
        }
      }),
    );
    identities.set(games, ids);
  }
  return ids;
}
