import { useEffect, useRef, useState } from "react";
import type { AnalysisOptions } from "./engine";
import type { ReviewSession } from "./reviewStorage";
import { rememberedUsername, syncLatestGame } from "./latestGame";
import { isBoolean, usePreference } from "./preferences";
export function LatestGameSync({
  options,
  blocked,
  showBanner,
  showControls,
  onBusy,
  onOpen,
}: {
  options: AnalysisOptions;
  blocked: boolean;
  showBanner: boolean;
  showControls: boolean;
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
  const [preferenceError, setPreferenceError] = useState("");
  const [enabled, setEnabled] = usePreference(
    "chesslens-auto-sync-v1",
    true,
    isBoolean,
    setPreferenceError,
  );
  const finished = useRef(new Set<string>()),
    manual = useRef(false);
  const [status, setStatus] = useState(""),
    [result, setResult] = useState<ReviewSession | null>(null),
    [failed, setFailed] = useState(false),
    [retry, setRetry] = useState(0),
    [dismissed, setDismissed] = useState(false),
    [inFlight, setInFlight] = useState(false);
  const hasStatus = !!status;
  useEffect(() => {
    if (!showBanner || !hasStatus || dismissed) return;
    const timer = setTimeout(() => setDismissed(true), 10000);
    return () => clearTimeout(timer);
  }, [showBanner, hasStatus, dismissed]);
  useEffect(() => {
    if (
      !user ||
      blocked ||
      (!enabled && !manual.current) ||
      finished.current.has(key)
    )
      return;
    const controller = new AbortController();
    let alive = true;
    onBusy(true);
    setInFlight(true);
    setFailed(false);
    setStatus("Checking latest game...");
    setResult(null);
    const timer = setTimeout(() => {
      void syncLatestGame(user, options, controller.signal, (text) => {
        if (alive) setStatus(text);
      })
        .then((session) => {
          if (alive) {
            manual.current = false;
            finished.current.add(key);
            setResult(session);
            setInFlight(false);
            onBusy(false);
          }
        })
        .catch((error) => {
          if (alive && !controller.signal.aborted) {
            manual.current = false;
            finished.current.add(key);
            setInFlight(false);
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
      setInFlight(false);
    };
  }, [user, key, blocked, retry, enabled]);
  function checkAgain() {
    finished.current.delete(key);
    manual.current = true;
    setDismissed(false);
    setRetry((n) => n + 1);
  }
  function stop() {
    manual.current = false;
    finished.current.add(key);
    setRetry((n) => n + 1);
    setStatus("Latest sync stopped. Saved progress is kept.");
  }
  return (
    <>
      {showControls && (
        <section
          className="panel sync-settings"
          aria-label="Latest game sync settings"
        >
          <h2>Latest game sync</h2>
          <label>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                manual.current = false;
                if (e.target.checked) finished.current.delete(key);
                setEnabled(e.target.checked);
                if (!e.target.checked)
                  setStatus("Automatic latest-game sync is off.");
              }}
            />{" "}
            Automatically fetch and analyse my latest game
          </label>
          <p>
            {user
              ? "Chess.com player: @" + user
              : "Enter a Chess.com username in Games to use this feature."}
          </p>
          <p>
            Checks once per page load when enabled, and waits for active
            analysis or downloads. Check again works even when automatic sync is
            off.
          </p>
          <button disabled={!user || blocked || inFlight} onClick={checkAgain}>
            Check again
          </button>
          {inFlight && <button onClick={stop}>Stop latest sync</button>}
          {status && (
            <p role="status">
              {blocked && inFlight
                ? "Waiting for active work to finish."
                : status}
            </p>
          )}
          {preferenceError && <p role="alert">{preferenceError}</p>}
        </section>
      )}
      {showBanner && !dismissed && user && status && (
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
            <button disabled={blocked} onClick={checkAgain}>
              Retry latest sync
            </button>
          )}
          <button
            aria-label="Dismiss latest game banner"
            onClick={() => setDismissed(true)}
          >
            Dismiss
          </button>
        </aside>
      )}
    </>
  );
}
