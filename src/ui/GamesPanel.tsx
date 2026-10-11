import { useMemo, useState } from 'react';
import { useStore, localPos } from '../store';
import { send } from '../net/socket';
import { Icon } from './icons';
import { ChatPanel } from './ChatPanel';
import { GAME_NAMES, PARTY_JOIN_RADIUS, type GameId, type PartyPublic, type Leaderboard } from '../../shared/protocol';
import { TRIVIA_TOPICS } from '../../shared/trivia';
import { Podium } from '../games/Podium';

const TILES: { id: GameId; title: string; blurb: string; icon: string; cls: string; rule: string }[] = [
  { id: 'uno', title: 'UNO', blurb: 'Match colours and numbers.', icon: 'cards', cls: 'uno-tile', rule: 'Ranked by matches won. Only matches between signed-in islanders count.' },
  { id: 'trivia', title: 'Quiz Night', blurb: 'Answer fast. Climb the scoreboard.', icon: 'quiz', cls: 'trivia-tile', rule: 'Ranked by best score in a quiz with other islanders. Solo quizzes don’t count.' },
  { id: 'chess', title: 'Beach Chess', blurb: 'Play a friend or practise with a bot.', icon: 'chess', cls: 'chess-tile', rule: 'Ranked by games won against other islanders. Games against the bot don’t count.' },
];

function RankLine({ game, board }: { game: GameId; board: Leaderboard | null }) {
  const me = useStore((s) => s.me);
  const entries = board?.[game].allTime ?? [];
  const idx = entries.findIndex((e) => e.id === me);
  return (
    <div className="game-tile-rank">
      <span className="game-tile-rank-label">Leaderboard</span>
      <span className="game-tile-rank-faces">{entries.slice(0, 3).map((e) => <span key={e.id} className="board-face">{e.emoji}</span>)}</span>
      <span className="game-tile-rank-me">{idx >= 0 ? `You're #${idx + 1}` : entries.length ? (game === 'trivia' ? 'Play with others to rank' : 'Beat an islander to rank') : 'Be the first'}</span>
    </div>
  );
}

function Boards() {
  const board = useStore((s) => s.leaderboard);
  const me = useStore((s) => s.me);
  const [game, setGame] = useState<GameId>('uno');
  const [period, setPeriod] = useState<'allTime' | 'month'>('allTime');
  const list = board?.[game][period] ?? [];
  return (
    <div className="board">
      <div className="seg">{TILES.map((t) => <button key={t.id} className={game === t.id ? 'on' : ''} onClick={() => setGame(t.id)}>{t.title}</button>)}</div>
      <div className="board-periods seg"><button className={period === 'allTime' ? 'on' : ''} onClick={() => setPeriod('allTime')}>All time</button><button className={period === 'month' ? 'on' : ''} onClick={() => setPeriod('month')}>This month</button></div>
      <p className="muted small">{TILES.find((t) => t.id === game)!.rule}</p>
      {list.length === 0 ? <div className="empty-state"><Icon name="trophy" size={30} /><h4>{game === 'trivia' ? 'No scores yet. Be the first!' : 'Nobody has won a match yet. Be the first!'}</h4></div> : (
        <div className="board-list">{list.map((e, i) => <div key={e.id} className={`board-row ${e.id === me ? 'me' : ''}`}><span className="board-rank">{i + 1}</span><span className="board-face">{e.emoji}</span><span className="board-name">{e.name}</span><span className="board-score">{game === 'trivia' ? `${e.best} pts` : `${e.wins} ${e.wins === 1 ? 'win' : 'wins'}`}<small>{e.matches} {e.matches === 1 ? 'match' : 'matches'}</small></span></div>)}</div>
      )}
    </div>
  );
}

