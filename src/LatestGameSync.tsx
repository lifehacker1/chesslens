import { useEffect, useRef, useState } from "react";
import type { AnalysisOptions } from "./engine";
import { type ReviewSession } from "./reviewStorage";
import { rememberedUsername, syncLatestGame } from "./latestGame";
export function LatestGameSync({
  options,
  blocked,
  onBusy,
  onOpen,
}: {
  options: AnalysisOptions;
  blocked: boolean;
  onBusy: (busy: boolean) => void;
  onOpen: (session: ReviewSession) => void;
}) {
  const user = rememberedUsername();
  const key = JSON.stringify([
    user,
    options.engine,
    options.depth,
    options.movetime,
    options.hash,
    options.multiPV,
  ]);
  const finished = useRef(new Set<string>());
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<ReviewSession | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!user || blocked || finished.current.has(key)) return;
    const controller = new AbortController();
    let alive = true;
    onBusy(true);
    setFailed(false);
    setResult(null);
    // Let active-review startup claim the engine first.
    const timer = setTimeout(() => {
      void syncLatestGame(user, options, controller.signal, (text) => {
        if (alive) setStatus(text);
      })
        .then((session) => {
          if (alive) {
            finished.current.add(key);
            setResult(session);
            onBusy(false);
          }
        })
        .catch((error) => {
          if (alive && !controller.signal.aborted) {
            finished.current.add(key);
            onBusy(false);
            setFailed(true);
            setStatus(
              "Latest game sync could not finish. Saved games and analysis are retained. " +
                (error instanceof Error ? error.message : "Please retry."),
            );
          }
        });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
      controller.abort();
      onBusy(false);
    };
  }, [user, key, blocked, retry]);
  if (!user || !status) return null;
  return (
    <aside className="latest-game-sync" aria-label="Latest game sync">
      <span role="status">
        {blocked && !result && !failed
          ? "Latest game sync waits while you review or manage downloads."
          : status}
      </span>
      {result && (
        <button onClick={() => onOpen(result)}>Review latest game</button>
      )}
      {failed && (
        <button
          disabled={blocked}
          onClick={() => {
            finished.current.delete(key);
            setRetry((n) => n + 1);
          }}
        >
          Retry latest sync
        </button>
      )}
    </aside>
  );
}
