import { Chess, type Move } from 'chess.js';
import { expectedPointLoss, expectedPoints, type Evaluation, parseGame } from './game';
export type Game = ReturnType<typeof parseGame>;
export const uci = (m: Move) => m.from + m.to + (m.promotion || '');
export function legalLine(fen: string, moves: string[]) {
  const chess = new Chess(fen);
  const result: { fen: string; san: string; from: string; to: string; uci: string }[] = [];
  for (const move of moves) {
    try { const m = chess.move(move); result.push({ fen: chess.fen(), san: m.san, from: m.from, to: m.to, uci: uci(m) }); }
    catch { break; }
  }
  return result;
}
export function engineLine(e?: Evaluation) {
  return e?.best ? (e.pv?.[0] === e.best ? e.pv : [e.best]) : [];
}
export function phase(move: Move, ply: number) {
  const material = new Chess(move.before).board().flat().filter(p => p && !['k','p'].includes(p.type)).length;
  return material <= 4 ? 'Endgame' : ply <= 20 ? 'Opening' : 'Middlegame';
}
export function criticalMoments(game: Game, evaluations: Record<number, Evaluation>) {
  return game.moves.flatMap((move, i) => {
    const before = evaluations[i], after = evaluations[i + 1];
    if (!before || !after) return [];
    const white = move.color === 'w';
    const loss = expectedPointLoss(before, after, white, uci(move));
    if (loss < 0.05) return [];
    const best = expectedPoints(before, white), played = expectedPoints(after, white);
    const label = best >= .8 && played < .6 ? 'Lost advantage' : best >= .8 ? 'Missed winning opportunity' : best >= .35 && played < .35 ? 'Defensive opportunity' : 'Turning point';
    return [{ ply: i + 1, move, loss, label, phase: phase(move, i + 1) }];
  }).sort((a,b) => b.loss - a.loss);
}
export function explainMove(game: Game, ply: number, evaluations: Record<number, Evaluation>) {
  const move = game.moves[ply - 1];
  if (!move) return ['Select a played move to explore its consequences.'];
  const facts = [`${move.san} moves ${move.piece.toUpperCase()} from ${move.from} to ${move.to}.`];
  if (move.captured) facts.push(`It captures a ${({p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'})[move.captured]}.`);
  const board = new Chess(move.after);
  if (board.isCheckmate()) facts.push('This move delivers checkmate.');
  else if (board.isCheck()) facts.push('The opponent must answer the check.');
  if (move.isKingsideCastle() || move.isQueensideCastle()) facts.push('Castling relocates the king and brings a rook toward the centre.');
  const before = evaluations[ply - 1], after = evaluations[ply];
  if (!before || !after) return [...facts, 'Analyse both positions to unlock an engine comparison.'];
  const loss = expectedPointLoss(before, after, move.color === 'w', uci(move));
  facts.push(`Estimated expected-score loss: ${(loss * 100).toFixed(1)} percentage points. This is not a win probability guarantee.`);
  const reply = legalLine(move.after, engineLine(after))[0];
  if (reply) facts.push(`The engine's reply is ${reply.san}. ${reply.san.includes('+') ? 'It gives check.' : reply.san.includes('x') ? 'It captures material.' : 'Replay the continuation to inspect its consequences.'}`);
  const best = legalLine(move.before, engineLine(before))[0];
  if (best) facts.push(best.uci === uci(move) ? 'Your move matches the saved engine recommendation.' : `The engine prefers ${best.san} from the same starting position. Compare the lines below; the score alone does not establish a tactical motive.`);
  return facts;
}
export function score(e?: Evaluation) { return !e ? 'Not analysed' : e.mate !== undefined ? `Mate ${e.mate}` : `${e.cp >= 0 ? '+' : ''}${(e.cp/100).toFixed(2)}`; }
export function nextPractice(streak: number, assisted: boolean, now = Date.now()) {
  const next = assisted ? 0 : streak + 1;
  return { streak: next, due: now + (assisted ? 10/1440 : [1,3,7,14,30][Math.min(next-1,4)]) * 86400000 };
}
export const lessons = [
  { id:'opposition', name:'Take the opposition', fen:'8/8/4k3/8/8/4K3/4P3/8 w - - 0 1', text:'Place the kings on the same file with one square between them, leaving Black to move. This is direct opposition; whether it wins depends on the pawn and king positions.', answer:'e3e4', hint:'Bring your king one square forward.' },
  { id:'passed', name:'Advance a passed pawn', fen:'6k1/8/2p5/4P3/8/8/8/6K1 w - - 0 1', text:'The e-pawn is passed: no enemy pawn can block or capture it from the same or an adjacent file ahead. Advance it one square. A passed pawn is not automatically a winning pawn.', answer:'e5e6', hint:'Advance the e-pawn.' },
  { id:'rook', name:'Rook behind the passer', fen:'6k1/8/8/4P3/8/R7/8/6K1 w - - 0 1', text:'Place your rook on the e-file behind your passed pawn. This illustrates supporting the pawn from behind, not a claim that this is the only good move.', answer:'a3e3', hint:'Move the rook along the third rank.' },
  { id:'queen-mate', name:'King and queen mate', fen:'7k/8/5KQ1/8/8/8/8/8 w - - 0 1', text:'Deliver checkmate in one move. Your king protects the queen and restricts escape squares. Remember: no legal moves without check is stalemate, not mate.', answer:'mate', hint:'Give a protected check close to the enemy king.' },
  { id:'rook-mate', name:'King and rook mate', fen:'7k/R7/6K1/8/8/8/8/8 w - - 0 1', text:'Deliver checkmate in one move. Your king cuts off escape squares while the rook checks along the back rank.', answer:'mate', hint:'Use the eighth rank.' },
];
export function solvesLesson(lesson: typeof lessons[number], move: string) {
  try { const c = new Chess(lesson.fen); c.move(move); return lesson.answer === 'mate' ? c.isCheckmate() : move === lesson.answer; } catch { return false; }
}
