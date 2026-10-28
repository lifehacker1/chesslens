import { Chess } from "chess.js";
import { parseGame, type Evaluation } from "./game";
import { legalLine, engineLine, lessons } from "./learning";
export interface Puzzle {
  id: string;
  fen: string;
  pgn: string;
  ply: number;
  title: string;
  before: Evaluation;
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
