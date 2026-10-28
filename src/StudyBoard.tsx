import { useState } from 'react';
import { Chess, type Square, type PieceSymbol } from 'chess.js';
import { ChessPiece, readBoardPreferences } from './BoardAppearance';
import { readPreferences, touchTick } from './MobileShell';
import { playMoveSound } from './moveSound';
export function StudyBoard({fen, onMove, last, label='Study position', flipped=false}: {fen:string;onMove?:(uci:string)=>void;last?:{from:string;to:string};label?:string;flipped?:boolean}) {
  const [selected,setSelected]=useState<Square|null>(null);
  const [promotion,setPromotion]=useState('q');
  const chess=new Chess(fen), preferences=readBoardPreferences();
  const squares=Array.from({length:64},(_,i)=>`${'abcdefgh'[i%8]}${8-Math.floor(i/8)}` as Square);
  if(flipped) squares.reverse();
  const legal=selected ? chess.moves({square:selected,verbose:true}) : [];
  function select(square:Square) {
    if(!onMove) return;
    const move=legal.find(m=>m.to===square && (!m.promotion || m.promotion===promotion));
    if(move) { const prefs=readPreferences();touchTick(prefs.haptics);playMoveSound(prefs.sounds);setSelected(null);onMove(move.from+move.to+(move.promotion||'')); }
    else setSelected(chess.get(square)?.color===chess.turn() ? square : null);
  }
  return <div className="study-position"><div className="study-board" role="group" aria-label={label}>{squares.map(square=>{
    const p=chess.get(square);const dark=(square.charCodeAt(0)+Number(square[1]))%2===1;
    return <button type="button" key={square} aria-label={`${square}${p ? ` ${p.color==='w'?'White':'Black'} ${p.type}` : ' empty'}`} aria-pressed={selected===square} disabled={!onMove} className={`${dark?'dark':'light'} ${last?.from===square||last?.to===square?'last':''} ${legal.some(m=>m.to===square)?'legal':''}`} onClick={()=>select(square)}>{p&&<ChessPiece type={p.type as PieceSymbol} color={p.color} finish={preferences.pieceFinish}/>}<small>{square}</small></button>;
  })}</div>{onMove&&<label className="study-promotion">Promote to <select value={promotion} onChange={e=>setPromotion(e.target.value)}><option value="q">Queen</option><option value="r">Rook</option><option value="b">Bishop</option><option value="n">Knight</option></select></label>}</div>;
}

