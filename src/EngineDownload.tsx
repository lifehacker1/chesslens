import { useEffect, useRef, useState } from "react";
import { bundledEngines, type EngineConfig } from "./engine";
import {
  downloadEngine,
  engineFiles,
  isEngineDownloaded,
  removeEngineDownload,
} from "./engineDownloads";
export function EngineDownload({ engine }: { engine: EngineConfig }) {
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    let active = true;
    setReady(false);
    setMessage("");
    setBusy(false);
    const refresh = () =>
      void isEngineDownloaded(engine)
        .then((value) => {
          if (active) setReady(value);
        })
        .catch(() => {
          if (active) setMessage("Engine storage is unavailable.");
        });
    refresh();
    window.addEventListener("chesslens-engine-download", refresh);
    navigator.serviceWorker?.addEventListener("message", refresh);
    return () => {
      window.removeEventListener("chesslens-engine-download", refresh);
      navigator.serviceWorker?.removeEventListener("message", refresh);
      active = false;
      abort.current?.abort();
    };
  }, [engine.id]);
  const start = async () => {
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    try {
      await downloadEngine(engine, controller.signal, (m) => {
        if (!controller.signal.aborted) setMessage(m);
      });
      if (!controller.signal.aborted) setReady(true);
    } catch (e) {
      if (!controller.signal.aborted)
        setMessage(
          e instanceof Error
            ? e.message
            : "Download failed. Check storage space and connection.",
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const bundled = bundledEngines.some((e) => e.id === engine.id);
  return (
    <section className="engine-download" aria-label="Engine download">
      <strong>{engine.name}</strong>
      <p className="muted">
        {engine.id === "stockfish-19-full"
          ? "Full network · approximately 99 MB download. Uses more memory than Lite."
          : engine.id === "stockfish-19-lite"
            ? "Lite network · approximately 1.9 MB download."
            : "Download this engine for reuse on this device."}
      </p>
      <p role="status">
        {busy ? message : ready ? "Saved on this device" : "Not downloaded"}
        {!busy && message && ` · ${message}`}
      </p>
      <div className="engine-actions">
        {!ready && (
          <button type="button" disabled={busy} onClick={() => void start()}>
            Download engine
          </button>
        )}
        {busy && (
          <button
            type="button"
            onClick={() => {
              abort.current?.abort();
              setBusy(false);
              setMessage("Download cancelled. You can retry.");
            }}
          >
            Cancel download
          </button>
        )}
        {ready && (
          <button
            type="button"
            onClick={() =>
              void removeEngineDownload(engine)
                .then(() => {
                  setReady(false);
                  setMessage("Download removed. Saved reviews are kept.");
                })
                .catch(() => setMessage("Could not remove the download."))
            }
          >
            Remove download
          </button>
        )}
      </div>
      <details>
        <summary>Saved file locations</summary>
        {engineFiles(engine).map((path) => (
          <p key={path}>
            <code style={{ overflowWrap: "anywhere" }}>{path}</code>
          </p>
        ))}
        <p className="muted">
          Stored in this browser, not your Downloads folder. Offline reuse
          requires the installed app or production site. Clearing site data can
          remove engines.
        </p>
      </details>
      {!bundled && (
        <p className="muted">
          This saves the custom worker only. Any extra model/WASM files are
          cached when fetched during online analysis; verify offline operation
          before relying on them.
        </p>
      )}
    </section>
  );
}
