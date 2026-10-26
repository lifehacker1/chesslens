import type { CSSProperties } from "react";
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
}
export function readBoardPreferences(): BoardPreferences {
  try {
    const value = JSON.parse(localStorage.getItem("chesslens-board") || "{}");
    return {
      theme: Object.hasOwn(boardThemes, value?.theme) ? value.theme : "classic",
      badges: value?.badges !== false,
    };
  } catch {
    return { theme: "classic", badges: true };
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
    <details className="panel board-appearance" open={expanded || undefined}>
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
}: {
  type: PieceSymbol;
  color: Color;
}) {
  return (
    <svg
      className={`piece-svg ${color === "w" ? "white-piece" : "black-piece"}`}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <g strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
        {type === "p" && (
          <>
            <circle cx="24" cy="12" r="6" />
            <path d="M19 18h10v5l-3 1c0 6 3 10 7 12H15c4-2 7-6 7-12l-3-1z" />
          </>
        )}
        {type === "r" && (
          <>
            <path d="M13 7h6v5h4V7h4v5h4V7h5v12l-5 4v11l3 3H14l3-3V23l-4-4z" />
            <path d="M17 19h14M18 28h12" fill="none" />
          </>
        )}
        {type === "n" && (
          <>
            <path d="M14 36c1-7 3-10 9-15l-7 2-5-4 9-11 10-3 4 9 2 11-2 11z" />
            <path
              d="m20 8 1-5 6 4M16 19l7-2M27 15c-1 6-4 10-9 15"
              fill="none"
            />
            <circle
              cx="24"
              cy="12"
              r="1.4"
              className="piece-detail"
              stroke="none"
            />
          </>
        )}
        {type === "b" && (
          <>
            <path d="M24 5c-7 6-11 12-8 17l6 5c-1 4-4 7-8 9h20c-4-2-7-5-8-9l6-5c3-5-1-11-8-17z" />
            <path d="m26 12-6 9M19 26h10" fill="none" />
          </>
        )}
        {type === "q" && (
          <>
            <path d="m12 14 7 7 5-12 5 12 7-7-5 20H17z" />
            <circle cx="11" cy="11" r="3" />
            <circle cx="24" cy="7" r="3" />
            <circle cx="37" cy="11" r="3" />
            <path d="M17 29h14M16 35h16" fill="none" />
          </>
        )}
        {type === "k" && (
          <>
            <path d="M22 5h4v4h4v4h-4v5h-4v-5h-4V9h4z" />
            <path d="M24 19c-4-7-13-4-11 4l6 11h10l6-11c2-8-7-11-11-4z" />
            <path d="M17 29h14M18 34h12" fill="none" />
          </>
        )}
        <path d="M14 36h20l2 5H12z" />
        <path d="M13 42h22" fill="none" />
      </g>
    </svg>
  );
}
