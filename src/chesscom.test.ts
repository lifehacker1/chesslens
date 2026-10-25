import { describe, expect, it } from "vitest";
import {
  formatArchiveLabel,
  formatResult,
  formatTimeControl,
  type ChessComGame,
} from "./chesscom";

describe("chesscom helper functions", () => {
  it("formats archive URL into friendly label", () => {
    expect(
      formatArchiveLabel("https://api.chess.com/pub/player/hikaru/games/2026/10"),
    ).toBe("October 2026");
    expect(
      formatArchiveLabel("https://api.chess.com/pub/player/hikaru/games/2024/01"),
    ).toBe("January 2024");
  });

  it("formats time control", () => {
    expect(formatTimeControl("180+2", "blitz")).toBe("3+2 · Blitz");
    expect(formatTimeControl("600", "rapid")).toBe("10 min · Rapid");
    expect(formatTimeControl("60", "bullet")).toBe("1 min · Bullet");
    expect(formatTimeControl("1/86400", "daily")).toBe("Daily");
  });

  it("correctly identifies win, loss, and draw outcomes", () => {
    const mockGame: ChessComGame = {
      url: "https://chess.com/game/1",
      pgn: "1. e4 e5",
      time_control: "180",
      end_time: 1700000000,
      rated: true,
      time_class: "blitz",
      rules: "chess",
      white: { username: "Alice", rating: 1500, result: "win" },
      black: { username: "Bob", rating: 1520, result: "resigned" },
    };

    const aliceResult = formatResult(mockGame, "Alice");
    expect(aliceResult.outcome).toBe("win");
    expect(aliceResult.reason).toBe("by resignation");

    const bobResult = formatResult(mockGame, "Bob");
    expect(bobResult.outcome).toBe("loss");
    expect(bobResult.reason).toBe("by resignation");

    const drawGame: ChessComGame = {
      ...mockGame,
      white: { username: "Alice", rating: 1500, result: "agreed" },
      black: { username: "Bob", rating: 1520, result: "agreed" },
    };
    const drawResult = formatResult(drawGame, "Alice");
    expect(drawResult.outcome).toBe("draw");
  });
});
