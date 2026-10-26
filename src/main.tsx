import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Chess, type Square } from "chess.js";
import {
  accuracy,
  expectedPointLoss,
  gradeIcons,
  isCriticalGrade,
  moveAccuracy,
  reviewLoss,
  classify,
  demo,
  describeEvaluation,
  estimateElo,
  labels,
  parseGame,
  pvToSan,
  type Evaluation,
  type Grade,
} from "./game";
import { BoardArrows } from "./BoardArrows";
import {
  BoardAppearance,
  BoardMoveBadge,
  ChessPiece,
  readBoardPreferences,
  type BoardPreferences,
} from "./BoardAppearance";
import { ReplayNavigation } from "./ReplayNavigation";
import { CapturedMaterial } from "./CapturedMaterial";
import {
  capturedPieces,
  addCapture,
  materialCount,
  type CaptureLedger,
} from "./material";
import { EvalGraph } from "./EvalGraph";
import { analyse, defaultOptions, type AnalysisOptions } from "./engine";
import { EngineSettings, BetterMoves } from "./ReviewControls";
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
import {
  MobileNavigation,
  PageScrollFeedback,
  TouchSettings,
  readPreferences,
  touchTick,
  type MobileView,
  type TouchPreferences,
} from "./MobileShell";
import "./style.css";

