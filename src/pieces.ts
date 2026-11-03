import type { Color, PieceSymbol } from "chess.js";
export const pieceDesigns = {
  chesslens: "ChessLens",
  tournament: "Tournament",
  minimal: "Minimal",
};
export type PieceDesign = keyof typeof pieceDesigns;
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
const tournament: Record<PieceSymbol, string> = {
  p: '<circle cx="32" cy="16" r="7"/><path d="M25 25h14v5h-4c-1 8 2 13 7 17H22c5-4 8-9 7-17h-4z"/><path class="piece-groove" d="M25 29h14"/>',
  n: '<path d="M19 48c0-10 5-15 10-19l-7-3-7 3-4-5 10-13 7-1 2-6 6 7c10 6 13 17 10 28l-5 9z"/><path class="piece-groove" d="M31 15c10 5 12 15 8 24M19 24l7-4M25 35l6-6"/><circle class="piece-eye" cx="25" cy="16" r="1.6"/>',
  b: '<circle cx="32" cy="7" r="3"/><path d="M32 11c-3 4-12 11-12 18 0 5 5 7 9 8l-3 7-6 4h24l-6-4-3-7c4-1 9-3 9-8 0-7-9-14-12-18z"/><path class="piece-groove bishop-cut" d="m37 17-9 13"/><path class="piece-groove" d="M25 39h14"/>',
  r: '<path d="M16 9h8v8h5V9h6v8h5V9h8v16l-7 5 1 17H22l1-17-7-5z"/><path class="piece-groove" d="M17 24h30M23 31h18M22 44h20"/>',
  q: '<path d="m15 16 8 8 2-12 7 12 7-12 2 12 8-8-7 23-5 5 6 4H21l6-4-5-5z"/><circle cx="15" cy="13" r="3"/><circle cx="25" cy="9" r="3"/><circle cx="39" cy="9" r="3"/><circle cx="49" cy="13" r="3"/><path class="piece-groove" d="M23 36h18M26 42h12"/>',
  k: '<path d="M30 4h4v6h6v4h-6v7h-4v-7h-6v-4h6z"/><path d="M18 26c0-7 8-9 14-3 6-6 14-4 14 3l-7 15 4 7H21l4-7z"/><path class="piece-groove" d="M22 34h20M25 41h14"/>',
};
const minimal: Record<PieceSymbol, string> = {
  p: '<circle cx="32" cy="17" r="8"/><path d="M28 27h8l5 20H23z"/>',
  n: '<path d="m20 47 5-16-11-2v-7L29 9l2-6 7 8 10 16-7 20z"/><path class="piece-groove" d="m27 21-7 5M34 24l5 10"/><circle class="piece-eye" cx="30" cy="16" r="2"/>',
  b: '<path d="m32 6 13 23-10 8 7 10H22l7-10-10-8z"/><path class="piece-groove bishop-cut" d="m37 17-9 12"/>',
  r: '<path d="M17 10h8v8h5v-8h4v8h5v-8h8v17h-6v20H23V27h-6z"/><path class="piece-groove" d="M23 29h18"/>',
  q: '<path d="m14 13 12 12 6-18 6 18 12-12-9 34H23z"/><path class="piece-groove" d="M23 37h18"/>',
  k: '<path d="M29 4h6v8h8v6h-8v9h-6v-9h-8v-6h8z"/><path d="M22 30h20l-5 10 5 7H22l5-7z"/>',
};
const designBodies = { chesslens: bodies, tournament, minimal };
const designBase =
  '<path d="M21 48h22l5 6H16zM16 54h32v6H16z"/><path class="piece-groove" d="M20 54h24"/>';
/** Authored vector masters; strings contain only this module's static geometry. */
export function pieceSvg(
  type: PieceSymbol,
  color: Color,
  finish: PieceFinish = "sculpted",
  prefix = "piece",
  design: PieceDesign = "chesslens",
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" id="${id}-art" class="piece-svg ${white ? "white-piece" : "black-piece"} finish-${finish} design-${design}" role="img" aria-label="${white ? "White" : "Black"} ${pieceNames[type].toLowerCase()}" focusable="false"><title>${white ? "White" : "Black"} ${pieceNames[type]}</title><defs><linearGradient id="${id}-body" x1="12" y1="8" x2="50" y2="58" gradientUnits="userSpaceOnUse"><stop stop-color="${palette[0]}"/><stop offset=".48" stop-color="${palette[1]}"/><stop offset="1" stop-color="${palette[2]}"/></linearGradient></defs><style> #${id}-art .piece-groove{fill:none;stroke:${groove};stroke-width:1.35;opacity:${white ? ".82" : ".7"}} #${id}-art .piece-highlight{fill:none;stroke:${highlight};stroke-width:1.45;opacity:${finish === "flat" ? "0" : white ? ".9" : ".4"}} #${id}-art .piece-eye{fill:${white ? "#29352c" : "#e3edda"};stroke:none} #${id}-art .bishop-cut{stroke-width:2.8;opacity:1}</style><g fill="${fill}" stroke="${outline}" stroke-width="1.55" stroke-linejoin="round" stroke-linecap="round">${designBodies[design][type]}${design === "chesslens" ? (type === "p" ? pawnBase : base) : designBase}</g></svg>`;
}
