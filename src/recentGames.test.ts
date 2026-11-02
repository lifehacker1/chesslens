import { beforeEach, expect, it, vi } from "vitest";
import { fetchRecentGames } from "./recentGames";
import {
  fetchPlayerArchives,
  fetchMonthGames,
  type ChessComGame,
} from "./chesscom";
vi.mock("./chesscom", () => ({
  fetchPlayerArchives: vi.fn(),
  fetchMonthGames: vi.fn(),
}));
const base = "https://api.chess.com/pub/player/player/games/";
beforeEach(() => vi.resetAllMocks());
it("loads newest archives first, deduplicates and limits to the latest 100", async () => {
  vi.mocked(fetchPlayerArchives).mockResolvedValue([
    base + "2026/01",
    base + "2026/03",
    base + "2026/02",
  ]);
  const games = (start: number, end: number) =>
    Array.from(
      { length: end - start },
      (_, i) =>
        ({ url: String(i + start), end_time: i + start }) as ChessComGame,
    );
  vi.mocked(fetchMonthGames).mockImplementation(async (url) =>
    url.endsWith("/03") ? games(50, 120) : games(0, 60),
  );
  const result = await fetchRecentGames("Player");
  expect(result).toHaveLength(100);
  expect(result[0].end_time).toBe(119);
  expect(result[99].end_time).toBe(20);
  expect(vi.mocked(fetchMonthGames).mock.calls.map((c) => c[0])).toEqual([
    base + "2026/03",
    base + "2026/02",
  ]);
});
it("rejects archive URLs outside the requested account and honours cancellation", async () => {
  vi.mocked(fetchPlayerArchives).mockResolvedValue([
    "https://evil.example/games/2026/01",
  ]);
  await expect(fetchRecentGames("player")).rejects.toThrow("Invalid archive");
  expect(fetchMonthGames).not.toHaveBeenCalled();
  const controller = new AbortController();
  controller.abort();
  await expect(
    fetchRecentGames("player", false, controller.signal),
  ).rejects.toThrow();
});
it("handles accounts with no archived games", async () => {
  vi.mocked(fetchPlayerArchives).mockResolvedValue([]);
  expect(await fetchRecentGames("player")).toEqual([]);
});
