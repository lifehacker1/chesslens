import { useState } from "react";
import { analyse } from "./engine";
import { parseGame } from "./game";
import { criticalMoments, score } from "./learning";
import { adaptiveIndices } from "./insightAnalysis";
import {
  analysisRetention,
  cacheGameAnalysis,
  loadGameAnalysis,
  type ReviewSession,
} from "./reviewStorage";
import { withBackgroundJob } from "./backgroundJobs";
import { jobProgress } from "./jobs";
export function DeepReview({ session }: { session: ReviewSession }) {
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [result, setResult] = useState<ReviewSession | null>(null);
  const indices = adaptiveIndices(
    criticalMoments(parseGame(session.pgn), session.evaluations),
  );
  async function run() {
    setBusy(true);
    setResult(null);
    try {
      await withBackgroundJob(
        new AbortController().signal,
        async (signal) => {
          const game = parseGame(session.pgn),
            options = {
              ...session.options,
              depth: Math.max(
                session.options.depth,
                Math.min(30, session.options.depth + 4),
              ),
              movetime: Math.max(
                session.options.movetime,
                Math.min(10000, Math.max(1000, session.options.movetime * 3)),
              ),
              useCache: true,
            };
          const evaluations = await loadGameAnalysis(session.pgn, options);
          const completed = Object.fromEntries(
            indices.flatMap((index, i) =>
              evaluations[index] ? [[i, evaluations[index]]] : [],
            ),
          );
          try {
            await analyse(
              indices.map((i) => game.fens[i]),
              (i, e) => {
                evaluations[indices[i]] = e;
                const text = `Deeper review: ${i + 1}/${indices.length} positions  -  ${options.engine.name}`;
                setStatus(text);
                jobProgress(signal, text);
              },
              signal,
              options,
              completed,
            );
          } finally {
            await cacheGameAnalysis({
              ...session,
              options,
              evaluations,
              running: false,
              updatedAt: Date.now(),
            });
          }
          setResult({
            ...session,
            options,
            evaluations,
            running: false,
            updatedAt: Date.now(),
          });
          setStatus(
            analysisRetention()
              ? "Deeper critical positions saved in the analysis cache. Original game review is unchanged."
              : "Deeper review completed. Cache retention is zero, so these results last only in this view.",
          );
        },
        "Deepen critical positions",
        true,
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Deeper review failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="learning-card" aria-label="Adaptive critical analysis">
      <h3>Deepen critical positions</h3>
      <p>
        Recheck both sides of up to eight highest-loss moves ({indices.length}{" "}
        unique positions). Uses up to 4 extra depth levels and three times the
        search time, normally capped at depth 30 / 10 seconds per position
        (existing higher limits are retained). Search depth is not guaranteed.
      </p>
      <button
        disabled={busy || session.running || !indices.length}
        onClick={() => void run()}
      >
        Deepen critical positions
      </button>
      {busy && <p>Pause or cancel in Settings ? Jobs.</p>}
      {status && <p role="status">{status}</p>}
      {result && (
        <ul>
          {indices.map((i) => (
            <li key={i}>
              Position after ply {i}: {score(session.evaluations[i])} ?{" "}
              {score(result.evaluations[i])} - actual depth{" "}
              {result.evaluations[i]?.depth ?? " - "}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
