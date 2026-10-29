import { cpuBudget } from "./cpuBudget";
import { useEffect, useState } from "react";
import type { AnalysisOptions } from "./engine";
export function AnalysisStatus({
  download,
  options,
  completed,
  total,
  startedAt,
  initialCompleted,
}: {
  download?: string;
  options: AnalysisOptions;
  completed: number;
  total: number;
  startedAt: number;
  initialCompleted: number;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
  const elapsed = Math.max(0, now - startedAt);
  const processed = Math.max(0, completed - initialCompleted);
  const remaining = Math.max(0, total - completed);
  // Initial estimate uses configured search time; adapt to this device once positions finish.
  const workers = cpuBudget(options, total - initialCompleted).workers || 1;
  const perPosition =
    processed >= workers * 2 ? elapsed / processed : options.movetime / workers;
  const estimatedMs =
    processed >= workers * 2
      ? remaining * perPosition
      : Math.ceil(remaining / workers) * options.movetime;
  const seconds = Math.max(1, Math.ceil(estimatedMs / 1000));
  const estimate =
    seconds >= 60 ? `${Math.ceil(seconds / 60)} min` : `${seconds} sec`;
  return (
    <div
      className="analysis-live"
      role="group"
      aria-label="Engine analysis details"
    >
      <div>
        <strong>{options.engine.name}</strong>
        <span>
          {download
            ? "Preparing engine…"
            : remaining
              ? `About ${estimate} left`
              : "Finishing…"}
        </span>
      </div>
      {download && <small role="status">{download}</small>}
      <small>
        {completed}/{total} positions · Depth {options.depth} ·{" "}
        {options.multiPV} candidate {options.multiPV === 1 ? "line" : "lines"} ·{" "}
        {options.hash} MB hash/worker
      </small>
      <small>
        Up to {workers} local workers · {options.movetime / 1000}s search
        limit/position · Time remaining is an estimate
      </small>
    </div>
  );
}
