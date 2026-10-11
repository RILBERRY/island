import { useMemo, useState } from 'react';
import { send } from '../net/socket';
import type { ChessView } from '../../shared/protocol';

const GLYPH: Record<string, string> = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟', k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const FILES = 'abcdefgh';

function parseFen(fen: string): (string | null)[][] {
  const rows = fen.split(' ')[0].split('/');
  return rows.map((r) => { const out: (string | null)[] = []; for (const ch of r) { if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) out.push(null); else out.push(ch); } return out; });
}
function fmt(ms: number): string { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

export function ChessTable({ view }: { view: ChessView }) {
  const board = useMemo(() => parseFen(view.fen), [view.fen]);
  const myColor: 'w' | 'b' | null = view.white.id === view.you ? 'w' : view.black.id === view.you ? 'b' : null;
  const flip = myColor === 'b';
  const [from, setFrom] = useState<string | null>(null);
  const myTurn = myColor === view.turn && view.status === 'playing';
  const targets = from ? view.legal.filter((m) => m.from === from).map((m) => m.to) : [];
  const click = (sq: string, piece: string | null) => {
    if (!myTurn) return;
    if (from && targets.includes(sq)) { send({ t: 'game', action: { type: 'move', from, to: sq, promotion: 'q' } }); setFrom(null); return; }
    const mine = piece && (myColor === 'w' ? piece === piece.toUpperCase() : piece === piece.toLowerCase());
    setFrom(mine ? sq : null);
  };
  const rows = flip ? board.slice().reverse() : board;
  const opp = myColor === 'w' ? view.black : view.white;
  const meSide = myColor === 'b' ? view.black : view.white;
  const status = view.status === 'checkmate' ? `Checkmate · ${view.winner === 'w' ? view.white.name : view.black.name} wins` : view.status === 'draw' ? 'Draw' : view.status === 'resigned' ? `${view.winner === 'w' ? view.white.name : view.black.name} wins by resignation` : view.status === 'timeout' ? `${view.winner === 'w' ? view.white.name : view.black.name} wins on time` : view.check ? 'Check!' : myTurn ? 'Your move' : `${view.turn === 'w' ? view.white.name : view.black.name} to move`;
  return (
    <div className="chess-stage">
      <div className="chess-side">
        <div className={`chess-player ${view.turn === (myColor === 'w' ? 'b' : 'w') ? 'turn' : ''}`}><span className="board-face">{opp.emoji}</span><strong>{opp.name}{opp.bot ? ' 🤖' : ''}</strong><em>{fmt(view.clocks[myColor === 'w' ? 'b' : 'w'])}</em></div>
        <div className="chess-status">{status}</div>
        <div className="chess-history">{view.history.map((h, i) => <span key={i}>{i % 2 === 0 ? `${i / 2 + 1}. ` : ''}{h} </span>)}</div>
        <div className={`chess-player ${view.turn === myColor ? 'turn' : ''}`}><span className="board-face">{meSide.emoji}</span><strong>{meSide.name}</strong><em>{fmt(view.clocks[myColor ?? 'w'])}</em></div>
        {view.status === 'playing' && myColor && <button className="pill danger" onClick={() => { if (confirm('Resign this game?')) send({ t: 'game', action: { type: 'resign' } }); }}>Resign</button>}
      </div>
      <div className="chess-board" role="grid">
        {rows.map((row, ri) => {
          const rank = flip ? ri + 1 : 8 - ri;
          const cells = flip ? row.slice().reverse() : row;
          return cells.map((piece, ci) => {
            const file = flip ? 7 - ci : ci;
            const sq = `${FILES[file]}${rank}`;
            const dark = (file + rank) % 2 === 0;
            const last = view.lastMove && (view.lastMove.from === sq || view.lastMove.to === sq);
            return <button key={sq} className={`chess-sq ${dark ? 'dark' : 'light'} ${from === sq ? 'from' : ''} ${targets.includes(sq) ? 'target' : ''} ${last ? 'last' : ''}`} onClick={() => click(sq, piece)} aria-label={`${sq} ${piece ?? 'empty'}`}>{piece ? <span className={piece === piece.toUpperCase() ? 'white' : 'black'}>{GLYPH[piece]}</span> : null}</button>;
          });
        })}
      </div>
    </div>
  );
}
