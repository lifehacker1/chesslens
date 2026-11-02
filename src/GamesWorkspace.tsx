import {
  fetchRecentGames,
  readRecentPlayers,
  rememberPlayer,
} from "./recentGames";
import { saveFilteredGames } from "./filteredGames";
import { GameIcon } from "./GameIcon";
import { readPgnDraft, storePgnDraft, PGN_DRAFT_LIMIT } from "./pgnDraft";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { parseGame, demo } from "./game";
import {
  canonicalPgn,
  getSavedGame,
  deleteSavedGame,
  exportPgn,
  saveGame,
  replaceSavedGame,
  type ReviewSession,
  type SavedGame,
} from "./reviewStorage";
import { formatResult, formatTimeControl, type ChessComGame } from "./chesscom";
import {
  analyseCollection,
  collections,
  downloadCollection,
  downloadFile,
  newSession,
  removeCollection,
  type Collection,
} from "./archiveLibrary";
import { headers, useLibrary } from "./useLibrary";
import { isDraft, usePreference, readLegacyUsername } from "./preferences";
import type { AnalysisOptions } from "./engine";
import "./games.css";
function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      className="games-dialog"
      ref={ref}
      aria-label={title}
      onCancel={onClose}
    >
      <div className="games-heading">
        <h2>{title}</h2>
        <button aria-label={"Close " + title} onClick={onClose}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
