import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Chess, type Square } from "chess.js";
import {
  accuracy,
  classify,
  demo,
  describeEvaluation,
  estimateElo,
  labels,
  loss,
  parseGame,
  pvToSan,
  type Evaluation,
  type Grade,
} from "./game";
import { BoardArrows } from "./BoardArrows";
import { EvalGraph } from "./EvalGraph";
import { analyse } from "./engine";
import {
  fetchPlayerProfile,
  fetchPlayerArchives,
  fetchMonthGames,
  formatArchiveLabel,
  formatResult,
  formatTimeControl,
  type ChessComGame,
  type ChessComPlayer,
} from "./chesscom";
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

  // Chess.com integration state
  const [ccUsername, setCcUsername] = useState(
    () => localStorage.getItem("chesslens_cc_user") || "",
  );
  const [ccPlayer, setCcPlayer] = useState<ChessComPlayer | null>(null);
  const [ccArchives, setCcArchives] = useState<string[]>([]);
  const [ccSelectedArchive, setCcSelectedArchive] = useState<string>("");
  const [ccGames, setCcGames] = useState<ChessComGame[]>([]);
  const [ccLoading, setCcLoading] = useState(false);
  const [ccLoadingMsg, setCcLoadingMsg] = useState("");
  const [ccError, setCcError] = useState("");
  const [ccSpeedFilter, setCcSpeedFilter] = useState<string>("all");
  const [ccResultFilter, setCcResultFilter] = useState<string>("all");
  const [ccSearch, setCcSearch] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [arrowsEnabled, setArrowsEnabled] = useState(true);
  const [criticalOnly, setCriticalOnly] = useState(false);
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

  const loadChessComUser = async (targetUser?: string) => {
    const user = (targetUser ?? ccUsername).trim();
    if (!user) {
      setCcError("Please enter a Chess.com username.");
      return;
    }
    setCcLoading(true);
    setCcLoadingMsg(`Looking up "${user}" on Chess.com...`);
    setCcError("");
    try {
      const player = await fetchPlayerProfile(user);
      setCcPlayer(player);
      setCcUsername(player.username);
      localStorage.setItem("chesslens_cc_user", player.username);

      setCcLoadingMsg("Fetching game archives...");
      const archives = await fetchPlayerArchives(user);
      setCcArchives(archives);

      if (archives.length === 0) {
        setCcGames([]);
        setCcError(`No archived games found for ${player.username}.`);
        return;
      }

      const latestArchive = archives[archives.length - 1];
      setCcSelectedArchive(latestArchive);

      setCcLoadingMsg(
        `Loading games from ${formatArchiveLabel(latestArchive)}...`,
      );
      const games = await fetchMonthGames(latestArchive);
      setCcGames(games);
    } catch (err) {
      setCcError(
        err instanceof Error ? err.message : "Failed to load from Chess.com.",
      );
      setCcGames([]);
    } finally {
      setCcLoading(false);
    }
  };

  const changeArchive = async (archiveUrl: string) => {
    setCcSelectedArchive(archiveUrl);
    setCcLoading(true);
    setCcLoadingMsg(
      `Loading games from ${formatArchiveLabel(archiveUrl)}...`,
    );
    setCcError("");
    try {
      const games = await fetchMonthGames(archiveUrl);
      setCcGames(games);
    } catch (err) {
      setCcError(
        err instanceof Error
          ? err.message
          : "Failed to load games for this month.",
      );
    } finally {
      setCcLoading(false);
    }
  };

  const downloadAllMonthGames = () => {
    if (!ccGames.length) return;
    const pgnData = ccGames.map((g) => g.pgn).join("\n\n");
    const blob = new Blob([pgnData], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const monthName = formatArchiveLabel(ccSelectedArchive).replace(
      /\s+/g,
      "_",
    );
    a.download = `${ccPlayer?.username || "chesscom"}_${monthName}_games.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectChessComGame = (g: ChessComGame) => {
    setPgn(g.pgn);
    importPgn(g.pgn);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const copyGamePgn = async (gamePgn: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(gamePgn);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // Clipboard write fallback
    }
  };

  const filteredCcGames = ccGames.filter((g) => {
    if (
      ccSpeedFilter !== "all" &&
      g.time_class.toLowerCase() !== ccSpeedFilter
    ) {
      return false;
    }
    if (ccResultFilter !== "all") {
      const res = formatResult(g, ccPlayer?.username || ccUsername);
      if (res.outcome !== ccResultFilter) return false;
    }
    if (ccSearch.trim()) {
      const q = ccSearch.toLowerCase();
      const target = (ccPlayer?.username || ccUsername).toLowerCase();
      const isWhite = g.white.username.toLowerCase() === target;
      const opponent = isWhite
        ? g.black.username.toLowerCase()
        : g.white.username.toLowerCase();
      const eco = (g.eco || "").toLowerCase();
      if (!opponent.includes(q) && !eco.includes(q)) return false;
    }
    return true;
  });
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
  const playerLosses = (color: string) =>
    game.moves.flatMap((m, i) =>
      m.color === color && evaluations[i] && evaluations[i + 1]
        ? [loss(evaluations[i], evaluations[i + 1], color === "w")]
        : [],
    );

  const playerGradeCounts = (color: string) => {
    const counts: Partial<Record<Grade, number>> = {};
    game.moves.forEach((m, i) => {
      if (m.color === color) {
        const g = grade(i);
        if (g) counts[g] = (counts[g] || 0) + 1;
      }
    });
    return counts;
  };

  const playerElo = (color: string) =>
    estimateElo(
      playerAccuracy(color),
      playerLosses(color),
      playerGradeCounts(color),
    );

  const playerAccuracy = (color: string) => accuracy(playerLosses(color));

  const bestSan = () => {
    if (!current?.best || current.best === "(none)") return "No legal moves";
    try {
      const b = new Chess(branch || game.fens[ply]);
      const m = b.move({
        from: current.best.slice(0, 2),
        to: current.best.slice(2, 4),
        promotion: current.best[4],
      });
      return m?.san || current.best;
    } catch {
      return current.best;
    }
  };

  const getSanFromUci = (fen: string, uciMove: string) => {
    if (!uciMove || uciMove.length < 4 || uciMove === "(none)") return "—";
    try {
      const b = new Chess(fen);
      const m = b.move({
        from: uciMove.slice(0, 2),
        to: uciMove.slice(2, 4),
        promotion: uciMove[4],
      });
      return m?.san || uciMove;
    } catch {
      return uciMove;
    }
  };

  const seekMistake = (direction: 1 | -1) => {
    const startIdx = direction === 1 ? ply : ply - 2;
    for (let i = startIdx; i >= 0 && i < game.moves.length; i += direction) {
      const g = grade(i);
      if (g === "Blunder" || g === "Mistake" || g === "Inaccuracy") {
        navigate(i + 1);
        return;
      }
    }
  };

  const previewBetterMove = (bestUci: string) => {
    if (!bestUci || bestUci === "(none)") return;
    try {
      const b = new Chess(game.fens[ply - 1]);
      const m = b.move({
        from: bestUci.slice(0, 2),
        to: bestUci.slice(2, 4),
        promotion: bestUci[4],
      });
      if (m) {
        setBranch(b.fen());
        setSelected(null);
      }
    } catch {
      // Ignore
    }
  };

  const allGrades = React.useMemo(() => {
    const res: Record<number, Grade | null> = {};
    for (let i = 0; i < game.moves.length; i++) {
      res[i] = grade(i);
    }
    return res;
  }, [evaluations, game]);

  const currentGrade = ply > 0 ? grade(ply - 1) : null;
  const tacticalDesc = describeEvaluation(
    previous,
    current,
    currentGrade,
    move?.color === "w",
  );

  const pvMoves = React.useMemo(() => {
    if (!current?.pv?.length || branch) return [];
    return pvToSan(game.fens[ply], current.pv.slice(0, 6));
  }, [current, ply, branch, game.fens]);
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
              <div className="player-stats-col">
                <span className="player-score">
                  {playerAccuracy(flipped ? "w" : "b") ?? "—"}
                  <small>accuracy</small>
                </span>
                {playerElo(flipped ? "w" : "b") !== null && (
                  <span className="player-elo-pill" title="Estimated game performance rating">
                    {playerElo(flipped ? "w" : "b")} <small>Elo</small>
                  </span>
                )}
              </div>
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
              <div className="board-container">
                <BoardArrows
                  bestMoveUci={current?.best}
                  playedMoveUci={move ? uci(ply - 1) : undefined}
                  grade={currentGrade}
                  flipped={flipped}
                  enabled={arrowsEnabled && !branch}
                />
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
            </div>
            <div className="player">
              <span className="avatar">{flipped ? "♚" : "♔"}</span>
              <div>
                <strong>{flipped ? blackName : whiteName}</strong>
                <small>{flipped ? "Black pieces" : "White pieces"}</small>
              </div>
              <div className="player-stats-col">
                <span className="player-score">
                  {playerAccuracy(flipped ? "b" : "w") ?? "—"}
                  <small>accuracy</small>
                </span>
                {playerElo(flipped ? "b" : "w") !== null && (
                  <span className="player-elo-pill" title="Estimated game performance rating">
                    {playerElo(flipped ? "b" : "w")} <small>Elo</small>
                  </span>
                )}
              </div>
            </div>
            <div className="navigation">
              <div className="nav-group-left">
                <button
                  title="Flip board"
                  aria-label="Flip board"
                  onClick={() => setFlipped(!flipped)}
                >
                  ↻
                </button>
                <button
                  title={arrowsEnabled ? "Hide visual tactical arrows" : "Show visual tactical arrows"}
                  aria-label="Toggle tactical arrows"
                  className={arrowsEnabled ? "active-tool" : ""}
                  onClick={() => setArrowsEnabled(!arrowsEnabled)}
                >
                  🎯
                </button>
              </div>
              <div className="nav-group-center">
                <button
                  aria-label="First position"
                  disabled={!ply && !branch}
                  onClick={() => navigate(0)}
                >
                  ⏮
                </button>
                <button
                  aria-label="Previous blunder"
                  title="Jump to previous blunder or mistake"
                  disabled={!ply || !!branch}
                  onClick={() => seekMistake(-1)}
                  className="blunder-seek-btn"
                >
                  ◀◀
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
                  aria-label="Next blunder"
                  title="Jump to next blunder or mistake"
                  disabled={ply >= game.moves.length || !!branch}
                  onClick={() => seekMistake(1)}
                  className="blunder-seek-btn"
                >
                  ▶▶
                </button>
                <button
                  aria-label="Last position"
                  disabled={ply === game.moves.length && !branch}
                  onClick={() => navigate(game.moves.length)}
                >
                  ⏭
                </button>
              </div>
              <span className="ply-indicator">
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
              {ply > 0 && previous && current && !branch && tacticalDesc && (
                <div className="tactical-breakdown">
                  <div className="tactical-header">
                    <span className="tactical-title">{tacticalDesc.heading}</span>
                    {tacticalDesc.deltaText && (
                      <span className="adv-shift-badge">
                        {tacticalDesc.deltaText}
                      </span>
                    )}
                  </div>
                  <p className="tactical-expl">{tacticalDesc.detail}</p>
                  {tacticalDesc.betterMoveUci && (
                    <div className="better-move-row">
                      <span className="better-move-lbl">Better was:</span>
                      <button
                        type="button"
                        className="better-move-chip"
                        onClick={() =>
                          previewBetterMove(tacticalDesc.betterMoveUci!)
                        }
                        title="Click to preview the recommended move on the board"
                      >
                        ★{" "}
                        {getSanFromUci(
                          game.fens[ply - 1],
                          tacticalDesc.betterMoveUci,
                        )}
                        <small className="preview-lbl">Preview</small>
                      </button>
                    </div>
                  )}
                </div>
              )}
              {current && !branch && (
                <p className="best-line">
                  Next best move <strong>{bestSan()}</strong>
                </p>
              )}
              {pvMoves.length > 0 && !branch && (
                <div className="pv-continuation">
                  <span className="pv-label">Best continuation:</span>
                  <div className="pv-line">
                    {pvMoves.map((pv, idx) => (
                      <span key={idx} className="pv-chip">
                        {pv.moveNum ? `${pv.moveNum}.` : ""}
                        {pv.san}
                      </span>
                    ))}
                  </div>
                </div>
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
                {tab === "moves" && (
                  <button
                    type="button"
                    className={`filter-critical-toggle ${criticalOnly ? "active" : ""}`}
                    onClick={() => setCriticalOnly(!criticalOnly)}
                    title="Show only critical moves (blunders, mistakes, inaccuracies)"
                  >
                    ⚠️ Critical only
                  </button>
                )}
                <span>{game.headers.Result || "*"}</span>
              </div>
              {tab === "moves" ? (
                <div className="moves">
                  {Array.from(
                    {
                      length: Math.ceil((game.moves.length + initialBlack) / 2),
                    },
                    (_, row) => {
                      const wIdx = row * 2 - initialBlack;
                      const bIdx = row * 2 + 1 - initialBlack;
                      const g0 = wIdx >= 0 ? grade(wIdx) : null;
                      const g1 = bIdx >= 0 ? grade(bIdx) : null;
                      const isCritical = (g: Grade | null) =>
                        g === "Blunder" ||
                        g === "Mistake" ||
                        g === "Inaccuracy";
                      if (criticalOnly && !isCritical(g0) && !isCritical(g1)) {
                        return null;
                      }
                      return (
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
                      );
                    },
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
                    {["w", "b"].map((color) => {
                      const elo = playerElo(color);
                      return (
                        <div key={color}>
                          <small>
                            {color === "w" ? "White" : "Black"} accuracy
                          </small>
                          <strong>
                            {playerAccuracy(color) ?? "—"}
                            {playerAccuracy(color) !== null && <small>%</small>}
                          </strong>
                          {elo !== null && (
                            <div
                              className="summary-elo-badge"
                              title="Estimated performance rating"
                            >
                              Est. <strong>~{elo}</strong> Elo
                            </div>
                          )}
                        </div>
                      );
                    })}
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
                    ChessLens accuracy and performance ratings are estimates from
                    centipawn loss, not official Chess.com or FIDE ratings.
                  </p>
                </div>
              )}
            </section>
          </aside>
        </div>
        <EvalGraph
          evaluations={evaluations}
          moves={game.moves}
          currentPly={ply}
          grades={allGrades}
          onSelectPly={navigate}
        />
        <section
          className="panel chesscom-panel"
          aria-label="Chess.com import"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">CHESS.COM DIRECT IMPORT</p>
              <h2>Review your Chess.com games</h2>
              <p className="muted">
                Fetch games directly from the official Chess.com API. 100%
                private in your browser.
              </p>
            </div>
            <span className="engine-tag">Live API</span>
          </div>

          <form
            className="chesscom-search-bar"
            onSubmit={(e) => {
              e.preventDefault();
              loadChessComUser();
            }}
          >
            <div className="search-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Enter Chess.com username (e.g. hikaru, your_username)"
                value={ccUsername}
                onChange={(e) => setCcUsername(e.target.value)}
                disabled={ccLoading}
                aria-label="Chess.com username"
              />
            </div>
            <button
              type="submit"
              className="primary"
              disabled={ccLoading || !ccUsername.trim()}
              aria-label="Fetch games"
            >
              {ccLoading ? "Fetching..." : "Fetch games →"}
            </button>
          </form>

          <div className="quick-suggestions">
            <span className="muted">Try:</span>
            {["hikaru", "magnuscarlsen", "GothamChess"].map((user) => (
              <button
                key={user}
                type="button"
                className="chip-btn"
                onClick={() => {
                  setCcUsername(user);
                  loadChessComUser(user);
                }}
                disabled={ccLoading}
              >
                {user}
              </button>
            ))}
          </div>

          {ccLoading && (
            <div className="chesscom-loading" role="status">
              <div className="spinner" />
              <span>{ccLoadingMsg}</span>
            </div>
          )}

          {ccError && (
            <div className="error" role="alert">
              {ccError}
            </div>
          )}

          {ccPlayer && !ccLoading && (
            <div className="chesscom-results">
              <div className="chesscom-player-card">
                <div className="player-info">
                  {ccPlayer.avatar ? (
                    <img
                      src={ccPlayer.avatar}
                      alt={ccPlayer.username}
                      className="cc-avatar"
                    />
                  ) : (
                    <div className="cc-avatar-placeholder">
                      {ccPlayer.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="player-name-row">
                      {ccPlayer.title && (
                        <span className="title-badge">{ccPlayer.title}</span>
                      )}
                      <strong>{ccPlayer.name || ccPlayer.username}</strong>
                      <a
                        href={
                          ccPlayer.url ||
                          `https://www.chess.com/member/${ccPlayer.username}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="cc-link"
                        title="Open Chess.com profile"
                      >
                        @{ccPlayer.username} ↗
                      </a>
                    </div>
                    <small className="muted">
                      {ccArchives.length} active{" "}
                      {ccArchives.length === 1 ? "month" : "months"} of game
                      archives
                    </small>
                  </div>
                </div>

                <div className="archive-selector-row">
                  <label htmlFor="archive-select" className="muted">
                    Month:
                  </label>
                  <select
                    id="archive-select"
                    value={ccSelectedArchive}
                    onChange={(e) => changeArchive(e.target.value)}
                    disabled={ccLoading}
                    aria-label="Select archive month"
                  >
                    {[...ccArchives].reverse().map((arch) => (
                      <option key={arch} value={arch}>
                        {formatArchiveLabel(arch)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="secondary download-btn"
                    onClick={downloadAllMonthGames}
                    title="Download all games of this month as a .pgn file"
                    disabled={!ccGames.length}
                  >
                    📥 Download Month (.pgn)
                  </button>
                </div>
              </div>

              {ccGames.length > 0 && (
                <>
                  <div className="chesscom-filter-bar">
                    <div className="filter-group">
                      <span className="filter-label">Speed:</span>
                      {[
                        { id: "all", label: "All" },
                        { id: "blitz", label: "⚡ Blitz" },
                        { id: "bullet", label: "🚀 Bullet" },
                        { id: "rapid", label: "⏳ Rapid" },
                        { id: "daily", label: "♟ Daily" },
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className={`filter-btn ${ccSpeedFilter === s.id ? "active" : ""}`}
                          onClick={() => setCcSpeedFilter(s.id)}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>

                    <div className="filter-group">
                      <span className="filter-label">Result:</span>
                      {[
                        { id: "all", label: "All" },
                        { id: "win", label: "🏆 Wins" },
                        { id: "loss", label: "❌ Losses" },
                        { id: "draw", label: "🤝 Draws" },
                      ].map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className={`filter-btn ${ccResultFilter === r.id ? "active" : ""}`}
                          onClick={() => setCcResultFilter(r.id)}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>

                    <div className="search-filter">
                      <input
                        type="text"
                        placeholder="Search opponent or ECO..."
                        value={ccSearch}
                        onChange={(e) => setCcSearch(e.target.value)}
                        className="filter-search-input"
                        aria-label="Search games"
                      />
                    </div>
                  </div>

                  <div className="games-count-banner">
                    <span>
                      Showing <strong>{filteredCcGames.length}</strong> of{" "}
                      <strong>{ccGames.length}</strong> games from{" "}
                      <strong>
                        {formatArchiveLabel(ccSelectedArchive)}
                      </strong>
                    </span>
                  </div>

                  <div className="chesscom-games-list">
                    {filteredCcGames.length === 0 ? (
                      <div className="no-games-msg muted">
                        No games match the current filters.
                      </div>
                    ) : (
                      filteredCcGames.map((g, idx) => {
                        const targetUser = ccPlayer.username.toLowerCase();
                        const isWhite =
                          g.white.username.toLowerCase() === targetUser;
                        const opponent = isWhite ? g.black : g.white;
                        const res = formatResult(g, ccPlayer.username);
                        const dateStr = new Date(
                          g.end_time * 1000,
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        });
                        const tcStr = formatTimeControl(
                          g.time_control,
                          g.time_class,
                        );

                        return (
                          <div
                            className={`cc-game-card outcome-${res.outcome}`}
                            key={g.url || idx}
                          >
                            <div className="game-card-header">
                              <span className="game-tc">{tcStr}</span>
                              <span className="game-date">{dateStr}</span>
                              <span
                                className={`outcome-badge ${res.outcome}`}
                              >
                                {res.outcome === "win"
                                  ? "🏆 Win"
                                  : res.outcome === "loss"
                                    ? "❌ Loss"
                                    : "🤝 Draw"}
                                {res.reason ? (
                                  <small> · {res.reason}</small>
                                ) : null}
                              </span>
                            </div>

                            <div className="game-matchup">
                              <div
                                className={`matchup-side ${isWhite ? "is-user" : ""}`}
                              >
                                <span className="side-piece">⚪</span>
                                <strong>{g.white.username}</strong>
                                <span className="rating">
                                  ({g.white.rating})
                                </span>
                              </div>
                              <span className="vs-tag">vs</span>
                              <div
                                className={`matchup-side ${!isWhite ? "is-user" : ""}`}
                              >
                                <span className="side-piece">⚫</span>
                                <strong>{g.black.username}</strong>
                                <span className="rating">
                                  ({g.black.rating})
                                </span>
                              </div>
                            </div>

                            <div className="game-card-footer">
                              <div className="game-meta">
                                {g.eco && (
                                  <span className="eco-badge">
                                    {g.eco}
                                  </span>
                                )}
                                {g.rated && (
                                  <span className="rated-badge">
                                    Rated
                                  </span>
                                )}
                              </div>
                              <div className="game-actions">
                                <button
                                  type="button"
                                  className="secondary copy-pgn-btn"
                                  onClick={() => copyGamePgn(g.pgn, idx)}
                                  title="Copy PGN to clipboard"
                                >
                                  {copiedIndex === idx
                                    ? "✓ Copied"
                                    : "Copy PGN"}
                                </button>
                                <button
                                  type="button"
                                  className="primary review-btn"
                                  onClick={() => selectChessComGame(g)}
                                >
                                  Review Game →
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </section>

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
