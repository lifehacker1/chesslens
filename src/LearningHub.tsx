import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import openings from './openings.json';
import { expectedPoints, parseGame, type Evaluation } from './game';
import { criticalMoments, engineLine, explainMove, legalLine, lessons, nextPractice, phase, score, solvesLesson, uci, type Game } from './learning';
import { emptyLearning, loadLearning, saveLearning, type LearningData, type Puzzle } from './learningStorage';
import { listSavedGames, type ReviewSession, type SavedGame } from './reviewStorage';
import { StudyBoard } from './StudyBoard';
import './learning.css';

function Variation({title,root,moves,step,evaluation,flipped}:{title:string;root:string;moves:string[];step:number;evaluation?:Evaluation;flipped:boolean}) {
  const line=legalLine(root,moves), current=line[Math.min(step,line.length)-1];
  return <article><h3>{title}</h3><p>White evaluation: <strong>{score(evaluation)}</strong></p><StudyBoard fen={current?.fen||root} last={current} flipped={flipped} label={`${title} position`}/><p className="line-notation">{line.map((m,i)=><span key={i} className={i===step-1?'active':''}>{m.san} </span>)}</p>{step>line.length&&<small>End of available line.</small>}</article>;
}
function Comparison({game,ply,evaluations}:{game:Game;ply:number;evaluations:Record<number,Evaluation>}) {
  const [step,setStep]=useState(0);
  const move=game.moves[ply-1], before=evaluations[ply-1],after=evaluations[ply];
  const played=[uci(move),...engineLine(after)], recommended=engineLine(before);
  const max=Math.max(legalLine(move.before,played).length,legalLine(move.before,recommended).length);
  return <section className="learning-card"><h2>Compare variations</h2><p>Both boards begin immediately before {move.san}. Scores describe each line's starting evaluation, not every replayed position.</p><div className="learning-actions"><button disabled={!step} onClick={()=>setStep(step-1)}>Previous</button><strong>{step===0?'Same starting position':`Continuation ply ${step}`}</strong><button disabled={step>=max} onClick={()=>setStep(step+1)}>Next</button><button onClick={()=>setStep(0)}>Reset comparison</button></div><div className="variation-grid"><Variation title="Your move" root={move.before} moves={played} step={step} evaluation={after} flipped={move.color==='b'}/><Variation title="Engine recommendation" root={move.before} moves={recommended} step={step} evaluation={before} flipped={move.color==='b'}/></div></section>;
}
function OpeningExplorer({game,ply}:{game:Game;ply:number}) {
 const result=useMemo(()=>{
   const positions=game.fens.slice(0,ply+1).map(f=>f.split(' ').slice(0,4).join(' '));
   let match:typeof openings[number]|undefined;
   for(let i=positions.length-1;i>=0&&!match;i--) match=openings.find(o=>o.position===positions[i]);
   const prefix=game.moves.slice(0,ply).map(uci), continuations=new Map<string,number>();
   for(const opening of openings) if(prefix.every((m,i)=>opening.moves[i]===m)&&opening.moves.length>ply){const next=opening.moves[ply];continuations.set(next,(continuations.get(next)||0)+1);}
   return {match,continuations:[...continuations].sort((a,b)=>b[1]-a[1]).slice(0,6)};
 },[game,ply]);
 const name=result.match?.name||'';
 const plan=/Sicilian/.test(name)?'White often seeks central space and development; Black challenges the centre asymmetrically with the c-pawn. Pawn breaks depend on the variation.':/French|Caro-Kann/.test(name)?'Develop behind the pawn structure and prepare central pawn breaks. Pay attention to the activity of the light-squared bishop.':/Queen|Indian|Slav/.test(name)?'Develop toward the centre, finish king safety and choose a pawn break that challenges the opponent’s central pawns.': 'Develop minor pieces, contest the centre and prepare king safety. Avoid repeated moves without a concrete reason.';
 return <section className="learning-card"><h2>Opening explorer</h2><h3>{result.match?`${result.match.eco} · ${name}`:'No named opening reached yet'}</h3>{result.match&&<p>{result.match.pgn}</p>}<p><strong>General study plan:</strong> {plan}</p><p className="muted">Educational guidelines, not engine conclusions. Continuations below count catalogue lines sharing this move order, not games played or win rates.</p><ul>{result.continuations.map(([move,count])=><li key={move}>{legalLine(game.fens[ply],[move])[0]?.san||move} · {count} catalogue lines</li>)}</ul>{!result.continuations.length&&<p>No catalogue continuations for this move order.</p>}<small>Opening names: Lichess chess-openings, CC0. Includes position matching for named transpositions.</small></section>;
}
function Exercise({puzzle,onRecord}:{puzzle:Puzzle;onRecord:(assisted:boolean)=>void}) {
 const [hint,setHint]=useState(0),[message,setMessage]=useState(''),[done,setDone]=useState(false),[fen,setFen]=useState(puzzle.fen);
 const line=legalLine(puzzle.fen,engineLine(puzzle.before));
 const [last,setLast]=useState<{from:string;to:string}>();
 function submit(move:string) {
  const white=new Chess(puzzle.fen).turn()==='w';
  const candidates=[puzzle.before,...(puzzle.before.lines||[])];
  const known=candidates.find(e=>e.best===move);
  const good=known&&expectedPoints(puzzle.before,white)-expectedPoints(known,white)<=.02;
  if(good){const m=legalLine(puzzle.fen,[move])[0];setFen(m.fen);setLast(m);setDone(true);setMessage('Good solution: this move is within two expected-score points of the saved engine recommendation.');onRecord(hint>0);}
  else {setMessage(known?'The saved engine analysis prefers another move. Try again, or use a hint.':'This legal move was not evaluated in the saved candidate lines. It is unverified, not marked wrong. Try the saved recommendation or inspect it in Review.');setHint(h=>Math.max(h,1));}
 }
 return <section className="learning-card"><h2>{puzzle.title}</h2><p>{new Chess(puzzle.fen).turn()==='w'?'White':'Black'} to move · choose a piece, then its destination.</p><StudyBoard key={fen} fen={fen} onMove={done?undefined:submit} last={last} flipped={new Chess(puzzle.fen).turn()==='b'}/><p role="status">{message}</p>{hint>0&&<p>{hint===1?`Hint: consider the piece on ${line[0]?.from}.`:hint===2?`Hint: consider ${line[0]?.to} as a destination.`:`Saved solution: ${line.map(m=>m.san).join(' ')}`}</p>}<div className="learning-actions"><button disabled={done||hint>=3} onClick={()=>setHint(h=>h+1)}>Hint</button><button disabled={done} onClick={()=>{setHint(3);setDone(true);setMessage('Solution revealed. Revisit this position soon.');onRecord(true);}}>Reveal solution</button></div><small>Saved analysis depth {puzzle.before.depth}. Other unanalysed legal moves may also be good.</small></section>;
}
function Endgames({data,update}:{data:LearningData;update:(data:LearningData)=>void}) {
 const [id,setId]=useState(lessons[0].id), [hint,setHint]=useState(false),[message,setMessage]=useState(''),[fen,setFen]=useState(lessons[0].fen);
 const lesson=lessons.find(l=>l.id===id)!;
 return <section className="learning-card"><h2>Endgame classroom</h2><label>Lesson <select value={id} onChange={e=>{const next=lessons.find(l=>l.id===e.target.value)!;setId(next.id);setFen(next.fen);setMessage('');setHint(false);}}>{lessons.map(l=><option key={l.id} value={l.id}>{data.completed.includes(l.id)?'✓ ':''}{l.name}</option>)}</select></label><p>{lesson.text}</p><StudyBoard key={id+fen} fen={fen} onMove={fen===lesson.fen?(move)=>{if(solvesLesson(lesson,move)){setFen(legalLine(lesson.fen,[move])[0].fen);setMessage('Objective achieved. Try the next lesson.');update({...data,completed:[...new Set([...data.completed,id])]});}else setMessage('Legal move, but it does not achieve this lesson’s objective. Try again.');}:undefined}/><p role="status">{message}</p><div className="learning-actions"><button onClick={()=>setHint(true)}>Lesson hint</button><button onClick={()=>{setFen(lesson.fen);setMessage('');setHint(false);}}>Restart lesson</button></div>{hint&&<p>{lesson.hint}</p>}<p>{data.completed.length} of {lessons.length} lessons completed on this device.</p></section>;
}
export function LearningHub({session,onSelect}:{session:ReviewSession;onSelect:(ply:number)=>void}) {
 const game=useMemo(()=>parseGame(session.pgn),[session.pgn]);
 const [tab,setTab]=useState('coach'),[data,setData]=useState<LearningData>(emptyLearning),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[active,setActive]=useState<string|null>(null),[dueOnly,setDueOnly]=useState(false);
 const [selected,setSelected]=useState(Math.max(1,session.ply));
 useEffect(()=>{loadLearning().then(d=>{setData(d);setReady(true);}).catch(e=>setError(String(e)));},[]);
 useEffect(()=>setSelected(Math.max(1,session.ply)),[session.ply,session.pgn]);
 async function update(next:LearningData){if(!ready||busy)return;setBusy(true);try{await saveLearning(next);setData(next);setError('');}catch{setError('Learning progress could not be saved. Check browser storage and retry.');}finally{setBusy(false);}}
 const ply=Math.min(selected,game.moves.length), before=session.evaluations[ply-1],move=game.moves[ply-1];
 const moments=criticalMoments(game,session.evaluations);
 function savePuzzle(retry:boolean){
   if(!before||!legalLine(move.before,engineLine(before)).length)return;
   const id=move.before;
   const puzzle:Puzzle={id,fen:move.before,pgn:session.pgn,ply,title:`${game.headers.White||'White'} – ${game.headers.Black||'Black'} · move ${Math.ceil(ply/2)}`,before,attempts:0,streak:0,due:Date.now()};
   if(!data.puzzles.some(p=>p.id===id))void update({...data,puzzles:[puzzle,...data.puzzles]});
   setNotice('Position added to your practice collection.');if(retry){setActive(id);setTab('practice');}
 }
 const puzzle=data.puzzles.find(p=>p.id===active);
 return <div className="learning-hub"><div className="learning-tabs" role="group" aria-label="Learning sections">{['coach','practice','endgames'].map(t=><button key={t} aria-pressed={tab===t} onClick={()=>{setTab(t);setNotice('');}}>{t==='coach'?'Move coach':t==='practice'?'Practice':'Endgames'}</button>)}</div>{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{!ready&&!error&&<p>Loading learning progress…</p>}<fieldset disabled={!ready||busy} className="learning-content">
 {tab==='coach'&&<><section className="learning-card"><div className="learning-actions"><label>Study move <select aria-label="Study move" value={ply} onChange={e=>setSelected(Number(e.target.value))}>{game.moves.map((m,i)=><option key={i} value={i+1}>{Math.ceil((i+1)/2)}{m.color==='w'?'.':'…'} {m.san}</option>)}</select></label><button onClick={()=>onSelect(ply)}>Open in Review</button></div><h2>Explain this move</h2>{explainMove(game,ply,session.evaluations).map((fact,i)=><p key={i}>{fact}</p>)}<small>{before?`Saved engine depth ${before.depth}; evaluation perspective is White.`:'Engine analysis is still needed.'}</small><div className="learning-actions"><button disabled={!before?.best} onClick={()=>savePuzzle(true)}>Retry this position</button><button disabled={!before?.best} onClick={()=>savePuzzle(false)}>Save for practice</button></div></section><section className="learning-card"><h2>Critical moments</h2><p>Ranked by expected-score loss. {game.moves.filter((_,i)=>session.evaluations[i]&&session.evaluations[i+1]).length}/{game.moves.length} moves analysed.</p>{moments.length?<div className="moment-list">{moments.map(m=><button key={m.ply} aria-pressed={ply===m.ply} onClick={()=>setSelected(m.ply)}><strong>{Math.ceil(m.ply/2)}{m.move.color==='w'?'.':'…'} {m.move.san}</strong> {m.label} <small>−{(m.loss*100).toFixed(1)} points · {m.phase}</small></button>)}</div>:<p>No critical moments found in the available analysis.</p>}</section><Comparison key={`${session.pgn}:${ply}`} game={game} ply={ply} evaluations={session.evaluations}/><OpeningExplorer game={game} ply={ply}/></>}
 {tab==='practice'&&<><section className="learning-card"><h2>Practice from your games</h2><p>Find a better move without seeing the engine suggestion. Progress stays on this device.</p><label><input type="checkbox" checked={dueOnly} onChange={e=>setDueOnly(e.target.checked)}/> Due now only</label>{!data.puzzles.length&&<p>Save a position from Move coach to start your collection.</p>}<div className="practice-list">{data.puzzles.filter(p=>!dueOnly||p.due<=Date.now()).map(p=><article key={p.id}><button onClick={()=>setActive(p.id)}>{p.title}</button><small>{p.attempts} attempts · {p.due<=Date.now()?'Due now':`Due ${new Date(p.due).toLocaleDateString()}`}</small><button aria-label={`Delete ${p.title}`} onClick={()=>{void update({...data,puzzles:data.puzzles.filter(q=>q.id!==p.id)});if(active===p.id)setActive(null);}}>Delete</button></article>)}</div></section>{puzzle&&<Exercise key={puzzle.id} puzzle={puzzle} onRecord={assisted=>void update({...data,puzzles:data.puzzles.map(p=>p.id===puzzle.id?{...p,attempts:p.attempts+1,...nextPractice(p.streak,assisted)}:p)})}/>}</>}
 {tab==='endgames'&&<Endgames data={data} update={next=>void update(next)}/>}
 </fieldset></div>;
}
export function WeaknessDashboard({onOpen}:{onOpen:(session:ReviewSession)=>void}) {
 const [saved,setSaved]=useState<SavedGame[]>([]),[player,setPlayer]=useState(''),[error,setError]=useState('');
 useEffect(()=>{listSavedGames().then(setSaved).catch(()=>setError('Saved games could not be loaded.'));},[]);
 const games=useMemo(()=>saved.map(s=>({saved:s,game:parseGame(s.session.pgn)})),[saved]);
 const names=[...new Set(games.flatMap(({game})=>[game.headers.White,game.headers.Black]).filter(n=>n&&n!=='?'))].sort();
 const selected=player||names[0]||'';
 const analysed=games.flatMap(({saved,game})=>game.moves.flatMap((move,i)=>game.headers[move.color==='w'?'White':'Black']===selected&&saved.session.evaluations[i]&&saved.session.evaluations[i+1]?[{saved,game,move,ply:i+1}]:[]));
 const moments=games.flatMap(({saved,game})=>criticalMoments(game,saved.session.evaluations).filter(m=>game.headers[m.move.color==='w'?'White':'Black']===selected).map(m=>({...m,saved})));
 const forcing=moments.filter(m=>{const reply=legalLine(m.move.after,engineLine(m.saved.session.evaluations[m.ply]))[0];return reply&&/[x+#]/.test(reply.san);}).length;
 const checks=moments.filter(m=>{const reply=legalLine(m.move.after,engineLine(m.saved.session.evaluations[m.ply]))[0];return reply&&/[+#]/.test(reply.san);}).length;
 return <section className="panel learning-card" aria-label="Personal weakness dashboard"><h2>Personal weakness dashboard</h2>{error&&<p role="alert">{error}</p>}{!names.length?<p>Save analysed games with player names to start tracking patterns.</p>:<><label>Player <select aria-label="Dashboard player" value={selected} onChange={e=>setPlayer(e.target.value)}>{names.map(n=><option key={n}>{n}</option>)}</select></label><p>{analysed.length} analysed moves across {new Set(analysed.map(a=>a.saved.id)).size} saved games. Small samples can be misleading.</p><div className="weakness-grid">{['Opening','Middlegame','Endgame'].map(p=>{const count=analysed.filter(a=>phase(a.move,a.ply)===p).length,errors=moments.filter(m=>m.phase===p).length;return <article key={p}><h3>{p}</h3><strong>{errors} / {count}</strong><p>Critical moves / analysed moves</p></article>;})}</div><p>Tactics indicator: {forcing} critical moves allow an engine reply with a capture or check. King-safety indicator: {checks} allow a checking reply. These overlapping indicators are not proof of the cause of a mistake. Phase labels use material and move count.</p><div className="moment-list">{moments.sort((a,b)=>b.loss-a.loss).slice(0,8).map((m,i)=><button key={i} onClick={()=>onOpen({...m.saved.session,ply:m.ply,view:'review',branch:null,branchMove:null,branchCaptures:null})}>{m.saved.name} · {m.move.san} · {m.label}</button>)}</div></>}</section>;
}