function Lobby({ party }: { party: PartyPublic }) {
  const me = useStore((s) => s.me)!;
  const [chat, setChat] = useState(false);
  const host = party.hostId === me;
  const mine = party.members.find((m) => m.id === me);
  const others = party.members.filter((m) => m.id !== party.hostId && !m.sittingOut);
  const allReady = others.every((m) => m.ready);
  const s = party.settings;
  const select = (game: GameId, settings: Partial<PartyPublic['settings']> = {}) => send({ t: 'party_select', game, settings });
  const topics = s.trivia.topics;
  const toggleTopic = (id: string) => select('trivia', { trivia: { ...s.trivia, topics: topics.includes(id) ? topics.filter((t) => t !== id) : [...topics, id] } });
  const humans = party.members.filter((m) => !m.sittingOut).length;
  return (
    <div className="party">
      <div className="party-topbar">
        <strong>Party lobby</strong>
        <div className="party-actions">
          <button className="secondary small" onClick={() => setChat((c) => !c)}><Icon name="chat" size={14} /> {chat ? 'Hide party chat' : 'Party chat'}</button>
          <button className="danger small" onClick={() => send({ t: 'party_leave' })}>Leave party</button>
        </div>
      </div>
      {chat && <div className="party-chat"><ChatPanel scope="party" compact /></div>}
      <div className="party-roster">
        {party.members.map((m) => <div key={m.id} className={`party-member ${m.ready ? 'ready' : ''}`}><span className="person-emoji">{m.emoji}</span><strong>{m.name}</strong><small>{m.id === party.hostId ? 'Host' : m.sittingOut ? 'Sitting out' : m.ready ? 'Ready' : 'Not ready'}</small></div>)}
        <div className="party-member open"><span className="person-emoji">➕</span><strong>Open spot</strong><small>Nearby players can join</small></div>
      </div>
      {party.status === 'finished' && party.results && (
        <div className="party-results">
          <Podium podium={party.results.podium} ranked={party.results.ranked} game={party.results.game} />
          {host && <div className="row"><button onClick={() => send({ t: 'party_start' })}>Play again</button><button className="secondary" onClick={() => send({ t: 'party_lobby' })}>Return everyone to lobby</button></div>}
          {!host && <p className="muted">Match finished. Waiting for the host to start again or return everyone to the lobby.</p>}
        </div>
      )}
      {party.status === 'playing' && mine?.sittingOut && <div className="notice"><Icon name="clock" size={16} /><p>You’re waiting for the next match. Players sitting out keep party chat.</p></div>}
      <h3>{host ? 'Choose game' : 'Party game'}</h3>
      {!host && !party.game && <p className="muted">The host chooses a game before players ready up.</p>}
      <div className="party-game-choices">
        {TILES.map((t) => <button key={t.id} disabled={!host} className={`party-game-card ${t.cls} ${party.game === t.id ? 'on' : ''}`} onClick={() => select(t.id)}><Icon name={t.icon} size={26} /><strong>{t.title}</strong><small>{t.blurb}</small></button>)}
        <button disabled className="party-game-card jetski-tile"><Icon name="jetski" size={26} /><strong>Jetski Rush</strong><small>Coming soon</small></button>
      </div>
      {party.game && (
        <div className="party-settings">
          <h3>Game settings</h3>
          {party.game === 'uno' && (<>
            {([['stackDrawTwo', 'Stack Draw Two on Draw Two'], ['stackWildDrawFour', 'Stack Wild Draw Four on Wild Draw Four'], ['drawUntilPlayable', 'Draw until you can play'], ['forcePlayDrawnCard', 'Must play a playable drawn card']] as const).map(([k, label]) => (
              <label key={k} className="toggle"><input type="checkbox" disabled={!host} checked={s.uno[k]} onChange={(e) => select('uno', { uno: { ...s.uno, [k]: e.target.checked } })} /><span>{label}</span></label>
            ))}
            <div className="setting-row"><span>Rounds</span><div className="seg"><button disabled={!host} className={s.uno.targetScore === 0 ? 'on' : ''} onClick={() => select('uno', { uno: { ...s.uno, targetScore: 0 } })}>One round</button><button disabled={!host} className={s.uno.targetScore === 500 ? 'on' : ''} onClick={() => select('uno', { uno: { ...s.uno, targetScore: 500 } })}>First to 500 points</button></div></div>
          </>)}
          {party.game === 'trivia' && (<>
            <div className="trivia-topics">{TRIVIA_TOPICS.map((t) => <button key={t.id} disabled={!host} className={`trivia-topic ${topics.includes(t.id) ? 'on' : ''}`} style={{ '--topic': t.color } as React.CSSProperties} onClick={() => toggleTopic(t.id)}><span>{t.emoji}</span><strong>{t.name}</strong><small>{t.questions.length} questions</small></button>)}</div>
            <div className="setting-row"><span>Questions</span><div className="seg">{[5, 10, 15].map((n) => <button key={n} disabled={!host} className={s.trivia.questions === n ? 'on' : ''} onClick={() => select('trivia', { trivia: { ...s.trivia, questions: n } })}>{n}</button>)}</div></div>
            <div className="setting-row"><span>Time to answer</span><div className="seg">{[10, 15, 20].map((n) => <button key={n} disabled={!host} className={s.trivia.seconds === n ? 'on' : ''} onClick={() => select('trivia', { trivia: { ...s.trivia, seconds: n } })}>{n}s</button>)}</div></div>
          </>)}
          {party.game === 'chess' && (<>
            <div className="setting-row"><span>Minutes each</span><div className="seg">{[3, 5, 10].map((n) => <button key={n} disabled={!host} className={s.chess.minutes === n ? 'on' : ''} onClick={() => select('chess', { chess: { ...s.chess, minutes: n } })}>{n}</button>)}</div></div>
            <div className="setting-row"><span>Bot strength</span><div className="seg">{(['easy', 'normal', 'strong'] as const).map((n) => <button key={n} disabled={!host} className={s.chess.strength === n ? 'on' : ''} onClick={() => select('chess', { chess: { ...s.chess, strength: n } })}>{n[0].toUpperCase() + n.slice(1)}</button>)}</div></div>
          </>)}
          <label className="toggle"><input type="checkbox" disabled={!host} checked={s.bots} onChange={(e) => select(party.game!, { bots: e.target.checked })} /><span>Practice against bots {humans < 2 ? '· needed while you’re alone' : ''}</span></label>
        </div>
      )}
      {party.status !== 'playing' && (
        <div className="party-start-area">
          {host ? <button disabled={!party.game || !allReady} onClick={() => send({ t: 'party_start' })}>{party.game ? `Start ${GAME_NAMES[party.game]}` : 'Choose a game to start'}</button> : <button onClick={() => send({ t: 'party_ready', ready: !mine?.ready })}>{mine?.ready ? 'Not ready' : "I'm ready"}</button>}
          <small className="party-start-hint">{host ? (allReady ? (party.game ? 'Your party is ready. Let’s play.' : 'Select a game to see its rules and settings.') : 'Waiting for selected players to be ready') : 'The host chooses the game type.'}</small>
        </div>
      )}
    </div>
  );
}

