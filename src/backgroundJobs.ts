import { runJob, jobCheckpoint } from "./jobs";
/** The local queue is prioritized; Web Locks serialize participating tabs. */
export function withBackgroundJob<T>(
  signal: AbortSignal,
  work: (signal: AbortSignal) => Promise<T>,
  label = "Storage maintenance",
  controls = false,
): Promise<T> {
  return runJob(
    signal,
    async (managed) => {
      if (typeof navigator === "undefined" || !navigator.locks)
        return work(managed);
      return navigator.locks.request(
        "chesslens-library-background-v1",
        { mode: "exclusive", signal: managed },
        async () => {
          await jobCheckpoint(managed);
          managed.throwIfAborted();
          return work(managed);
        },
      );
    },
    label,
    controls,
  );
}
