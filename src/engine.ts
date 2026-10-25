import type { Evaluation } from "./game";
export async function analyse(
  fens: string[],
  onResult: (index: number, e: Evaluation) => void,
  signal: AbortSignal,
) {
  const worker = new Worker(
    new URL("./engine/stockfish-19-lite-single.js", document.baseURI),
  );
  let rejectPending: ((reason: Error) => void) | undefined;
  const abort = () => {
    worker.terminate();
    rejectPending?.(new Error("Analysis stopped."));
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    const wait = (
      command: string,
      done: (line: string) => boolean,
      onLine?: (line: string) => void,
    ) =>
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error("Engine timed out. Retry analysis."));
        }, 45000);
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
          for (const line of String(event.data).split("\n")) {
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
              "Could not load Stockfish. Check engine files and browser WebAssembly support.",
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
    await wait("uci", (line) => line === "uciok");
    worker.postMessage("setoption name Hash value 16");
    await wait("isready", (line) => line === "readyok");
    for (let i = 0; i < fens.length; i++) {
      if (signal.aborted) throw new Error("Analysis stopped.");
      worker.postMessage(`position fen ${fens[i]}`);
      let result: Evaluation = { cp: 0, best: "", depth: 0 };
      await wait(
        "go depth 12",
        (line) => line.startsWith("bestmove"),
        (line) => {
          const score = line.match(
            /info depth (\d+).*?score (cp|mate) (-?\d+)(?:\s|$)/,
          );
          if (score && !/\b(upperbound|lowerbound)\b/.test(line)) {
            const sign = fens[i].split(" ")[1] === "w" ? 1 : -1;
            const n = Number(score[3]);
            result = {
              ...result,
              depth: Number(score[1]),
              cp: sign * (score[2] === "mate" ? (n > 0 ? 10000 : -10000) : n),
              mate: score[2] === "mate" ? sign * n : undefined,
            };
          }
          if (line.startsWith("bestmove")) result.best = line.split(" ")[1];
        },
      );
      onResult(i, result);
    }
  } finally {
    signal.removeEventListener("abort", abort);
    worker.terminate();
  }
}