const positionCounts = new Map<string, number>();
function gameStatus(session: ReviewSession) {
  const count = Object.keys(session.evaluations).length,
    total =
      positionCounts.get(session.pgn) ?? parseGame(session.pgn).fens.length;
  if (positionCounts.size > 3000) positionCounts.clear();
  positionCounts.set(session.pgn, total);
  return count >= total
    ? "Analysed"
    : count
      ? "Partial · " + count + "/" + total
      : "Not analysed";
}
export function GamesWorkspace({
  current,
  onOpen,
  onImport,
  options,
  running,
  onActivity,
}: {
  current: ReviewSession;
  onOpen: (s: ReviewSession) => void;
  onImport: (pgn: string, source: "pgn" | "chesscom") => void;
  options: AnalysisOptions;
  running: boolean;
  onActivity?: (busy: boolean) => void;
}) {
  const library = useLibrary(),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [section, setSection] = usePreference(
    "chesslens-games-section",
    "library",
    (v): v is string =>
      typeof v === "string" && ["library", "chesscom", "downloads"].includes(v),
    setError,
  );
  const [query, setQuery] = usePreference(
      "chesslens-library-query",
      "",
      isDraft,
      setError,
    ),
    [filter, setFilter] = usePreference(
      "chesslens-library-filter",
      "all",
      isDraft,
      setError,
    ),
    [sort, setSort] = usePreference(
      "chesslens-library-sort",
      "recent",
      isDraft,
      setError,
    );
  const [collectionFilter, setCollectionFilter] = usePreference(
    "chesslens-library-collection",
    "all",
    isDraft,
    setError,
  );
  useEffect(() => {
    if (!["all", "analysed", "pending"].includes(filter)) {
      setCollectionFilter(filter);
      setFilter("all");
    }
  }, [filter]);
  const [username, setUsername] = usePreference(
    "chesslens-games-username",
    readLegacyUsername(),
    isDraft,
    setError,
  );
  const [recentPlayers, setRecentPlayers] = useState(readRecentPlayers);
  const locatedCurrent = useRef(false);
  const [online, setOnline] = useState<ChessComGame[]>([]),
    [profile, setProfile] = useState(""),
    [onlineBusy, setOnlineBusy] = useState(false),
    [onlineError, setOnlineError] = useState("");
  const [onlineQuery, setOnlineQuery] = usePreference(
      "chesslens-online-query",
      "",
      isDraft,
      setError,
    ),
    [speed, setSpeed] = usePreference(
      "chesslens-online-speed",
      "all",
      isDraft,
      setError,
    ),
    [outcome, setOutcome] = usePreference(
      "chesslens-online-outcome",
      "all",
      isDraft,
      setError,
    );
  const [limit, setLimit] = useState(30),
    [importOpen, setImportOpen] = useState(false),
    [draft, setDraft] = useState(readPgnDraft),
    [importError, setImportError] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const selectedGames = library.games.filter((g) => selection.includes(g.id));
  function changeDraft(value: string) {
    setDraft(value);
    try {
      storePgnDraft(value);
      setImportError("");
    } catch (e) {
      setImportError(
        e instanceof Error
          ? e.message
          : "Draft could not be saved. Keep a copy before reloading.",
      );
    }
  }
  const [rename, setRename] = useState<SavedGame | null>(null),
    [name, setName] = useState(""),
    [undo, setUndo] = useState<SavedGame | null>(null);
  const [downloads, setDownloads] = useState<Collection[]>([]),
    [job, setJob] = useState(""),
    [progress, setProgress] = useState(""),
    [remove, setRemove] = useState<Collection | null>(null),
    [busy, setBusy] = useState(false);
  const onlineController = useRef<AbortController | null>(null);
  const abort = useRef<AbortController | null>(null),
    alive = useRef(true),
    request = useRef(0);
  useEffect(() => {
    alive.current = true;
    void collections()
      .then(setDownloads)
      .catch(() => setError("Download records could not be loaded."));
    return () => {
      alive.current = false;
      abort.current?.abort();
      onlineController.current?.abort();
      request.current++;
    };
  }, []);
  useEffect(() => {
    onActivity?.(!!job || onlineBusy);
    return () => onActivity?.(false);
  }, [job, onlineBusy, onActivity]);
  useLayoutEffect(() => {
    const key = "chesslens-games-scroll-" + section;
    let timer: ReturnType<typeof setTimeout>;
    const frame = requestAnimationFrame(() =>
      window.scrollTo({
        top: (() => {
          try {
            return Number(sessionStorage.getItem(key) || 0);
          } catch {
            return 0;
          }
        })(),
        behavior: "instant",
      }),
    );
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          sessionStorage.setItem(key, String(scrollY));
        } catch {}
      }, 150);
    };
    window.addEventListener("scroll", save, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      window.removeEventListener("scroll", save);
    };
  }, [section]);
  useEffect(
    () => setLimit(30),
    [
      query,
      filter,
      collectionFilter,
      sort,
      onlineQuery,
      speed,
      outcome,
      section,
    ],
  );
  async function action(work: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    try {
      await work();
      setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this change.");
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const currentId = useMemo(() => canonicalPgn(current.pgn), [current.pgn]);
  const currentSaved = library.games.find((g) => g.id === currentId),
    currentHeaders = headers(current.pgn);
  const rows = useMemo(
    () =>
      library.games
        .map((g) => ({
          g,
          h: headers(g.session.pgn),
          status: gameStatus(g.session),
        }))
        .filter(
          ({ g, h, status }) =>
            (!query ||
              [g.name, h.White, h.Black, h.ECO, h.Event]
                .join(" ")
                .toLowerCase()
                .includes(query.toLowerCase())) &&
            (filter === "all" ||
              (filter === "analysed" && status === "Analysed") ||
              (filter === "pending" && status !== "Analysed")) &&
            (collectionFilter === "all" ||
              g.collections?.includes(collectionFilter)),
        )
        .sort((a, b) =>
          sort === "oldest"
            ? a.g.session.updatedAt - b.g.session.updatedAt
            : sort === "played"
              ? (b.g.playedAt || 0) - (a.g.playedAt || 0)
              : b.g.session.updatedAt - a.g.session.updatedAt,
        ),
    [library.games, query, filter, collectionFilter, sort],
  );
  const reviewCounts = useMemo(() => {
    let complete = 0,
      partial = 0;
    for (const g of library.games) {
      if (gameStatus(g.session) === "Analysed") complete++;
      else if (Object.keys(g.session.evaluations).length) partial++;
    }
    return {
      complete,
      partial,
      pending: library.games.length - complete - partial,
      percent: library.games.length
        ? Math.round((100 * complete) / library.games.length)
        : 0,
    };
  }, [library.games]);
  const onlineIds = useMemo(
    () =>
      new Map(
        online.map((game) => {
          try {
            return [game.url, canonicalPgn(game.pgn)] as const;
          } catch {
            return [game.url, ""] as const;
          }
        }),
      ),
    [online],
  );
  const visibleOnline = online.filter(
    (g) =>
      (speed === "all" || g.time_class === speed) &&
      (outcome === "all" || formatResult(g, profile).outcome === outcome) &&
      (!onlineQuery ||
        [g.white.username, g.black.username, g.eco]
          .join(" ")
          .toLowerCase()
          .includes(onlineQuery.toLowerCase())),
  );
  function changeUsername(value: string) {
    onlineController.current?.abort();
    request.current++;
    setOnlineBusy(false);
    setUsername(value);
    setProfile("");
    setOnline([]);
    setOnlineQuery("");
    setSpeed("all");
    setOutcome("all");
    setOnlineError("");
  }
  async function fetchGames(refresh = false) {
    if (job || onlineBusy) return;
    const id = ++request.current;
    const controller = new AbortController();
    onlineController.current?.abort();
    onlineController.current = controller;
    setOnlineBusy(true);
    setOnlineError("");
    try {
      const user = username.trim().toLowerCase();
      if (!user) throw new Error("Enter a Chess.com username.");
      const games = await fetchRecentGames(user, refresh, controller.signal);
      if (id !== request.current) return;
      setOnline(games);
      setProfile(user);
      try {
        localStorage.setItem("chesslens_cc_user", user);
        setRecentPlayers(rememberPlayer(user));
      } catch {
        setError("Player history could not be saved on this device.");
      }
      if (!games.length) setOnlineError("No archived standard games found.");
    } catch (e) {
      if (id === request.current)
        setOnlineError(
          e instanceof Error ? e.message : "Could not fetch games.",
        );
    } finally {
      if (id === request.current) setOnlineBusy(false);
    }
  }
  useEffect(() => {
    if (section === "downloads") setSection("library");
    if (section === "chesscom" && username && !profile) void fetchGames();
  }, [section]);
  useEffect(() => {
    locatedCurrent.current = false;
  }, [section, currentId]);
  useEffect(() => {
    if (library.loading || onlineBusy || locatedCurrent.current) return;
    const index =
      section === "library"
        ? rows.findIndex(({ g }) => g.id === currentId)
        : visibleOnline.findIndex((g) => onlineIds.get(g.url) === currentId);
    if (index < 0) return;
    if (index >= limit) {
      setLimit(Math.ceil((index + 1) / 30) * 30);
      return;
    }
    const frame = requestAnimationFrame(() => {
      const card = document.querySelector<HTMLElement>(".game-row.is-current");
      if (card) {
        card.scrollIntoView({ block: "center", behavior: "instant" });
        locatedCurrent.current = true;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [
    section,
    library.loading,
    onlineBusy,
    rows,
    visibleOnline,
    currentId,
    limit,
  ]);
  async function filteredAction(analyseGames: boolean) {
    if (job || onlineBusy) return;
    const controller = new AbortController();
    abort.current = controller;
    setJob("filtered");
    setNotice("");
    setProgress(
      analyseGames ? "Preparing analysis..." : "Saving filtered games...",
    );
    setError("");
    try {
      await saveFilteredGames(
        [...visibleOnline],
        options,
        analyseGames,
        controller.signal,
        (text) => {
          if (alive.current) setProgress(text);
        },
      );
      setNotice(
        analyseGames
          ? "Filtered games analysed and saved in Library."
          : "Filtered games saved in Library.",
      );
    } catch (e) {
      if (alive.current)
        setError(
          controller.signal.aborted
            ? "Stopped. Completed analysis is saved."
            : e instanceof Error
              ? e.message
              : "Could not save games.",
        );
    } finally {
      if (alive.current) setJob("");
      abort.current = null;
    }
  }
  async function runJob(kind: "download" | "analyse", collection?: Collection) {
    if (job || onlineBusy) return;
    const controller = new AbortController();
    abort.current = controller;
    setJob(kind);
    setError("");
    setProgress(
      kind === "download" ? "Fetching archive list…" : "Preparing analysis…",
    );
    let failed = false;
    try {
      if (kind === "download")
        await downloadCollection(
          collection?.username || username,
          options,
          controller.signal,
          (c) => {
            if (alive.current) {
              setProgress(
                c.finished.length +
                  "/" +
                  c.archives.length +
                  " months downloaded",
              );
              setDownloads((prev) => [c, ...prev.filter((x) => x.id !== c.id)]);
            }
          },
        );
      else if (collection)
        await analyseCollection(collection, options, controller.signal, (m) => {
          if (alive.current) setProgress(m);
        });
    } catch (e) {
      failed = true;
      if (alive.current)
        setError(
          e instanceof Error ? e.message : "Job failed. Progress is saved.",
        );
    } finally {
      if (alive.current) {
        try {
          setDownloads(await collections());
        } catch {
          failed = true;
          setError("Could not refresh download records. Retry from Library.");
        }
        setJob("");
        setProgress(
          controller.signal.aborted
            ? "Paused. Resume when ready."
            : failed
              ? "Job could not finish. Saved progress is kept."
              : "Job finished.",
        );
      }
      abort.current = null;
    }
  }
  function importPgn(text: string) {
    try {
      parseGame(text);
      changeDraft("");
      setImportError("");
      setImportOpen(false);
      onImport(text, "pgn");
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Invalid PGN.");
    }
  }
  async function exportCollection(c: Collection, backup = false) {
    const games = library.games.filter((g) => g.collections?.includes(c.id));
    downloadFile(
      c.username + (backup ? "-backup.json" : "-games.pgn"),
      backup
        ? JSON.stringify({ version: 1, collection: c, games }, null, 2)
        : games.map((g) => g.session.pgn).join("\n\n"),
      backup ? "application/json" : "application/x-chess-pgn",
    );
  }
  return (
    <div className="games-workspace">
      <div className="games-heading">
        <div>
          <h1>Games</h1>
          <small>Your local library and downloads</small>
        </div>
        <button
          className="primary"
          onClick={() => {
            setImportError("");
            setImportOpen(true);
          }}
        >
          Import PGN
        </button>
      </div>
      <div className="games-tabs" role="group" aria-label="Games sections">
        {[
          ["library", "Library"],
          ["chesscom", "Chess.com"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={section === id}
            onClick={() => {
              setSection(id);
              setNotice("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {(error || library.error) && (
        <p role="alert">
          {error || library.error}{" "}
          <button
            onClick={() =>
              window.dispatchEvent(new Event("chesslens-library-changed"))
            }
          >
            Retry library
          </button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {section === "library" && (
        <section aria-label="Saved games">
          {!currentSaved && (
            <div className="continue-card saved-game-current">
              <div>
                <small>
                  {current.pgn.trim() === demo.trim()
                    ? "Sample review"
                    : currentSaved
                      ? "Current review · Saved"
                      : "Current review · Not saved"}
                </small>
                <strong>
                  {currentHeaders.White || "White"} vs{" "}
                  {currentHeaders.Black || "Black"}
                </strong>
                <small>
                  {current.ply
                    ? "Move " + Math.ceil(current.ply / 2)
                    : "Starting position"}{" "}
                  · {gameStatus(current)}
                </small>
              </div>
              <div className="games-actions">
                <button onClick={() => onOpen(current)}>
                  Continue reviewing
                </button>
                <button
                  aria-label="Save game"
                  title="Save game"
                  disabled={busy}
                  onClick={() =>
                    void action(
                      () => saveGame(current),
                      "Game saved. Saving again updates this game.",
                    )
                  }
                >
                  <GameIcon name="save" />
                </button>
              </div>
            </div>
          )}
          <div className="library-heading">
            <div>
              <h2>Your library</h2>
              <p>Saved on this device. Analysis is saved automatically.</p>
            </div>
          </div>
          <section
            className="library-review-progress"
            aria-label="Library review progress"
          >
            <div>
              <strong>{reviewCounts.percent}% reviewed</strong>
              <span>
                {reviewCounts.complete} of {library.games.length} games fully
                analysed
              </span>
            </div>
            <div
              className="review-segments"
              role="img"
              aria-label={
                reviewCounts.complete +
                " fully analysed, " +
                reviewCounts.partial +
                " partially analysed, " +
                reviewCounts.pending +
                " not analysed"
              }
            >
              <span
                className="review-complete"
                style={{
                  width:
                    (100 * reviewCounts.complete) /
                      (library.games.length || 1) +
                    "%",
                }}
              />
              <span
                className="review-partial"
                style={{
                  width:
                    (100 * reviewCounts.partial) / (library.games.length || 1) +
                    "%",
                }}
              />
            </div>
            <small>
              <span className="review-complete-text">
                {reviewCounts.complete} complete
              </span>{" "}
              /{" "}
              <span className="review-partial-text">
                {reviewCounts.partial} partial
              </span>{" "}
              / {reviewCounts.pending} not analysed
            </small>
          </section>
          <div className="games-toolbar">
            <input
              aria-label="Search saved games"
              placeholder="Search players, openings, event…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <details>
              <summary>Filters & sort</summary>
              <label>
                Status
                <select
                  aria-label="Library status"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All games</option>
                  <option value="analysed">Analysed</option>
                  <option value="pending">Needs analysis</option>
                </select>
              </label>
              <label>
                Collection
                <select
                  aria-label="Library collection"
                  value={collectionFilter}
                  onChange={(e) => setCollectionFilter(e.target.value)}
                >
                  <option value="all">All collections</option>
                  {downloads.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.username}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sort
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="recent">Recently reviewed</option>
                  <option value="played">Date played</option>
                  <option value="oldest">Oldest review</option>
                </select>
              </label>
            </details>
            <button
              aria-label={
                selecting ? "Export selected PGN" : "Export filtered PGN"
              }
              title={
                selecting
                  ? "Export selected games as PGN"
                  : "Export matching games as PGN"
              }
              disabled={selecting ? !selectedGames.length : !rows.length}
              onClick={() =>
                downloadFile(
                  "chesslens-library.pgn",
                  (selecting ? selectedGames : rows.map(({ g }) => g))
                    .map((g) => g.session.pgn)
                    .join("\n\n"),
                  "application/x-chess-pgn",
                )
              }
            >
              <GameIcon name="export" />
            </button>
          </div>
          {(query || filter !== "all" || collectionFilter !== "all") && (
            <div className="library-filter-summary">
              <span>
                {query ? `Search: ${query}` : "Filtered library"}{" "}
                {filter !== "all"
                  ? ` / ${filter === "analysed" ? "Analysed" : "Needs analysis"}`
                  : ""}
                {collectionFilter !== "all" ? ` / ${collectionFilter}` : ""}
              </span>
              <button
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                  setCollectionFilter("all");
                }}
              >
                Reset library filters
              </button>
            </div>
          )}
          <p className="muted" role="status">
            {library.loading
              ? "Loading library…"
              : `${rows.length} of ${library.games.length} games`}
          </p>
          {!library.loading && !library.games.length && (
            <p>
              No saved games yet. Save the current review above, or{" "}
              <button onClick={() => setImportOpen(true)}>
                Import your first game
              </button>
              .
            </p>
          )}
          {!library.loading && library.games.length > 0 && !rows.length && (
            <p>
              No matches.{" "}
              <button
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                  setCollectionFilter("all");
                }}
              >
                Clear filters
              </button>
            </p>
          )}
          <button
            disabled={!library.games.length}
            aria-pressed={selecting}
            onClick={() => {
              setSelecting(!selecting);
              setSelection([]);
            }}
          >
            {selecting ? "Done selecting" : "Select games"}
          </button>
          {selecting && (
            <div className="library-selection" aria-label="Game selection">
              <span>{selectedGames.length} selected</span>
              <button
                disabled={!rows.length}
                onClick={() =>
                  setSelection((prev) => [
                    ...new Set([...prev, ...rows.map(({ g }) => g.id)]),
                  ])
                }
              >
                Select all matching ({rows.length})
              </button>

              {selectedGames.length > 0 && (
                <button onClick={() => setSelection([])}>
                  Clear selection
                </button>
              )}
            </div>
          )}
          <div className="games-list">
            {rows.slice(0, limit).map(({ g, h, status }) => (
              <article
                className={
                  "game-row saved-game-card" +
                  (g.id === currentId ? " is-current" : "")
                }
                aria-current={g.id === currentId ? "true" : undefined}
                key={g.id}
                aria-label={g.name}
              >
                <div className="game-row-info">
                  {selecting && (
                    <label className="game-select">
                      <input
                        type="checkbox"
                        aria-label={"Select " + g.name}
                        checked={selection.includes(g.id)}
                        onChange={(e) =>
                          setSelection((prev) =>
                            e.target.checked
                              ? [...prev, g.id]
                              : prev.filter((id) => id !== g.id),
                          )
                        }
                      />{" "}
                      Select game
                    </label>
                  )}
                  <strong>{g.name}</strong>
                  {g.name !==
                    `${h.White || "White"} vs ${h.Black || "Black"}` && (
                    <span className="game-players">
                      {h.White || "White"} vs {h.Black || "Black"}
                    </span>
                  )}
                  <small>
                    {h.Result || "*"} · {h.Date || "Date unknown"} ·{" "}
                    {h.TimeControl || g.timeClass || "Imported PGN"}
                  </small>
                  <div
                    className="card-analysis-progress"
                    aria-label="Game analysis progress"
                  >
                    <progress
                      max="100"
                      value={Math.min(
                        100,
                        Math.floor(
                          (100 * Object.keys(g.session.evaluations).length) /
                            (positionCounts.get(g.session.pgn) || 1),
                        ),
                      )}
                      className={status === "Analysed" ? "complete" : "partial"}
                    />
                    <small>
                      {Math.min(
                        100,
                        Math.floor(
                          (100 * Object.keys(g.session.evaluations).length) /
                            (positionCounts.get(g.session.pgn) || 1),
                        ),
                      )}
                      % analysed
                    </small>
                  </div>
                  <small>
                    <span
                      className={
                        status === "Analysed"
                          ? "review-complete-text"
                          : Object.keys(g.session.evaluations).length
                            ? "review-partial-text"
                            : ""
                      }
                    >
                      {status}
                    </span>
                    {g.session.options.engine?.name && status !== "Not analysed"
                      ? " · " + g.session.options.engine.name
                      : ""}
                  </small>
                </div>
                <div className="library-card-actions">
                  {g.id === currentId && (
                    <small className="saved-indicator">Saved</small>
                  )}
                  <button
                    aria-label="Open review"
                    title="Open review"
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        const latest = await getSavedGame(g.id);
                        if (!latest)
                          throw new Error(
                            "This game is no longer saved. Refresh the library.",
                          );
                        if (alive.current) onOpen(latest.session);
                      }, "")
                    }
                  >
                    <GameIcon name="play" />
                  </button>
                  <button
                    aria-label="Export PGN"
                    title="Export PGN"
                    onClick={() => exportPgn(g.session)}
                  >
                    <GameIcon name="export" />
                  </button>
                  <details className="game-menu">
                    <summary aria-label={"Actions for " + g.name}>⋯</summary>
                    <div>
                      <button
                        onClick={() => {
                          setRename(g);
                          setName(g.name);
                        }}
                      >
                        Rename
                      </button>
                      <button
                        onClick={() =>
                          void action(async () => {
                            await deleteSavedGame(g.id);
                            setUndo(g);
                          }, "Game removed. Undo is available.")
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </details>
                </div>
              </article>
            ))}
          </div>
          {rows.length > limit && (
            <button onClick={() => setLimit((n) => n + 30)}>
              Load more saved games
            </button>
          )}
          {undo && (
            <p role="status">
              Removed {undo.name}.{" "}
              <button
                onClick={() =>
                  void action(async () => {
                    await replaceSavedGame(undo);
                    setUndo(null);
                  }, "Game restored.")
                }
              >
                Undo delete
              </button>
            </p>
          )}
        </section>
      )}
      {section === "chesscom" && (
        <section className="games-online" aria-label="Chess.com import">
          <div className="games-toolbar">
            <form
              style={{ display: "contents" }}
              onSubmit={(e) => {
                e.preventDefault();
                void fetchGames(true);
              }}
            >
              <input
                aria-label="Chess.com username"
                placeholder="Chess.com username"
                list="recent-chess-players"
                value={username}
                onChange={(e) => changeUsername(e.target.value)}
                disabled={!!job}
              />
              <datalist id="recent-chess-players">
                {recentPlayers.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <button
                aria-label="Load games"
                title="Load latest games (refresh results)"
                disabled={onlineBusy || !!job || !username.trim()}
              >
                <GameIcon name="search" />
              </button>
            </form>
          </div>
          <div className="games-toolbar">
            <input
              aria-label="Search games"
              placeholder="Opponent or ECO…"
              value={onlineQuery}
              onChange={(e) => setOnlineQuery(e.target.value)}
            />
            <details>
              <summary>Filters</summary>
              <label>
                Speed
                <select
                  value={speed}
                  onChange={(e) => setSpeed(e.target.value)}
                >
                  {["all", "bullet", "blitz", "rapid", "daily"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Result
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                >
                  {["all", "win", "loss", "draw"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            </details>
          </div>
          <div
            className="games-actions filtered-actions"
            aria-label="Filtered game actions"
          >
            <span>{visibleOnline.length} matching games</span>
            <button
              aria-label="Download filtered games"
              title="Save matching games to Library"
              disabled={busy || !!job || onlineBusy || !visibleOnline.length}
              onClick={() => void filteredAction(false)}
            >
              <GameIcon name="save" />
            </button>
            <button
              aria-label="Export filtered games PGN"
              title="Export matching games as PGN"
              disabled={onlineBusy || !visibleOnline.length}
              onClick={() =>
                downloadFile(
                  profile + "-filtered.pgn",
                  visibleOnline.map((g) => g.pgn).join("\n\n"),
                  "application/x-chess-pgn",
                )
              }
            >
              <GameIcon name="export" />
            </button>
            <button
              aria-label="Analyse filtered games"
              title="Analyse and automatically save matching games"
              disabled={running || !!job || onlineBusy || !visibleOnline.length}
              onClick={() => void filteredAction(true)}
            >
              <GameIcon name="analyse" />
              <span>{visibleOnline.length}</span>
            </button>
            {job && (
              <button onClick={() => abort.current?.abort()}>Stop job</button>
            )}
          </div>
          {progress && <p role="status">{progress}</p>}
          {onlineError && (
            <p role="alert">
              {onlineError}{" "}
              <button
                disabled={onlineBusy || !!job}
                onClick={() => void fetchGames(true)}
              >
                Retry fetch
              </button>
            </p>
          )}
          {onlineBusy && <p role="status">Loading games…</p>}
          {!onlineBusy && profile && (
            <p className="muted">
              {visibleOnline.length} of {online.length} recent games (latest
              100). Recent fetched results may be cached
            </p>
          )}
          <div className="games-list">
            {visibleOnline.slice(0, limit).map((g) => {
              const h = headers(g.pgn),
                result = formatResult(g, profile);
              return (
                <article
                  key={g.url}
                  className={
                    "game-row cc-game-card outcome-" +
                    result.outcome +
                    (onlineIds.get(g.url) === currentId ? " is-current" : "")
                  }
                  aria-current={
                    onlineIds.get(g.url) === currentId ? "true" : undefined
                  }
                >
                  <div className="game-row-info">
                    <strong>
                      {g.white.username} vs {g.black.username}
                    </strong>
                    <small>
                      {formatTimeControl(g.time_control, g.time_class)} ·{" "}
                      {new Date(g.end_time * 1000).toLocaleDateString()}
                    </small>
                    <span className={"outcome-badge " + result.outcome}>
                      {result.label}
                      {h.ECO ? " · " + h.ECO : ""}
                    </span>
                  </div>
                  <button
                    className="primary"
                    aria-label="Review game"
                    title="Review game"
                    onClick={() => onImport(g.pgn, "chesscom")}
                  >
                    <GameIcon name="play" />
                  </button>
                  <div className="game-card-actions">
                    <button
                      aria-label="Save game"
                      title="Save game"
                      onClick={() =>
                        void action(
                          () =>
                            saveGame(newSession(g.pgn, options), undefined, {
                              sourceUrl: g.url,
                              playedAt: g.end_time * 1000,
                              timeClass: g.time_class,
                              downloadOnly: false,
                            }),
                          "Game saved.",
                        )
                      }
                    >
                      <GameIcon name="save" />
                    </button>
                    <button
                      aria-label="Export PGN"
                      title="Export PGN"
                      onClick={() =>
                        downloadFile(
                          "game.pgn",
                          g.pgn,
                          "application/x-chess-pgn",
                        )
                      }
                    >
                      <GameIcon name="export" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          {visibleOnline.length > limit && (
            <button onClick={() => setLimit((n) => n + 30)}>
              Load more games
            </button>
          )}
          {!onlineBusy && profile && !visibleOnline.length && (
            <p>No games match these filters.</p>
          )}
          <p className="muted">
            Analysis stays on this device. Fetching contacts Chess.com's public
            API. ChessLens is not affiliated with Chess.com.
          </p>
        </section>
      )}
      {section === "library" && downloads.length > 0 && (
        <section aria-label="Download manager">
          <h2>Saved download collections</h2>
          <p>
            Your existing archives are part of this library. Resume or manage
            them here.
          </p>
          {job && (
            <button onClick={() => abort.current?.abort()}>Pause job</button>
          )}
          {progress && <p role="status">{progress}</p>}
          <p className="muted">
            Analysis uses {options.engine.name}, depth {options.depth},{" "}
            {options.movetime / 1000}s/position. Completed compatible results
            are reused.
          </p>
          {downloads.map((c) => {
            const games = library.games.filter((g) =>
                g.collections?.includes(c.id),
              ),
              done = games.filter(
                (g) => gameStatus(g.session) === "Analysed",
              ).length,
              bytes = new Blob(games.map((g) => g.session.pgn)).size;
            return (
              <article className="download-card" key={c.id}>
                <h3>@{c.username}</h3>
                <p>
                  {games.length} games · {c.finished.length}/{c.archives.length}{" "}
                  months · {done} analysed · {(bytes / 1048576).toFixed(1)} MB
                  PGN
                </p>
                <small>
                  Download:{" "}
                  {c.state === "downloading" && !job ? "paused" : c.state} ·
                  Analysis:{" "}
                  {c.analysis === "running" && !job ? "paused" : c.analysis}
                </small>
                {c.error && <p role="alert">{c.error}</p>}
                {c.skipped > 0 && (
                  <p>
                    {c.skipped} unsupported or unreadable entries encountered.
                  </p>
                )}
                <div className="games-actions">
                  <button
                    disabled={!!job}
                    onClick={() => void runJob("download", c)}
                  >
                    {c.state === "complete"
                      ? "Refresh downloads"
                      : "Resume download"}
                  </button>
                  <button
                    disabled={!!job || running || !games.length}
                    onClick={() => void runJob("analyse", c)}
                  >
                    Analyse downloaded games
                  </button>
                  <button
                    onClick={() => {
                      setCollectionFilter(c.id);
                      setFilter("all");
                      setSection("library");
                    }}
                  >
                    View games
                  </button>
                  <details>
                    <summary>Export / manage</summary>
                    <button onClick={() => void exportCollection(c)}>
                      Export all PGN
                    </button>
                    <button onClick={() => void exportCollection(c, true)}>
                      Export backup JSON
                    </button>
                    <button disabled={!!job} onClick={() => setRemove(c)}>
                      Remove download
                    </button>
                  </details>
                </div>
              </article>
            );
          })}
          {!downloads.length && <p>No archive downloads yet.</p>}
          <small>
            PGN contains moves only. JSON backup includes stored review sessions
            and analysis. Browser storage is local and can be cleared by the
            browser.
          </small>
        </section>
      )}
      {importOpen && (
        <Dialog title="Import PGN" onClose={() => setImportOpen(false)}>
          <p>
            Paste a single game or choose a PGN file. Text drafts stay on this
            device until imported or discarded.
          </p>
          {draft && (
            <button onClick={() => changeDraft("")}>Discard PGN draft</button>
          )}
          <label className="file-button">
            Import .pgn
            <input
              type="file"
              accept=".pgn,.txt"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 1000000) {
                  setImportError("Choose a PGN smaller than 1 MB.");
                  return;
                }
                try {
                  const text = await file.text();
                  changeDraft(text);
                  importPgn(text);
                } catch {
                  setImportError("Could not read this file.");
                }
              }}
            />
          </label>
          <label>
            Game PGN
            <textarea
              aria-label="Game PGN"
              value={draft}
              maxLength={PGN_DRAFT_LIMIT}
              onChange={(e) => changeDraft(e.target.value)}
              spellCheck={false}
            />
          </label>
          {importError && <p role="alert">{importError}</p>}
          <div className="games-actions">
            <button
              className="primary"
              aria-label="Import game"
              onClick={() => importPgn(draft)}
            >
              Import game →
            </button>
            <button onClick={() => importPgn(demo)}>Load Opera Game</button>
          </div>
        </Dialog>
      )}
      {rename && (
        <Dialog title="Rename game" onClose={() => setRename(null)}>
          <label>
            Game name
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
          </label>
          <button
            disabled={busy || !name.trim()}
            onClick={() =>
              void action(async () => {
                await saveGame(rename.session, name.trim(), {
                  downloadOnly: rename.downloadOnly,
                });
                setRename(null);
              }, "Game renamed.")
            }
          >
            Save name
          </button>
        </Dialog>
      )}
      {remove && (
        <Dialog title="Remove download" onClose={() => setRemove(null)}>
          <p>
            Remove @{remove.username}'s download and games stored only by this
            download? Independently saved games and games in other downloads are
            kept. Your active review remains available.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await removeCollection(remove);
                setDownloads(await collections());
                setRemove(null);
              }, "Download removed.")
            }
          >
            Remove downloaded games
          </button>
        </Dialog>
      )}
    </div>
  );
}
