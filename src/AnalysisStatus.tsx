import { useEffect, useState } from "react";
import type { AnalysisOptions } from "./engine";
export function AnalysisStatus({
  options,
  completed,
  total,
  startedAt,
  initialCompleted,
}: {
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
  const perPosition = processed >= 2 ? elapsed / processed : options.movetime;
  const seconds = Math.max(1, Math.ceil((remaining * perPosition) / 1000));
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
        <span>{remaining ? `About ${estimate} left` : "Finishing…"}</span>
      </div>
      <small>
        {completed}/{total} positions · Depth {options.depth} ·{" "}
        {options.multiPV} candidate {options.multiPV === 1 ? "line" : "lines"} ·{" "}
        {options.hash} MB
      </small>
      <small>
        Local worker · {options.movetime / 1000}s search limit/position · Time
        remaining is an estimate
      </small>
    </div>
  );
}
