/** Serialize library background jobs across same-origin tabs when Web Locks is available.
 * Independent interactive reviews remain usable. Closing a tab releases its lock.
 */
export async function withBackgroundJob<T>(
  signal: AbortSignal,
  work: () => Promise<T>,
): Promise<T> {
  signal.throwIfAborted();
  if (typeof navigator === "undefined" || !navigator.locks) return work();
  return navigator.locks.request(
    "chesslens-library-background-v1",
    { mode: "exclusive", signal },
    async () => {
      signal.throwIfAborted();
      return work();
    },
  );
}
