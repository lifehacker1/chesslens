import React from "react";
import type { Grade } from "./game";

interface BoardArrowsProps {
  bestMoveUci?: string;
  playedMoveUci?: string;
  grade?: Grade | null;
  flipped: boolean;
  enabled?: boolean;
}

function squareToCoords(
  square: string,
  flipped: boolean,
): { x: number; y: number } | null {
  if (!square || square.length < 2) return null;
  const rawFile = square.charCodeAt(0) - 97;
  const rawRank = parseInt(square[1], 10);
  if (
    isNaN(rawFile) ||
    isNaN(rawRank) ||
    rawFile < 0 ||
    rawFile > 7 ||
    rawRank < 1 ||
    rawRank > 8
  ) {
    return null;
  }
  const col = flipped ? 7 - rawFile : rawFile;
  const row = flipped ? rawRank - 1 : 8 - rawRank;
  return {
    x: (col + 0.5) * 12.5,
    y: (row + 0.5) * 12.5,
  };
}

function computeArrowPoints(
  from: { x: number; y: number },
  to: { x: number; y: number },
  trimEnd = 3.2,
  trimStart = 2.0,
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
  return {
    x1: from.x + (dx / len) * trimStart,
    y1: from.y + (dy / len) * trimStart,
    x2: to.x - (dx / len) * trimEnd,
    y2: to.y - (dy / len) * trimEnd,
  };
}

export function BoardArrows({
  bestMoveUci,
  playedMoveUci,
  grade,
  flipped,
  enabled = true,
}: BoardArrowsProps) {
  if (!enabled) return null;

  const arrows: Array<{
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color: string;
    markerId: string;
    strokeWidth: number;
    opacity: number;
    isDashed?: boolean;
  }> = [];

  // 1. Played move arrow (if it was an inaccuracy, mistake, or blunder)
  const isMistake =
    grade === "Blunder" ||
    grade === "Mistake" ||
    grade === "Inaccuracy" ||
    grade === "Miss";
  if (playedMoveUci && isMistake && playedMoveUci !== bestMoveUci) {
    const from = squareToCoords(playedMoveUci.slice(0, 2), flipped);
    const to = squareToCoords(playedMoveUci.slice(2, 4), flipped);
    if (from && to) {
      const pts = computeArrowPoints(from, to, 3.2, 1.8);
      const color =
        grade === "Blunder" || grade === "Miss"
          ? "#f43f5e"
          : grade === "Mistake"
            ? "#f97316"
            : "#eab308";
      arrows.push({
        id: "played-mistake",
        ...pts,
        color,
        markerId:
          grade === "Miss" ? "marker-blunder" : `marker-${grade.toLowerCase()}`,
        strokeWidth: 2.0,
        opacity: 0.9,
      });
    }
  }

  // 2. Best move arrow (green/teal recommendation)
  if (bestMoveUci && bestMoveUci !== "(none)") {
    const from = squareToCoords(bestMoveUci.slice(0, 2), flipped);
    const to = squareToCoords(bestMoveUci.slice(2, 4), flipped);
    if (from && to) {
      const pts = computeArrowPoints(from, to, 3.2, 1.8);
      arrows.push({
        id: "best-move",
        ...pts,
        color: "#8ce4c2",
        markerId: "marker-best",
        strokeWidth: 2.3,
        opacity: 0.95,
      });
    }
  }

  return (
    <svg
      className="board-arrows-overlay"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        {/* Best move marker */}
        <marker
          id="marker-best"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#8ce4c2" />
        </marker>
        {/* Blunder marker */}
        <marker
          id="marker-blunder"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#f43f5e" />
        </marker>
        {/* Mistake marker */}
        <marker
          id="marker-mistake"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#f97316" />
        </marker>
        {/* Inaccuracy marker */}
        <marker
          id="marker-inaccuracy"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#eab308" />
        </marker>
      </defs>

      {arrows.map((a) => (
        <g key={a.id}>
          {/* Subtle dark stroke outline for high-contrast on any board theme */}
          <line
            x1={a.x1}
            y1={a.y1}
            x2={a.x2}
            y2={a.y2}
            stroke="#0b1216"
            strokeWidth={a.strokeWidth + 1.2}
            strokeLinecap="round"
            opacity={0.6}
          />
          {/* Main colored arrow */}
          <line
            x1={a.x1}
            y1={a.y1}
            x2={a.x2}
            y2={a.y2}
            stroke={a.color}
            strokeWidth={a.strokeWidth}
            strokeLinecap="round"
            markerEnd={`url(#${a.markerId})`}
            opacity={a.opacity}
            strokeDasharray={a.isDashed ? "3,2" : undefined}
          />
        </g>
      ))}
    </svg>
  );
}