function App() {
  const [mobileView, setMobileView] = useState<MobileView>("review");
  const [gameSource, setGameSource] = useState<"pgn" | "chesscom">("pgn");
  const [touchPreferences, setTouchPreferences] =
    useState<TouchPreferences>(readPreferences);
  const [notice, setNotice] = useState("");
  const selectMobileView = (view: MobileView) => {
    setMobileView(view);
    setIsPlaying(false);
    setError("");
    if (view === "insights") setTab("summary");
    if (view === "review") setTab("moves");
    touchTick(touchPreferences.haptics);
  };
  const updateTouchPreferences = (next: TouchPreferences) => {
    setTouchPreferences(next);
    try {
      localStorage.setItem("chesslens-touch", JSON.stringify(next));
    } catch {
      /* Preferences still work for this session. */
    }
  };
  useEffect(() => {
    if (window.matchMedia("(max-width:800px)").matches)
      window.scrollTo({ top: 0, behavior: "instant" });
  }, [mobileView]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2600);
    return () => clearTimeout(timer);
  }, [notice]);
  const [boardPreferences, setBoardPreferences] =
    useState<BoardPreferences>(readBoardPreferences);
  const [boardFocused, setBoardFocused] = useState(false);
  const updateBoardPreferences = (next: BoardPreferences) => {
    setBoardPreferences(next);
    try {
      localStorage.setItem("chesslens-board", JSON.stringify(next));
    } catch {
      /* Works for this session when storage is unavailable. */
    }
  };
  useEffect(() => {
    if (!boardFocused) return;
    const previous = document.body.style.overflow;
    const active = document.activeElement as HTMLElement | null;
    const restore =
      (active
        ?.closest("details")
        ?.querySelector("summary") as HTMLElement | null) || active;
    const frame = requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(".focus-exit")?.focus(),
    );
    document.body.style.overflow = "hidden";
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".replay-menu[open]"))
        setBoardFocused(false);
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = previous;
      cancelAnimationFrame(frame);
      if (restore?.isConnected) restore.focus();
      document.removeEventListener("keydown", escape);
    };
  }, [boardFocused]);
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
  const [betterMovesOpen, setBetterMovesOpen] = useState(false);
  const [branchCaptures, setBranchCaptures] = useState<CaptureLedger | null>(
    null,
  );
  const controller = useRef<AbortController | null>(null),
    generation = useRef(0);
  const [install, setInstall] = useState<
    (Event & { prompt: () => Promise<void> }) | null
  >(null);

  const [analysisOptions, setAnalysisOptions] =
    useState<AnalysisOptions>(defaultOptions);
  const [resultOptions, setResultOptions] =
    useState<AnalysisOptions>(defaultOptions);
  const changeAnalysisOptions = (next: AnalysisOptions) => {
    generation.current++;
    controller.current?.abort();
    setRunning(false);
    setEvaluations({});
    setAnalysisOptions(next);
    setBranch(null);
    setBetterMovesOpen(false);
    setBranchCaptures(null);
  };

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
  const [isPlaying, setIsPlaying] = useState(false);

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
    setIsPlaying(false);
    setPly(Math.max(0, Math.min(game.moves.length, next)));
    setBranch(null);
    setBetterMovesOpen(false);
    setBranchCaptures(null);
    setSelected(null);
  };

  useEffect(() => {
    if (!isPlaying) return;
    if (ply >= game.moves.length) {
      setIsPlaying(false);
      return;
    }
    const timer = setInterval(() => {
      setPly((prev) => {
        if (prev >= game.moves.length - 1) {
          setIsPlaying(false);
          return game.moves.length;
        }
        return prev + 1;
      });
    }, 1400);
    return () => clearInterval(timer);
  }, [isPlaying, ply, game.moves.length]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).matches("textarea,input,select"))
        return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIsPlaying(false);
        navigate(ply - 1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setIsPlaying(false);
        navigate(ply + 1);
      }
      if (
        event.key === " " &&
        (event.target as HTMLElement).tagName !== "BUTTON"
      ) {
        event.preventDefault();
        setIsPlaying(false);
        if (ply < game.moves.length) {
          navigate(ply + 1);
        }
      }
      if (event.key === "Home") {
        event.preventDefault();
        setIsPlaying(false);
        navigate(0);
      }
      if (event.key === "End") {
        event.preventDefault();
        setIsPlaying(false);
        navigate(game.moves.length);
      }
      if (event.key === "x" || event.key === "X") {
        setFlipped((f) => !f);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [ply, game, isPlaying]);
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
      setMobileView("review");
      setNotice(`Game loaded · ${parsed.moves.length} moves`);
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
    setCcLoadingMsg(`Loading games from ${formatArchiveLabel(archiveUrl)}...`);
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
    window.scrollTo({
      top: 0,
      behavior:
        touchPreferences.reducedMotion ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
    });
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
    setResultOptions(analysisOptions);
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
        analysisOptions,
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
  const previousFrame = useRef({ ply, game, branch, flipped });
  useLayoutEffect(() => {
    const old = previousFrame.current;
    previousFrame.current = { ply, game, branch, flipped };
    if (
      old.game !== game ||
      old.branch ||
      branch ||
      old.flipped !== flipped ||
      Math.abs(old.ply - ply) !== 1 ||
      touchPreferences.reducedMotion ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const forward = ply > old.ply,
      moved = game.moves[forward ? ply - 1 : old.ply - 1];
    if (!moved) return;
    const pairs: string[][] = [
      [forward ? moved.from : moved.to, forward ? moved.to : moved.from],
    ];
    if (moved.flags.includes("k") || moved.flags.includes("q")) {
      const rank = moved.from[1],
        kingSide = moved.flags.includes("k");
      const a = (kingSide ? "h" : "a") + rank,
        b = (kingSide ? "f" : "d") + rank;
      pairs.push(forward ? [a, b] : [b, a]);
    }
    const animations: Animation[] = [];
    for (const [from, to] of pairs) {
      const source = document.querySelector<HTMLElement>(
          '[data-square="' + from + '"]',
        ),
        target = document.querySelector<HTMLElement>(
          '[data-square="' + to + '"] .piece',
        );
      if (!source || !target) continue;
      const a = source.getBoundingClientRect(),
        b = target.parentElement!.getBoundingClientRect();
      animations.push(
        target.animate(
          [
            {
              transform:
                "translate(" + (a.x - b.x) + "px," + (a.y - b.y) + "px)",
            },
            { transform: "translate(0,0)" },
          ],
          { duration: 420, easing: "cubic-bezier(.22,.7,.25,1)" },
        ),
      );
    }
    return () => animations.forEach((a) => a.cancel());
  }, [ply, game, branch, flipped, touchPreferences.reducedMotion]);
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
          { move: game.moves[index], previous: evaluations[index - 1] },
        )
      : null;
  const score =
    current?.mate !== undefined
      ? `M${current.mate}`
      : current
        ? `${current.cp >= 0 ? "+" : ""}${(current.cp / 100).toFixed(2)}`
        : "—";
  const board = new Chess(branch || game.fens[ply]);
  const material = materialCount(board);
  const displayedCaptures =
    branch && branchCaptures
      ? branchCaptures
      : capturedPieces(game.moves.slice(0, ply));
  const legal = selected
    ? board.moves({ square: selected, verbose: true }).map((m) => m.to)
    : [];
  const clickSquare = (square: Square) => {
    if (selected && legal.includes(square)) {
      const m = board.move({ from: selected, to: square, promotion: "q" });
      if (m) {
        setBranch(board.fen());
        setBranchCaptures(addCapture(displayedCaptures, m));
      }
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
        ? [
            reviewLoss(
              evaluations[i],
              evaluations[i + 1],
              color === "w",
              uci(i),
            ),
          ]
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

  const playerAccuracy = (color: string) =>
    accuracy(
      game.moves.flatMap((m, i) =>
        m.color === color && evaluations[i] && evaluations[i + 1]
          ? [
              expectedPointLoss(
                evaluations[i],
                evaluations[i + 1],
                color === "w",
                uci(i),
              ),
            ]
          : [],
      ),
    );

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

  const seekMistake = (direction: 1 | -1) => {
    const startIdx = direction === 1 ? ply : ply - 2;
    for (let i = startIdx; i >= 0 && i < game.moves.length; i += direction) {
      const g = grade(i);
      if (isCriticalGrade(g)) {
        navigate(i + 1);
        return;
      }
    }
  };

  const allGrades = React.useMemo(() => {
    const res: Record<number, Grade | null> = {};
    for (let i = 0; i < game.moves.length; i++) {
      res[i] = grade(i);
    }
    return res;
  }, [evaluations, game]);

  const criticalPlies = React.useMemo(() => {
    const list: number[] = [];
    for (let i = 0; i < game.moves.length; i++) {
      const g = allGrades[i];
      if (isCriticalGrade(g)) {
        list.push(i + 1);
      }
    }
    return list;
  }, [allGrades, game.moves.length]);

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
    <div
      className={`app ${touchPreferences.reducedMotion ? "reduce-motion" : ""}`}
      data-mobile-view={mobileView}
      data-games-source={gameSource}
      data-board-theme={boardPreferences.theme}
    >
      <PageScrollFeedback view={mobileView} />
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
      <main id="main-content">
        {notice && (
          <div className="mobile-toast" role="status">
            {notice}
          </div>
        )}
        {running && mobileView !== "review" && (
          <button
            className="mobile-analysis-status"
            onClick={() => selectMobileView("review")}
          >
            Analysis running · {Object.keys(evaluations).length}/
            {game.fens.length} positions <span>Open review →</span>
          </button>
        )}
        <div className="intro">
          <div>
            <p className="eyebrow">YOUR GAME. A CLEARER PICTURE.</p>
            <h1>
              <span className="desktop-title">Every move has a story.</span>
              <span className="mobile-title">
                {mobileView === "review"
                  ? "Every move has a story."
                  : mobileView === "games"
                    ? "Your games, all in one place."
                    : mobileView === "insights"
                      ? "See the bigger picture."
                      : "Make ChessLens yours."}
              </span>
            </h1>
            <p className="desktop-subtitle">
              Find the turning points. Understand your next move.
            </p>
          </div>
          <span className="tag">GAME REVIEW</span>
        </div>
        <div
          className="mobile-games-switch"
          role="group"
          aria-label="Import source"
        >
          <button
            aria-pressed={gameSource === "pgn"}
            onClick={() => setGameSource("pgn")}
          >
            PGN import
          </button>
          <button
            aria-pressed={gameSource === "chesscom"}
            onClick={() => setGameSource("chesscom")}
          >
            Chess.com
          </button>
        </div>
        <div className="workspace">
          <section
            className={`board-section ${boardFocused ? "board-focused" : ""}`}
            aria-label="Game board"
            role={boardFocused ? "dialog" : undefined}
            aria-modal={boardFocused || undefined}
          >
            <button
              className="focus-exit"
              onClick={() => setBoardFocused(false)}
            >
              Exit focus view
            </button>
            <div className="player">
              <span className="avatar">{flipped ? "♔" : "♚"}</span>
              <div className="player-identity">
                <strong>{flipped ? whiteName : blackName}</strong>
                <small>{flipped ? "White pieces" : "Black pieces"}</small>
                <CapturedMaterial
                  color={flipped ? "w" : "b"}
                  captures={displayedCaptures[flipped ? "w" : "b"]}
                  advantage={material.advantage[flipped ? "w" : "b"]}
                  partial={game.headers.SetUp === "1"}
                />
              </div>
              <div className="player-stats-col">
                <span className="player-score">
                  {playerAccuracy(flipped ? "w" : "b") ?? "—"}
                  <small>accuracy</small>
                </span>
                {playerElo(flipped ? "w" : "b") !== null && (
                  <span
                    className="player-elo-pill"
                    title="Estimated game performance rating"
                  >
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
                        data-square={square}
                        className={`square ${(file + rank) % 2 ? "light" : "dark"} ${!branch && (move?.from === square || move?.to === square) ? "last" : ""} ${selected === square ? "selected" : ""} ${!branch && move?.from === square ? "move-origin" : ""} ${!branch && move?.to === square ? "move-destination" : ""}`}
                        onClick={() => clickSquare(square)}
                        aria-label={`${square}${piece ? ` ${piece.color === "w" ? "White" : "Black"} ${piece.type}` : ""}`}
                        aria-pressed={selected === square}
                      >
                        {piece && (
                          <span className={`piece ${piece.color}`}>
                            <ChessPiece
                              type={piece.type}
                              color={piece.color}
                              finish={boardPreferences.pieceFinish}
                            />
                          </span>
                        )}
                        {!branch &&
                          move?.to === square &&
                          currentGrade &&
                          boardPreferences.badges && (
                            <BoardMoveBadge
                              grade={currentGrade}
                              accuracy={moveAccuracy(
                                previous,
                                current,
                                move.color === "w",
                                uci(ply - 1),
                              )}
                            />
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
              <div className="player-identity">
                <strong>{flipped ? blackName : whiteName}</strong>
                <small>{flipped ? "Black pieces" : "White pieces"}</small>
                <CapturedMaterial
                  color={flipped ? "b" : "w"}
                  captures={displayedCaptures[flipped ? "b" : "w"]}
                  advantage={material.advantage[flipped ? "b" : "w"]}
                  partial={game.headers.SetUp === "1"}
                />
              </div>
              <div className="player-stats-col">
                <span className="player-score">
                  {playerAccuracy(flipped ? "b" : "w") ?? "—"}
                  <small>accuracy</small>
                </span>
                {playerElo(flipped ? "b" : "w") !== null && (
                  <span
                    className="player-elo-pill"
                    title="Estimated game performance rating"
                  >
                    {playerElo(flipped ? "b" : "w")} <small>Elo</small>
                  </span>
                )}
              </div>
            </div>
            <ReplayNavigation
              ply={ply}
              moves={game.moves.map((m) => m.san)}
              branch={!!branch}
              playing={isPlaying}
              arrows={arrowsEnabled}
              running={running}
              complete={complete}
              focused={boardFocused}
              onFocus={() => setBoardFocused(!boardFocused)}
              sounds={touchPreferences.sounds}
              haptics={touchPreferences.haptics}
              onNavigate={navigate}
              onFlip={() => setFlipped(!flipped)}
              onArrows={() => setArrowsEnabled(!arrowsEnabled)}
              onPlay={() => {
                setBranch(null);
                setBetterMovesOpen(false);
                setBranchCaptures(null);
                setSelected(null);
                setIsPlaying(!isPlaying);
              }}
              onSeek={seekMistake}
              onAnalyse={running ? () => controller.current?.abort() : start}
            />
            {branch && (
              <div className="variation">
                Exploring a variation · auto-queen promotion{" "}
                <button
                  onClick={() => {
                    setBranch(null);
                    setBetterMovesOpen(false);
                    setBranchCaptures(null);
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
            {criticalPlies.length > 0 && !branch && (
              <div
                className="key-moments-bar"
                aria-label="Key moments navigation"
              >
                <div className="km-header">
                  <span className="km-title">
                    <span className="km-bolt">⚡</span> Key Moments (
                    {criticalPlies.length})
                  </span>
                  <span className="km-status">
                    {criticalPlies.includes(ply)
                      ? `Moment ${criticalPlies.indexOf(ply) + 1} of ${criticalPlies.length}`
                      : "Tap to inspect critical turn"}
                  </span>
                </div>
                <div className="km-pills-row">
                  {criticalPlies.map((p) => {
                    const g = allGrades[p - 1];
                    const isCur = ply === p;
                    const mv = game.moves[p - 1];
                    return (
                      <button
                        key={p}
                        type="button"
                        className={`km-pill ${g ? g.toLowerCase() : ""} ${isCur ? "active" : ""}`}
                        title={`Move ${Math.ceil(p / 2)} (${mv?.color === "w" ? "White" : "Black"} ${mv?.san}): ${g}`}
                        onClick={() => navigate(p)}
                        aria-label={`Jump to Move ${Math.ceil(p / 2)} ${g}`}
                      >
                        <span className="km-glyph">
                          {g ? gradeIcons[g] : "●"}
                        </span>
                        <span className="km-num">{Math.ceil(p / 2)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <section className="panel evaluation">
              <div className="section-heading">
                <span className="eyebrow">POSITION INSIGHT</span>
                <span className="engine-tag">
                  {analysisOptions.engine.name}
                </span>
              </div>
              <button
                type="button"
                className="replay-better"
                aria-label="Better move"
                aria-expanded={betterMovesOpen}
                aria-controls="better-move-lines"
                disabled={!!!(ply > 0 ? previous : current)?.best}
                title={
                  betterMovesOpen
                    ? "Hide alternative moves"
                    : !!(ply > 0 ? previous : current)?.best
                      ? "Show better move"
                      : "Analyse this position to see alternatives"
                }
                onClick={() => {
                  setBetterMovesOpen(!betterMovesOpen);
                  if (betterMovesOpen) {
                    setBranch(null);
                    setBranchCaptures(null);
                    setSelected(null);
                  }
                }}
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
                    <span
                      className="move-accuracy"
                      aria-label="Selected move accuracy"
                    >
                      {moveAccuracy(
                        previous,
                        current,
                        move.color === "w",
                        uci(ply - 1),
                      )}
                      % accuracy
                    </span>
                    <span>Depth {current.depth}</span>
                    <small className="move-loss">
                      {Math.round(
                        reviewLoss(
                          previous,
                          current,
                          move.color === "w",
                          uci(ply - 1),
                        ),
                      )}{" "}
                      cp lost{current.cached ? " · cached" : ""}
                    </small>
                    <small className="move-loss">
                      Expected-point loss:{" "}
                      {(
                        100 *
                        expectedPointLoss(
                          previous,
                          current,
                          move.color === "w",
                          uci(ply - 1),
                        )
                      ).toFixed(1)}
                      %
                    </small>
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
                <div
                  className={`tactical-breakdown ${currentGrade ? `grade-${currentGrade.toLowerCase()}` : ""}`}
                >
                  <div className="tactical-header">
                    <div className="tactical-heading-left">
                      <span
                        className={`grade-icon-badge ${currentGrade ? currentGrade.toLowerCase() : ""}`}
                      >
                        {currentGrade ? gradeIcons[currentGrade] : "●"}
                      </span>
                      <span className="tactical-title">
                        {tacticalDesc.heading}
                      </span>
                    </div>
                    {tacticalDesc.deltaText && (
                      <span className="adv-shift-badge">
                        {tacticalDesc.deltaText}
                      </span>
                    )}
                  </div>
                  <p className="tactical-expl">{tacticalDesc.detail}</p>
                </div>
              )}
              <BetterMoves
                open={betterMovesOpen}
                evaluation={ply > 0 ? previous : current}
                fen={game.fens[ply > 0 ? ply - 1 : 0]}
                played={move?.san}
                onPreview={(fen, path = []) => {
                  setIsPlaying(false);
                  setBranch(fen);
                  if (fen) {
                    const root = ply > 0 ? ply - 1 : 0;
                    let ledger = capturedPieces(game.moves.slice(0, root));
                    const variationBoard = new Chess(game.fens[root]);
                    for (const uci of path) {
                      try {
                        const move = variationBoard.move({
                          from: uci.slice(0, 2),
                          to: uci.slice(2, 4),
                          promotion: uci[4],
                        });
                        ledger = addCapture(ledger, move);
                      } catch {
                        break;
                      }
                    }
                    setBranchCaptures(ledger);
                  } else setBranchCaptures(null);
                  setSelected(null);
                }}
              />
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
                className="primary analyse analyse-icon"
                title={
                  running
                    ? "Stop analysis"
                    : complete
                      ? "Analyse again"
                      : "Analyse game"
                }
                aria-label={
                  running
                    ? "Stop analysis"
                    : complete
                      ? "Analyse again"
                      : "Analyse game"
                }
                onClick={running ? () => controller.current?.abort() : start}
              >
                <svg
                  aria-hidden="true"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className={running ? "analysis-spinner" : ""}
                >
                  {running ? (
                    <>
                      <circle cx="12" cy="12" r="9" strokeDasharray="40 17" />
                      <path d="M9 9h6v6H9z" fill="currentColor" />
                    </>
                  ) : (
                    <>
                      <circle cx="10" cy="10" r="6" />
                      <path d="m15 15 6 6M7 11l2-3 2 4 2-3" />
                    </>
                  )}
                </svg>
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
                  ? `Analysing up to depth ${resultOptions.depth}, ${resultOptions.movetime / 1000}s per position. You can keep exploring.`
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
                <>
                  <div className="moves">
                    {Array.from(
                      {
                        length: Math.ceil(
                          (game.moves.length + initialBlack) / 2,
                        ),
                      },
                      (_, row) => {
                        const wIdx = row * 2 - initialBlack;
                        const bIdx = row * 2 + 1 - initialBlack;
                        const g0 = wIdx >= 0 ? grade(wIdx) : null;
                        const g1 = bIdx >= 0 ? grade(bIdx) : null;
                        const isCritical = (g: Grade | null) =>
                          isCriticalGrade(g);
                        if (
                          criticalOnly &&
                          !isCritical(g0) &&
                          !isCritical(g1)
                        ) {
                          return null;
                        }
                        return (
                          <div className="move-row" key={row}>
                            <span>
                              {Number(game.fens[0].split(" ")[5]) + row}.
                            </span>
                            {[0, 1].map((offset) => {
                              const index = row * 2 + offset - initialBlack;
                              const m = game.moves[index];
                              if (!m) return <span key={`empty-${offset}`} />;
                              const g = grade(index);
                              const pct = moveAccuracy(
                                evaluations[index],
                                evaluations[index + 1],
                                m.color === "w",
                                uci(index),
                              );
                              return (
                                <button
                                  key={index}
                                  className={ply === index + 1 ? "current" : ""}
                                  onClick={() => navigate(index + 1)}
                                  aria-label={`${m.color === "w" ? "White" : "Black"} ${m.san}${g ? `, ${g}` : ""}`}
                                >
                                  <span className="move-cell">
                                    <strong>{m.san}</strong>
                                    <small className="move-accuracy">
                                      {pct === null
                                        ? "Not analysed"
                                        : `${pct}% accuracy`}
                                    </small>
                                  </span>
                                  {g && (
                                    <span
                                      className={`move-dot ${g.toLowerCase()}`}
                                      title={g}
                                    >
                                      {gradeIcons[g]}
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
                </>
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
                    ChessLens accuracy and performance ratings are estimates
                    from expected-point loss, not official Chess.com or FIDE
                    ratings.
                  </p>
                </div>
              )}
            </section>
          </aside>
        </div>
        <div className="insights-heading mobile-only">
          <p className="eyebrow">GAME INSIGHTS</p>
          <p className="muted">
            {Object.keys(evaluations).length
              ? "Review your accuracy, key moments and advantage over time."
              : "Analyse your game in Review to unlock accuracy and turning points."}
          </p>
          <button onClick={() => selectMobileView("review")}>
            Back to review →
          </button>
        </div>
        <EvalGraph
          evaluations={evaluations}
          moves={game.moves}
          currentPly={ply}
          grades={allGrades}
          onSelectPly={navigate}
        />
        <section className="panel chesscom-panel" aria-label="Chess.com import">
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
                      <strong>{formatArchiveLabel(ccSelectedArchive)}</strong>
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
                              <span className={`outcome-badge ${res.outcome}`}>
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
                                  <span className="eco-badge">{g.eco}</span>
                                )}
                                {g.rated && (
                                  <span className="rated-badge">Rated</span>
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
        <BoardAppearance
          value={boardPreferences}
          onChange={updateBoardPreferences}
          expanded={mobileView === "settings"}
        />
        <section
          className="panel engine-settings-page"
          aria-label="Engine settings"
        >
          <EngineSettings
            positions={game.fens.length}
            options={analysisOptions}
            onChange={changeAnalysisOptions}
            disabled={running}
            expanded
          />
        </section>
        <TouchSettings
          value={touchPreferences}
          onChange={updateTouchPreferences}
          onInstall={
            install
              ? () => {
                  install.prompt();
                  setInstall(null);
                }
              : undefined
          }
        />
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
              <a href="./engine/lozza/LICENSE.txt">Lozza MIT license</a> ·{" "}
              <a
                href="https://github.com/op12no2/lozza/releases/tag/12.1"
                target="_blank"
                rel="noreferrer"
              >
                Lozza 12.1 source
              </a>{" "}
              · <a href="./engine/COPYING.txt">Stockfish GPLv3 license</a> ·{" "}
              <a href="./engine/stockfish-source.tar.gz">
                Corresponding engine source
              </a>{" "}
              ·{" "}
              <a href="https://github.com/nmrugg/stockfish.js/tree/v19.0.1">
                Upstream & build instructions
              </a>
            </p>
            <p>
              Grades use a fixed expected-points estimate from engine
              evaluation: Excellent ≤0.02, Good ≤0.05, Inaccuracy ≤0.10, Mistake
              ≤0.20, otherwise Blunder. Best matches the engine recommendation.
              Great requires a clearly unique sound engine line; Brilliant
              requires a verified piece sacrifice; Miss flags a dropped winning
              chance after the opponent’s error. These are conservative
              ChessLens heuristics, not Chess.com’s rating-trained model.
              Accuracy averages 100 × exp(−6 × expected-point loss).
              Depth/time-limited results can change with deeper analysis.
              <a href="https://support.chess.com/en/articles/8572705-how-are-moves-classified-what-is-a-blunder-or-brilliant-etc">
                Read the classification reference
              </a>
              . App code: MIT; engine: GPLv3.
            </p>
            <p>
              Material lead uses pieces on the board: pawn 1, knight/bishop 3,
              rook 5, queen 9. Captured icons use recorded moves; imported
              starting positions may omit earlier captures.
            </p>
            <p>
              Offline use works after loading the app and running analysis
              online once. Installation support varies by browser.
            </p>
          </details>
        </footer>
      </main>
      <MobileNavigation
        view={mobileView}
        onSelect={selectMobileView}
        running={running}
      />
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
