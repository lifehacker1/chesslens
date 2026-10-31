import { expect, it } from "vitest";
import { playedDate, recurringPositions } from "./weaknessPatterns";
import type { SavedGame } from "./reviewStorage";
const saved = (id: string, sourceUrl?: string) =>
  ({ id, sourceUrl, session: { updatedAt: 999999999 } }) as SavedGame;
it("uses date played and excludes unknown dates, never review timestamps", () => {
  expect(playedDate(saved("1"), { Date: "2020.01.02" })).toBe(
    Date.UTC(2020, 0, 2),
  );
  expect(playedDate(saved("1"), { Date: "????.??.??" })).toBeNull();
  expect(playedDate({ ...saved("1"), playedAt: 1234 }, {})).toBe(1234);
});
it("requires distinct games and retains rights when grouping positions", () => {
  const m = (id: string, fen: string, url?: string) => ({
    saved: saved(id, url),
    move: { before: fen, san: "e4" },
    ply: 1,
    loss: 0.2,
  });
  const fen = "board w KQkq -";
  expect(
    recurringPositions([m("a", fen + " 0 1"), m("a", fen + " 2 4")]),
  ).toHaveLength(0);
  expect(
    recurringPositions([m("a", fen + " 0 1"), m("b", fen + " 2 4")])[0]
      .evidence,
  ).toHaveLength(2);
  expect(recurringPositions([m("a", fen), m("b", "board w - -")])).toHaveLength(
    0,
  );
  expect(
    recurringPositions([m("a", fen, "same"), m("b", fen, "same")]),
  ).toHaveLength(0);
});

it("rejects impossible dates and accepts a valid leap day", () => {
  expect(playedDate(saved("1"), { Date: "2026.02.31" })).toBeNull();
  expect(playedDate(saved("1"), { Date: "2026.02.29" })).toBeNull();
  expect(playedDate(saved("1"), { Date: "2024.02.29" })).toBe(
    Date.UTC(2024, 1, 29),
  );
  expect(playedDate(saved("1"), { Date: "2026.13.01" })).toBeNull();
});
