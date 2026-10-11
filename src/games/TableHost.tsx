import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { send } from '../net/socket';
import { Icon } from '../ui/icons';
import { ChatPanel } from '../ui/ChatPanel';
import { UnoTable } from './UnoTable';
import { TriviaTable } from './TriviaTable';
import { ChessTable } from './ChessTable';
import { Podium } from './Podium';
import { GAME_NAMES } from '../../shared/protocol';
import { sfx } from '../audio';

export function TableHost() {
  const myPartyId = useStore((s) => s.myPartyId);
  const party = useStore((s) => (s.myPartyId ? s.parties[s.myPartyId] : undefined));
  const game = useStore((s) => s.game);
  const me = useStore((s) => s.me);
  const daylight = useStore((s) => s.daylight);
  const [chat, setChat] = useState(false);
  const gameEvent = useStore((s) => s.gameEvent);
  useEffect(() => {
    if (!gameEvent) return;
    const mine = gameEvent.by === me;
    switch (gameEvent.event) {
      case 'play': case 'reverse': sfx('play'); break;
      case 'draw': sfx('draw'); break;
      case 'uno': sfx('uno'); break;
      case 'win': sfx(mine ? 'win' : 'lose'); break;
      case 'move': sfx('move'); break;
      case 'check': sfx('check'); break;
      case 'timeout': if (mine) useStore.getState().toast('Time’s up — you drew a card'); break;
    }
  }, [gameEvent, me]);

  if (!myPartyId || !party) return null;
  const mine = party.members.find((m) => m.id === me);
  if (!mine || mine.sittingOut) return null;
  if (party.status === 'lobby') return null;
  const host = party.hostId === me;
  const title = party.game ? GAME_NAMES[party.game] : 'Table';
  return (
    <div className={`table-root ${daylight.night > 0.5 ? 'night' : 'day'}`}>
      <div className="table-stage">
        <div className="table-top">
          <strong>{title} table</strong>
          <div className="table-top-actions">
            <button className="pill" onClick={() => setChat((c) => !c)}><Icon name="chat" size={14} /> Party chat</button>
            {host && <button className="pill" onClick={() => send({ t: 'party_lobby' })}><Icon name="back" size={14} /> Return to lobby</button>}
            {!host && <button className="pill" onClick={() => send({ t: 'party_leave' })}><Icon name="x" size={14} /> Leave</button>}
          </div>
        </div>
        {chat && <div className="table-chat"><ChatPanel scope="party" compact /></div>}
        {party.status === 'finished' && party.results ? (
          <div className="table-results">
            <Podium podium={party.results.podium} ranked={party.results.ranked} game={party.results.game} />
            {host ? <div className="row"><button onClick={() => send({ t: 'party_start' })}>Play again</button><button className="secondary" onClick={() => send({ t: 'party_lobby' })}>Return everyone to lobby</button></div> : <p>Match finished. Waiting for the host to return everyone to the lobby.</p>}
          </div>
        ) : !game || game.partyId !== myPartyId ? (
          <div className="table-results"><p>Starting game…</p></div>
        ) : game.view.game === 'uno' ? <UnoTable view={game.view.view} /> : game.view.game === 'trivia' ? <TriviaTable view={game.view.view} /> : <ChessTable view={game.view.view} />}
      </div>
    </div>
  );
}
