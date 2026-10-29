import type { AnalysisOptions } from "./engine";
export type CpuMode = "single" | "balanced" | "maximum";
export function hardware() {
  const nav =
    typeof navigator === "undefined"
      ? undefined
      : (navigator as Navigator & { deviceMemory?: number });
  return { cores: nav?.hardwareConcurrency || 1, memoryGB: nav?.deviceMemory };
}
/** Memory budgets are conservative estimates, not a measurement of free RAM. */
export function cpuBudget(
  options: AnalysisOptions,
  positions = Infinity,
  hints = hardware(),
) {
  const cores = Number.isFinite(hints.cores)
    ? Math.max(1, Math.floor(hints.cores))
    : 1;
  const memoryGB = hints.memoryGB;
  const budgetMB =
    memoryGB && Number.isFinite(memoryGB)
      ? Math.max(128, Math.min(4096, memoryGB * 1024 * 0.25))
      : 512;
  const overhead =
    options.engine.id === "stockfish-19-full"
      ? 384
      : options.engine.id.startsWith("stockfish-19-lite")
        ? 64
        : 128;
  const perWorkerMB = overhead + options.hash;
  const memoryLimit = Math.max(1, Math.floor(budgetMB / perWorkerMB));
  const maximum = Math.max(1, Math.min(cores, memoryLimit, 32));
  const desired =
    options.cpuMode === "maximum"
      ? maximum
      : options.cpuMode === "balanced"
        ? Math.min(maximum, 4, Math.max(1, Math.floor(cores / 2)))
        : 1;
  return {
    workers: Math.max(0, Math.min(desired, Math.max(0, Math.floor(positions)))),
    maximum,
    cores,
    budgetMB,
    perWorkerMB,
    memoryGB,
  };
}
