import type { LearningData, Puzzle } from "./learningStorage";
export function practiceProgress(puzzles: Puzzle[], now = Date.now()) {
  const recent = puzzles
    .flatMap((p) => p.history || [])
    .filter((e) => e.at <= now && e.at >= now - 30 * 86400000);
  return {
    due: puzzles.filter((p) => p.due <= now).length,
    established: puzzles.filter((p) => p.streak >= 3).length,
    reviews: recent.length,
    unassisted: recent.filter((e) => !e.assisted).length,
    days: new Set(recent.map((e) => new Date(e.at).toISOString().slice(0, 10)))
      .size,
  };
}
export function PracticeProgress({ data }: { data: LearningData }) {
  const p = practiceProgress(data.puzzles);
  return (
    <section aria-label="Practice progress">
      <h3>Practice progress</h3>
      <p>
        {p.due} due  -  {p.established} positions with 3+ consecutive unassisted
        solves
      </p>
      <p>
        Last 30 days: {p.reviews} recorded reviews  -  {p.unassisted} unassisted
        solves  -  {p.days} active days (UTC)
      </p>
      <p>
        Older attempts without history are excluded. A streak reflects exercise
        performance, not a guaranteed retention score. Hints or revealing the
        solution reset the interval.
      </p>
    </section>
  );
}