export function GamesPanel() {
  const myPartyId = useStore((s) => s.myPartyId);
  const parties = useStore((s) => s.parties);
  const party = myPartyId ? parties[myPartyId] : null;
  const board = useStore((s) => s.leaderboard);
  const connection = useStore((s) => s.connection);
  const [view, setView] = useState<'games' | 'board'>('games');
  const nearbyParties = useMemo(() => Object.values(parties).filter((p) => p.id !== myPartyId && Math.hypot(p.x - localPos.x, p.z - localPos.z) <= PARTY_JOIN_RADIUS), [parties, myPartyId]);
  if (party) return <Lobby party={party} />;
  if (view === 'board') return <div><button className="board-back" onClick={() => setView('games')} aria-label="Back to games"><Icon name="back" size={16} /></button><Boards /></div>;
  return (
    <div className="games">
      <p className="muted">Create a party, gather nearby friends, and switch games together. Stand near other islanders so they can join.</p>
      <button disabled={connection !== 'online'} onClick={() => send({ t: 'party_create' })}><Icon name="dice" size={16} /> Open a table here</button>
      {nearbyParties.length > 0 && (<div className="games-join"><h3>Tables nearby</h3>{nearbyParties.map((p) => <div key={p.id} className="party-member"><span className="person-emoji">🎲</span><strong>{p.members[0]?.name}'s table</strong><small>{p.game ? GAME_NAMES[p.game] : 'Choosing a game'} · {p.members.length} {p.members.length === 1 ? 'player' : 'players'}{p.status === 'playing' ? ' · playing' : ''}</small><button className="small" onClick={() => send({ t: 'party_join', id: p.id })}>Join</button></div>)}</div>)}
      <div className="games-picker">
        {TILES.map((t) => <div key={t.id} className={`game-tile ${t.cls}`}><div className="game-tile-art"><Icon name={t.icon} size={34} /></div><div className="game-tile-copy"><strong>{t.title}</strong><small>{t.blurb}</small></div><RankLine game={t.id} board={board} /></div>)}
        <div className="game-tile jetski-tile"><div className="game-tile-art"><Icon name="jetski" size={34} /></div><div className="game-tile-copy"><strong>Jetski Rush</strong><small>Elimination race · coming soon.</small></div></div>
      </div>
      <button className="secondary" onClick={() => setView('board')}><Icon name="trophy" size={16} /> Leaderboards</button>
    </div>
  );
}
