import { useEffect, useState } from "react";
import { listSavedGames, retainAnalysisCaches } from "./reviewStorage";
import { usePreference } from "./preferences";
import { withBackgroundJob } from "./backgroundJobs";

export function StorageSettings() {
  const [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<StorageEstimate | null>(null),
    [count, setCount] = useState(0);
  const [persisted, setPersisted] = useState(false);
  const [limit, setLimit] = usePreference(
    "chesslens-cache-retention-v1",
    20,
    (v): v is number =>
      Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 20,
    setStatus,
  );
  async function refresh() {
    try {
      const [estimate, games] = await Promise.all([
        navigator.storage?.estimate?.(),
        listSavedGames(),
      ]);
      setUsage(estimate || null);
      setCount(games.length);
      setPersisted((await navigator.storage?.persisted?.()) || false);
    } catch {
      setStatus("Storage information is unavailable in this browser.");
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function clean() {
    setBusy(true);
    try {
      await withBackgroundJob(new AbortController().signal, async () => {
        await retainAnalysisCaches(limit);
      });
      setStatus(
        "Recent analysis cache trimmed. Saved games, active review, practice and engines are kept.",
      );
      await refresh();
    } catch {
      setStatus("Cleanup failed. Your saved games have not been removed.");
    } finally {
      setBusy(false);
    }
  }
  const mb = (bytes: number) => (bytes / 1048576).toFixed(1) + " MiB";
  return (
    <section
      className="panel workflow-settings"
      aria-label="Storage management"
    >
      <h2>Storage management</h2>
      <p>
        {usage?.usage !== undefined
          ? `${mb(usage.usage)} used${usage.quota ? ` of approximately ${mb(usage.quota)}` : ""}`
          : "Browser storage estimate unavailable."}{" "}
        - {count} saved games
      </p>
      {usage?.quota && usage.usage !== undefined ? (
        <progress
          aria-label="Storage usage"
          value={usage.usage}
          max={usage.quota}
        />
      ) : null}
      <p>
        Estimates cover this site, including downloaded engines. Browser
        eviction can remove local data; keep a backup.
      </p>
      <p>
        {persisted
          ? "Persistent storage granted."
          : "Persistent storage is not granted."}
      </p>
      <button
        disabled={busy || persisted || !navigator.storage?.persist}
        onClick={async () => {
          try {
            const granted = await navigator.storage.persist();
            setPersisted(granted);
            setStatus(
              granted
                ? "Persistent storage granted."
                : "The browser did not grant persistence. Backups are still recommended.",
            );
          } catch {
            setStatus("Could not request persistent storage.");
          }
        }}
      >
        Request persistent storage
      </button>
      <label>
        Recent analysis configurations to retain{" "}
        <select
          aria-label="Analysis cache retention"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        >
          {[0, 5, 10, 20].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <p>
        This limit applies to extra cached configurations, not analysis attached
        to saved games. Engine downloads can be removed individually in Engine
        settings; fetched games can be cleared in Games.
      </p>
      <button disabled={busy} onClick={() => void clean()}>
        Trim recent analysis cache
      </button>{" "}
      <button disabled={busy} onClick={() => void refresh()}>
        Refresh storage usage
      </button>
      {status && <p role="status">{status}</p>}
    </section>
  );
}
