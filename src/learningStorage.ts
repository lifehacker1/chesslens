import { Chess } from 'chess.js';
import type { Evaluation } from './game';
export interface Puzzle { id: string; fen: string; pgn: string; ply: number; title: string; before: Evaluation; attempts: number; streak: number; due: number; }
export interface LearningData { version: 1; puzzles: Puzzle[]; completed: string[]; }
export const emptyLearning = (): LearningData => ({version:1, puzzles:[], completed:[]});
function valid(value: unknown): LearningData {
  const v = value as LearningData;
  if (!v || v.version !== 1 || !Array.isArray(v.puzzles) || !Array.isArray(v.completed)) throw new Error('Unsupported learning data. Your stored data has not been overwritten.');
  return {version:1, completed:v.completed.filter(x => typeof x === 'string'), puzzles:v.puzzles.filter(p => {
    try { new Chess(p.fen); return typeof p.id === 'string' && typeof p.pgn === 'string' && Number.isInteger(p.ply) && p.ply > 0 && typeof p.title === 'string' && typeof p.before?.best === 'string' && Number.isFinite(p.before.cp) && [p.attempts,p.streak,p.due].every(n => Number.isFinite(n) && n >= 0); } catch { return false; }
  })};
}
async function database() {
  return new Promise<IDBDatabase>((resolve,reject) => { const r=indexedDB.open('chesslens-learning',1); r.onupgradeneeded=()=>r.result.createObjectStore('data'); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
}
export async function loadLearning(): Promise<LearningData> {
  const db=await database();
  try { return await new Promise((resolve,reject)=>{ const r=db.transaction('data').objectStore('data').get('current'); r.onsuccess=()=>{try{resolve(r.result ? valid(r.result) : emptyLearning());}catch(e){reject(e);}};r.onerror=()=>reject(r.error); }); } finally {db.close();}
}
export async function saveLearning(value: LearningData) {
  const db=await database();
  try { await new Promise<void>((resolve,reject)=>{ const t=db.transaction('data','readwrite');t.objectStore('data').put(valid(value),'current');t.oncomplete=()=>resolve();t.onabort=()=>reject(t.error);t.onerror=()=>reject(t.error); }); } finally {db.close();}
}
