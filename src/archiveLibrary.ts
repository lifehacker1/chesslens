import { withBackgroundJob } from "./backgroundJobs";
import { parseGame } from "./game";
import { analyse, type AnalysisOptions } from "./engine";
import {
  cacheGameAnalysis,
  canonicalPgn,
  listSavedGames,
  loadGameAnalysis,
  removeGameCollection,
  sameOptions,
  saveGame,
  type ReviewSession,
  type SavedGame,
} from "./reviewStorage";
import type { ChessComGame } from "./chesscom";
export interface Collection {
  version: 1;
  id: string;
  username: string;
  archives: string[];
  finished: string[];
  state: "paused" | "downloading" | "complete" | "error";
  analysis: "paused" | "running" | "complete" | "error";
  updatedAt: number;
  error: string;
  skipped: number;
  analysisOptions?: AnalysisOptions;
}
async function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("chesslens-downloads", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("collections", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function collections(): Promise<Collection[]> {
  const d = await db();
  try {
    return await new Promise((resolve, reject) => {
      const r = d
        .transaction("collections")
        .objectStore("collections")
        .getAll();
      r.onsuccess = () =>
        resolve(
          r.result.filter(
            (c) =>
              c.version === 1 &&
              typeof c.id === "string" &&
              Array.isArray(c.finished) &&
              Array.isArray(c.archives),
          ),
        );
      r.onerror = () => reject(r.error);
    });
  } finally {
    d.close();
  }
}
export async function storeCollection(c: Collection) {
  const d = await db();
  try {
    await new Promise<void>((resolve, reject) => {
      const t = d.transaction("collections", "readwrite");
      t.objectStore("collections").put(c);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    d.close();
  }
}
export function newSession(
  pgn: string,
  options: AnalysisOptions,
): ReviewSession {
  parseGame(pgn);
  return {
    version: 1,
    pgn,
    ply: 0,
    flipped: false,
    view: "review",
    source: "chesscom",
    options,
    evaluations: {},
    running: false,
    updatedAt: Date.now(),
    branch: null,
    branchMove: null,
    branchCaptures: null,
    betterMovesOpen: false,
  };
}
export function archiveUrl(url: string, username: string) {
  const u = new URL(url);
  if (
    u.origin !== "https://api.chess.com" ||
    !u.pathname.startsWith(
      "/pub/player/" + encodeURIComponent(username.toLowerCase()) + "/games/",
    ) ||
    !/^\d{4}\/\d{2}$/.test(u.pathname.split("/games/")[1] || "")
  )
    throw new Error("Invalid archive address.");
  return u.href;
}
async function json(url: string, signal: AbortSignal) {
  const r = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (r.status === 429)
    throw new Error(
      "Chess.com rate limit reached. Progress is saved; retry later" +
        (r.headers.get("Retry-After")
          ? " (Retry-After: " + r.headers.get("Retry-After") + ")"
          : "") +
        ".",
    );
  if (!r.ok)
    throw new Error(
      "Chess.com request failed (" + r.status + "). Progress is saved.",
    );
  return r.json();
}
function stopped(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Paused", "AbortError");
}
async function downloadCollectionUnlocked(
  username: string,
  options: AnalysisOptions,
  signal: AbortSignal,
  onProgress: (c: Collection) => void,
) {
  const user = username.trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,100}$/.test(user))
    throw new Error("Enter a valid Chess.com username.");
  let c = (await collections()).find((x) => x.id === user) || {
    version: 1 as const,
    id: user,
    username: user,
    archives: [],
    finished: [],
    state: "paused" as const,
    analysis: "paused" as const,
    updatedAt: Date.now(),
    error: "",
    skipped: 0,
  };
  const publish = async () => {
    c = { ...c, updatedAt: Date.now() };
    await storeCollection(c);
    onProgress(c);
  };
  try {
    c = { ...c, state: "downloading", error: "" };
    await publish();
    const data = await json(
      "https://api.chess.com/pub/player/" +
        encodeURIComponent(user) +
        "/games/archives",
      signal,
    );
    if (!Array.isArray(data.archives))
      throw new Error("Invalid archive response.");
    c.archives = [
      ...new Set<string>(data.archives.map((u: string) => archiveUrl(u, user))),
    ].sort();
    await publish();
    const saved = await listSavedGames(),
      byId = new Map(saved.map((g) => [g.id, g])),
      byUrl = new Map(
        saved.filter((g) => g.sourceUrl).map((g) => [g.sourceUrl, g]),
      );
    for (const url of c.archives) {
      stopped(signal);
      if (c.finished.includes(url) && url !== c.archives.at(-1)) continue;
      const response = await json(url, signal);
      if (!Array.isArray(response.games))
        throw new Error("Invalid monthly games response.");
      for (const g of response.games as ChessComGame[]) {
        stopped(signal);
        if (g.rules !== "chess" || typeof g.pgn !== "string") {
          c.skipped++;
          continue;
        }
        let id: string;
        try {
          id = canonicalPgn(g.pgn);
          parseGame(g.pgn);
        } catch {
          c.skipped++;
          continue;
        }
        const existing = byUrl.get(g.url) || byId.get(id);
        const session = existing?.session || newSession(g.pgn, options);
        const metadata = {
          collections: [...new Set([...(existing?.collections || []), user])],
          sourceUrl: g.url,
          playedAt: g.end_time * 1000,
          timeClass: g.time_class,
          downloadOnly: existing ? existing.downloadOnly === true : true,
        };
        await saveGame(session, undefined, metadata);
        const entry: SavedGame = {
          id: existing?.id || id,
          name: existing?.name || "",
          session,
          ...metadata,
        };
        byId.set(entry.id, entry);
        byUrl.set(g.url, entry);
      }
      c.finished = [...new Set([...c.finished, url])];
      c.analysis = "paused";
      await publish();
    }
    c.state = "complete";
    await publish();
    return c;
  } catch (e) {
    c.state = signal.aborted ? "paused" : "error";
    c.error = signal.aborted
      ? ""
      : e instanceof Error
        ? e.message
        : "Download failed.";
    await publish();
    if (!signal.aborted) throw e;
    return c;
  }
}
async function analyseCollectionUnlocked(
  c: Collection,
  options: AnalysisOptions,
  signal: AbortSignal,
  onProgress: (message: string) => void,
) {
  c = {
    ...c,
    analysis: "running",
    analysisOptions: options,
    error: "",
    updatedAt: Date.now(),
  };
  await storeCollection(c);
  try {
    const games = (await listSavedGames()).filter((g) =>
      g.collections?.includes(c.id),
    );
    let done = 0;
    for (const item of games) {
      stopped(signal);
      const game = parseGame(item.session.pgn);
      let evaluations = sameOptions(item.session.options, options)
        ? { ...item.session.evaluations }
        : await loadGameAnalysis(item.session.pgn, options);
      const make = () => ({
        ...item.session,
        options,
        evaluations: { ...evaluations },
        running: false,
        updatedAt: Date.now(),
      });
      if (!sameOptions(item.session.options, options))
        await cacheGameAnalysis(item.session);
      let checkpoint = Promise.resolve(),
        failure: unknown;
      let received = 0;
      try {
        await analyse(
          game.fens,
          (i, e) => {
            evaluations[i] = e;
            received++;
            onProgress(
              "Game " +
                (done + 1) +
                "/" +
                games.length +
                " · " +
                Object.keys(evaluations).length +
                "/" +
                game.fens.length +
                " positions",
            );
            if (received % 5 === 0) {
              const snapshot = make();
              checkpoint = checkpoint
                .then(() =>
                  saveGame(snapshot, undefined, {
                    downloadOnly: item.downloadOnly,
                  }),
                )
                .catch((e) => {
                  failure = e;
                });
            }
          },
          signal,
          options,
          evaluations,
        );
      } finally {
        await checkpoint;
        if (failure) throw failure;
        await saveGame(make(), undefined, { downloadOnly: item.downloadOnly });
        await cacheGameAnalysis(make());
      }
      done++;
      onProgress("Analysed " + done + "/" + games.length + " games");
    }
    c.analysis = "complete";
  } catch (e) {
    c.analysis = signal.aborted ? "paused" : "error";
    c.error = signal.aborted
      ? ""
      : e instanceof Error
        ? e.message
        : "Analysis failed.";
    if (!signal.aborted) throw e;
  } finally {
    c.updatedAt = Date.now();
    await storeCollection(c);
  }
}
async function removeCollectionUnlocked(c: Collection) {
  for (const g of await listSavedGames()) {
    if (!g.collections?.includes(c.id)) continue;
    await removeGameCollection(g.id, c.id);
  }
  const d = await db();
  try {
    await new Promise<void>((resolve, reject) => {
      const t = d.transaction("collections", "readwrite");
      t.objectStore("collections").delete(c.id);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  } finally {
    d.close();
  }
}
export function downloadFile(
  name: string,
  text: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCollection(
  username: string,
  options: AnalysisOptions,
  signal: AbortSignal,
  onProgress: (c: Collection) => void,
) {
  return withBackgroundJob(signal, () =>
    downloadCollectionUnlocked(username, options, signal, onProgress),
  );
}
export function analyseCollection(
  c: Collection,
  options: AnalysisOptions,
  signal: AbortSignal,
  onProgress: (message: string) => void,
) {
  onProgress("Waiting for background work to finish...");
  return withBackgroundJob(signal, async () => {
    const current = (await collections()).find((item) => item.id === c.id);
    if (!current)
      throw new Error(
        "This download was removed in another tab. Refresh the download list.",
      );
    return analyseCollectionUnlocked(current, options, signal, onProgress);
  });
}
export function removeCollection(c: Collection) {
  return withBackgroundJob(new AbortController().signal, () =>
    removeCollectionUnlocked(c),
  );
}
