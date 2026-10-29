import { afterEach, describe, expect, it, vi } from "vitest";
import { analyse, clearAnalysisCache, defaultOptions } from "./engine";
import { cpuBudget } from "./cpuBudget";
import { parseGame } from "./game";
import { sameOptions, validOptions, analysisKey } from "./reviewStorage";
afterEach(() => {
  vi.unstubAllGlobals();
  clearAnalysisCache();
});
describe("CPU resource budget", () => {
  it("limits concurrency by CPU, memory, work and mode", () => {
    const o = { ...defaultOptions, cpuMode: "maximum" as const };
    expect(cpuBudget(o, 100, { cores: 8, memoryGB: 8 }).workers).toBe(8);
    expect(
      cpuBudget({ ...o, cpuMode: "balanced" }, 100, { cores: 16, memoryGB: 8 })
        .workers,
    ).toBe(4);
    expect(cpuBudget(o, 2, { cores: 16, memoryGB: 8 }).workers).toBe(2);
    expect(
      cpuBudget(
        { ...o, engine: { ...o.engine, id: "stockfish-19-full" } },
        100,
        { cores: 16, memoryGB: 2 },
      ).workers,
    ).toBe(1);
    expect(cpuBudget(o, 100, { cores: 1, memoryGB: undefined }).workers).toBe(
      1,
    );
    expect(cpuBudget(o, 0, { cores: 8, memoryGB: 8 }).workers).toBe(0);
  });
  it("persists CPU mode without invalidating saved chess analysis", () => {
    const o = { ...defaultOptions, cpuMode: "maximum" as const };
    expect(validOptions(o).cpuMode).toBe("maximum");
    expect(validOptions({ ...o, cpuMode: "invalid" }).cpuMode).toBe("single");
    expect(sameOptions(o, defaultOptions)).toBe(true);
    expect(analysisKey("1. e4 *", o)).toBe(
      analysisKey("1. e4 *", defaultOptions),
    );
  });
});
function workers(fens: string[], fail = false) {
  const instances: MockWorker[] = [];
  const searched: number[] = [];
  class MockWorker {
    onmessage: ((event: { data: string }) => void) | null = null;
    onerror: (() => void) | null = null;
    terminated = false;
    fen = "";
    constructor() {
      instances.push(this);
    }
    postMessage(command: string) {
      const send = (data: string) => {
        if (!this.terminated) this.onmessage?.({ data });
      };
      if (command === "uci") queueMicrotask(() => send("uciok"));
      else if (command === "isready") queueMicrotask(() => send("readyok"));
      else if (command.startsWith("position fen "))
        this.fen = command.slice(13);
      else if (command.startsWith("go ")) {
        const index = fens.indexOf(this.fen);
        searched.push(index);
        setTimeout(
          () => {
            if (this.terminated) return;
            if (fail && index === 0) {
              this.onerror?.();
              return;
            }
            send("info depth 6 score cp " + index + " pv e2e4");
            send("bestmove e2e4");
          },
          index === 0 ? 20 : 2,
        );
      }
    }
    terminate() {
      this.terminated = true;
    }
  }
  vi.stubGlobal("Worker", MockWorker);
  vi.stubGlobal("document", { baseURI: "http://localhost/" });
  vi.stubGlobal("navigator", { hardwareConcurrency: 4, deviceMemory: 8 });
  return { instances, searched };
}
describe("parallel engine scheduling", () => {
  const fens = parseGame("1. e4 e5 2. Nf3 Nc6 *").fens;
  it("delivers original indices once, skips completed work, and cleans up every worker", async () => {
    const mock = workers(fens),
      received: number[] = [];
    const o = { ...defaultOptions, cpuMode: "maximum" as const };
    await analyse(
      fens,
      (i) => received.push(i),
      new AbortController().signal,
      o,
      { 2: { cp: 0, best: "g1f3", depth: 6 } },
    );
    expect(mock.instances).toHaveLength(4);
    expect([...received].sort()).toEqual([0, 1, 2, 3, 4]);
    expect(mock.searched).not.toContain(2);
    expect(new Set(mock.searched).size).toBe(4);
    expect(mock.instances.every((w) => w.terminated)).toBe(true);
  });
  it("reuses the position cache after changing CPU mode without starting workers", async () => {
    const mock = workers(fens);
    await analyse(fens, () => {}, new AbortController().signal, defaultOptions);
    const count = mock.instances.length;
    await analyse(fens, () => {}, new AbortController().signal, {
      ...defaultOptions,
      cpuMode: "maximum",
    });
    expect(mock.instances).toHaveLength(count);
  });
  it("aborts all siblings after an engine failure", async () => {
    const mock = workers(fens, true);
    await expect(
      analyse(fens, () => {}, new AbortController().signal, {
        ...defaultOptions,
        cpuMode: "maximum",
      }),
    ).rejects.toThrow();
    expect(mock.instances.every((w) => w.terminated)).toBe(true);
  });
  it("cancellation terminates the pool without late callbacks", async () => {
    const mock = workers(fens),
      abort = new AbortController(),
      received: number[] = [];
    const promise = analyse(fens, (i) => received.push(i), abort.signal, {
      ...defaultOptions,
      cpuMode: "maximum",
    });
    abort.abort();
    await expect(promise).rejects.toThrow("stopped");
    expect(mock.instances.every((w) => w.terminated)).toBe(true);
    expect(received).toEqual([]);
  });
});
