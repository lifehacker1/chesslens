import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { parseGame, demo } from "./game";
import {
  canonicalPgn,
  deleteSavedGame,
  exportPgn,
  saveGame,
  replaceSavedGame,
  type ReviewSession,
  type SavedGame,
} from "./reviewStorage";
import {
  fetchPlayerArchives,
  fetchMonthGames,
  formatArchiveLabel,
  formatResult,
  formatTimeControl,
  type ChessComGame,
} from "./chesscom";
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
import { isDraft, usePreference } from "./preferences";
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
  const [username, setUsername] = usePreference(
    "chesslens-games-username",
    localStorage.getItem("chesslens_cc_user") || "",
    isDraft,
    setError,
  );
  const [month, setMonth] = usePreference(
    "chesslens-games-month",
    "",
    isDraft,
    setError,
  );
  const [archives, setArchives] = useState<string[]>([]),
    [online, setOnline] = useState<ChessComGame[]>([]),
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
    [draft, setDraft] = useState(""),
    [importError, setImportError] = useState("");
  const [rename, setRename] = useState<SavedGame | null>(null),
    [name, setName] = useState(""),
    [undo, setUndo] = useState<SavedGame | null>(null);
  const [downloads, setDownloads] = useState<Collection[]>([]),
    [job, setJob] = useState(""),
    [progress, setProgress] = useState(""),
    [remove, setRemove] = useState<Collection | null>(null),
    [busy, setBusy] = useState(false);
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
    [query, filter, sort, onlineQuery, speed, outcome, month, section],
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
              (filter === "pending" && status !== "Analysed") ||
              g.collections?.includes(filter)),
        )
        .sort((a, b) =>
          sort === "oldest"
            ? a.g.session.updatedAt - b.g.session.updatedAt
            : sort === "played"
              ? (b.g.playedAt || 0) - (a.g.playedAt || 0)
              : b.g.session.updatedAt - a.g.session.updatedAt,
        ),
    [library.games, query, filter, sort],
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
  async function fetchGames(refresh = false, selected?: string) {
    if (job || onlineBusy) return;
    const id = ++request.current;
    setOnlineBusy(true);
    setOnlineError("");
    try {
      const user = username.trim().toLowerCase();
      if (!user) throw new Error("Enter a Chess.com username.");
      const list = await fetchPlayerArchives(user, refresh);
      const chosen =
        selected || (list.includes(month) ? month : list.at(-1)) || "";
      const games = chosen ? await fetchMonthGames(chosen, refresh) : [];
      if (id !== request.current) return;
      setArchives(list);
      setMonth(chosen);
      setOnline(games);
      setProfile(user);
      try {
        localStorage.setItem("chesslens_cc_user", user);
      } catch {}
      if (!list.length) setOnlineError("No archived standard games found.");
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
    if (section === "chesscom" && username && !profile) void fetchGames();
  }, [section]);
  async function runJob(kind: "download" | "analyse", collection?: Collection) {
    if (job || onlineBusy) return;
    const controller = new AbortController();
    abort.current = controller;
    setJob(kind);
    setError("");
    setProgress(
      kind === "download" ? "Fetching archive list…" : "Preparing analysis…",
    );
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
      if (alive.current)
        setError(
          e instanceof Error ? e.message : "Job failed. Progress is saved.",
        );
    } finally {
      if (alive.current) {
        setDownloads(await collections());
        setJob("");
        setProgress(
          controller.signal.aborted
            ? "Paused. Resume when ready."
            : "Job finished.",
        );
      }
      abort.current = null;
    }
  }
  function importPgn(text: string) {
    try {
      parseGame(text);
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
            setDraft("");
            setImportError("");
            setImportOpen(true);
          }}
        >
          Import PGN
        </button>
      </div>
      <div className="games-tabs" role="group" aria-label="Import source">
        {[
          ["library", "Library"],
          ["chesscom", "Chess.com"],
          ["downloads", "Downloads"],
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
          <div
            className={
              "continue-card " +
              (currentSaved ? "saved-game-card" : "saved-game-current")
            }
          >
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
                · {gameStatus(currentSaved?.session || current)}
              </small>
            </div>
            <div className="games-actions">
              <button
                onClick={() =>
                  onOpen(
                    currentSaved
                      ? { ...currentSaved.session, ply: current.ply }
                      : current,
                  )
                }
              >
                Continue reviewing
              </button>
              <button
                aria-label="Save game"
                disabled={busy}
                onClick={() =>
                  void action(
                    () =>
                      saveGame(
                        currentSaved
                          ? { ...currentSaved.session, ply: current.ply }
                          : current,
                      ),
                    "Game saved. Saving again updates this game.",
                  )
                }
              >
                {currentSaved ? "Saved · Update" : "Save game"}
              </button>
            </div>
          </div>
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
                  {downloads.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.username} downloads
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
              disabled={!rows.length}
              onClick={() =>
                downloadFile(
                  "chesslens-library.pgn",
                  rows.map(({ g }) => g.session.pgn).join("\n\n"),
                  "application/x-chess-pgn",
                )
              }
            >
              Export filtered PGN
            </button>
          </div>
          <p className="muted">
            {library.loading
              ? "Loading library…"
              : rows.length + " saved games"}{" "}
            · Stored on this device
          </p>
          {!library.loading && !library.games.length && (
            <p>
              No saved games yet. Import a game, save your current review, or
              download an archive.
            </p>
          )}
          {!library.loading && library.games.length > 0 && !rows.length && (
            <p>
              No matches.{" "}
              <button
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Clear filters
              </button>
            </p>
          )}
          <div className="games-list">
            {rows
              .filter(({ g }) => g.id !== currentId)
              .slice(0, limit)
              .map(({ g, h, status }) => (
                <article className="game-row saved-game-card" key={g.id}>
                  <div className="game-row-info">
                    <strong>{g.name}</strong>
                    <small>
                      {h.Result || "*"} · {h.Date || "Date unknown"} ·{" "}
                      {h.TimeControl || g.timeClass || "Imported PGN"}
                    </small>
                    <small>
                      {status}
                      {g.session.options.engine?.name &&
                      status !== "Not analysed"
                        ? " · " + g.session.options.engine.name
                        : ""}
                    </small>
                  </div>
                  <button disabled={busy} onClick={() => onOpen(g.session)}>
                    Open review
                  </button>
                  <details className="game-menu">
                    <summary aria-label={"Actions for " + g.name}>⋯</summary>
                    <div>
                      <button onClick={() => exportPgn(g.session)}>
                        Export PGN
                      </button>
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
            {!profile ? (
              <form
                style={{ display: "contents" }}
                onSubmit={(e) => {
                  e.preventDefault();
                  void fetchGames();
                }}
              >
                <input
                  aria-label="Chess.com username"
                  placeholder="Chess.com username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={onlineBusy || !!job}
                />
                <button
                  className="primary"
                  aria-label="Fetch games"
                  disabled={onlineBusy || !!job || !username.trim()}
                >
                  {onlineBusy ? "Fetching…" : "Fetch games"}
                </button>
              </form>
            ) : (
              <>
                <span>@{profile}</span>
                <select
                  aria-label="Select archive month"
                  value={month}
                  onChange={(e) => void fetchGames(false, e.target.value)}
                  disabled={onlineBusy || !!job}
                >
                  {[...archives].reverse().map((a) => (
                    <option key={a} value={a}>
                      {formatArchiveLabel(a)}
                    </option>
                  ))}
                </select>
                <button
                  disabled={onlineBusy || !!job}
                  onClick={() => void fetchGames(true)}
                >
                  Refresh
                </button>
                <details>
                  <summary>⋯</summary>
                  <button
                    disabled={!online.length}
                    onClick={() =>
                      downloadFile(
                        profile + "-month.pgn",
                        online.map((g) => g.pgn).join("\n\n"),
                        "application/x-chess-pgn",
                      )
                    }
                  >
                    Download month PGN
                  </button>
                  <button
                    disabled={!!job}
                    onClick={() => {
                      setSection("downloads");
                      void runJob("download");
                    }}
                  >
                    Download all games
                  </button>
                </details>
              </>
            )}
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
              {visibleOnline.length} games · {formatArchiveLabel(month)} ·
              Recent fetched results may be cached
            </p>
          )}
          <div className="games-list">
            {visibleOnline.slice(0, limit).map((g) => {
              const h = headers(g.pgn),
                result = formatResult(g, profile);
              return (
                <article
                  key={g.url}
                  className={"game-row cc-game-card outcome-" + result.outcome}
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
                    onClick={() => onImport(g.pgn, "chesscom")}
                  >
                    Review Game →
                  </button>
                  <details className="game-menu">
                    <summary aria-label={"Actions for game " + g.url}>
                      ⋯
                    </summary>
                    <button
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
                      Save game
                    </button>
                    <button
                      onClick={() =>
                        downloadFile(
                          "game.pgn",
                          g.pgn,
                          "application/x-chess-pgn",
                        )
                      }
                    >
                      Export PGN
                    </button>
                  </details>
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
      {section === "downloads" && (
        <section aria-label="Download manager">
          <h2>Download & analyse archives</h2>
          <p>
            Keep all available standard-chess games locally. Jobs pause when you
            leave Games or close the tab; saved progress can be resumed.
          </p>
          <div className="games-toolbar">
            <input
              aria-label="Download username"
              placeholder="Chess.com username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={!!job}
            />
            <button
              className="primary"
              disabled={!!job || onlineBusy || !username.trim()}
              onClick={() => void runJob("download")}
            >
              Download all games
            </button>
          </div>
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
                      setFilter(c.id);
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
          <p>Paste a single game or choose a PGN file.</p>
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
                  setDraft(text);
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
              onChange={(e) => setDraft(e.target.value)}
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
