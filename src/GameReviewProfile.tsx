import { usePreference } from "./preferences";
import { useMemo, useState } from "react";
import type { Color } from "chess.js";
import type { Game } from "./learning";
import type { Evaluation } from "./game";
import type { AnalysisOptions } from "./engine";
import { REVIEW_MODEL } from "./review";
import {
  reviewProfile,
  reviewMoveLabel,
  isProfileSelection,
  type ProfileSelection,
} from "./reviewProfile";
export function GameReviewProfile({
  game,
  evaluations,
  options,
  preferredPlayer,
  onSelect,
}: {
  game: Game;
  evaluations: Record<number, Evaluation>;
  options: AnalysisOptions;
  preferredPlayer: string;
  onSelect: (ply: number) => void;
}) {
  const whiteName = game.headers.White || "White",
    blackName = game.headers.Black || "Black";
  const [error, setError] = useState("");
  const [selection, setSelection] = usePreference<ProfileSelection | null>(
    "chesslens-review-profile-selection",
    null,
    (value): value is ProfileSelection | null =>
      value === null || isProfileSelection(value),
    setError,
  );
  const color: Color =
    selection?.white === whiteName && selection?.black === blackName
      ? selection.side
      : blackName.trim().toLowerCase() === preferredPlayer.trim().toLowerCase()
        ? "b"
        : "w";
  const setColor = (side: Color) =>
    setSelection({ white: whiteName, black: blackName, side });
  const data = useMemo(
    () => reviewProfile(game, evaluations, color),
    [game, evaluations, color],
  );
  const name =
    game.headers[color === "w" ? "White" : "Black"] ||
    (color === "w" ? "White" : "Black");
  return (
    <section
      className="panel review-profile"
      aria-label="Game performance profile"
    >
      <h2>Game performance profile</h2>
      {error && <p role="alert">{error}</p>}
      <label>
        Player
        <select
          aria-label="Performance profile player"
          value={color}
          onChange={(e) => setColor(e.target.value as Color)}
        >
          <option value="w">White - {game.headers.White || "White"}</option>
          <option value="b">Black - {game.headers.Black || "Black"}</option>
        </select>
      </label>
      <p>
        <strong>{name}</strong>: {data.available}/{data.expected} moves
        analysed.{" "}
        {data.minDepth !== null
          ? `Observed search depth ${data.minDepth}-${data.maxDepth}.`
          : "Analyse the game to unlock scores."}
      </p>
      <p className="muted">
        Scores measure move quality from 0 to 100 for this game. They are not
        Elo ratings or comparisons with other players. Categories can overlap.
      </p>
      <div className="review-profile-grid">
        {data.categories.map((category) => (
          <article
            key={category.key}
            aria-label={category.name + " move quality"}
          >
            <h3>{category.name}</h3>
            <strong
              className={
                "profile-score score-" +
                (category.score === null
                  ? "empty"
                  : category.score < 60
                    ? "low"
                    : category.score < 85
                      ? "mid"
                      : "high")
              }
            >
              {category.score === null
                ? "Not enough data"
                : category.score + "/100"}
            </strong>
            {category.score !== null && (
              <progress
                className={
                  category.score < 60
                    ? "score-low"
                    : category.score < 85
                      ? "score-mid"
                      : "score-high"
                }
                aria-label={category.name + " score"}
                value={category.score}
                max="100"
              />
            )}
            <p>
              {category.samples.length} analysed / {category.eligible}{" "}
              identified decisions
            </p>
            <small>
              {category.samples.length === 0
                ? "No scored decisions"
                : category.samples.length < 8
                  ? "Limited sample"
                  : "Single-game sample"}
              {category.meanLoss !== null
                ? ` · ${category.meanLoss.toFixed(1)} expected-score points lost per move`
                : ""}
            </small>
            <details>
              <summary>Evidence and meaning</summary>
              <p>{category.detail}</p>
              {category.evidence.length ? (
                <ul>
                  {category.evidence.map((item) => (
                    <li key={item.ply}>
                      <button onClick={() => onSelect(item.ply)}>
                        {reviewMoveLabel(game, item.ply)} ·{" "}
                        {Math.round(item.loss * 1000) / 10} points lost
                      </button>
                      <small>
                        Depth {item.depth} ·{" "}
                        {item.source === "position-pair"
                          ? "Separate-position comparison"
                          : "Same-position search"}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No analysed evidence available.</p>
              )}
            </details>
          </article>
        ))}
      </div>
      <details>
        <summary>Analysis quality and scoring method</summary>
        <p>
          {options.engine.name} · requested depth {options.depth} or{" "}
          {options.movetime / 1000}s per position · {options.multiPV} candidate
          lines. Limits stop the search at whichever is reached first.
        </p>
        <p>
          {data.rootComparisons}/{data.available} scored moves use the
          recommendation or an alternative from the same search. Other
          comparisons use the positions before and after the move.
        </p>
        {data.depthMismatch > 0 && (
          <p>
            {data.depthMismatch} comparisons have a search-depth difference of
            at least four; review critical moves more deeply.
          </p>
        )}
        {data.engineMismatch > 0 && (
          <p>
            {data.engineMismatch} moves excluded from this profile because the
            two positions name different engines.
          </p>
        )}
        <p>
          Model: {REVIEW_MODEL}. Fixed-strength expected-score estimate, not a
          rating-trained model. Missing engine lines mean some forcing decisions
          may not be identified. Positional play is a proxy; a calibrated game
          rating is not yet available.
        </p>
      </details>
    </section>
  );
}
