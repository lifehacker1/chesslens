import { useMemo, useState } from "react";
import type { PatternGame } from "./patterns.worker";
import type { ReviewSession } from "./reviewStorage";
import { openingResults, criticalPuzzle } from "./insightAnalysis";
import { emptyLearning, mergeLearningForRestore } from "./learningStorage";
export function LibraryInsights({
  games,
  player,
  onOpen,
}: {
  games: PatternGame[];
  player: string;
  onOpen: (s: ReviewSession) => void;
}) {
  const [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const openings = useMemo(
    () => openingResults(games, player),
    [games, player],
  );
  const evidence = games.flatMap(({ game, saved, evidence }) =>
    evidence
      .filter(
        (m) =>
          game.headers[m.color === "w" ? "White" : "Black"]?.toLowerCase() ===
          player.toLowerCase(),
      )
      .map((m) => ({ ...m, game, saved })),
  );
  const families = [
    ...new Set(evidence.flatMap((e) => e.facts.map((f) => f.family))),
  ];
  async function practice(family: string) {
    setBusy(true);
    try {
      const puzzles = evidence
        .filter((e) => e.facts.some((f) => f.family === family))
        .map((e) =>
          criticalPuzzle(
            e.game,
            e.ply,
            e.saved.session.evaluations,
            `${family}: ${e.saved.name}  -  move ${Math.ceil(e.ply / 2)}`,
            e.saved.session.pgn,
          ),
        )
        .filter((p) => p !== null);
      await mergeLearningForRestore({ ...emptyLearning(), puzzles });
      setNotice(
        "Practice set saved. Open Learn ? Practice. Existing progress is preserved.",
      );
    } catch {
      setNotice("Could not save practice set. Check browser storage.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section aria-label="Personal opening results">
        <h3>Personal opening results</h3>
        <p>
          Frequency uses all matching saved games. W/D/L is from the selected
          player's perspective; unfinished results are excluded from score.
        </p>
        <div className="insight-table">
          <table>
            <thead>
              <tr>
                <th>Opening</th>
                <th>Games</th>
                <th>Frequency</th>
                <th>W / D / L</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {openings.map((o) => {
                const n = o.wins + o.draws + o.losses;
                return (
                  <tr key={o.eco}>
                    <td>
                      {o.eco}  -  {o.name}
                    </td>
                    <td>
                      {o.games}
                      {o.unknown > 0 ? ` (${o.unknown} unfinished)` : ""}
                    </td>
                    <td>
                      {((o.games / Math.max(1, games.length)) * 100).toFixed(0)}
                      %
                    </td>
                    <td>
                      {o.wins} / {o.draws} / {o.losses}
                    </td>
                    <td>
                      {n
                        ? (((o.wins + o.draws / 2) / n) * 100).toFixed(0) + "%"
                        : " - "}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section aria-label="Tactical evidence">
        <h3>Tactical evidence and practice sets</h3>
        <p>
          Critical moves with legal saved engine replies. Labels describe
          observed continuations, not proven causes or forced wins. Mixed search
          depths affect results.
        </p>
        {!families.length && (
          <p>No supported tactical evidence in these analysed games.</p>
        )}
        {families.map((f) => {
          const items = evidence.filter((e) =>
            e.facts.some((x) => x.family === f),
          );
          return (
            <details key={f}>
              <summary>
                {f}  -  {items.length} positions in{" "}
                {new Set(items.map((e) => e.saved.id)).size} games
              </summary>
              <button disabled={busy} onClick={() => void practice(f)}>
                Practise {f.toLowerCase()}
              </button>
              {items.slice(0, 10).map((e) => (
                <article key={e.saved.id + e.ply}>
                  <p>
                    {e.saved.name}  -  move {Math.ceil(e.ply / 2)}  -  loss{" "}
                    {(e.loss * 100).toFixed(1)} points  -  depth {e.depth}
                  </p>
                  <p>
                    {e.facts
                      .filter((x) => x.family === f)
                      .map((x) => x.detail)
                      .join(" ")}
                  </p>
                  <button
                    onClick={() =>
                      onOpen({
                        ...e.saved.session,
                        ply: e.ply,
                        view: "review",
                        branch: null,
                        branchMove: null,
                        branchCaptures: null,
                        alternativeCursor: undefined,
                      })
                    }
                  >
                    Review evidence
                  </button>
                </article>
              ))}
            </details>
          );
        })}
        {notice && <p role="status">{notice}</p>}
      </section>
    </>
  );
}
