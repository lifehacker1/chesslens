import type { Color } from "chess.js";
import type { CapturedPiece } from "./material";
const names = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen" };
const icons = {
  w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕" },
  b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛" },
};
const order: CapturedPiece[] = ["q", "r", "b", "n", "p"];
export function CapturedMaterial({
  color,
  captures,
  advantage,
  partial = false,
}: {
  color: Color;
  captures: CapturedPiece[];
  advantage: number;
  partial?: boolean;
}) {
  const player = color === "w" ? "White" : "Black",
    opponent = color === "w" ? "b" : "w";
  return (
    <div
      className="captured-material"
      role="group"
      aria-label={`${player} captured pieces`}
      title={
        partial
          ? "Captures shown since the imported starting position. Material lead uses the current board."
          : "Captured opponent pieces · material lead uses the current board."
      }
    >
      <span className="captured-piece-list">
        {order.map((type) => {
          const count = captures.filter((p) => p === type).length;
          return count ? (
            <span
              key={type}
              className="captured-piece-group"
              role="img"
              aria-label={`${count} ${opponent === "w" ? "White" : "Black"} ${names[type]}${count === 1 ? "" : "s"} captured`}
            >
              {Array.from({ length: count }, (_, i) => (
                <span className="captured-piece" aria-hidden="true" key={i}>
                  {icons[opponent][type]}
                </span>
              ))}
            </span>
          ) : null;
        })}
      </span>
      {advantage > 0 && (
        <span
          className="material-advantage"
          aria-label={`${player} material advantage +${advantage}`}
          title={`Material lead: ${advantage} point${advantage === 1 ? "" : "s"}. Pawn 1, knight/bishop 3, rook 5, queen 9.`}
        >
          +{advantage}
        </span>
      )}
      {!captures.length && (
        <span className="sr-only">No captures in recorded moves.</span>
      )}
    </div>
  );
}
