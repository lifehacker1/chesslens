import type { Evaluation, EngineLine } from "./game";
export interface EngineConfig {
  id: string;
  name: string;
  url: string;
}
export interface AnalysisOptions {
  depth: number;
  movetime: number;
  hash: number;
  multiPV: number;
  engine: EngineConfig;
  useCache?: boolean;
}
export const builtinEngine: EngineConfig = {
  id: "stockfish-19-lite",
  name: "Stockfish 19 · Lite",
  url: "./engine/stockfish-19-lite-single.js",
};
export const bundledEngines: EngineConfig[] = [
  builtinEngine,
  {
    id: "lozza-12.1-nnue",
    name: "Lozza 12.1 · Neural",
    url: "./engine/lozza/lozzaNNUE.js",
  },
  {
    id: "lozza-12.1-hce",
    name: "Lozza 12.1 · Classical",
    url: "./engine/lozza/lozzaHCE.js",
  },
];
export const defaultOptions: AnalysisOptions = {
  depth: 12,
  movetime: 2000,
  hash: 16,
  multiPV: 3,
  engine: builtinEngine,
};
export const presets = {
  battery: { depth: 6, movetime: 250 },
  quick: { depth: 8, movetime: 500 },
  balanced: { depth: 12, movetime: 2000 },
  deep: { depth: 18, movetime: 5000 },
  thorough: { depth: 22, movetime: 15000 },
};
const cache = new Map<string, Evaluation>();
export function clearAnalysisCache() {
  cache.clear();
}
export function engineUrl(path: string, base: string) {
  const url = new URL(path, base);
  if (
    url.origin !== new URL(base).origin ||
    !/\.js$/i.test(url.pathname) ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Use a same-site JavaScript worker path, for example ./engine/my-engine.js.",
    );
  return url;
}
export function parseInfo(
  line: string,
  fen: string,
): (EngineLine & { rank: number }) | null {
  if (!line.startsWith("info ") || /\b(upperbound|lowerbound)\b/.test(line))
    return null;
  const score = line.match(/\bscore (cp|mate) (-?\d+)/),
    depth = line.match(/\bdepth (\d+)/);
  if (!score || !depth) return null;
  const n = Number(score[2]),
    sign = fen.split(" ")[1] === "w" ? 1 : -1;
  const pv =
    line
      .match(/\bpv\s+(.+)$/)?.[1]
      .trim()
      .split(/\s+/)
      .filter((m) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m)) || [];
  return {
    rank: Number(line.match(/\bmultipv (\d+)/)?.[1] || 1),
    depth: Number(depth[1]),
    cp: sign * (score[1] === "mate" ? (n > 0 ? 10000 : -10000) : n),
    mate: score[1] === "mate" ? sign * n : undefined,
    pv,
    best: pv[0] || "",
  };
}
export async function analyse(
  fens: string[],
  onResult: (index: number, e: Evaluation) => void,
  signal: AbortSignal,
  options: AnalysisOptions = defaultOptions,
) {
  const worker = new Worker(engineUrl(options.engine.url, document.baseURI));
  let rejectPending: ((reason: Error) => void) | undefined;
  const abort = () => {
    worker.terminate();
    rejectPending?.(new Error("Analysis stopped."));
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    const supported = new Set<string>();
    const wait = (
      command: string,
      done: (line: string) => boolean,
      onLine?: (line: string) => void,
    ) =>
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => {
            cleanup();
            reject(
              new Error("Engine timed out. Retry or choose a lighter preset."),
            );
          },
          Math.max(45000, options.movetime + 10000),
        );
        const cleanup = () => {
          clearTimeout(timeout);
          worker.onmessage = null;
          worker.onerror = null;
          rejectPending = undefined;
        };
        rejectPending = (reason) => {
          cleanup();
          reject(reason);
        };
        worker.onmessage = (event) => {
          for (const raw of String(event.data).split("\n")) {
            const line = raw.trim();
            onLine?.(line);
            if (done(line)) {
              cleanup();
              resolve();
              break;
            }
          }
        };
        worker.onerror = () => {
          cleanup();
          reject(
            new Error(
              "Could not load the engine. Check its worker path, WASM files and browser compatibility.",
            ),
          );
        };
        if (signal.aborted) {
          cleanup();
          reject(new Error("Analysis stopped."));
          return;
        }
        worker.postMessage(command);
      });
    await wait(
      "uci",
      (line) => line === "uciok",
      (line) => {
        const name = line.match(/^option name (.+?) type /)?.[1];
        if (name) supported.add(name);
      },
    );
    if (supported.has("Hash"))
      worker.postMessage(`setoption name Hash value ${options.hash}`);
    if (supported.has("MultiPV"))
      worker.postMessage(`setoption name MultiPV value ${options.multiPV}`);
    if (supported.has("UCI_AnalyseMode"))
      worker.postMessage("setoption name UCI_AnalyseMode value true");
    await wait("isready", (line) => line === "readyok");
    for (let i = 0; i < fens.length; i++) {
      if (signal.aborted) throw new Error("Analysis stopped.");
      const key = JSON.stringify([options, fens[i]]);
      const cached = options.useCache === false ? undefined : cache.get(key);
      if (cached) {
        onResult(i, { ...cached, cached: true });
        await new Promise((resolve) => setTimeout(resolve, 0));
        continue;
      }
      worker.postMessage(`position fen ${fens[i]}`);
      const lines = new Map<number, EngineLine>();
      let best = "";
      await wait(
        `go depth ${options.depth} movetime ${options.movetime}`,
        (line) => line.startsWith("bestmove"),
        (line) => {
          const info = parseInfo(line, fens[i]);
          if (info) lines.set(info.rank, info);
          if (line.startsWith("bestmove")) best = line.split(/\s+/)[1] || "";
        },
      );
      const primary = lines.get(1);
      if (!primary)
        throw new Error(
          "The engine returned no evaluation. Try another compatible UCI worker.",
        );
      const alternatives = [...lines.entries()]
        .sort((a, b) => a[0] - b[0])
        .filter(([, line]) => line.depth === primary.depth)
        .map(([, line]) => line);
      const result: Evaluation = {
        ...primary,
        best,
        pv: primary.pv?.length
          ? primary.pv
          : best && best !== "(none)" && best !== "0000"
            ? [best]
            : [],
        lines: alternatives,
        engine: options.engine.name,
        cached: false,
      };
      if (options.useCache !== false) cache.set(key, result);
      if (cache.size > 400) cache.delete(cache.keys().next().value!);
      onResult(i, result);
    }
  } finally {
    signal.removeEventListener("abort", abort);
    worker.terminate();
  }
}
