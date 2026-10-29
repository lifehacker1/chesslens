import { cpuBudget, type CpuMode } from "./cpuBudget";
import { reviewAlternatives } from "./alternatives";
import { moveAccuracy, classify } from "./game";
import { Chess } from "chess.js";
import { EngineDownload } from "./EngineDownload";
import { usePreference, isDraft } from "./preferences";
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
  const [error, setError] = useState("");
  const [name, setName] = usePreference(
    "chesslens-engine-name-draft",
    "",
    isDraft,
    setError,
  );
  const [path, setPath] = usePreference(
    "chesslens-engine-path-draft",
    "",
    isDraft,
    setError,
  );
  const engines = [
    ...bundledEngines,
    ...extra.filter(
      (item) => !bundledEngines.some((engine) => engine.id === item.id),
    ),
  ];
  const budget = cpuBudget(options);
  const [cacheNotice, setCacheNotice] = useState("");
  const preset =
    Object.entries(presets).find(
      ([, p]) => p.depth === options.depth && p.movetime === options.movetime,
    )?.[0] || "custom";
  return (
    <details
      data-setting-section="engine"
      className="engine-settings"
      open={expanded || undefined}
    >
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
        <EngineDownload key={options.engine.id} engine={options.engine} />
        <label>
          CPU usage
          <select
            aria-label="CPU usage"
            value={options.cpuMode || "single"}
            onChange={(e) =>
              onChange({ ...options, cpuMode: e.target.value as CpuMode })
            }
          >
            <option value="single">Single worker · lower resource use</option>
            <option value="balanced">
              Balanced · up to{" "}
              {cpuBudget({ ...options, cpuMode: "balanced" }).workers} workers
            </option>
            <option value="maximum">
              Maximum · up to {budget.maximum} workers
            </option>
          </select>
        </label>
        <p className="muted">
          Browser reports {budget.cores} logical CPUs. {budget.workers} worker
          {budget.workers === 1 ? "" : "s"} selected; parallelism is limited by
          remaining positions and an estimated memory budget. Maximum uses more
          battery and memory. It speeds up batches, not a single position.
        </p>
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
            Engine memory (per worker)
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
            {budget.workers} worker{budget.workers === 1 ? "" : "s"} · depth{" "}
            {options.depth} · {options.movetime / 1000}s per position ·{" "}
            {options.multiPV} candidate lines
          </span>
          {positions > 0 && (
            <small>
              This game: {positions} positions · roughly{" "}
              {Math.ceil(
                (positions * options.movetime) /
                  (60000 * cpuBudget(options, positions).workers),
              )}{" "}
              min of search at the time limit, plus startup and CPU contention.
              Depth limits and cached positions can finish sooner.
            </small>
          )}
        </div>
        <details
          data-setting-section="search"
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
        <details data-setting-section="registration">
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
  active,
  step,
  evaluations,
  onSelect,
}: {
  open: boolean;
  evaluation: Evaluation | undefined;
  fen: string;
  played?: string;
  active: number;
  step: number;
  evaluations: Record<string, Evaluation>;
  onSelect: (index: number, step: number) => void;
}) {
  const lines = reviewAlternatives(fen, evaluation);
  if (!lines.length) return null;
  return (
    <section
      id="better-move-lines"
      className="better-panel"
      aria-label="Alternative moves"
      hidden={!open}
    >
      <p className="eyebrow">ENGINE ALTERNATIVES</p>
      <div className="alternative-lines">
        <p className="muted">
          {played
            ? "You played " +
              played +
              ". Compare choices from before that move."
            : "Engine choices from this position."}{" "}
          Scores are from White’s perspective. Accuracy is calculated only after
          each predicted position is analysed.
        </p>
        {lines.map((line, i) => (
          <div
            key={line.best}
            className={"alternative-line " + (active === i ? "active" : "")}
          >
            <button
              aria-label={"Preview alternative " + (i + 1)}
              aria-pressed={active === i}
              onClick={() => onSelect(i, 1)}
            >
              <span>
                {i === 0 ? "Top choice" : "Candidate " + (i + 1)}{" "}
                <strong>{line.moves[0].san}</strong>
              </span>
              <b>
                {line.mate !== undefined
                  ? "M" + line.mate
                  : (line.cp / 100).toFixed(2)}
              </b>
            </button>
            <div className="pv-line">
              {line.moves.map((m, j) => {
                const beforeFen = j ? line.moves[j - 1].fen : fen,
                  before = evaluations[beforeFen],
                  after = evaluations[m.fen];
                const white = new Chess(beforeFen).turn() === "w",
                  accuracy = moveAccuracy(before, after, white, m.uci);
                const grade =
                  before && after
                    ? classify(before, after, m.uci, white)
                    : null;
                return (
                  <button
                    key={j}
                    className={
                      "pv-chip " +
                      (active === i && step === j + 1 ? "selected" : "")
                    }
                    aria-current={
                      active === i && step === j + 1 ? "step" : undefined
                    }
                    aria-label={
                      "Alternative " +
                      (i + 1) +
                      " step " +
                      (j + 1) +
                      ": " +
                      m.san
                    }
                    onClick={() => onSelect(i, j + 1)}
                  >
                    <span>{m.san}</span>
                    <small>
                      {accuracy === null
                        ? "Pending"
                        : accuracy + "% · " + grade}
                    </small>
                  </button>
                );
              })}
            </div>
            <small>
              Line depth {line.depth}
              {played === line.moves[0].san ? " · Matches your move" : ""}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}
