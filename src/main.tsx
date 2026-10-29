import { reviewAlternatives, restoredAlternative } from "./alternatives";
import { LearningHub, WeaknessDashboard } from "./LearningHub";
import { useSettingsPage, usePreference, isBoolean } from "./preferences";
import { AnalysisStatus } from "./AnalysisStatus";
import { SavedGames } from "./SavedGames";
import {
  cacheGameAnalysis,
  loadGameAnalysis,
  clearSavedGames,
  loadReview,
  readAnalysisSettings,
  writeAnalysisSettings,
  persistReview,
  checkpoint,
  updateSavedGame,
  sameOptions,
  type ReviewSession,
} from "./reviewStorage";
import { cached, saveCached, clearGameCache } from "./gameCache";
import { playMoveSound } from "./moveSound";
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
import { MoveDetails } from "./MoveDetails";
import "./style.css";
import "./review-workspace.css";

function App({
  restored,
  storageWarning,
}: {
  restored: ReviewSession | null;
  storageWarning: string;
}) {
  const [storageError, setStorageError] = useState(storageWarning);
  const [activePgn, setActivePgn] = useState(restored?.pgn || demo);
  const [initialOptions] = useState(readAnalysisSettings);
  const resumePending = useRef(restored?.running || false);
  const compatible = restored && sameOptions(restored.options, initialOptions);

  const [mobileView, setMobileView] = useState<MobileView>(
    restored?.view || "review",
  );
  const [gameSource, setGameSource] = useState<"pgn" | "chesscom">(
    restored?.source || "pgn",
  );
  const [touchPreferences, setTouchPreferences] =
    useState<TouchPreferences>(readPreferences);
  const [notice, setNotice] = useState("");
  const selectMobileView = (view: MobileView) => {
    setMobileView(view);
    setIsPlaying(false);
    setError("");

    touchTick(touchPreferences.haptics);
  };
  const updateTouchPreferences = (next: TouchPreferences) => {
    setTouchPreferences(next);
    try {
      localStorage.setItem("chesslens-touch", JSON.stringify(next));
    } catch {
      setStorageError("Touch settings could not be saved on this device.");
    }
  };
  useSettingsPage(mobileView, setStorageError);
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
      setStorageError("Board settings could not be saved on this device.");
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
  const [game, setGame] = useState(() => parseGame(restored?.pgn || demo));
  const [pgn, setPgn] = useState(restored?.pgn || demo),
    [ply, setPly] = useState(restored?.ply || 0),
    [flipped, setFlipped] = useState(restored?.flipped || false);
  const [evaluations, setEvaluations] = useState<Record<number, Evaluation>>(
    compatible ? restored.evaluations : {},
  );
  const [running, setRunning] = useState(false),
    [error, setError] = useState("");
  const [selected, setSelected] = useState<Square | null>(null),
    [branch, setBranch] = useState<string | null>(restored?.branch || null);
  const [branchMove, setBranchMove] = useState<{
    from: string;
    to: string;
  } | null>(restored?.branchMove || null);
  const [betterMovesOpen, setBetterMovesOpen] = useState(
    restored?.betterMovesOpen || false,
  );
  const rootPly = Math.max(0, ply - 1),
    alternativeRoot = game.fens[rootPly];
  const alternativeEvaluation = evaluations[rootPly];
  const alternativeLines = React.useMemo(
    () => reviewAlternatives(alternativeRoot, alternativeEvaluation),
    [alternativeRoot, alternativeEvaluation],
  );
  const [alternativeIndex, setAlternativeIndex] = useState(
    () =>
      restoredAlternative(
        alternativeRoot,
        alternativeEvaluation,
        restored?.branch,
        restored?.alternativeCursor,
      ).index,
  );
  const [alternativeStep, setAlternativeStep] = useState(
    () =>
      restoredAlternative(
        alternativeRoot,
        alternativeEvaluation,
        restored?.branch,
        restored?.alternativeCursor,
      ).step,
  );
  const activeAlternative =
    alternativeLines[alternativeIndex] || alternativeLines[0];
  const [variationEvaluations, setVariationEvaluations] = useState<
    Record<string, Evaluation>
  >({});
  const [variationStatus, setVariationStatus] = useState("");
  const variationConfig = useRef("");
  const variationFens = React.useMemo(
    () =>
      activeAlternative
        ? [alternativeRoot, ...activeAlternative.moves.map((m) => m.fen)]
        : [],
    [alternativeRoot, activeAlternative],
  );
  const variationFen = variationFens[alternativeStep];
  const variationBefore =
    variationEvaluations[variationFens[alternativeStep - 1]];
  const variationAfter = variationEvaluations[variationFen];
  const variationMove = activeAlternative?.moves[alternativeStep - 1];
  const variationWhite =
    alternativeStep > 0 &&
    new Chess(variationFens[alternativeStep - 1] || alternativeRoot).turn() ===
      "w";
  const variationAccuracy = variationMove
    ? moveAccuracy(
        variationBefore,
        variationAfter,
        variationWhite,
        variationMove.uci,
      )
    : null;
  const variationGrade =
    variationMove && variationBefore && variationAfter
      ? classify(
          variationBefore,
          variationAfter,
          variationMove.uci,
          variationWhite,
        )
      : null;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [branchCaptures, setBranchCaptures] = useState<CaptureLedger | null>(
    restored?.branchCaptures || null,
  );
  const controller = useRef<AbortController | null>(null),
    generation = useRef(0);
  const [install, setInstall] = useState<
    (Event & { prompt: () => Promise<void> }) | null
  >(null);

  const [analysisOptions, setAnalysisOptions] =
    useState<AnalysisOptions>(initialOptions);
  const [resultOptions, setResultOptions] =
    useState<AnalysisOptions>(initialOptions);
  const changeAnalysisOptions = (next: AnalysisOptions) => {
    if (
      sameOptions(next, analysisOptions) &&
      next.cpuMode !== analysisOptions.cpuMode
    ) {
      setAnalysisOptions(next);
      setResultOptions(next);
      try {
        writeAnalysisSettings(next);
      } catch {
        setStorageError("CPU preference could not be saved.");
      }
      return;
    }
    generation.current++;
    controller.current?.abort();
    setRunning(false);
    setEvaluations({});
    resumePending.current = true;
    setAnalysisOptions(next);
    try {
      writeAnalysisSettings(next);
    } catch {
      setStorageError("Engine settings could not be saved on this device.");
    }
    setBranch(null);
    setBetterMovesOpen(false);
    setBranchCaptures(null);
  };

  // Restore the last successful browser, including PGNs, without a network request.
  const [savedBrowser] = useState(() => {
    const session = cached<{
      player: ChessComPlayer;
      archives: string[];
      archive: string;
    }>("browser")?.data;
    if (
      !session?.player?.username ||
      !Array.isArray(session.archives) ||
      typeof session.archive !== "string"
    )
      return null;
    const games = cached<ChessComGame[]>("month:" + session.archive)?.data;
    return Array.isArray(games) ? { ...session, games } : null;
  });
  const [ccUsername, setCcUsername] = useState(() => {
    try {
      return (
        savedBrowser?.player.username ||
        localStorage.getItem("chesslens_cc_user") ||
        ""
      );
    } catch {
      return "";
    }
  });
  const [ccPlayer, setCcPlayer] = useState<ChessComPlayer | null>(
    savedBrowser?.player || null,
  );
  const [ccArchives, setCcArchives] = useState<string[]>(
    savedBrowser?.archives || [],
  );
  const [ccSelectedArchive, setCcSelectedArchive] = useState(
    savedBrowser?.archive || "",
  );
  const [ccGames, setCcGames] = useState<ChessComGame[]>(
    savedBrowser?.games || [],
  );
  const cacheLabel = (archive: string) => {
    const entry = cached("month:" + archive);
    return entry
      ? "Saved on this device · " + new Date(entry.savedAt).toLocaleString()
      : "Games loaded, but local storage is unavailable or this month is too large to save.";
  };
  const [ccCacheInfo, setCcCacheInfo] = useState(() =>
    savedBrowser ? cacheLabel(savedBrowser.archive) : "",
  );
  const [ccLoading, setCcLoading] = useState(false);
  const [ccLoadingMsg, setCcLoadingMsg] = useState("");
  const [ccError, setCcError] = useState("");
  const [ccSpeedFilter, setCcSpeedFilter] = useState<string>(
    restored?.filters?.speed || "all",
  );
  const [ccResultFilter, setCcResultFilter] = useState<string>(
    restored?.filters?.result || "all",
  );
  const [ccSearch, setCcSearch] = useState(restored?.filters?.search || "");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [arrowsEnabled, setArrowsEnabled] = usePreference(
    "chesslens-arrows-v1",
    true,
    isBoolean,
    setStorageError,
  );
  const [criticalOnly, setCriticalOnly] = usePreference(
    "chesslens-critical-v1",
    false,
    isBoolean,
    setStorageError,
  );
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

  useEffect(() => {
    if (!betterMovesOpen || !activeAlternative) return;
    const step = Math.max(
      0,
      Math.min(alternativeStep, activeAlternative.moves.length),
    );
    const path = activeAlternative.moves.slice(0, step);
    const b = new Chess(alternativeRoot);
    let ledger = capturedPieces(game.moves.slice(0, rootPly));
    for (const m of path) ledger = addCapture(ledger, b.move(m.uci));
    setBranch(b.fen());
    setBranchMove(path.at(-1) || null);
    setBranchCaptures(ledger);
    setSelected(null);
  }, [
    betterMovesOpen,
    activeAlternative,
    alternativeStep,
    alternativeRoot,
    game,
    rootPly,
  ]);
  useEffect(() => {
    if (!betterMovesOpen || !variationFens.length || mobileView !== "review")
      return;
    if (running) {
      setVariationStatus("Waiting for game analysis…");
      return;
    }
    const abort = new AbortController();
    const completed: Record<number, Evaluation> = {};
    const config = JSON.stringify(analysisOptions);
    if (variationConfig.current !== config) setVariationEvaluations({});
    variationFens.forEach((fen, i) => {
      if (variationConfig.current === config && variationEvaluations[fen])
        completed[i] = variationEvaluations[fen];
    });
    variationConfig.current = config;
    const timer = setTimeout(() => {
      setVariationStatus(
        "Analysing predicted positions · " + analysisOptions.engine.name,
      );
      void analyse(
        variationFens,
        (i, e) => {
          if (!abort.signal.aborted)
            setVariationEvaluations((prev) => ({
              ...prev,
              [variationFens[i]]: e,
            }));
        },
        abort.signal,
        analysisOptions,
        completed,
      )
        .then(() => {
          if (!abort.signal.aborted)
            setVariationStatus("Predicted positions analysed");
        })
        .catch(() => {
          if (!abort.signal.aborted)
            setVariationStatus(
              "Prediction analysis unavailable. Reopen the variation to retry.",
            );
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [betterMovesOpen, variationFens, running, analysisOptions, mobileView]);
  function selectAlternative(index: number, step: number) {
    setIsPlaying(false);
    setAlternativeIndex(index);
    setAlternativeStep(step);
    setSelected(null);
    touchTick(touchPreferences.haptics);
    playMoveSound(touchPreferences.sounds);
  }
  function navigateReview(next: number) {
    if (betterMovesOpen && activeAlternative) {
      selectAlternative(
        alternativeIndex,
        Math.max(0, Math.min(activeAlternative.moves.length, next)),
      );
    } else navigate(next);
  }
  const navigate = (next: number) => {
    const target = Math.max(0, Math.min(game.moves.length, next));
    if (target !== ply)
      playMoveSound(
        touchPreferences.sounds,
        target === 0 || target === game.moves.length,
      );
    setIsPlaying(false);
    setPly(Math.max(0, Math.min(game.moves.length, next)));
    setBranch(null);
    setBetterMovesOpen(false);
    setBranchCaptures(null);
    setSelected(null);
  };

  useEffect(() => {
    if (!isPlaying) return;
    if (betterMovesOpen && activeAlternative) {
      if (alternativeStep >= activeAlternative.moves.length) {
        setIsPlaying(false);
        return;
      }
      const timer = setInterval(() => {
        setAlternativeStep((step) => step + 1);
        playMoveSound(touchPreferences.sounds);
      }, 1400);
      return () => clearInterval(timer);
    }
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
  }, [
    isPlaying,
    ply,
    game.moves.length,
    betterMovesOpen,
    activeAlternative,
    alternativeStep,
  ]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        mobileView !== "review" ||
        document.querySelector("dialog[open]") ||
        (event.target as HTMLElement).matches("textarea,input,select")
      )
        return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIsPlaying(false);
        navigateReview(betterMovesOpen ? alternativeStep - 1 : ply - 1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setIsPlaying(false);
        navigateReview(betterMovesOpen ? alternativeStep + 1 : ply + 1);
      }
      if (
        event.key === " " &&
        (event.target as HTMLElement).tagName !== "BUTTON"
      ) {
        event.preventDefault();
        setIsPlaying(false);
        if (betterMovesOpen || ply < game.moves.length) {
          navigateReview(betterMovesOpen ? alternativeStep + 1 : ply + 1);
        }
      }
      if (event.key === "Home") {
        event.preventDefault();
        setIsPlaying(false);
        navigateReview(0);
      }
      if (event.key === "End") {
        event.preventDefault();
        setIsPlaying(false);
        navigateReview(
          betterMovesOpen
            ? activeAlternative?.moves.length || 0
            : game.moves.length,
        );
      }
      if (event.key === "x" || event.key === "X") {
        setFlipped((f) => !f);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    ply,
    game,
    isPlaying,
    mobileView,
    betterMovesOpen,
    alternativeStep,
    alternativeIndex,
    activeAlternative,
  ]);
  const importPgn = (value: string) => {
    try {
      const parsed = parseGame(value);
      generation.current++;
      controller.current?.abort();
      setRunning(false);
      setGame(parsed);
      resumePending.current = true;
      setActivePgn(value);
      setPgn(value);
      setEvaluations({});
      navigate(0);
      setError("");
      setMobileView("review");
      setNotice(`Game loaded · ${parsed.moves.length} moves`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this PGN.");
    }
  };

  const loadChessComUser = async (targetUser?: string, refresh = false) => {
    const user = (targetUser ?? ccUsername).trim();
    if (!user) {
      setCcError("Please enter a Chess.com username.");
      return;
    }
    setCcLoading(true);
    setCcLoadingMsg(`Looking up "${user}" on Chess.com...`);
    setCcError("");
    try {
      const player = await fetchPlayerProfile(user, refresh);

      try {
        localStorage.setItem("chesslens_cc_user", player.username);
      } catch {}

      setCcLoadingMsg("Fetching game archives...");
      const archives = await fetchPlayerArchives(user, refresh);

      if (archives.length === 0) {
        setCcPlayer(player);
        setCcArchives([]);
        setCcSelectedArchive("");
        setCcCacheInfo("");
        setCcGames([]);
        setCcError(`No archived games found for ${player.username}.`);
        return;
      }

      const latestArchive = archives[archives.length - 1];

      setCcLoadingMsg(
        `Loading games from ${formatArchiveLabel(latestArchive)}...`,
      );
      const games = await fetchMonthGames(latestArchive, refresh);
      setCcGames(games);
      setCcPlayer(player);
      setCcUsername(player.username);
      setCcArchives(archives);
      setCcSelectedArchive(latestArchive);
      setCcCacheInfo(cacheLabel(latestArchive));
      saveCached("browser", { player, archives, archive: latestArchive });
    } catch (err) {
      setCcError(
        err instanceof Error ? err.message : "Failed to load from Chess.com.",
      );
    } finally {
      setCcLoading(false);
    }
  };

  const changeArchive = async (archiveUrl: string, refresh = false) => {
    setCcLoading(true);
    setCcLoadingMsg(`Loading games from ${formatArchiveLabel(archiveUrl)}...`);
    setCcError("");
    try {
      const games = await fetchMonthGames(archiveUrl, refresh);
      setCcSelectedArchive(archiveUrl);
      setCcCacheInfo(cacheLabel(archiveUrl));
      setCcGames(games);
      saveCached("browser", {
        player: ccPlayer,
        archives: ccArchives,
        archive: archiveUrl,
      });
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
  const [analysisDownload, setAnalysisDownload] = useState("");
  const [analysisRun, setAnalysisRun] = useState({
    startedAt: 0,
    initialCompleted: 0,
  });
  const start = async (force = false) => {
    setAnalysisDownload("");
    resumePending.current = false;
    controller.current?.abort();
    const id = ++generation.current;
    const abort = new AbortController();
    controller.current = abort;
    let reusable =
      !force && sameOptions(resultOptions, analysisOptions) ? evaluations : {};
    const snapshot = {
      ...latestSession.current,
      pgn: activePgn,
      options: analysisOptions,
    };
    let collected: Record<number, Evaluation> = { ...reusable };
    setAnalysisRun({
      startedAt: Date.now(),
      initialCompleted: Object.keys(reusable).length,
    });
    setEvaluations(reusable);
    setResultOptions(analysisOptions);
    setRunning(true);
    setError("");
    try {
      if (!force) {
        try {
          reusable = {
            ...(await loadGameAnalysis(activePgn, analysisOptions)),
            ...reusable,
          };
        } catch {
          setStorageError(
            "Saved analysis could not be read. New analysis will still work.",
          );
        }
      }
      if (abort.signal.aborted || generation.current !== id) return;
      collected = { ...reusable };
      setEvaluations(reusable);
      setAnalysisRun({
        startedAt: Date.now(),
        initialCompleted: Object.keys(reusable).length,
      });
      if (Object.keys(reusable).length === game.fens.length) {
        setNotice("Saved analysis restored · no engine run needed");
        return;
      }
      await analyse(
        game.fens,
        (index, value) => {
          collected[index] = value;
          if (generation.current === id)
            setEvaluations((previous) => ({ ...previous, [index]: value }));
        },
        abort.signal,
        force ? { ...analysisOptions, useCache: false } : analysisOptions,
        reusable,
        (message) => {
          if (generation.current === id) setAnalysisDownload(message);
        },
      );
    } catch (e) {
      if (!abort.signal.aborted && generation.current === id)
        setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      try {
        await cacheGameAnalysis({
          ...snapshot,
          evaluations: collected,
          updatedAt: Date.now(),
          running: false,
        });
      } catch {
        setStorageError(
          "Analysis finished but could not be saved. Check browser storage space.",
        );
      }
      if (generation.current === id) setRunning(false);
    }
  };
  const startRef = useRef(start);
  startRef.current = start;
  const automaticJob = useRef<{
    game: typeof game;
    options: AnalysisOptions;
  } | null>(
    restored && compatible && !restored.running
      ? { game, options: analysisOptions }
      : null,
  );
  useEffect(() => {
    if (
      mobileView !== "review" ||
      (automaticJob.current?.game === game &&
        automaticJob.current.options === analysisOptions)
    )
      return;
    const timer = setTimeout(() => {
      automaticJob.current = { game, options: analysisOptions };
      void startRef.current();
    }, 0);
    return () => clearTimeout(timer);
  }, [game, analysisOptions, mobileView]);
  const session: ReviewSession = {
    version: 1,
    pgn: activePgn,
    ply,
    flipped,
    view: mobileView,
    source: gameSource,
    options: analysisOptions,
    evaluations,
    running: running || resumePending.current,
    updatedAt: Date.now(),
    filters: { speed: ccSpeedFilter, result: ccResultFilter, search: ccSearch },
    branch,
    branchMove,
    branchCaptures,
    betterMovesOpen,
    alternativeCursor:
      betterMovesOpen && activeAlternative
        ? { best: activeAlternative.best, step: alternativeStep }
        : undefined,
  };
  const latestSession = useRef(session);
  latestSession.current = session;
  const persist = () => {
    const value = latestSession.current;
    try {
      checkpoint(value);
    } catch {
      setStorageError(
        "The recovery checkpoint could not be saved. Browser storage may be full.",
      );
    }
    void persistReview(value)
      .then(() => updateSavedGame(value))
      .catch(() =>
        setStorageError(
          "Could not save review progress. Export your PGN before closing this page.",
        ),
      );
  };
  useEffect(() => {
    const timer = setTimeout(persist, 200);
    return () => clearTimeout(timer);
  }, [
    activePgn,
    ply,
    flipped,
    mobileView,
    gameSource,
    analysisOptions,
    evaluations,
    running,
    branch,
    branchMove,
    betterMovesOpen,
    alternativeIndex,
    alternativeStep,
    ccSpeedFilter,
    ccResultFilter,
    ccSearch,
  ]);
  useEffect(() => {
    persist();
  }, [activePgn]);
  useEffect(() => {
    const save = () => persist();
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", save);
    return () => {
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", save);
    };
  }, []);
  const openSavedReview = (saved: ReviewSession) => {
    generation.current++;
    controller.current?.abort();
    setRunning(false);
    setIsPlaying(false);
    const parsed = parseGame(saved.pgn);
    const reuse = sameOptions(saved.options, analysisOptions);
    resumePending.current = saved.running || !reuse;
    automaticJob.current =
      reuse && !saved.running
        ? { game: parsed, options: analysisOptions }
        : null;
    setGame(parsed);
    setActivePgn(saved.pgn);
    setPgn(saved.pgn);
    setPly(saved.ply);
    setFlipped(saved.flipped);
    setEvaluations(reuse ? saved.evaluations : {});
    setResultOptions(analysisOptions);
    const restoredLine = restoredAlternative(
      parsed.fens[Math.max(0, saved.ply - 1)],
      saved.evaluations[Math.max(0, saved.ply - 1)],
      saved.branch,
      saved.alternativeCursor,
    );
    setAlternativeIndex(restoredLine.index);
    setAlternativeStep(restoredLine.step);
    setBranch(saved.branch);
    setBranchMove(saved.branchMove);
    setBranchCaptures(saved.branchCaptures);
    setBetterMovesOpen(saved.betterMovesOpen);
    setSelected(null);
    setError("");
    setMobileView("review");
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
          {
            duration:
              document
                .querySelector(".app")
                ?.getAttribute("data-replay-scrubbing") === "true"
                ? 180
                : 420,
            easing: "cubic-bezier(.22,.7,.25,1)",
          },
        ),
      );
    }
    return () => animations.forEach((a) => a.cancel());
  }, [ply, game, branch, flipped, touchPreferences.reducedMotion]);
  useEffect(() => {
    const pane = document.querySelector<HTMLElement>(".review-content");
    const selectedMove = pane?.querySelector<HTMLElement>(
      ".moves button.current",
    );
    if (!pane) return;
    if (betterMovesOpen) {
      pane.scrollTop = 0;
      return;
    }
    if (!selectedMove) {
      pane.scrollTop = 0;
      return;
    }
    const row = selectedMove.getBoundingClientRect(),
      area = pane.getBoundingClientRect();
    pane.scrollTo({
      top:
        pane.scrollTop +
        row.top -
        area.top -
        (pane.clientHeight - row.height) / 2,
      behavior:
        touchPreferences.reducedMotion ||
        matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
    });
  }, [
    ply,
    betterMovesOpen,
    criticalOnly,
    mobileView,
    touchPreferences.reducedMotion,
  ]);
  useEffect(() => {
    if (!betterMovesOpen) return;
    const pane = document.querySelector<HTMLElement>(".review-content");
    const chip = pane?.querySelector<HTMLElement>(
      '.pv-chip[aria-current="step"]',
    );
    if (!pane || !chip) return;
    const rect = chip.getBoundingClientRect(),
      area = pane.getBoundingClientRect();
    if (rect.top < area.top || rect.bottom > area.bottom)
      pane.scrollTo({
        top: pane.scrollTop + rect.top - area.top - pane.clientHeight / 2,
        behavior: touchPreferences.reducedMotion ? "instant" : "smooth",
      });
  }, [
    betterMovesOpen,
    alternativeIndex,
    alternativeStep,
    touchPreferences.reducedMotion,
  ]);
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
  const displayedEvaluation = betterMovesOpen
    ? variationAfter
    : branch
      ? undefined
      : current;
  const score =
    displayedEvaluation?.mate !== undefined
      ? `M${displayedEvaluation.mate}`
      : displayedEvaluation
        ? `${displayedEvaluation.cp >= 0 ? "+" : ""}${(displayedEvaluation.cp / 100).toFixed(2)}`
        : "—";
  const displayedMove = branch ? branchMove : move;
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
        setBetterMovesOpen(false);
        setBranch(board.fen());
        setBranchMove({ from: m.from, to: m.to });
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
  const replayNavigation = (
    <ReplayNavigation
      ply={betterMovesOpen ? alternativeStep : ply}
      moves={
        betterMovesOpen
          ? activeAlternative?.moves.map((m) => m.san) || []
          : game.moves.map((m) => m.san)
      }
      variationLabel={
        betterMovesOpen
          ? `Variation ${alternativeIndex + 1}/${alternativeLines.length} · ${alternativeStep}/${activeAlternative?.moves.length || 0}`
          : undefined
      }
      branch={!!branch}
      playing={isPlaying}
      arrows={arrowsEnabled}
      running={running}
      complete={complete}
      focused={boardFocused}
      onFocus={() => setBoardFocused(!boardFocused)}
      sounds={touchPreferences.sounds}
      haptics={touchPreferences.haptics}
      onLearn={() => selectMobileView("learn")}
      onDetails={() => {
        setIsPlaying(false);
        setDetailsOpen(true);
      }}
      onNavigate={navigateReview}
      onReturn={() => navigate(ply)}
      onFlip={() => setFlipped(!flipped)}
      onArrows={() => setArrowsEnabled(!arrowsEnabled)}
      onPlay={() => {
        if (betterMovesOpen) {
          setIsPlaying(!isPlaying);
          return;
        }
        setBranch(null);
        setBetterMovesOpen(false);
        setBranchCaptures(null);
        setSelected(null);
        setIsPlaying(!isPlaying);
      }}
      betterAvailable={alternativeLines.length > 0}
      betterOpen={betterMovesOpen}
      onBetter={() => {
        setIsPlaying(false);
        selectAlternative(
          betterMovesOpen
            ? (alternativeIndex + 1) % alternativeLines.length
            : 0,
          1,
        );
        setBetterMovesOpen(true);
      }}
      onSeek={seekMistake}
      onAnalyse={
        running ? () => controller.current?.abort() : () => start(complete)
      }
    />
  );
  return (
    <div
      className={`app review-layout ${touchPreferences.reducedMotion ? "reduce-motion" : ""}`}
      data-current-ply={ply}
      data-alternatives={betterMovesOpen}
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
                      : mobileView === "learn"
                        ? "Turn your games into lessons."
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
            </div>
            <div className="board-wrap">
              <div
                className="eval-bar"
                aria-label={`White evaluation ${score}`}
              >
                <div
                  style={{
                    height: `${displayedEvaluation ? 50 + 45 * Math.tanh(displayedEvaluation.cp / 400) : 50}%`,
                  }}
                />
              </div>
              <div className="board-container">
                <BoardArrows
                  bestMoveUci={
                    betterMovesOpen
                      ? activeAlternative?.moves[alternativeStep]?.uci
                      : current?.best
                  }
                  playedMoveUci={
                    branch ? undefined : move ? uci(ply - 1) : undefined
                  }
                  grade={currentGrade}
                  flipped={flipped}
                  enabled={arrowsEnabled && (!branch || betterMovesOpen)}
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
                        className={`square ${(file + rank) % 2 ? "light" : "dark"} ${displayedMove?.from === square || displayedMove?.to === square ? "last" : ""} ${selected === square ? "selected" : ""} ${displayedMove?.from === square ? "move-origin" : ""} ${displayedMove?.to === square ? "move-destination" : ""}`}
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
                        {betterMovesOpen &&
                          variationMove?.to === square &&
                          variationGrade &&
                          boardPreferences.badges && (
                            <BoardMoveBadge
                              grade={variationGrade}
                              accuracy={variationAccuracy}
                            />
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
            </div>
            <div className="board-analysis">
              {" "}
              <div className="board-analysis-status">
                <span className="sr-only" role="status">
                  {running
                    ? `Analysing · ${analysed}/${game.fens.length}`
                    : complete
                      ? "Analysis complete"
                      : analysed
                        ? "Analysis stopped · partial results"
                        : error
                          ? "Analysis unavailable"
                          : automaticJob.current?.game === game
                            ? "Analysis stopped"
                            : "Preparing analysis…"}
                </span>
                {running && (
                  <button
                    aria-label="Stop analysis"
                    title="Stop analysis"
                    onClick={() => controller.current?.abort()}
                  >
                    ■
                  </button>
                )}
              </div>
              <div
                className={`progress board-analysis-progress ${running ? "" : "sr-only"}`}
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
            </div>
            {boardFocused && replayNavigation}
            <p className="board-hint">
              Use ← → to replay. Select a piece to explore legal moves.
            </p>
          </section>
          <aside className="unified-review" aria-label="Move review">
            <div className="review-toolbar">
              {running && (
                <AnalysisStatus
                  options={resultOptions}
                  completed={analysed}
                  total={game.fens.length}
                  download={analysisDownload}
                  {...analysisRun}
                />
              )}
              {!boardFocused && replayNavigation}
              {branch && (
                <div className="variation-label" role="status">
                  <span>Alternative preview</span>
                  {betterMovesOpen && (
                    <>
                      {" "}
                      · Variation {alternativeIndex + 1}/
                      {alternativeLines.length} · Move {alternativeStep}/
                      {activeAlternative?.moves.length || 0}
                      <div>
                        {variationMove?.san || "Starting position"} ·{" "}
                        {variationAccuracy === null
                          ? "Accuracy pending"
                          : "Accuracy " +
                            variationAccuracy +
                            "% · " +
                            variationGrade}
                        {variationAfter
                          ? " · Eval " +
                            (variationAfter.mate !== undefined
                              ? "M" + variationAfter.mate
                              : (variationAfter.cp / 100).toFixed(2)) +
                            " (White) · Depth " +
                            variationAfter.depth
                          : ""}
                      </div>
                      <small>{variationStatus}</small>
                    </>
                  )}
                </div>
              )}
              {branch && (
                <button
                  className="return-game"
                  onClick={() => {
                    setBranch(null);
                    setBranchCaptures(null);
                    setBetterMovesOpen(false);
                    setSelected(null);
                  }}
                >
                  Return to game
                </button>
              )}
              {error && (
                <p className="review-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div
              className={`review-body ${betterMovesOpen ? "show-alternatives" : "show-moves"}`}
            >
              <div
                className="review-content"
                tabIndex={0}
                aria-label="Review content"
              >
                {betterMovesOpen ? (
                  <div className="evaluation alternatives-view">
                    {" "}
                    <BetterMoves
                      open={betterMovesOpen}
                      evaluation={alternativeEvaluation}
                      fen={alternativeRoot}
                      played={move?.san}
                      active={alternativeIndex}
                      step={alternativeStep}
                      evaluations={variationEvaluations}
                      onSelect={selectAlternative}
                    />{" "}
                  </div>
                ) : (
                  <>
                    {" "}
                    <section className="panel review">
                      <div className="tabs move-list-heading">
                        <h2>Moves</h2>
                        <button
                          type="button"
                          className={`filter-critical-toggle ${criticalOnly ? "active" : ""}`}
                          onClick={() => setCriticalOnly(!criticalOnly)}
                          aria-pressed={criticalOnly}
                        >
                          Critical only
                        </button>
                        <span>{game.headers.Result || "*"}</span>
                      </div>

                      <>
                        {criticalOnly &&
                          !game.moves.some((_, i) =>
                            isCriticalGrade(grade(i)),
                          ) && (
                            <p className="review-empty">
                              {complete
                                ? "No critical moves in this game."
                                : "No critical moves found yet. Analysis results appear here as they arrive."}
                            </p>
                          )}
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
                                    const index =
                                      row * 2 + offset - initialBlack;
                                    const m = game.moves[index];
                                    if (!m)
                                      return <span key={`empty-${offset}`} />;
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
                                        className={
                                          ply === index + 1 ? "current" : ""
                                        }
                                        onClick={() => {
                                          touchTick(touchPreferences.haptics);
                                          navigate(index + 1);
                                        }}
                                        aria-label={`${m.color === "w" ? "White" : "Black"} ${m.san}${g ? `, ${g}` : ""}`}
                                      >
                                        <span className="move-cell">
                                          <strong>{m.san}</strong>
                                          <small className="move-accuracy">
                                            {pct === null
                                              ? "Pending"
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
                    </section>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
        {mobileView === "learn" && (
          <LearningHub
            session={session}
            onSelect={(next) => {
              navigate(next);
              selectMobileView("review");
            }}
          />
        )}
        {mobileView === "insights" && (
          <WeaknessDashboard onOpen={openSavedReview} />
        )}
        <div className="insights-heading">
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
        <section className="panel game-summary-panel" aria-label="Game summary">
          <h2>Game summary</h2>{" "}
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
                    <small>{color === "w" ? "White" : "Black"} accuracy</small>
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
                <span className={`badge ${label.toLowerCase()}`}>{label}</span>
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
              expected-point loss, not official Chess.com or FIDE ratings.
            </p>
          </div>
        </section>
        <EvalGraph
          evaluations={evaluations}
          moves={game.moves}
          currentPly={ply}
          grades={allGrades}
          onSelectPly={(next) => {
            navigate(next);
            selectMobileView("review");
          }}
        />
        {mobileView === "games" && (
          <SavedGames
            current={session}
            onOpen={openSavedReview}
            onError={setStorageError}
          />
        )}
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

          <div className="game-cache-controls">
            <small>
              Fetched games are saved on this device when storage is available.
              Recent results are reused for 15 minutes; saved games stay
              available offline.
            </small>
            {ccPlayer && (
              <button
                type="button"
                disabled={ccLoading}
                onClick={() => loadChessComUser(ccPlayer.username, true)}
              >
                Refresh games
              </button>
            )}
            {ccPlayer && (
              <button
                type="button"
                disabled={ccLoading}
                onClick={() => {
                  clearGameCache();
                  setCcCacheInfo("");
                  setCcPlayer(null);
                  setCcArchives([]);
                  setCcSelectedArchive("");
                  setCcGames([]);
                  setCcError("");
                }}
              >
                Clear fetched games
              </button>
            )}
          </div>
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

          {ccCacheInfo && ccPlayer && (
            <p className="muted" role="status">
              {ccCacheInfo}
            </p>
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
                    disabled={ccLoading}
                    onClick={() => changeArchive(ccSelectedArchive, true)}
                  >
                    Refresh month
                  </button>
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
        {error && mobileView !== "review" && (
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
            disabled={false}
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
        {storageError && (
          <div className="error storage-warning" role="alert">
            {storageError}
            <button onClick={() => setStorageError("")}>Dismiss</button>
          </div>
        )}
        {mobileView === "settings" && (
          <section className="panel">
            <h2>Device storage</h2>
            <p role="status">
              {storageError
                ? "Some changes could not be saved. See the storage warning."
                : "Preferences save automatically on this device."}
            </p>
            <p className="muted">
              Settings and reviews are saved automatically on this browser.
              Saved games are separate from fetched-game caches.
            </p>
            <button
              onClick={() => {
                updateBoardPreferences({
                  theme: "classic",
                  badges: true,
                  pieceFinish: "sculpted",
                });
                updateTouchPreferences({
                  haptics: false,
                  sounds: true,
                  reducedMotion: false,
                });
                changeAnalysisOptions(defaultOptions);
                setFlipped(false);
                setArrowsEnabled(true);
                setCriticalOnly(false);
                setNotice("Settings reset. Saved games kept.");
              }}
            >
              Reset settings
            </button>
            <button
              onClick={async () => {
                if (
                  !window.confirm(
                    "Delete all saved games from this device? Your active review and settings will be kept.",
                  )
                )
                  return;
                try {
                  await clearSavedGames();
                  setNotice("Saved library cleared. Current review kept.");
                } catch {
                  setStorageError("Could not clear saved games.");
                }
              }}
            >
              Clear saved library
            </button>
          </section>
        )}
        <footer>
          <span>◈ ChessLens · See your game differently.</span>
          <details>
            <summary>Engine, licenses & methodology</summary>
            <p>
              Stockfish.js 19.0.1 by Nathan Rugg, Chess.com and the Stockfish
              contributors. Unmodified Lite and Full single-thread WebAssembly
              builds. GPLv3. No warranty.
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
      <MoveDetails open={detailsOpen} onClose={() => setDetailsOpen(false)}>
        <p className="eyebrow">
          POSITION DETAILS · {resultOptions.engine.name}
        </p>
        <div className="eval-number">
          {branch ? "—" : score}
          <span>
            {branch
              ? "Variation · not analysed"
              : current?.mate !== undefined
                ? "Forced mate"
                : "White’s evaluation"}
          </span>
        </div>
        {current && !branch && (
          <p>
            Depth {current.depth}
            {current.cached ? " · cached" : ""}
          </p>
        )}
        {!branch && move && current && previous && (
          <>
            <p>
              {Math.round(
                reviewLoss(previous, current, move.color === "w", uci(ply - 1)),
              )}{" "}
              cp lost ·{" "}
              {(
                100 *
                expectedPointLoss(
                  previous,
                  current,
                  move.color === "w",
                  uci(ply - 1),
                )
              ).toFixed(1)}
              % expected-point loss
            </p>
            <p>{tacticalDesc?.detail}</p>
          </>
        )}
        {current && !branch && (
          <p>
            From this position: <strong>{bestSan()}</strong>
          </p>
        )}
        {pvMoves.length > 0 && !branch && (
          <p className="pv-line">
            {pvMoves.map((pv, i) => (
              <span key={i} className="pv-chip">
                {pv.moveNum ? pv.moveNum + "." : ""}
                {pv.san}
              </span>
            ))}
          </p>
        )}
      </MoveDetails>
      <MobileNavigation
        view={mobileView}
        onSelect={selectMobileView}
        running={running}
      />
    </div>
  );
}
const root = createRoot(document.getElementById("root")!);
root.render(
  <p role="status" style={{ padding: 24 }}>
    Restoring your review…
  </p>,
);
void loadReview().then(({ session, warning }) => {
  root.render(
    <React.StrictMode>
      <App restored={session} storageWarning={warning} />
    </React.StrictMode>,
  );
});
if ("serviceWorker" in navigator && import.meta.env.PROD)
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
  });
