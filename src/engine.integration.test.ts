import { afterEach, describe, it, expect, vi } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { join } from "node:path";
import { analyse, defaultOptions, clearAnalysisCache } from "./engine";
import { parseGame, type Evaluation } from "./game";
// Exercise the real, pinned WASM engine over the same UCI message boundary in
// Node. Browser loading, rendering and sticky positioning are covered by e2e.
let searches = 0;
class NodeEngineWorker {
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  process: ChildProcessWithoutNullStreams;
  stopped = false;
  constructor() {
    this.process = spawn(process.execPath, [
      join(
        process.cwd(),
        "node_modules/stockfish/bin/stockfish-19-lite-single.js",
      ),
    ]);
    let buffer = "";
    this.process.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      let index;
      while ((index = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);
        this.onmessage?.({ data: line });
      }
    });
    this.process.on("error", () => this.onerror?.());
    this.process.on("exit", (code) => {
      if (code && !this.stopped) this.onerror?.();
    });
  }
  postMessage(command: string) {
    if (command.startsWith("go ")) searches++;
    this.process.stdin.write(command + "\n");
  }
  terminate() {
    this.stopped = true;
    this.process.kill();
  }
}
afterEach(() => vi.unstubAllGlobals());
describe("real WASM UCI analysis", () => {
  it("analyses candidate lines, checkmate, cache reuse and cancellation", async () => {
    vi.stubGlobal("document", { baseURI: "http://localhost/" });
    vi.stubGlobal("Worker", NodeEngineWorker);
    const game = parseGame("1. f3 e5 2. g4 Qh4# *");
    const options = { ...defaultOptions, depth: 8, movetime: 500 };
    const results: Evaluation[] = [];
    searches = 0;
    await analyse(
      game.fens,
      (i, value) => {
        results[i] = value;
      },
      new AbortController().signal,
      options,
    );
    expect(results).toHaveLength(5);
    expect(results[0].lines!.length).toBeGreaterThan(1);
    expect(results.at(-1)?.mate).toBeDefined();
    expect(results.at(-1)?.cp).toBe(-10000);
    expect(searches).toBe(5);
    searches = 0;
    const cached: Evaluation[] = [];
    await analyse(
      game.fens,
      (i, value) => {
        cached[i] = value;
      },
      new AbortController().signal,
      options,
    );
    expect(searches).toBe(0);
    expect(cached.every((value) => value.cached)).toBe(true);
    searches = 0;
    await analyse([game.fens[0]], () => {}, new AbortController().signal, {
      ...options,
      useCache: false,
    });
    expect(searches).toBe(1);
    clearAnalysisCache();
    searches = 0;
    await analyse(
      [game.fens[0]],
      () => {},
      new AbortController().signal,
      options,
    );
    expect(searches).toBe(1);
    const controller = new AbortController();
    const pending = analyse(game.fens, () => {}, controller.signal, {
      ...options,
      depth: 18,
      movetime: 5000,
    });
    controller.abort();
    await expect(pending).rejects.toThrow("Analysis stopped");
  }, 15000);
});
