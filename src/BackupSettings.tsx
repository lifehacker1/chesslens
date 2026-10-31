import { useState } from "react";
import {
  BACKUP_LIMIT,
  createBackup,
  parseBackup,
  restoreBackup,
  type Backup,
} from "./backup";
import { downloadFile } from "./archiveLibrary";
import type { ReviewSession } from "./reviewStorage";
export function BackupSettings({
  current,
  disabled,
  onBusy,
}: {
  current: ReviewSession;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const [preview, setPreview] = useState<Backup | null>(null),
    [preferences, setPreferences] = useState(false),
    [recovery, setRecovery] = useState(false),
    [done, setDone] = useState(false);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backup operation failed.");
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  async function exportRecovery() {
    await run(async () => {
      const backup = await createBackup(current);
      downloadFile(
        "chesslens-backup-" + new Date().toISOString().slice(0, 10) + ".json",
        JSON.stringify(backup),
      );
      setRecovery(true);
      setStatus("Backup download prepared. Keep this file safe.");
    });
  }
  return (
    <section className="panel backup-settings" aria-label="Backup and restore">
      <h2>Backup and restore</h2>
      <p>
        Export saved games, saved analysis, your current review, practice
        history, downloads and app preferences. Engine binaries and fetched-game
        caches are excluded.
      </p>
      {disabled && (
        <p>
          Wait for the current game analysis to finish, or stop it before
          managing backups.
        </p>
      )}
      <fieldset disabled={busy || disabled}>
        <button onClick={() => void exportRecovery()}>
          Download full backup
        </button>
        <label>
          Choose backup JSON
          <input
            aria-label="Choose backup JSON"
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              setPreview(null);
              setRecovery(false);
              setDone(false);
              setError("");
              setStatus("");
              if (!file) return;
              await run(async () => {
                if (file.size > BACKUP_LIMIT)
                  throw Error("Backup exceeds the 50 MB limit.");
                setPreview(parseBackup(await file.text()));
              });
            }}
          />
        </label>
        {preview && !done && (
          <div aria-label="Restore preview">
            <h3>Restore preview</h3>
            <p>
              {preview.games.length} saved games, {preview.analyses.length}{" "}
              recent analysis records, {preview.learning.puzzles.length}{" "}
              practice positions, {preview.learning.completed.length} completed
              lessons, {preview.collections.length} download collections and{" "}
              {Object.keys(preview.preferences).length} preferences.
            </p>
            <p>
              Duplicates merge with existing games. Existing game names, engine
              choices and practice progress are kept. The backup's current
              review is added to your library; your current board stays
              unchanged.
            </p>
            <label>
              <input
                type="checkbox"
                checked={preferences}
                onChange={(e) => setPreferences(e.target.checked)}
              />{" "}
              Restore app preferences too (takes effect after reload)
            </label>
            <p>
              First download a recovery copy using Download full backup. Restore
              writes across browser stores; if storage fills up, some records
              may already be restored. You can retry the same file without
              duplicating games.
            </p>
            <button
              disabled={!recovery}
              onClick={() =>
                void run(async () => {
                  setStatus("Waiting for background jobs...");
                  try {
                    await restoreBackup(preview, preferences, setStatus);
                    setDone(true);
                  } catch (e) {
                    throw Error(
                      "Restore did not finish. Some records may have been restored; your recovery file is unchanged. " +
                        (e instanceof Error ? e.message : ""),
                    );
                  }
                })
              }
            >
              Merge backup into this device
            </button>
            <button
              onClick={() => {
                setPreview(null);
                setStatus("");
              }}
            >
              Cancel restore
            </button>
          </div>
        )}
      </fieldset>
      {busy && <p role="status">{status || "Preparing backup..."}</p>}
      {!busy && status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
      {done && <button onClick={() => location.reload()}>Reload app</button>}
    </section>
  );
}
