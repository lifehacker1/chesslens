import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Chess, type Square } from "chess.js";
import {
  accuracy,
  classify,
  demo,
  labels,
  loss,
  parseGame,
  type Evaluation,
} from "./game";
import { analyse } from "./engine";
import "./style.css";

const glyphs: Record<string, string> = {
  wk: "♔",
  wq: "♕",
  wr: "♖",
  wb: "♗",
  wn: "♘",
  wp: "♙",
  bk: "♚",
  bq: "♛",
  br: "♜",
  bb: "♝",
  bn: "♞",
  bp: "♟",
};
function App() {
  const [game, setGame] = useState(() => parseGame(demo));
  const [pgn, setPgn] = useState(demo),
    [ply, setPly] = useState(0),
    [flipped, setFlipped] = useState(false);
  const [evaluations, setEvaluations] = useState<Record<number, Evaluation>>(
    {},
  );
  const [running, setRunning] = useState(false),
    [error, setError] = useState(""),
    [tab, setTab] = useState<"moves" | "summary">("moves");
  const [selected, setSelected] = useState<Square | null>(null),
    [branch, setBranch] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null),
    generation = useRef(0);
  const [install, setInstall] = useState<
    (Event & { prompt: () => Promise<void> }) | null
  >(null);
  useEffect(() => {
    const listener = (event: Event) => {
      event.preventDefault();
      setInstall(event as Event & { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", listener);
    return () => {
      window.removeEventListener("beforeinstallprompt", listener);
      controller.current?.abort();
    };
  }, []);
  const navigate = (next: number) => {
    setPly(Math.max(0, Math.min(game.moves.length, next)));
    setBranch(null);
    setSelected(null);
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).matches("textarea,input,select"))
        return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigate(ply - 1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        navigate(ply + 1);
      }
      if (event.key === "Home") navigate(0);
      if (event.key === "End") navigate(game.moves.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [ply, game]);
  const importPgn = (value: string) => {
    try {
      const parsed = parseGame(value);
      generation.current++;
      controller.current?.abort();
      setRunning(false);
      setGame(parsed);
      setEvaluations({});
      navigate(0);
      setError("");
      setTab("moves");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this PGN.");
    }
  };
  const start = async () => {
    controller.current?.abort();
    const id = ++generation.current;
    const abort = new AbortController();
    controller.current = abort;
    setEvaluations({});
    setRunning(true);
    setError("");
    try {
      await analyse(
        game.fens,
        (index, value) => {
          if (generation.current === id)
            setEvaluations((previous) => ({ ...previous, [index]: value }));
        },
        abort.signal,
      );
    } catch (e) {
      if (!abort.signal.aborted && generation.current === id)
        setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      if (generation.current === id) setRunning(false);
    }
  };
  const current = evaluations[ply],
    previous = evaluations[ply - 1];
  const move = game.moves[ply - 1];
  const uci = (index: number) => {
    const m = game.moves[index];
    return m.from + m.to + (m.promotion || "");
  };
  const grade = (index: number) =>
    evaluations[index] && evaluations[index + 1]
      ? classify(
          evaluations[index],
          evaluations[index + 1],
          uci(index),
          game.moves[index].color === "w",
        )
      : null;
  const score =
    current?.mate !== undefined
      ? `M${current.mate}`
      : current
        ? `${current.cp >= 0 ? "+" : ""}${(current.cp / 100).toFixed(2)}`
        : "—";
  const board = new Chess(branch || game.fens[ply]);
  const legal = selected
    ? board.moves({ square: selected, verbose: true }).map((m) => m.to)
    : [];
  const clickSquare = (square: Square) => {
    if (selected && legal.includes(square)) {
      const m = board.move({ from: selected, to: square, promotion: "q" });
      if (m) setBranch(board.fen());
      setSelected(null);
    } else
      setSelected(board.get(square)?.color === board.turn() ? square : null);
  };
  const analysed = Object.keys(evaluations).length,
    complete = analysed === game.fens.length;
  const initialBlack = game.moves[0].color === "b" ? 1 : 0;
  const whiteName =
    game.headers.White && game.headers.White !== "?"
      ? game.headers.White
      : "White";
  const blackName =
    game.headers.Black && game.headers.Black !== "?"
      ? game.headers.Black
      : "Black";
  const playerAccuracy = (color: string) =>
    accuracy(
      game.moves.flatMap((m, i) =>
        m.color === color && evaluations[i] && evaluations[i + 1]
          ? [loss(evaluations[i], evaluations[i + 1], color === "w")]
          : [],
      ),
    );
  const bestSan = () => {
    if (!current?.best || current.best === "(none)") return "No legal moves";
    try {
      const b = new Chess(game.fens[ply]);
      return (
        b.move({
          from: current.best.slice(0, 2),
          to: current.best.slice(2, 4),
          promotion: current.best[4],
        })?.san || "—"
      );
    } catch {
      return "—";
    }
  };
  return (
    <div className="app">
      <header>
        <a className="brand" href="./">
          <span className="brand-icon">◈</span> ChessLens <small>BETA</small>
        </a>
        <div className="header-right">
          <span className="local">● Browser-local analysis</span>
          {install && (
            <button
              onClick={() => {
                install.prompt();
                setInstall(null);
              }}
            >
              Install app
            </button>
          )}
        </div>
      </header>
      <main>
        <div className="intro">
          <div>
            <p className="eyebrow">YOUR GAME. A CLEARER PICTURE.</p>
            <h1>Every move has a story.</h1>
            <p>Find the turning points. Understand your next move.</p>
          </div>
          <span className="tag">GAME REVIEW</span>
        </div>
        <div className="workspace">
          <section className="board-section" aria-label="Game board">
            <div className="player">
              <span className="avatar">{flipped ? "♔" : "♚"}</span>
              <div>
                <strong>{flipped ? whiteName : blackName}</strong>
                <small>{flipped ? "White pieces" : "Black pieces"}</small>
              </div>
              <span className="player-score">
                {playerAccuracy(flipped ? "w" : "b") ?? "—"}
                <small>accuracy</small>
              </span>
            </div>
            <div className="board-wrap">
              <div
                className="eval-bar"
                aria-label={`White evaluation ${score}`}
              >
                <div
                  style={{
                    height: `${current ? 50 + 45 * Math.tanh(current.cp / 400) : 50}%`,
                  }}
                />
              </div>
              <div className="board">
                {Array.from({ length: 64 }, (_, i) => {
                  const row = Math.floor(i / 8),
                    col = i % 8;
                  const file = flipped ? 7 - col : col,
                    rank = flipped ? row + 1 : 8 - row;
                  const square = ("abcdefgh"[file] + rank) as Square;
                  const piece = board.get(square);
                  return (
                    <button
                      key={square}
                      className={`square ${(file + rank) % 2 ? "light" : "dark"} ${!branch && (move?.from === square || move?.to === square) ? "last" : ""} ${selected === square ? "selected" : ""}`}
                      onClick={() => clickSquare(square)}
                      aria-label={`${square}${piece ? ` ${piece.color === "w" ? "White" : "Black"} ${piece.type}` : ""}`}
                      aria-pressed={selected === square}
                    >
                      {piece && (
                        <span className={`piece ${piece.color}`}>
                          {glyphs[piece.color + piece.type]}
                        </span>
                      )}
                      {legal.includes(square) && <span className="legal" />}
                      {col === 0 && <small className="rank">{rank}</small>}
                      {row === 7 && (
                        <small className="file">{"abcdefgh"[file]}</small>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="player">
              <span className="avatar">{flipped ? "♚" : "♔"}</span>
              <div>
                <strong>{flipped ? blackName : whiteName}</strong>
                <small>{flipped ? "Black pieces" : "White pieces"}</small>
              </div>
              <span className="player-score">
                {playerAccuracy(flipped ? "b" : "w") ?? "—"}
                <small>accuracy</small>
              </span>
            </div>
            <div className="navigation">
              <button
                title="Flip board"
                aria-label="Flip board"
                onClick={() => setFlipped(!flipped)}
              >
                ↻
              </button>
              <div>
                <button
                  aria-label="First position"
                  disabled={!ply && !branch}
                  onClick={() => navigate(0)}
                >
                  ⏮
                </button>
                <button
                  aria-label="Previous move"
                  disabled={!ply && !branch}
                  onClick={() => navigate(ply - 1)}
                >
                  ◀
                </button>
                <button
                  aria-label="Next move"
                  disabled={ply === game.moves.length && !branch}
                  onClick={() => navigate(ply + 1)}
                >
                  ▶
                </button>
                <button
                  aria-label="Last position"
                  disabled={ply === game.moves.length && !branch}
                  onClick={() => navigate(game.moves.length)}
                >
                  ⏭
                </button>
              </div>
              <span>
                {ply} / {game.moves.length}
              </span>
            </div>
            {branch && (
              <div className="variation">
                Exploring a variation · auto-queen promotion{" "}
                <button
                  onClick={() => {
                    setBranch(null);
                    setSelected(null);
                  }}
                >
                  Return to game
                </button>
              </div>
            )}
            <p className="board-hint">
              Use ← → to replay. Select a piece to explore legal moves.
            </p>
          </section>
          <aside>
            <section className="panel evaluation">
              <div className="section-heading">
                <span className="eyebrow">POSITION INSIGHT</span>
                <span className="engine-tag">Stockfish 19 · Lite</span>
              </div>
              <div className="eval-number">
                {branch ? "—" : score}
                <span>
                  {branch
                    ? "Variation · not analysed"
                    : current
                      ? current.mate !== undefined
                        ? "Forced mate"
                        : Math.abs(current.cp) < 30
                          ? "Balanced position"
                          : current.cp > 0
                            ? "White is ahead"
                            : "Black is ahead"
                      : "Ready when you are"}
                </span>
              </div>
              <div className="insight">
                {ply > 0 && previous && current && !branch ? (
                  <>
                    <span className={`badge ${grade(ply - 1)?.toLowerCase()}`}>
                      {grade(ply - 1)}
                    </span>
                    <strong>{move.san}</strong>
                    <span>Depth {current.depth}</span>
                  </>
                ) : (
                  <span>
                    {branch
                      ? "Return to the game to see its evaluation."
                      : "Review your game with private, on-device analysis."}
                  </span>
                )}
              </div>
              {current && !branch && (
                <p className="best-line">
                  Next best move <strong>{bestSan()}</strong>
                </p>
              )}
              <button
                className="primary analyse"
                aria-label={
                  running
                    ? "Stop analysis"
                    : complete
                      ? "Analyse again"
                      : "Analyse game"
                }
                onClick={running ? () => controller.current?.abort() : start}
              >
                {running
                  ? "Stop analysis"
                  : complete
                    ? "Analyse again"
                    : "Analyse game"}
                <span>{running ? `${analysed}/${game.fens.length}` : "↗"}</span>
              </button>
              <div
                className="progress"
                role="progressbar"
                aria-label="Analysis progress"
                aria-valuenow={analysed}
                aria-valuemin={0}
                aria-valuemax={game.fens.length}
              >
                <div
                  style={{ width: `${(100 * analysed) / game.fens.length}%` }}
                />
              </div>
              <p className="muted">
                {running
                  ? "Analysing at depth 12. You can keep exploring."
                  : complete
                    ? "Analysis complete. Explore your game below."
                    : analysed
                      ? "Partial analysis · restart to review every position."
                      : "PGN stays on this device. No account required."}
              </p>
            </section>
            <section className="panel review">
              <div className="tabs">
                <button
                  className={tab === "moves" ? "active" : ""}
                  onClick={() => setTab("moves")}
                >
                  Moves
                </button>
                <button
                  className={tab === "summary" ? "active" : ""}
                  onClick={() => setTab("summary")}
                >
                  Game summary
                </button>
                <span>{game.headers.Result || "*"}</span>
              </div>
              {tab === "moves" ? (
                <div className="moves">
                  {Array.from(
                    {
                      length: Math.ceil((game.moves.length + initialBlack) / 2),
                    },
                    (_, row) => (
                      <div className="move-row" key={row}>
                        <span>{Number(game.fens[0].split(" ")[5]) + row}.</span>
                        {[0, 1].map((offset) => {
                          const index = row * 2 + offset - initialBlack;
                          const m = game.moves[index];
                          if (!m) return <span key={`empty-${offset}`} />;
                          const g = grade(index);
                          return (
                            <button
                              key={index}
                              className={ply === index + 1 ? "current" : ""}
                              onClick={() => navigate(index + 1)}
                              aria-label={`${m.color === "w" ? "White" : "Black"} ${m.san}${g ? `, ${g}` : ""}`}
                            >
                              <strong>{m.san}</strong>
                              {g && (
                                <span
                                  className={`move-dot ${g.toLowerCase()}`}
                                  title={g}
                                >
                                  {g === "Best"
                                    ? "★"
                                    : g === "Blunder"
                                      ? "??"
                                      : g === "Mistake"
                                        ? "?"
                                        : g === "Inaccuracy"
                                          ? "?!"
                                          : "●"}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <div className="summary">
                  <p className="muted">
                    {complete
                      ? "Full game review"
                      : "Partial results · analyse the full game for a complete review"}
                  </p>
                  <div className="accuracy-cards">
                    {["w", "b"].map((color) => (
                      <div key={color}>
                        <small>
                          {color === "w" ? "White" : "Black"} accuracy
                        </small>
                        <strong>
                          {playerAccuracy(color) ?? "—"}
                          {playerAccuracy(color) !== null && <small>%</small>}
                        </strong>
                      </div>
                    ))}
                  </div>
                  {labels.map((label) => (
                    <div className="summary-row" key={label}>
                      <span className={`badge ${label.toLowerCase()}`}>
                        {label}
                      </span>
                      {["w", "b"].map((color) => (
                        <strong key={color}>
                          {
                            game.moves.filter(
                              (m, i) => m.color === color && grade(i) === label,
                            ).length
                          }
                        </strong>
                      ))}
                    </div>
                  ))}
                  <p className="muted">
                    ChessLens accuracy is an estimate from centipawn loss, not a
                    rating or a Chess.com score.
                  </p>
                </div>
              )}
            </section>
          </aside>
        </div>
        <section className="panel import-panel">
          <div>
            <p className="eyebrow">BRING YOUR OWN GAME</p>
            <h2>A fresh perspective starts here.</h2>
            <p className="muted">
              Paste a PGN or import a file to begin your review.
            </p>
            <label className="file-button">
              Import .pgn
              <input
                type="file"
                accept=".pgn,.txt"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    if (f.size > 1000000) {
                      setError("Choose a PGN smaller than 1 MB.");
                      return;
                    }
                    const text = await f.text();
                    setPgn(text);
                    importPgn(text);
                    e.target.value = "";
                  }
                }}
              />
            </label>
            <button
              className="text-button"
              onClick={() => {
                setPgn(demo);
                importPgn(demo);
              }}
            >
              Load Opera Game
            </button>
          </div>
          <div>
            <label htmlFor="pgn">Game PGN</label>
            <textarea
              id="pgn"
              value={pgn}
              onChange={(e) => setPgn(e.target.value)}
              spellCheck={false}
            />
            <button
              className="primary"
              aria-label="Import game"
              onClick={() => importPgn(pgn)}
            >
              Import game →
            </button>
          </div>
        </section>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <footer>
          <span>◈ ChessLens · See your game differently.</span>
          <details>
            <summary>Engine, licenses & methodology</summary>
            <p>
              Stockfish.js 19.0.1 by Nathan Rugg, Chess.com and the Stockfish
              contributors. Unmodified lite single-thread WebAssembly build.
              GPLv3. No warranty.
            </p>
            <p>
              <a href="./engine/COPYING.txt">GPLv3 license</a> ·{" "}
              <a href="./engine/stockfish-source.tar.gz">
                Corresponding engine source
              </a>{" "}
              ·{" "}
              <a href="https://github.com/nmrugg/stockfish.js/tree/v19.0.1">
                Upstream & build instructions
              </a>
            </p>
            <p>
              Grades use mover-perspective centipawn loss: Excellent ≤15, Good
              ≤50, Inaccuracy ≤100, Mistake ≤200, otherwise Blunder. Matching
              the engine's best move is Best. Mate scores use ±10,000 cp.
              Accuracy averages 100 × exp(−loss/220). Depth 12 estimates can
              change at deeper search. App code: MIT; engine: GPLv3.
            </p>
            <p>
              Offline use works after loading the app and running analysis
              online once. Installation support varies by browser.
            </p>
          </details>
        </footer>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
  });
