import { cachedRequest } from "./gameCache";
export interface ChessComPlayer {
  username: string;
  avatar?: string;
  name?: string;
  title?: string;
  url?: string;
}

export interface ChessComSide {
  username: string;
  rating: number;
  result: string;
}

export interface ChessComGame {
  url: string;
  pgn: string;
  time_control: string;
  end_time: number;
  rated: boolean;
  time_class: string;
  rules: string;
  white: ChessComSide;
  black: ChessComSide;
  eco?: string;
}

const HEADERS = {
  Accept: "application/json",
};

export async function fetchPlayerProfile(
  username: string,
  refresh = false,
): Promise<ChessComPlayer> {
  const clean = username.trim().toLowerCase();
  if (!clean) throw new Error("Please enter a Chess.com username.");
  return cachedRequest(
    "profile:" + clean,
    async () => {
      const res = await fetch(
        `https://api.chess.com/pub/player/${encodeURIComponent(clean)}`,
        {
          headers: HEADERS,
        },
      );
      if (res.status === 404) {
        throw new Error(`Player "${username}" not found on Chess.com.`);
      }
      if (!res.ok) {
        throw new Error(
          `Chess.com error (${res.status}). Please try again later.`,
        );
      }
      const data = await res.json();
      return {
        username: data.username,
        avatar: data.avatar,
        name: data.name,
        title: data.title,
        url: data.url,
      };
    },
    refresh,
  );
}

export async function fetchPlayerArchives(
  username: string,
  refresh = false,
  signal?: AbortSignal,
): Promise<string[]> {
  const clean = username.trim().toLowerCase();
  return cachedRequest(
    "archives:" + clean,
    async () => {
      const res = await fetch(
        `https://api.chess.com/pub/player/${encodeURIComponent(clean)}/games/archives`,
        { headers: HEADERS, signal },
      );
      if (!res.ok) {
        throw new Error(`Could not load archives for "${username}".`);
      }
      const data = await res.json();
      const archives: string[] = data.archives || [];
      return archives;
    },
    refresh,
  );
}

export async function fetchMonthGames(
  archiveUrl: string,
  refresh = false,
  signal?: AbortSignal,
): Promise<ChessComGame[]> {
  return cachedRequest(
    "month:" + archiveUrl,
    async () => {
      const res = await fetch(archiveUrl, { headers: HEADERS, signal });
      if (!res.ok) {
        throw new Error("Could not load games for the selected month.");
      }
      const data = await res.json();
      const games: ChessComGame[] = data.games || [];
      // Sort reverse-chronologically so newest games appear first
      return games
        .filter((g) => g.pgn && g.rules === "chess")
        .sort((a, b) => b.end_time - a.end_time);
    },
    refresh,
  );
}

export function formatArchiveLabel(url: string): string {
  const parts = url.split("/");
  const year = parseInt(parts[parts.length - 2], 10);
  const month = parseInt(parts[parts.length - 1], 10);
  if (isNaN(year) || isNaN(month)) return url;
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatResult(
  game: ChessComGame,
  targetUsername: string,
): { outcome: "win" | "loss" | "draw"; reason: string; label: string } {
  const clean = targetUsername.trim().toLowerCase();
  const isWhite = game.white.username.toLowerCase() === clean;
  const isBlack = game.black.username.toLowerCase() === clean;
  const playerSide = isWhite ? game.white : isBlack ? game.black : game.white;
  const opponentSide = isWhite ? game.black : game.white;

  if (playerSide.result === "win") {
    const reason =
      opponentSide.result === "checkmated"
        ? "by checkmate"
        : opponentSide.result === "resigned"
          ? "by resignation"
          : opponentSide.result === "timeout"
            ? "on time"
            : opponentSide.result === "abandoned"
              ? "abandoned"
              : "won";
    return { outcome: "win", reason, label: "Win" };
  }

  if (opponentSide.result === "win") {
    const reason =
      playerSide.result === "checkmated"
        ? "by checkmate"
        : playerSide.result === "resigned"
          ? "by resignation"
          : playerSide.result === "timeout"
            ? "on time"
            : playerSide.result === "abandoned"
              ? "abandoned"
              : "lost";
    return { outcome: "loss", reason, label: "Loss" };
  }

  return { outcome: "draw", reason: playerSide.result, label: "Draw" };
}

export function formatTimeControl(tc: string, timeClass: string): string {
  const capitalized = timeClass.charAt(0).toUpperCase() + timeClass.slice(1);
  if (!tc) return capitalized;
  if (tc.includes("/")) {
    return capitalized;
  }
  if (tc.includes("+")) {
    const [base, inc] = tc.split("+");
    const mins = Math.floor(parseInt(base, 10) / 60);
    return `${mins}+${inc} · ${capitalized}`;
  }
  const secs = parseInt(tc, 10);
  if (!isNaN(secs)) {
    if (secs >= 60) {
      return `${Math.floor(secs / 60)} min · ${capitalized}`;
    }
    return `${secs}s · ${capitalized}`;
  }
  return `${tc} · ${capitalized}`;
}
