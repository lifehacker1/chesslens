import { useEffect, useRef, useState } from "react";
import { pvToSan, type Evaluation } from "./game";
import {
  builtinEngine,
  presets,
  engineUrl,
  type AnalysisOptions,
  type EngineConfig,
} from "./engine";
import { touchTick } from "./MobileShell";
export function MoveDial({
  ply,
  moves,
  onChange,
  haptics = false,
}: {
  ply: number;
  moves: string[];
  onChange: (ply: number) => void;
  haptics?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null),
    action = useRef(onChange),
    value = useRef(ply),
    haptic = useRef(haptics),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [feedback, setFeedback] = useState(""),
    [active, setActive] = useState(false);
  action.current = onChange;
  value.current = ply;
  haptic.current = haptics;
  const step = useRef((next: number) => {});
  step.current = (next: number) => {
    const clamped = Math.max(0, Math.min(moves.length, next));
    setFeedback(
      clamped === 0
        ? "Start of game"
        : clamped === moves.length
          ? "End of game"
          : `Move ${clamped} of ${moves.length}`,
    );
    setActive(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setActive(false), 450);
    if (clamped !== value.current) {
      touchTick(haptic.current);
      action.current(clamped);
    }
  };
  useEffect(() => {
    const el = ref.current;
    let distance = 0;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      e.preventDefault();
      distance += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(distance) >= 30) {
        step.current(value.current + Math.sign(distance));
        distance = 0;
      }
    };
    el?.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el?.removeEventListener("wheel", wheel);
      clearTimeout(timer.current);
    };
  }, []);
  return (
    <div className={`move-dial ${active ? "is-scrubbing" : ""}`} ref={ref}>
      <div className="dial-heading">
        <span>MOVE DIAL</span>
        <strong>{ply ? moves[ply - 1] : "Start"}</strong>
        <span>
          {ply} / {moves.length}
        </span>
      </div>
      <div className="dial-ruler" aria-hidden="true">
        <div
          className="dial-ticks"
          style={{ transform: `translateX(${-ply * 14}px)` }}
        />
        <i />
      </div>
      <input
        aria-label="Move dial"
        type="range"
        min={0}
        max={moves.length}
        step={1}
        value={ply}
        aria-valuetext={
          ply ? `Ply ${ply}: ${moves[ply - 1]}` : "Starting position"
        }
        onPointerDown={() => {
          setFeedback(
            ply === 0
              ? "Start of game"
              : ply === moves.length
                ? "End of game"
                : `Move ${ply} of ${moves.length}`,
          );
          setActive(true);
        }}
        onChange={(e) => step.current(Number(e.target.value))}
        onKeyDown={(e) => {
          if (
            (ply === 0 && ["ArrowLeft", "Home"].includes(e.key)) ||
            (ply === moves.length && ["ArrowRight", "End"].includes(e.key))
          )
            step.current(ply);
        }}
        onPointerUp={() => {
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setActive(false), 450);
        }}
      />
      <small className="dial-feedback" aria-live="polite" aria-atomic="true">
        {active && feedback ? feedback : "Drag, swipe or scroll to replay"}
      </small>
      <div className="dial-progress" aria-hidden="true">
        <span
          style={{ width: `${moves.length ? (ply / moves.length) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}
export function EngineSettings({
  options,
  onChange,
  disabled,
  expanded = false,
}: {
  options: AnalysisOptions;
  onChange: (options: AnalysisOptions) => void;
  disabled: boolean;
  expanded?: boolean;
}) {
  const [extra, setExtra] = useState<EngineConfig[]>(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("chesslens-engines") || "[]",
      );
      return Array.isArray(saved)
        ? saved
            .filter(
              (item): item is EngineConfig =>
                item &&
                typeof item.id === "string" &&
                typeof item.name === "string" &&
                typeof item.url === "string",
            )
            .slice(0, 10)
        : [];
    } catch {
      return [];
    }
  });
  const [name, setName] = useState(""),
    [path, setPath] = useState(""),
    [error, setError] = useState("");
  const engines = [builtinEngine, ...extra];
  return (
    <details className="engine-settings" open={expanded || undefined}>
      <summary>Engine & analysis options</summary>
      <fieldset disabled={disabled}>
        <label>
          Engine
          <select
            aria-label="Analysis engine"
            value={options.engine.id}
            onChange={(e) =>
              onChange({
                ...options,
                engine: engines.find((x) => x.id === e.target.value)!,
              })
            }
          >
            {engines.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <div className="settings-grid">
          <label>
            Review speed
            <select
              aria-label="Review speed"
              value={
                options.depth === 8
                  ? "quick"
                  : options.depth === 18
                    ? "deep"
                    : "balanced"
              }
              onChange={(e) =>
                onChange({
                  ...options,
                  ...presets[e.target.value as keyof typeof presets],
                })
              }
            >
              <option value="quick">Quick · depth 8 / 0.5 s</option>
              <option value="balanced">Balanced · depth 12 / 2 s</option>
              <option value="deep">Deep · depth 18 / 5 s</option>
            </select>
          </label>
          <label>
            Candidate lines
            <select
              aria-label="Candidate lines"
              value={options.multiPV}
              onChange={(e) =>
                onChange({ ...options, multiPV: Number(e.target.value) })
              }
            >
              <option value={1}>1 · fastest</option>
              <option value={2}>2 alternatives</option>
              <option value={3}>3 alternatives</option>
            </select>
          </label>
          <label>
            Engine memory
            <select
              aria-label="Engine memory"
              value={options.hash}
              onChange={(e) =>
                onChange({ ...options, hash: Number(e.target.value) })
              }
            >
              {[16, 32, 64].map((n) => (
                <option key={n} value={n}>
                  {n} MB
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted">
          Search stops at the depth or time limit. More lines share the same
          time budget. Matching positions and settings reuse cached results in
          this session.
        </p>
        <details>
          <summary>Add another engine</summary>
          <p className="muted">
            Host a compatible, single-thread UCI JavaScript worker and its WASM
            files on this site first. Send commands as strings and return UCI
            lines as strings. Include its required license and corresponding
            source. This registers an existing worker; it does not upload an
            engine.
          </p>
          <label>
            Engine name
            <input
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Worker path
            <input
              placeholder="./engine/my-engine.js"
              value={path}
              onChange={(e) => setPath(e.target.value)}
            />
          </label>
          <button
            onClick={() => {
              try {
                if (!name.trim()) throw new Error("Enter an engine name.");
                const url = engineUrl(path, document.baseURI);
                if (!path.trim()) throw new Error("Enter a worker path.");
                const added = {
                  id: url.href,
                  name: name.trim(),
                  url: url.href,
                };
                const updated = [
                  ...extra.filter((x) => x.id !== added.id),
                  added,
                ];
                localStorage.setItem(
                  "chesslens-engines",
                  JSON.stringify(updated),
                );
                setExtra(updated);
                onChange({ ...options, engine: added });
                setName("");
                setPath("");
                setError("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Register engine
          </button>
          {error && <p role="alert">{error}</p>}
        </details>
      </fieldset>
    </details>
  );
}
export function BetterMoves({
  evaluation,
  fen,
  played,
  onPreview,
}: {
  evaluation: Evaluation | undefined;
  fen: string;
  played?: string;
  onPreview: (fen: string | null, path?: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  useEffect(() => {
    setOpen(false);
    setActive(0);
  }, [fen, evaluation]);
  if (
    !evaluation?.best ||
    evaluation.best === "(none)" ||
    evaluation.best === "0000"
  )
    return null;
  const lines = (evaluation.lines?.length ? evaluation.lines : [evaluation])
    .map((line) => ({
      ...line,
      moves: pvToSan(
        fen,
        (line.pv?.length ? line.pv : [line.best]).slice(0, 8),
      ),
    }))
    .filter((line) => line.moves.length);
  if (!lines.length) return null;
  return (
    <section className="better-panel">
      <button
        className="better-toggle"
        aria-label={open ? "Hide alternatives" : "Show better move"}
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open) onPreview(lines[0].moves[0].fen, [lines[0].moves[0].uci]);
          else onPreview(null);
        }}
      >
        {open ? "Hide alternatives" : "Show better move"} <span>↗</span>
      </button>
      {open && (
        <div className="alternative-lines">
          <p className="muted">
            {played
              ? `You played ${played}. Compare engine choices from the position before that move.`
              : "Engine choices from this position."}{" "}
            Scores below are from White’s perspective.
          </p>
          {lines.map((line, i) => (
            <div
              key={line.best}
              className={`alternative-line ${active === i ? "active" : ""}`}
            >
              <button
                aria-label={`Preview alternative ${i + 1}`}
                onClick={() => {
                  setActive(i);
                  onPreview(line.moves[0].fen, [line.moves[0].uci]);
                }}
              >
                <span>
                  {i === 0 ? "Top choice" : `Candidate ${i + 1}`}{" "}
                  <strong>{line.moves[0].san}</strong>
                </span>
                <b>
                  {line.mate !== undefined
                    ? `M${line.mate}`
                    : `${line.cp >= 0 ? "+" : ""}${(line.cp / 100).toFixed(2)}`}
                </b>
              </button>
              <div className="pv-line">
                {line.moves.map((m, j) => (
                  <button
                    key={j}
                    className="pv-chip"
                    aria-label={`Alternative ${i + 1} step ${j + 1}: ${m.san}`}
                    onClick={() => {
                      setActive(i);
                      onPreview(
                        m.fen,
                        line.moves.slice(0, j + 1).map((move) => move.uci),
                      );
                    }}
                  >
                    {m.moveNum ? `${m.moveNum}. ` : ""}
                    {m.san}
                  </button>
                ))}
              </div>
              <small>
                Depth {line.depth}
                {played === line.moves[0].san ? " · Matches your move" : ""}
              </small>
            </div>
          ))}
          <button onClick={() => onPreview(null)}>
            Return to played position
          </button>
        </div>
      )}
    </section>
  );
}
