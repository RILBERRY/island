import { Chess, type Move } from 'chess.js';

const VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const CENTER = new Set(['d4', 'e4', 'd5', 'e5']);

function evaluate(game: Chess, forColor: 'w' | 'b'): number {
  let score = 0;
  for (const row of game.board()) {
    for (const sq of row) {
      if (!sq) continue;
      let v = VALUE[sq.type];
      if (CENTER.has(sq.square) && (sq.type === 'p' || sq.type === 'n')) v += 15;
      score += sq.color === forColor ? v : -v;
    }
  }
  if (game.isCheckmate()) score += game.turn() === forColor ? -100000 : 100000;
  else if (game.isDraw()) score = 0;
  return score;
}

function orderMoves(moves: Move[]): Move[] {
  return moves.slice().sort((a, b) => {
    const av = (a.captured ? VALUE[a.captured] : 0) + (a.promotion ? 800 : 0);
    const bv = (b.captured ? VALUE[b.captured] : 0) + (b.promotion ? 800 : 0);
    return bv - av;
  });
}

function search(game: Chess, depth: number, alpha: number, beta: number, forColor: 'w' | 'b', deadline: number): number {
  if (depth === 0 || game.isGameOver() || Date.now() > deadline) return evaluate(game, forColor);
  const maximizing = game.turn() === forColor;
  const moves = orderMoves(game.moves({ verbose: true }));
  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      game.move(m);
      best = Math.max(best, search(game, depth - 1, alpha, beta, forColor, deadline));
      game.undo();
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    game.move(m);
    best = Math.min(best, search(game, depth - 1, alpha, beta, forColor, deadline));
    game.undo();
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

export function pickBotMove(fen: string, strength: 'easy' | 'normal' | 'strong'): { from: string; to: string; promotion?: string } | null {
  const game = new Chess(fen);
  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return null;
  const me = game.turn();
  const depth = strength === 'easy' ? 1 : strength === 'normal' ? 2 : 3;
  const deadline = Date.now() + 1500;
  const scored = orderMoves(moves).map((m) => {
    game.move(m);
    const s = search(game, depth - 1, -Infinity, Infinity, me, deadline) + Math.random() * (strength === 'easy' ? 120 : 8);
    game.undo();
    return { m, s };
  });
  scored.sort((a, b) => b.s - a.s);
  const choice = strength === 'easy' ? scored[Math.floor(Math.random() * Math.min(3, scored.length))] : scored[0];
  return { from: choice.m.from, to: choice.m.to, promotion: choice.m.promotion };
}
