import { useEffect, useRef, useState } from "react";
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
  sounds: boolean;
  onNavigate: (ply: number) => void;
  onFlip: () => void;
  onArrows: () => void;
  onPlay: () => void;
  onSeek: (direction: 1 | -1) => void;
  onAnalyse: () => void;
  onDetails: () => void;
  betterAvailable: boolean;
  betterOpen: boolean;
  onBetter: () => void;
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
        <ControlIcon kind="previous" />
      </button>
      <button
        aria-label={p.playing ? "Pause review" : "Auto-play review"}
        title={p.playing ? "Pause review" : "Auto-play review"}
        onClick={p.onPlay}
      >
        <ControlIcon kind={p.playing ? "pause" : "play"} />
      </button>
      <button
        type="button"
        className="replay-step replay-next"
        aria-label="Next move"
        title="Next move (→)"
        disabled={p.ply === p.moves.length && !p.branch}
        onClick={() => p.onNavigate(p.ply + 1)}
      >
        <ControlIcon kind="next" />
      </button>
      <button
        className="replay-better"
        aria-label="Better move"
        title="Compare a better move"
        aria-pressed={p.betterOpen}
        aria-expanded={p.betterOpen}
        aria-controls="better-move-lines"
        disabled={!p.betterAvailable}
        onClick={p.onBetter}
      >
        <ControlIcon kind="compare" />
      </button>
      <details
        className={`replay-menu ${placement}`}
        ref={menu}
        onToggle={() => {
          if (!menu.current?.open) return;
          const rect = menu.current.getBoundingClientRect();
          const mobile = matchMedia("(max-width:800px)").matches;
          const headerBottom = mobile
            ? 0
            : Math.max(
                0,
                document.querySelector(".app > header")?.getBoundingClientRect()
                  .bottom || 0,
              );
          const above = rect.top - headerBottom - 12,
            below = innerHeight - rect.bottom - (mobile ? 85 : 16);
          setPlacement(above >= below ? "above" : "below");
          setMenuHeight(Math.max(48, Math.max(above, below)));
        }}
      >
        <summary aria-label="Review tools" title="Review tools">
          <ControlIcon kind="more" />
        </summary>
        <div className="replay-menu-content" style={{ maxHeight: menuHeight }}>
          <button
            onClick={() => run(p.onDetails)}
            aria-label="Position details"
          >
            Position details
          </button>
          <button
            onClick={() => run(p.onAnalyse)}
            aria-label={p.complete ? "Analyse again" : "Start engine analysis"}
            disabled={p.running}
          >
            {p.running
              ? "Analysis in progress"
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

function ControlIcon({
  kind,
}: {
  kind: "previous" | "next" | "play" | "pause" | "compare" | "more";
}) {
  const paths = {
    previous: "M15 5l-7 7 7 7",
    next: "M9 5l7 7-7 7",
    play: "M8 5l11 7-11 7Z",
    pause: "M8 5v14M16 5v14",
    compare: "M6 20v-8c0-4 12-2 12-8M14 8l4-4 4 4M6 12V4M2 8l4-4 4 4",
    more: "M5 12h.01M12 12h.01M19 12h.01",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth={kind === "more" ? 3 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[kind]} />
    </svg>
  );
}
