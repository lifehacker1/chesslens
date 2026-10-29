import { legalLine } from "./learning";
import type { Evaluation } from "./game";
export function reviewAlternatives(fen: string, evaluation?: Evaluation) {
  const seen = new Set<string>();
  return (
    evaluation?.lines?.length
      ? evaluation.lines
      : evaluation
        ? [evaluation]
        : []
  ).flatMap((line) => {
    if (!line.best || seen.has(line.best)) return [];
    const moves = legalLine(
      fen,
      line.pv?.[0] === line.best ? line.pv : [line.best],
    );
    if (!moves.length) return [];
    seen.add(line.best);
    return [{ ...line, moves }];
  });
}
export function restoredAlternative(
  fen: string,
  evaluation: Evaluation | undefined,
  preview: string | null | undefined,
  cursor?: { best: string; step: number },
) {
  const lines = reviewAlternatives(fen, evaluation);
  if (cursor && Number.isInteger(cursor.step) && cursor.step >= 0) {
    const index = lines.findIndex((line) => line.best === cursor.best);
    if (
      index >= 0 &&
      (cursor.step === 0 ? fen : lines[index].moves[cursor.step - 1]?.fen) ===
        preview
    )
      return { index, step: cursor.step };
  }
  for (let index = 0; index < lines.length; index++) {
    const step = lines[index].moves.findIndex((m) => m.fen === preview);
    if (step >= 0) return { index, step: step + 1 };
  }
  return { index: 0, step: preview === fen ? 0 : 1 };
}
