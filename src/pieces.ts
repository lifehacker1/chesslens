import type { Color, PieceSymbol } from "chess.js";
export type PieceFinish = "sculpted" | "flat";
export const pieceNames: Record<PieceSymbol, string> = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King",
};
const bodies: Record<PieceSymbol, string> = {
  p: `<circle cx="32" cy="18" r="7.2"/><path d="M26 25h12l1.5 5H36c-.8 6 1.4 11 6 16H22c4.6-5 6.8-10 6-16h-3.5z"/><path class="piece-groove" d="M27 29h10M25 43h14"/><path class="piece-highlight" d="M29 14c1-2 4-3 6-1M31 33c0 4-1 7-3 10"/>`,
  r: `<path d="M15 10h8v7h5v-7h8v7h5v-7h8v14l-5 5v17H20V29l-5-5z"/><path class="piece-groove" d="M19 24h26M21 29h22M22 43h20"/><path class="piece-highlight" d="M22 32v8M18 13v8M44 13v8"/>`,
  b: `<path d="M32 7c-4 6-14 14-11 22 1.4 4.2 6.4 5.3 7 8l-2 7-6 4h24l-6-4-2-7c.6-2.7 5.6-3.8 7-8 3-8-7-16-11-22z"/><path class="piece-groove bishop-cut" d="M37.5 15 28 27M27 36h10M25 43h14"/><path class="piece-highlight" d="M27 18c-3 4-5 7-3 10M31 38l-1 4"/>`,
  q: `<path d="m14 17 9 9V13l7 12 2-15 3 15 6-12v13l9-9-6 22-7 5 5 4H22l5-4-7-5z"/><circle cx="14" cy="14" r="3.2"/><circle cx="23" cy="10" r="3"/><circle cx="32" cy="7" r="3.2"/><circle cx="41" cy="10" r="3"/><circle cx="50" cy="14" r="3.2"/><path class="piece-groove" d="M21 35h22M24 39h16M27 44h10"/><path class="piece-highlight" d="m23 29 2 4M28 39h7"/>`,
  k: `<path d="M29 4h6v6h6v6h-6v9h-6v-9h-6v-6h6z"/><path d="M19 27c-5-9 5-13 13-5 8-8 18-4 13 5l-6 16 5 5H20l5-5z"/><path class="piece-groove" d="M23 35h18M25 41h14M32 23v11"/><path class="piece-highlight" d="M22 23c-1-3 2-3 5-1M27 37h9"/>`,
  n: `<path d="M19 48c1-7 1-13 8-18l-4-4-8 4c-2 1-5-1-5-4l10-14 8-3 1-5 7 7c9 3 14 15 10 27l-4 10z"/><path class="piece-groove" d="m15 26 8-4M27 14l-3 6M31 23c-1 5-6 8-7 13M30 31c6 1 9 7 8 12"/><circle class="piece-eye" cx="25" cy="17" r="1.7"/><circle class="piece-eye" cx="15" cy="25" r=".85"/><path class="piece-highlight" d="M36 15c7 5 9 15 6 22M22 39l-1 5"/>`,
};
const base = `<path d="M21 47h22l4 5H17z"/><path d="M17 52h30l4 5c1 1.8-.4 3-3 3H16c-2.6 0-4-1.2-3-3z"/><path class="piece-groove" d="M18 52h28M17 57h30"/><path class="piece-highlight" d="M22 49h19M19 54h22"/>`;
const pawnBase = `<path d="M23 45h18l3 6H20z"/><path d="M20 51h24l4 6c.8 1.7-.4 3-2.5 3h-27c-2.1 0-3.3-1.3-2.5-3z"/><path class="piece-groove" d="M21 51h22M20 57h24"/><path class="piece-highlight" d="M25 48h13M22 54h16"/>`;
/** Authored vector masters; strings contain only this module's static geometry. */
export function pieceSvg(
  type: PieceSymbol,
  color: Color,
  finish: PieceFinish = "sculpted",
  prefix = "piece",
) {
  const id = prefix.replace(/[^a-zA-Z0-9_-]/g, "");
  const white = color === "w";
  const palette = white
    ? ["#fffdf5", "#ede6d5", "#c9c0ab"]
    : ["#697365", "#303c31", "#111d17"];
  const outline = white ? "#3e493d" : "#08110c";
  const groove = white ? "#8e8c77" : "#bdcbb6";
  const highlight = white ? "#fffefa" : "#d9e7cf";
  const fill =
    finish === "sculpted" ? `url(#${id}-body)` : white ? "#faf8ed" : "#28362b";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" id="${id}-art" class="piece-svg ${white ? "white-piece" : "black-piece"} finish-${finish}" role="img" aria-label="${white ? "White" : "Black"} ${pieceNames[type].toLowerCase()}" focusable="false"><title>${white ? "White" : "Black"} ${pieceNames[type]}</title><defs><linearGradient id="${id}-body" x1="12" y1="8" x2="50" y2="58" gradientUnits="userSpaceOnUse"><stop stop-color="${palette[0]}"/><stop offset=".48" stop-color="${palette[1]}"/><stop offset="1" stop-color="${palette[2]}"/></linearGradient></defs><style> #${id}-art .piece-groove{fill:none;stroke:${groove};stroke-width:1.35;opacity:${white ? ".82" : ".7"}} #${id}-art .piece-highlight{fill:none;stroke:${highlight};stroke-width:1.45;opacity:${finish === "flat" ? "0" : white ? ".9" : ".4"}} #${id}-art .piece-eye{fill:${white ? "#29352c" : "#e3edda"};stroke:none} #${id}-art .bishop-cut{stroke-width:2.8;opacity:1}</style><g fill="${fill}" stroke="${outline}" stroke-width="1.55" stroke-linejoin="round" stroke-linecap="round">${bodies[type]}${type === "p" ? pawnBase : base}</g></svg>`;
}
