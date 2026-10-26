import React, { useState } from "react";
import type { Evaluation, Grade } from "./game";

interface EvalGraphProps {
  evaluations: Record<number, Evaluation>;
  moves: Array<{ san: string; color: "w" | "b" }>;
  currentPly: number;
  grades: Record<number, Grade | null>;
  onSelectPly: (ply: number) => void;
}

export function EvalGraph({
  evaluations,
  moves,
  currentPly,
  grades,
  onSelectPly,
}: EvalGraphProps) {
  const [hoverPly, setHoverPly] = useState<number | null>(null);

  const totalPlies = moves.length;
  if (totalPlies === 0) return null;

  const width = 1000;
  const height = 110;
  const midY = height / 2;

  // Generate points
  const points: Array<{
    x: number;
    y: number;
    ply: number;
    eval?: Evaluation;
    grade?: Grade | null;
  }> = [];
  for (let ply = 0; ply <= totalPlies; ply++) {
    const x = (ply / totalPlies) * width;
    const ev = evaluations[ply];
    let y = midY;
    if (ev) {
      if (ev.mate !== undefined) {
        y = ev.mate > 0 ? 8 : height - 8;
      } else {
        const norm = Math.tanh(ev.cp / 400); // [-1, 1]
        y = midY - norm * (midY - 12);
      }
    }
    points.push({
      x,
      y,
      ply,
      eval: ev,
      grade: ply > 0 ? grades[ply - 1] : null,
    });
  }

  // Build SVG path string
  const polylineStr = points
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  // Build area under line
  const whiteAreaStr =
    `0,${midY} ` +
    points
      .map((p) => `${p.x.toFixed(1)},${Math.min(midY, p.y).toFixed(1)}`)
      .join(" ") +
    ` ${width},${midY}`;
  const blackAreaStr =
    `0,${midY} ` +
    points
      .map((p) => `${p.x.toFixed(1)},${Math.max(midY, p.y).toFixed(1)}`)
      .join(" ") +
    ` ${width},${midY}`;

  const currentPt = points[currentPly] || points[0];
  const activePly = hoverPly !== null ? hoverPly : currentPly;
  const activePt = points[activePly] || currentPt;
  const activeMove = activePly > 0 ? moves[activePly - 1] : null;
  const activeEval = evaluations[activePly];

  const evalText =
    activeEval?.mate !== undefined
      ? `M${activeEval.mate}`
      : activeEval
        ? `${activeEval.cp >= 0 ? "+" : ""}${(activeEval.cp / 100).toFixed(2)}`
        : "—";

  return (
    <div className="eval-graph-card">
      <div className="eval-graph-header">
        <div className="graph-title-row">
          <span className="eyebrow">ADVANTAGE TIMELINE</span>
          <span className="graph-hover-info">
            {activePly === 0 ? (
              <span>Start of game</span>
            ) : (
              <span>
                Move {Math.ceil(activePly / 2)}
                {activeMove
                  ? ` · ${activeMove.color === "w" ? "White" : "Black"} ${activeMove.san}`
                  : ""}{" "}
                · <strong>{evalText}</strong>
                {activePt.grade && (
                  <span className={`badge ${activePt.grade.toLowerCase()}`}>
                    {activePt.grade}
                  </span>
                )}
              </span>
            )}
          </span>
        </div>
        <span className="graph-hint muted">Click graph to jump to move</span>
      </div>

      <div className="eval-graph-svg-wrap">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="eval-graph-svg"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoverPly(null)}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const ratio = Math.max(0, Math.min(1, clickX / rect.width));
            const targetPly = Math.round(ratio * totalPlies);
            onSelectPly(targetPly);
          }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const ratio = Math.max(0, Math.min(1, mouseX / rect.width));
            const targetPly = Math.round(ratio * totalPlies);
            setHoverPly(targetPly);
          }}
        >
          <defs>
            <linearGradient id="white-adv-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8ce4c2" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#8ce4c2" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="black-adv-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff8c97" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#ff8c97" stopOpacity="0.45" />
            </linearGradient>
          </defs>

          {/* Neutral zero line */}
          <line
            x1="0"
            y1={midY}
            x2={width}
            y2={midY}
            stroke="#2a3c46"
            strokeDasharray="4,4"
            strokeWidth="1.2"
          />

          {/* Area fills */}
          <polygon points={whiteAreaStr} fill="url(#white-adv-grad)" />
          <polygon points={blackAreaStr} fill="url(#black-adv-grad)" />

          {/* Main timeline trend line */}
          <polyline
            points={polylineStr}
            fill="none"
            stroke="#8ce4c2"
            strokeWidth="2.4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Critical moment marker dots (Blunder, Mistake, Inaccuracy) */}
          {points.map((p) => {
            if (!p.grade) return null;
            if (["Brilliant", "Great", "Miss"].includes(p.grade))
              return (
                <circle
                  key={`special-${p.ply}`}
                  cx={p.x}
                  cy={p.y}
                  r="5"
                  fill={
                    p.grade === "Brilliant"
                      ? "#28a7aa"
                      : p.grade === "Great"
                        ? "#4b8cc4"
                        : "#d94c5a"
                  }
                  stroke="#10181d"
                  strokeWidth="1.5"
                >
                  <title>{p.grade}</title>
                </circle>
              );
            if (p.grade === "Blunder") {
              return (
                <circle
                  key={`dot-${p.ply}`}
                  cx={p.x}
                  cy={p.y}
                  r="5"
                  fill="#f43f5e"
                  stroke="#10181d"
                  strokeWidth="1.5"
                />
              );
            }
            if (p.grade === "Mistake") {
              return (
                <circle
                  key={`dot-${p.ply}`}
                  cx={p.x}
                  cy={p.y}
                  r="4"
                  fill="#f97316"
                  stroke="#10181d"
                  strokeWidth="1.5"
                />
              );
            }
            if (p.grade === "Inaccuracy") {
              return (
                <circle
                  key={`dot-${p.ply}`}
                  cx={p.x}
                  cy={p.y}
                  r="3.2"
                  fill="#eab308"
                  stroke="#10181d"
                  strokeWidth="1"
                />
              );
            }
            return null;
          })}

          {/* Active / Current Ply vertical cursor */}
          <line
            x1={activePt.x}
            y1="0"
            x2={activePt.x}
            y2={height}
            stroke="#e8eeef"
            strokeWidth="1.8"
            strokeDasharray="3,2"
            opacity={0.85}
          />
          <circle
            cx={activePt.x}
            cy={activePt.y}
            r="6"
            fill="#ffffff"
            stroke="#8ce4c2"
            strokeWidth="2.5"
          />
        </svg>
      </div>

      <div className="eval-graph-footer">
        <span className="adv-label white-side">▲ White Advantage</span>
        <span className="adv-label neutral-side">Balanced (0.0)</span>
        <span className="adv-label black-side">▼ Black Advantage</span>
      </div>
    </div>
  );
}
