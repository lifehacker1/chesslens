import { useEffect, useRef, useState } from "react";
import { pvToSan, type Evaluation } from "./game";
import {
  builtinEngine,
  bundledEngines,
  defaultOptions,
  clearAnalysisCache,
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
  compact = false,
  rail = false,
  horizontal = false,
  sounds = false,
}: {
  ply: number;
  moves: string[];
  onChange: (ply: number) => void;
  haptics?: boolean;
  compact?: boolean;
  rail?: boolean;
  horizontal?: boolean;
  sounds?: boolean;
}) {
  const audio = useRef<AudioContext | null>(null);
  const length = useRef(moves.length);
  length.current = moves.length;
  const soundEnabled = useRef(sounds);
  soundEnabled.current = sounds;
  const drag = useRef<{ y: number; ply: number } | null>(null);
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
      if (soundEnabled.current) {
        try {
          const ctx = audio.current || (audio.current = new AudioContext());
          void ctx.resume().catch(() => {});
          const tone = ctx.createOscillator(),
            gain = ctx.createGain();
          tone.type = "sine";
          tone.frequency.setValueAtTime(
            clamped === 0 || clamped === moves.length ? 440 : 660,
            ctx.currentTime,
          );
          gain.gain.setValueAtTime(0.035, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(
            0.001,
            ctx.currentTime + 0.045,
          );
          tone.connect(gain);
          gain.connect(ctx.destination);
          tone.start();
          tone.stop(ctx.currentTime + 0.05);
        } catch {
          /* Audio is optional. */
        }
      }
      value.current = clamped;
      action.current(clamped);
    }
  };
  useEffect(() => {
    const el = ref.current;
    let distance = 0;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      if (horizontal && !e.shiftKey && Math.abs(e.deltaX) <= Math.abs(e.deltaY))
        return;
      if (!horizontal && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const delta = horizontal ? (e.shiftKey ? e.deltaY : e.deltaX) : e.deltaY;
      if (
        (value.current === 0 && delta < 0) ||
        (value.current === length.current && delta > 0)
      )
        return;
      e.preventDefault();
      distance +=
        delta * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      if (Math.abs(distance) >= 30) {
        step.current(value.current + Math.sign(distance));
        distance = 0;
      }
    };
    el?.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el?.removeEventListener("wheel", wheel);
      clearTimeout(timer.current);
      void audio.current?.close().catch(() => {});
      audio.current = null;
    };
  }, []);
  return (
    <div
      className={`move-dial ${compact ? "compact-dial" : ""} ${rail ? "rail-dial" : ""} ${horizontal ? "horizontal-dial" : ""} ${active ? "is-scrubbing" : ""}`}
      ref={ref}
    >
      <div className="dial-heading">
        <span>MOVE DIAL</span>
        <strong>{rail ? "MOVE" : ply ? moves[ply - 1] : "Start"}</strong>
        <span>
          {ply} / {moves.length}
        </span>
      </div>
      <div className="dial-ruler" aria-hidden="true">
        <div
          className="dial-ticks"
          style={rail ? undefined : { transform: `translateY(${-ply * 14}px)` }}
        />
        <i
          style={
            rail
              ? {
                  [horizontal ? "left" : "top"]:
                    `${moves.length ? (ply / moves.length) * 100 : 0}%`,
                }
              : undefined
          }
        />
      </div>
      <input
        aria-label="Move dial"
        type="range"
        aria-orientation={horizontal ? "horizontal" : "vertical"}
        min={0}
        max={moves.length}
        step={1}
        value={ply}
        aria-valuetext={
          ply ? `Ply ${ply}: ${moves[ply - 1]}` : "Starting position"
        }
        onPointerDown={(e) => {
          if (rail) {
            setActive(true);
            return;
          }
          e.preventDefault();
          e.currentTarget.focus();
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { y: e.clientY, ply };
          setFeedback(
            ply === 0
              ? "Start of game"
              : ply === moves.length
                ? "End of game"
                : `Move ${ply} of ${moves.length}`,
          );
          setActive(true);
        }}
        onPointerMove={(e) => {
          if (rail) return;
          if (drag.current)
            step.current(
              drag.current.ply + Math.round((e.clientY - drag.current.y) / 16),
            );
        }}
        onPointerCancel={() => {
          drag.current = null;
          setActive(false);
        }}
        onChange={(e) => step.current(Number(e.target.value))}
        onKeyDown={(e) => {
          const delta = ["ArrowDown", "ArrowRight"].includes(e.key)
            ? 1
            : ["ArrowUp", "ArrowLeft"].includes(e.key)
              ? -1
              : 0;
          if (delta) {
            e.preventDefault();
            step.current(value.current + delta);
            return;
          }
          if (
            (ply === 0 && ["ArrowLeft", "Home"].includes(e.key)) ||
            (ply === moves.length && ["ArrowRight", "End"].includes(e.key))
          )
            step.current(ply);
        }}
        onPointerUp={() => {
          drag.current = null;
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setActive(false), 450);
        }}
      />
      <small className="dial-feedback" aria-live="polite" aria-atomic="true">
        {active && feedback
          ? feedback
          : horizontal
            ? "Drag to replay"
            : "Swipe up or down to replay"}
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
  positions = 0,
}: {
  options: AnalysisOptions;
  onChange: (options: AnalysisOptions) => void;
  disabled: boolean;
  expanded?: boolean;
  positions?: number;
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
  const engines = [
    ...bundledEngines,
    ...extra.filter(
      (item) => !bundledEngines.some((engine) => engine.id === item.id),
    ),
  ];
  const [cacheNotice, setCacheNotice] = useState("");
  const preset =
    Object.entries(presets).find(
      ([, p]) => p.depth === options.depth && p.movetime === options.movetime,
    )?.[0] || "custom";
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
              value={preset}
              onChange={(e) =>
                onChange({
                  ...options,
                  ...(e.target.value === "custom"
                    ? { depth: 10, movetime: 1000 }
                    : presets[e.target.value as keyof typeof presets]),
                })
              }
            >
              <option value="battery">Battery saver · depth 6 / 0.25 s</option>
              <option value="quick">Quick · depth 8 / 0.5 s</option>
              <option value="balanced">Balanced · depth 12 / 2 s</option>
              <option value="deep">Deep · depth 18 / 5 s</option>
              <option value="thorough">Thorough · depth 22 / 15 s</option>
              <option value="custom">Custom · choose limits below</option>
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
              <option value={4}>4 alternatives</option>
              <option value={5}>5 alternatives</option>
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
              {[16, 32, 64, 128].map((n) => (
                <option key={n} value={n}>
                  {n} MB
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="engine-budget">
          <strong>{options.engine.name}</strong>
          <span>
            Single worker · depth {options.depth} · {options.movetime / 1000}s
            per position · {options.multiPV} candidate lines
          </span>
          {positions > 0 && (
            <small>
              This game: {positions} positions · up to{" "}
              {Math.ceil((positions * options.movetime) / 60000)} min of search,
              plus engine startup. Depth limits and cached positions can finish
              sooner.
            </small>
          )}
        </div>
        <details
          className="advanced-engine"
          open={preset === "custom" || undefined}
        >
          <summary>Custom search limits</summary>
          <div className="settings-grid">
            <label>
              Maximum depth
              <select
                aria-label="Maximum depth"
                value={options.depth}
                onChange={(e) =>
                  onChange({ ...options, depth: Number(e.target.value) })
                }
              >
                {Array.from({ length: 21 }, (_, i) => i + 4).map((n) => (
                  <option key={n} value={n}>
                    {n} plies
                  </option>
                ))}
              </select>
            </label>
            <label>
              Time per position
              <select
                aria-label="Time per position"
                value={options.movetime}
                onChange={(e) =>
                  onChange({ ...options, movetime: Number(e.target.value) })
                }
              >
                {[250, 500, 1000, 2000, 3000, 5000, 10000, 15000, 30000].map(
                  (n) => (
                    <option key={n} value={n}>
                      {n / 1000} seconds
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
          <p className="muted">
            Search stops at whichever limit is reached first. More time, depth
            and candidate lines use more battery. Hash memory is additional to
            the engine itself.
          </p>
        </details>
        <label className="preference-row">
          <span>
            <strong>Reuse analysed positions</strong>
            <small>
              Keep up to 400 matching results in memory for this session.
            </small>
          </span>
          <input
            type="checkbox"
            checked={options.useCache !== false}
            onChange={(e) =>
              onChange({ ...options, useCache: e.target.checked })
            }
          />
        </label>
        <div className="engine-actions">
          <button
            onClick={() => {
              clearAnalysisCache();
              setCacheNotice(
                "Analysis cache cleared. Existing review results are kept.",
              );
            }}
          >
            Clear analysis cache
          </button>
          <button
            onClick={() => {
              onChange({ ...defaultOptions });
              setCacheNotice("Default analysis options restored.");
            }}
          >
            Reset engine options
          </button>
        </div>
        <p role="status" className="muted">
          {cacheNotice}
        </p>
        <p className="muted">
          Search stops at the depth or time limit. More lines share the same
          time budget. Matching positions and settings reuse cached results in
          this session.
        </p>
        <p className="muted">
          Stockfish 19 Lite, Lozza Neural and Lozza Classical are bundled for
          local review. Stockfish is the default; Lozza offers a second opinion
          using neural or classical evaluation. Engine scores and accuracy
          estimates may differ.
        </p>
        {extra.length > 0 && (
          <div className="registered-engines">
            <h3>Registered engines</h3>
            {extra.map((engine) => (
              <div key={engine.id}>
                <span>{engine.name}</span>
                <button
                  aria-label={"Remove engine " + engine.name}
                  onClick={() => {
                    try {
                      const updated = extra.filter((x) => x.id !== engine.id);
                      localStorage.setItem(
                        "chesslens-engines",
                        JSON.stringify(updated),
                      );
                      setExtra(updated);
                      if (options.engine.id === engine.id)
                        onChange({ ...options, engine: builtinEngine });
                    } catch {
                      setError("Could not update saved engines.");
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
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
  open,
  evaluation,
  fen,
  played,
  onPreview,
}: {
  open: boolean;
  evaluation: Evaluation | undefined;
  fen: string;
  played?: string;
  onPreview: (fen: string | null, path?: string[]) => void;
}) {
  const [active, setActive] = useState(0);
  const preview = useRef(onPreview);
  preview.current = onPreview;
  useEffect(() => {
    if (!open || !evaluation?.best) return;
    const first = pvToSan(
      fen,
      (evaluation.pv?.length ? evaluation.pv : [evaluation.best]).slice(0, 1),
    )[0];
    if (first) preview.current(first.fen, [first.uci]);
  }, [open, fen, evaluation]);
  useEffect(() => {
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
    <section
      id="better-move-lines"
      className="better-panel"
      aria-label="Alternative moves"
      hidden={!open}
    >
      <p className="eyebrow">ENGINE ALTERNATIVES</p>
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
        </div>
      )}
    </section>
  );
}
