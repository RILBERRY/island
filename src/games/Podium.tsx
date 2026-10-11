import type { PodiumEntry, GameId } from '../../shared/protocol';
import { GAME_NAMES } from '../../shared/protocol';

export function Podium({ podium, ranked, game }: { podium: PodiumEntry[]; ranked: boolean; game: GameId }) {
  const medal = ['🥇', '🥈', '🥉'];
  return (
    <div className="podium">
      <h3>{GAME_NAMES[game]} · final standings</h3>
      <div className="podium-list">
        {podium.map((p) => <div key={p.id} className={`podium-row place-${p.place}`}><span>{medal[p.place - 1] ?? `#${p.place}`}</span><span className="board-face">{p.emoji}</span><strong>{p.name}{p.bot ? ' 🤖' : ''}</strong><em>{game === 'chess' ? (p.score === 1 ? 'Won' : p.score === 0.5 ? 'Draw' : 'Lost') : `${p.score} pts`}</em></div>)}
      </div>
      <small>{ranked ? 'This match counts toward the leaderboard.' : 'Practice match · not ranked. Play with another islander to rank.'}</small>
    </div>
  );
}
