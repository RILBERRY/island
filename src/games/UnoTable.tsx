import { useEffect, useState } from 'react';
import { send } from '../net/socket';
import { useStore } from '../store';
import type { UnoView, UnoCard, UnoColor } from '../../shared/uno';
import { UNO_COLORS } from '../../shared/uno';
import { Icon } from '../ui/icons';

function symbol(c: UnoCard): string {
  switch (c.value) { case 'skip': return '⊘'; case 'reverse': return '⇄'; case 'draw2': return '+2'; case 'wild4': return '+4'; case 'wild': return '✦'; default: return c.value; }
}

export function Card({ card, playable, onClick, small, back }: { card?: UnoCard; playable?: boolean; onClick?: () => void; small?: boolean; back?: boolean }) {
  if (back || !card) return <div className={`uno-card back ${small ? 'small' : ''}`} />;
  return (
    <button className={`uno-card c-${card.color} ${playable ? 'playable' : ''} ${small ? 'small' : ''}`} disabled={!onClick} onClick={onClick} aria-label={`${card.color} ${card.value}`}>
      <span className="uno-corner">{symbol(card)}</span><span className="uno-center">{symbol(card)}</span><span className="uno-corner flip">{symbol(card)}</span>
    </button>
  );
}

function act(action: unknown) { send({ t: 'game', action }); }

export function UnoTable({ view }: { view: UnoView }) {
  const me = view.you;
  const myTurn = view.current === me && view.phase === 'playing';
  const [now, setNow] = useState(Date.now());
  const offset = useStore((s) => s.serverOffset);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  const remaining = Math.max(0, view.turnSeconds - (now + offset - view.turnStartedAt) / 1000);
  const meIdx = view.players.findIndex((p) => p.id === me);
  const others = [...view.players.slice(meIdx + 1), ...view.players.slice(0, meIdx)];
  const chooseColor = view.phase === 'chooseColor' && view.pendingWildPlayer === me;
  const myCards = view.players[meIdx]?.cards ?? 0;
  const catchTarget = view.catchable && view.catchable.playerId !== me ? view.players.find((p) => p.id === view.catchable!.playerId) : null;
  const canCatch = catchTarget && catchTarget.cards === 1 && !catchTarget.calledUno && now + offset <= view.catchable!.until;
  return (
    <div className="uno-stage">
      <div className="uno-opponents">
        {others.map((p) => (
          <div key={p.id} className={`uno-seat ${view.current === p.id ? 'turn' : ''}`}>
            <span className="board-face">{p.emoji}</span>
            <div className="uno-seat-info"><strong>{p.name}{p.bot ? ' 🤖' : ''}</strong><small>{p.cards} {p.cards === 1 ? 'card' : 'cards'} · {p.score} pts</small></div>
            <div className="uno-seat-cards">{Array.from({ length: Math.min(p.cards, 7) }).map((_, i) => <div key={i} className="uno-card back tiny" />)}</div>
            {p.cards === 1 && p.calledUno && <span className="uno-badge">UNO!</span>}
            {canCatch && catchTarget?.id === p.id && <button className="uno-call catch" onClick={() => act({ type: 'catchUno', targetId: p.id })}>Catch {p.name}!</button>}
          </div>
        ))}
      </div>
      <div className="uno-center-area">
        <div className="uno-deck" onClick={() => myTurn && !view.drawn && act({ type: 'draw' })} role="button" aria-label="Draw a card">
          <div className="uno-card back" /><small>{view.deckCount}</small>
        </div>
        <div className="uno-pile">
          <Card card={view.top} />
          <span className={`uno-color-dot c-${view.activeColor}`} aria-label={`Active colour ${view.activeColor}`} />
        </div>
        <div className="uno-status">
          <span className={`uno-dir ${view.direction === -1 ? 'rev' : ''}`}>{view.direction === 1 ? '↻' : '↺'}</span>
          <strong>{view.phase === 'roundOver' ? 'Round over' : view.phase === 'matchOver' ? 'Match over' : myTurn ? 'Your turn' : chooseColor ? 'Choose a colour' : `${view.players.find((p) => p.id === view.current)?.name}'s turn`}</strong>
          {view.pendingDraw > 0 && <em>+{view.pendingDraw} pending</em>}
          <div className="uno-timer"><div style={{ width: `${(remaining / view.turnSeconds) * 100}%` }} /></div>
          <small>Round {view.round}{view.rules.targetScore ? ` · first to ${view.rules.targetScore}` : ''}</small>
        </div>
      </div>
      <div className="uno-log">{view.log.slice(-2).map((l, i) => <span key={i}>{l}</span>)}</div>
      <div className="uno-hand-area">
        <div className="uno-actions">
          {(myCards === 2 || myCards === 1) && <button className="uno-call" onClick={() => act({ type: 'callUno' })}>UNO!</button>}
          {view.drawn && myTurn && !view.rules.forcePlayDrawnCard && <button className="pill" onClick={() => act({ type: 'pass' })}>Keep &amp; pass</button>}
          {myTurn && !view.drawn && view.playable.length === 0 && <button className="pill" onClick={() => act({ type: 'draw' })}>{view.pendingDraw > 0 ? `Draw ${view.pendingDraw}` : 'Draw a card'}</button>}
          {view.phase === 'roundOver' && <button className="pill" onClick={() => act({ type: 'nextRound' })}>Next round</button>}
        </div>
        <div className="uno-hand">
          {view.hand.map((c) => <Card key={c.id} card={c} playable={myTurn && view.playable.includes(c.id)} onClick={myTurn && view.playable.includes(c.id) ? () => act({ type: 'play', cardId: c.id }) : undefined} />)}
        </div>
      </div>
      {chooseColor && (
        <div className="uno-modal"><div className="uno-modal-card"><strong>Choose a colour</strong><div className="uno-colors">{UNO_COLORS.map((c: UnoColor) => <button key={c} className={`c-${c}`} onClick={() => act({ type: 'chooseColor', color: c })} aria-label={c} />)}</div></div></div>
      )}
      {view.phase === 'roundOver' && (
        <div className="uno-modal"><div className="uno-modal-card"><strong>{view.players.find((p) => p.id === view.roundWinner)?.name} wins the round</strong><div className="uno-scores">{view.players.map((p) => <span key={p.id}>{p.emoji} {p.name} · {p.score}</span>)}</div><small>Next round starts shortly</small><Icon name="cards" size={18} /></div></div>
      )}
    </div>
  );
}
