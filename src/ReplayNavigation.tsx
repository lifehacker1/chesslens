import { useEffect, useRef, useState } from "react";
import { MoveDial } from "./ReviewControls";
interface Props {
  ply: number;
  moves: string[];
  branch: boolean;
  playing: boolean;
  arrows: boolean;
  running: boolean;
  complete: boolean;
  focused: boolean;
  onFocus: () => void;
  haptics: boolean;
  betterAvailable: boolean;
  betterOpen: boolean;
  onBetter: () => void;
  onNavigate: (ply: number) => void;
  onFlip: () => void;
  onArrows: () => void;
  onPlay: () => void;
  onSeek: (direction: 1 | -1) => void;
  onAnalyse: () => void;
}
export function ReplayNavigation(p: Props) {
  const menu = useRef<HTMLDetailsElement>(null);
  const [placement, setPlacement] = useState<"above" | "below">("above");
  const [menuHeight, setMenuHeight] = useState(320);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node))
        menu.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const run = (action: () => void) => {
    action();
    if (menu.current) menu.current.open = false;
  };
  return (
    <div
      className="navigation replay-navigation"
      role="group"
      aria-label="Move navigation"
    >
      <button
        type="button"
        className="replay-step"
        aria-label="Previous move"
        title="Previous move (←)"
        disabled={!p.ply && !p.branch}
        onClick={() => p.onNavigate(p.ply - 1)}
      >
        ‹
      </button>
      <MoveDial
        compact
        ply={p.ply}
        moves={p.moves}
        onChange={p.onNavigate}
        haptics={p.haptics}
      />
      <button
        type="button"
        className="replay-step replay-next"
        aria-label="Next move"
        title="Next move (→)"
        disabled={p.ply === p.moves.length && !p.branch}
        onClick={() => p.onNavigate(p.ply + 1)}
      >
        ›
      </button>
      <button
        type="button"
        className="replay-better"
        aria-label="Better move"
        aria-expanded={p.betterOpen}
        aria-controls="better-move-lines"
        disabled={!p.betterAvailable}
        title={
          p.betterOpen
            ? "Hide alternative moves"
            : p.betterAvailable
              ? "Show better move"
              : "Analyse this position to see alternatives"
        }
        onClick={p.onBetter}
      >
        <svg
          width="21"
          height="21"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 19v-4c0-4 4-3 8-7l5-5M12 3h5v5M4 15c4 0 6 1 9 5M9 20h5v-5" />
        </svg>
      </button>
      <details
        className={`replay-menu ${placement}`}
        ref={menu}
        onToggle={() => {
          if (!menu.current?.open) return;
          const rect = menu.current.getBoundingClientRect();
          const above = rect.top - 12,
            below = innerHeight - rect.bottom - 85;
          setPlacement(above >= below ? "above" : "below");
          setMenuHeight(Math.max(96, Math.max(above, below)));
        }}
      >
        <summary aria-label="Review tools" title="Review tools">
          ⋯
        </summary>
        <div className="replay-menu-content" style={{ maxHeight: menuHeight }}>
          <button
            onClick={() => run(p.onAnalyse)}
            aria-label={
              p.running ? "Stop engine analysis" : "Start engine analysis"
            }
          >
            {p.running
              ? "■ Stop analysis"
              : p.complete
                ? "↗ Analyse again"
                : "↗ Analyse game"}
          </button>
          <button
            disabled={!p.ply && !p.branch}
            onClick={() => run(() => p.onNavigate(0))}
            aria-label="First position"
          >
            ⇤ First position
          </button>
          <button
            disabled={p.ply === p.moves.length && !p.branch}
            onClick={() => run(() => p.onNavigate(p.moves.length))}
            aria-label="Last position"
          >
            ⇥ Last position
          </button>
          <button
            onClick={() => run(p.onFocus)}
            aria-label={p.focused ? "Exit focus view" : "Expand board"}
          >
            {p.focused ? "↙ Exit focus" : "⛶ Expand board"}
          </button>
          <button
            onClick={() => run(p.onPlay)}
            aria-label={p.playing ? "Pause review" : "Auto-play review"}
          >
            {p.playing ? "Ⅱ Pause" : "▶ Auto-play"}
          </button>
          <button onClick={() => run(p.onFlip)} aria-label="Flip board">
            ↻ Flip board
          </button>
          <button
            onClick={() => run(p.onArrows)}
            aria-label="Toggle tactical arrows"
            aria-pressed={p.arrows}
          >
            Arrows {p.arrows ? "on" : "off"}
          </button>
          <button
            disabled={!p.ply || p.branch}
            onClick={() => run(() => p.onSeek(-1))}
            aria-label="Previous blunder"
          >
            ← Previous key move
          </button>
          <button
            disabled={p.ply >= p.moves.length || p.branch}
            onClick={() => run(() => p.onSeek(1))}
            aria-label="Next blunder"
          >
            Next key move →
          </button>
        </div>
      </details>
    </div>
  );
}
