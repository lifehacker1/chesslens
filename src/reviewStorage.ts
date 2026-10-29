import { Chess } from "chess.js";
import { parseGame, type Evaluation } from "./game";
import { defaultOptions, type AnalysisOptions } from "./engine";
import type { MobileView } from "./MobileShell";
import type { CaptureLedger } from "./material";

const SETTINGS = "chesslens-analysis-v1";
const CHECKPOINT = "chesslens-review-checkpoint-v1";
export const REVIEW_VERSION = 1;
export interface ReviewSession {
  version: 1;
  pgn: string;
  ply: number;
  flipped: boolean;
  view: MobileView;
  source: "pgn" | "chesscom";
  options: AnalysisOptions;
  evaluations: Record<number, Evaluation>;
  running: boolean;
  updatedAt: number;
  branch: string | null;
  branchMove: { from: string; to: string } | null;
  branchCaptures: CaptureLedger | null;
  betterMovesOpen: boolean;
  alternativeCursor?: { best: string; step: number };
  filters?: { speed: string; result: string; search: string };
}
export interface SavedGame {
  id: string;
  name: string;
  session: ReviewSession;
}
export function validOptions(value: unknown): AnalysisOptions {
  const v = value as AnalysisOptions | null;
  if (
    !v ||
    ![v.depth, v.movetime, v.hash, v.multiPV].every(Number.isFinite) ||
    v.depth < 1 ||
    v.depth > 64 ||
    v.movetime < 1 ||
    v.movetime > 120000 ||
    v.hash < 1 ||
    v.hash > 1024 ||
    v.multiPV < 1 ||
    v.multiPV > 10 ||
    typeof v.engine?.id !== "string" ||
    typeof v.engine?.name !== "string" ||
    typeof v.engine?.url !== "string"
  )
    return defaultOptions;
  return v;
}
export function sameOptions(a: AnalysisOptions, b: AnalysisOptions) {
  return (
    a.engine.id === b.engine.id &&
    a.engine.url === b.engine.url &&
    a.depth === b.depth &&
    a.movetime === b.movetime &&
    a.hash === b.hash &&
    a.multiPV === b.multiPV
  );
}
export function readAnalysisSettings() {
  try {
    return validOptions(JSON.parse(localStorage.getItem(SETTINGS) || "null"));
  } catch {
    return defaultOptions;
  }
}
export function writeAnalysisSettings(options: AnalysisOptions) {
  localStorage.setItem(SETTINGS, JSON.stringify(options));
}
export function canonicalPgn(pgn: string) {
  const chess = new Chess();
  chess.loadPgn(pgn);
  return chess.pgn();
}
export function validateSession(value: unknown): ReviewSession | null {
  try {
    const s = value as ReviewSession;
    if (
      !s ||
      s.version !== REVIEW_VERSION ||
      typeof s.pgn !== "string" ||
      s.pgn.length > 1000000
    )
      return null;
    const game = parseGame(s.pgn);
    const options = validOptions(s.options);
    const evaluations: Record<number, Evaluation> = {};
    const validLine = (e: Evaluation) =>
      e &&
      Number.isFinite(e.cp) &&
      Number.isFinite(e.depth) &&
      typeof e.best === "string" &&
      (e.mate === undefined || Number.isFinite(e.mate)) &&
      (e.pv === undefined ||
        (Array.isArray(e.pv) && e.pv.every((m) => typeof m === "string")));
    for (const [key, e] of Object.entries(s.evaluations || {})) {
      const i = Number(key);
      if (
        Number.isInteger(i) &&
        i >= 0 &&
        i < game.fens.length &&
        validLine(e) &&
        (e.lines === undefined ||
          (Array.isArray(e.lines) && e.lines.every(validLine)))
      )
        evaluations[i] = e;
    }
    let branch: string | null = null;
    if (s.branch) {
      try {
        branch = new Chess(s.branch).fen();
      } catch {}
    }
    return {
      ...s,
      filters: {
        speed: typeof s.filters?.speed === "string" ? s.filters.speed : "all",
        result:
          typeof s.filters?.result === "string" ? s.filters.result : "all",
        search: typeof s.filters?.search === "string" ? s.filters.search : "",
      },
      options,
      evaluations,
      ply: Number.isInteger(s.ply)
        ? Math.max(0, Math.min(s.ply, game.moves.length))
        : 0,
      flipped: s.flipped === true,
      running: s.running === true,
      view: ["review", "games", "insights", "learn", "settings"].includes(
        s.view,
      )
        ? s.view
        : "review",
      source: s.source === "chesscom" ? "chesscom" : "pgn",
      updatedAt: Number.isFinite(s.updatedAt) ? s.updatedAt : 0,
      branch,
      branchMove:
        branch &&
        /^[a-h][1-8]$/.test(s.branchMove?.from || "") &&
        /^[a-h][1-8]$/.test(s.branchMove?.to || "")
          ? s.branchMove
          : null,
      branchCaptures:
        branch &&
        s.branchCaptures &&
        [s.branchCaptures.w, s.branchCaptures.b].every(
          (pieces) =>
            Array.isArray(pieces) &&
            pieces.every((p) => ["p", "n", "b", "r", "q"].includes(p)),
        )
          ? s.branchCaptures
          : null,
      betterMovesOpen: s.betterMovesOpen === true,
      alternativeCursor:
        typeof s.alternativeCursor?.best === "string" &&
        Number.isInteger(s.alternativeCursor.step) &&
        s.alternativeCursor.step >= 0
          ? s.alternativeCursor
          : undefined,
    };
  } catch {
    return null;
  }
}
let database: Promise<IDBDatabase> | undefined;
function db() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("chesslens-reviews", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("sessions");
      request.result.createObjectStore("games", { keyPath: "id" });
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Close other ChessLens tabs to enable saved reviews."));
  }));
}
async function transact<T>(
  store: string,
  mode: IDBTransactionMode,
  operation: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, mode);
    const request = operation(tx.objectStore(store));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export function checkpoint(session: ReviewSession) {
  // A synchronous, small recovery record survives page termination. Analysis lives in IndexedDB.
  const prior = localStorage.getItem(CHECKPOINT);
  if (prior) {
    try {
      if (JSON.parse(prior).updatedAt > session.updatedAt) return;
    } catch {}
  }
  localStorage.setItem(
    CHECKPOINT,
    JSON.stringify({ ...session, evaluations: {} }),
  );
}
export async function persistReview(session: ReviewSession) {
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction("sessions", "readwrite");
    const store = tx.objectStore("sessions");
    const get = store.get("active");
    get.onsuccess = () => {
      const previous = validateSession(get.result);
      if (previous && previous.updatedAt > session.updatedAt) return;
      if (previous && previous.pgn !== session.pgn)
        store.put(previous, "previous");
      store.put(session, "active");
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function loadReview(): Promise<{
  session: ReviewSession | null;
  warning: string;
}> {
  let session: ReviewSession | null = null;
  let warning = "";
  try {
    const raw = await transact("sessions", "readonly", (store) =>
      store.get("active"),
    );
    session = validateSession(raw);
    if (raw && !session) {
      session = validateSession(
        await transact("sessions", "readonly", (store) =>
          store.get("previous"),
        ),
      );
      warning = session
        ? "Recovered your previous review because the latest record could not be read."
        : "The saved review could not be read. Your saved games have not been deleted.";
    }
  } catch {
    warning =
      "Review storage is unavailable. This browser may not retain analysis or saved games.";
  }
  try {
    const raw = localStorage.getItem(CHECKPOINT);
    const latest = validateSession(raw ? JSON.parse(raw) : null);
    if (latest && (!session || latest.updatedAt > session.updatedAt)) {
      if (
        session &&
        canonicalPgn(session.pgn) === canonicalPgn(latest.pgn) &&
        sameOptions(session.options, latest.options)
      )
        latest.evaluations = session.evaluations;
      session = latest;
    }
  } catch {
    warning ||= "The recovery checkpoint could not be read.";
  }
  if (session) {
    try {
      const saved = await loadGameAnalysis(session.pgn, session.options);
      session.evaluations = { ...saved, ...session.evaluations };
    } catch {
      /* Existing review remains available when the cache cannot be read. */
    }
  }
  return { session, warning };
}
export async function listSavedGames(): Promise<SavedGame[]> {
  const games = (await transact("games", "readonly", (s) =>
    s.getAll(),
  )) as SavedGame[];
  return games
    .flatMap((g) => {
      const session = validateSession(g.session);
      return session && typeof g.name === "string" ? [{ ...g, session }] : [];
    })
    .sort((a, b) => b.session.updatedAt - a.session.updatedAt);
}
export async function saveGame(session: ReviewSession, name?: string) {
  const id = canonicalPgn(session.pgn);
  const existing = (await transact("games", "readonly", (s) => s.get(id))) as
    SavedGame | undefined;
  const headers = parseGame(session.pgn).headers;
  await transact("games", "readwrite", (s) =>
    s.put({
      id,
      name:
        name ||
        existing?.name ||
        `${headers.White || "White"} vs ${headers.Black || "Black"}`,
      session,
    }),
  );
}
export async function updateSavedGame(session: ReviewSession) {
  const id = canonicalPgn(session.pgn);
  const database = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = database.transaction("games", "readwrite");
    const store = tx.objectStore("games");
    const get = store.get(id);
    get.onsuccess = () => {
      if (get.result && get.result.session.updatedAt <= session.updatedAt)
        store.put({ ...get.result, session });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
export async function deleteSavedGame(id: string) {
  await transact("games", "readwrite", (s) => s.delete(id));
}
export function exportPgn(session: ReviewSession) {
  const url = URL.createObjectURL(
    new Blob([session.pgn], { type: "application/x-chess-pgn" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "chesslens-game.pgn";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function clearSavedGames() {
  await transact("games", "readwrite", (s) => s.clear());
}

export function analysisKey(pgn: string, options: AnalysisOptions) {
  return (
    "analysis-v1:" +
    JSON.stringify([
      parseGame(pgn).fens,
      options.engine.id,
      options.engine.url,
      options.depth,
      options.movetime,
      options.hash,
      options.multiPV,
    ])
  );
}
export async function loadGameAnalysis(
  pgn: string,
  options: AnalysisOptions,
): Promise<Record<number, Evaluation>> {
  const cached = validateSession(
    await transact("sessions", "readonly", (s) =>
      s.get(analysisKey(pgn, options)),
    ),
  );
  if (cached && sameOptions(cached.options, options)) return cached.evaluations;
  for (const key of ["active", "previous"]) {
    const recent = validateSession(
      await transact("sessions", "readonly", (s) => s.get(key)),
    );
    if (
      recent &&
      sameOptions(recent.options, options) &&
      analysisKey(recent.pgn, options) === analysisKey(pgn, options) &&
      Object.keys(recent.evaluations).length
    )
      return recent.evaluations;
  }
  const saved = (await transact("games", "readonly", (s) =>
    s.get(canonicalPgn(pgn)),
  )) as SavedGame | undefined;
  const session = validateSession(saved?.session);
  return session && sameOptions(session.options, options)
    ? session.evaluations
    : {};
}
export async function cacheGameAnalysis(session: ReviewSession) {
  if (!Object.keys(session.evaluations).length) return;
  const key = analysisKey(session.pgn, session.options);
  const database = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = database.transaction("sessions", "readwrite");
    const store = tx.objectStore("sessions");
    const get = store.get(key);
    get.onsuccess = () => {
      const previous = validateSession(get.result);
      store.put(
        {
          ...session,
          analysisCache: true,
          evaluations: { ...previous?.evaluations, ...session.evaluations },
        },
        key,
      );
      const all = store.getAll();
      all.onsuccess = () => {
        const entries = all.result
          .filter((s) => s?.analysisCache === true)
          .sort((a, b) => b.updatedAt - a.updatedAt);
        for (const expired of entries.slice(20))
          store.delete(analysisKey(expired.pgn, expired.options));
      };
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
