import { useId, type CSSProperties } from "react";
import { pieceSvg, type PieceFinish } from "./pieces";
import type { Color, PieceSymbol } from "chess.js";
import { gradeIcons, type Grade } from "./game";
export const boardThemes = {
  classic: { name: "Classic Green", light: "#eeeed2", dark: "#769656" },
  jade: { name: "ChessLens Jade", light: "#c9ddd3", dark: "#4d8271" },
  walnut: { name: "Walnut", light: "#f0d9b5", dark: "#b58863" },
  blue: { name: "Slate Blue", light: "#dee6ec", dark: "#6485a5" },
  midnight: { name: "Midnight", light: "#b9c7c2", dark: "#384d46" },
  contrast: { name: "High Contrast", light: "#fafaf4", dark: "#414d59" },
};
export type BoardTheme = keyof typeof boardThemes;
export interface BoardPreferences {
  theme: BoardTheme;
  badges: boolean;
  pieceFinish: PieceFinish;
}
export function readBoardPreferences(): BoardPreferences {
  try {
    const value = JSON.parse(localStorage.getItem("chesslens-board") || "{}");
    return {
      theme: Object.hasOwn(boardThemes, value?.theme) ? value.theme : "classic",
      badges: value?.badges !== false,
      pieceFinish: value?.pieceFinish === "flat" ? "flat" : "sculpted",
    };
  } catch {
    return { theme: "classic", badges: true, pieceFinish: "sculpted" };
  }
}
export function BoardAppearance({
  value,
  onChange,
  expanded,
}: {
  value: BoardPreferences;
  onChange: (value: BoardPreferences) => void;
  expanded: boolean;
}) {
  return (
    <details
      data-setting-section="appearance"
      className="panel board-appearance"
      open={expanded || undefined}
    >
      <summary>Board & review appearance</summary>
      <div className="appearance-content">
        <p className="muted">
          Classic chess palettes, with original ChessLens piece artwork.
        </p>
        <div
          role="group"
          aria-label="Board theme"
          className="board-theme-options"
        >
          {Object.entries(boardThemes).map(([id, theme]) => (
            <button
              key={id}
              aria-pressed={value.theme === id}
              aria-label={theme.name}
              onClick={() => onChange({ ...value, theme: id as BoardTheme })}
            >
              <span
                className="theme-swatch"
                style={
                  {
                    "--swatch-light": theme.light,
                    "--swatch-dark": theme.dark,
                  } as CSSProperties
                }
                aria-hidden="true"
              />
              <span>{theme.name}</span>
            </button>
          ))}
        </div>
        <label className="piece-finish-setting">
          Piece design
          <select
            aria-label="Piece design"
            value={value.pieceFinish}
            onChange={(e) =>
              onChange({ ...value, pieceFinish: e.target.value as PieceFinish })
            }
          >
            <option value="sculpted">Sculpted · shaded vector</option>
            <option value="flat">Flat · clean high contrast</option>
          </select>
        </label>
        <label className="preference-row badge-preference">
          <span>
            <strong>Move quality on the board</strong>
            <small>
              Show the selected move’s classification and accuracy on its
              destination square after analysis.
            </small>
          </span>
          <input
            type="checkbox"
            checked={value.badges}
            onChange={(e) => onChange({ ...value, badges: e.target.checked })}
          />
        </label>
        <p className="muted">
          Review grades use expected-point loss and conservative special-move
          heuristics. They are ChessLens estimates, not Chess.com scores.
        </p>
      </div>
    </details>
  );
}
export function BoardMoveBadge({
  grade,
  accuracy,
}: {
  grade: Grade;
  accuracy: number | null;
}) {
  return (
    <span
      className={`board-move-badge ${grade.toLowerCase()}`}
      role="img"
      aria-label={`${grade}${accuracy !== null ? `, ${accuracy}% accuracy` : ""}`}
      title={`${grade}${accuracy !== null ? ` · ${accuracy}% accuracy` : ""}`}
    >
      <b>{gradeIcons[grade]}</b>
      {accuracy !== null && <em>{accuracy}%</em>}
    </span>
  );
}
export function ChessPiece({
  type,
  color,
  finish = "sculpted",
}: {
  type: PieceSymbol;
  color: Color;
  finish?: PieceFinish;
}) {
  const id = useId();
  return (
    <span
      className="piece-vector-art"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: pieceSvg(type, color, finish, id) }}
    />
  );
}
