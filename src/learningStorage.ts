import { Chess } from "chess.js";
import { parseGame, type Evaluation } from "./game";
import { legalLine, engineLine, lessons, nextPractice } from "./learning";
export interface Puzzle {
  id: string;
  fen: string;
  pgn: string;
  ply: number;
  title: string;
  before: Evaluation;
  history?: { at: number; assisted: boolean; id?: string }[];
  attempts: number;
  streak: number;
  due: number;
}
export interface LearningData {
  version: 1;
  puzzles: Puzzle[];
  completed: string[];
}
export const emptyLearning = (): LearningData => ({
  version: 1,
  puzzles: [],
  completed: [],
});
export function validateLearning(value: unknown): LearningData {
  const v = value as LearningData;
  if (
    !v ||
    v.version !== 1 ||
    !Array.isArray(v.puzzles) ||
    !Array.isArray(v.completed)
  )
    throw new Error(
      "Unsupported learning data. Your stored data has not been overwritten.",
    );
  return {
    version: 1,
    completed: [
      ...new Set(v.completed.filter((x) => lessons.some((l) => l.id === x))),
    ],
    puzzles: v.puzzles.filter((p) => {
      try {
        new Chess(p.fen);
        if (
          parseGame(p.pgn).fens[p.ply - 1] !== p.fen ||
          !legalLine(p.fen, engineLine(p.before)).length
        )
          return false;
        if (
          p.before.lines !== undefined &&
          (!Array.isArray(p.before.lines) ||
            p.before.lines.some(
              (e) => !e || !Number.isFinite(e.cp) || typeof e.best !== "string",
            ))
        )
          return false;
        if (
          p.history !== undefined &&
          (!Array.isArray(p.history) ||
            p.history.length > 500 ||
            p.history.some(
              (e) =>
                !Number.isFinite(e.at) ||
                e.at < 0 ||
                typeof e.assisted !== "boolean" ||
                (e.id !== undefined &&
                  (typeof e.id !== "string" || e.id.length > 100)),
            ))
        )
          return false;
        return (
          typeof p.id === "string" &&
          typeof p.pgn === "string" &&
          Number.isInteger(p.ply) &&
          p.ply > 0 &&
          typeof p.title === "string" &&
          typeof p.before?.best === "string" &&
          Number.isFinite(p.before.cp) &&
          Number.isFinite(p.before.depth) &&
          [p.attempts, p.streak, p.due].every(
            (n) => Number.isFinite(n) && n >= 0,
          )
        );
      } catch {
        return false;
      }
    }),
  };
}
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("chesslens-learning", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("data");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function loadLearning(): Promise<LearningData> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction("data").objectStore("data").get("current");
      r.onsuccess = () => {
        try {
          resolve(r.result ? validateLearning(r.result) : emptyLearning());
        } catch (e) {
          reject(e);
        }
      };
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
export async function saveLearning(value: LearningData) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction("data", "readwrite");
      t.objectStore("data").put(validateLearning(value), "current");
      t.oncomplete = () => resolve();
      t.onabort = () => reject(t.error);
      t.onerror = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}

export function mergeLearningData(
  existing: LearningData,
  incoming: LearningData,
): LearningData {
  const puzzles = new Map(incoming.puzzles.map((p) => [p.id, p]));
  existing.puzzles.forEach((p) => puzzles.set(p.id, p));
  return {
    version: 1,
    puzzles: [...puzzles.values()],
    completed: [...new Set([...existing.completed, ...incoming.completed])],
  };
}
/** Restore merges against the record read inside the write transaction, not an earlier snapshot. */
export async function mergeLearningForRestore(incoming: LearningData) {
  const validated = validateLearning(incoming);
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("data", "readwrite");
      const store = tx.objectStore("data");
      const request = store.get("current");
      request.onsuccess = () => {
        try {
          const existing = request.result
            ? validateLearning(request.result)
            : emptyLearning();
          store.put(mergeLearningData(existing, validated), "current");
        } catch (error) {
          tx.abort();
          reject(error);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(tx.error || new Error("Practice restore was interrupted."));
    });
  } finally {
    db.close();
  }
}
/** Apply only changes since the editor snapshot, preserving other tabs' additions. */
export function mergeLearningEdit(
  current: LearningData,
  next: LearningData,
  base: LearningData,
): LearningData {
  const puzzles = new Map(current.puzzles.map((p) => [p.id, p]));
  for (const old of base.puzzles)
    if (!next.puzzles.some((p) => p.id === old.id)) puzzles.delete(old.id);
  for (const p of next.puzzles) {
    const old = base.puzzles.find((q) => q.id === p.id),
      latest = puzzles.get(p.id);
    if (!old) {
      if (!latest) puzzles.set(p.id, p);
      continue;
    }
    if (JSON.stringify(p) === JSON.stringify(old)) continue;
    if (!latest) continue; // Another tab explicitly deleted this puzzle.
    const history = [
      ...new Map(
        [...(latest.history || []), ...(p.history || [])].map((e) => [
          e.id || e.at + ":" + e.assisted,
          e,
        ]),
      ).values(),
    ]
      .sort((a, b) => a.at - b.at)
      .slice(-500);
    const key = (e: { at: number; assisted: boolean; id?: string }) =>
      e.id || e.at + ":" + e.assisted;
    const known = new Set((latest.history || []).map(key));
    let schedule = { streak: latest.streak, due: latest.due };
    for (const event of (p.history || [])
      .filter((e) => !known.has(key(e)))
      .sort((a, b) => a.at - b.at))
      schedule = nextPractice(schedule.streak, event.assisted, event.at);
    puzzles.set(p.id, {
      ...p,
      ...schedule,
      attempts: latest.attempts + Math.max(0, p.attempts - old.attempts),
      history,
    });
  }
  return {
    version: 1,
    puzzles: [...puzzles.values()],
    completed: [...new Set([...current.completed, ...next.completed])],
  };
}
export async function editLearning(
  next: LearningData,
  base: LearningData,
): Promise<LearningData> {
  const valid = validateLearning(next),
    db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("data", "readwrite"),
        store = tx.objectStore("data"),
        request = store.get("current");
      let result: LearningData;
      request.onsuccess = () => {
        try {
          result = mergeLearningEdit(
            request.result ? validateLearning(request.result) : emptyLearning(),
            valid,
            base,
          );
          store.put(result, "current");
        } catch (error) {
          tx.abort();
          reject(error);
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(tx.error || new Error("Practice update interrupted."));
    });
  } finally {
    db.close();
  }
}
