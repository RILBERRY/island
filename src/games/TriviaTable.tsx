import { useEffect, useState } from 'react';
import { send } from '../net/socket';
import { useStore } from '../store';
import type { TriviaView } from '../../shared/protocol';
import { TRIVIA_TOPICS } from '../../shared/trivia';
import { sfx } from '../audio';

const LETTERS = ['A', 'B', 'C', 'D'];

export function TriviaTable({ view }: { view: TriviaView }) {
  const [now, setNow] = useState(Date.now());
  const offset = useStore((s) => s.serverOffset);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(t); }, []);
  const elapsed = (now + offset - view.phaseStartedAt) / 1000;
  const remaining = Math.max(0, view.seconds - elapsed);
  const me = view.players.find((p) => p.id === view.you);
  useEffect(() => { if (view.phase === 'reveal' && me) { if (me.correct) sfx('correct'); else if (me.correct === false) sfx('wrong'); } }, [view.phase, view.index]);
  const topics = TRIVIA_TOPICS.filter((t) => view.topics.includes(t.id));
  const standings = view.players.slice().sort((a, b) => b.score - a.score);
  return (
    <div className="trivia-stage">
      <aside className="trivia-standings">
        <h4>Standings</h4>
        {standings.map((p, i) => <div key={p.id} className={`trivia-row ${p.id === view.you ? 'me' : ''}`}><span>{i + 1}</span><span className="board-face">{p.emoji}</span><strong>{p.name}{p.bot ? ' 🤖' : ''}</strong><em>{p.score}</em>{view.phase === 'question' && <small>{p.answered ? 'Answered' : '…'}</small>}{view.phase === 'reveal' && <small>{p.correct === null ? 'No answer' : p.correct ? '✓' : '✗'}</small>}</div>)}
      </aside>
      <div className="trivia-main">
        {view.phase === 'ready' && <div className="trivia-card trivia-ready"><div className="trivia-lobby-icon">?</div><h2>Get ready!</h2><p>{view.total} questions about {topics.length === 1 ? topics[0].name : 'these topics'}: {topics.map((t) => t.emoji).join(' ')}. {view.seconds} seconds each.</p></div>}
        {(view.phase === 'question' || view.phase === 'reveal') && view.question && (
          <div className="trivia-card trivia-question">
            <div className="trivia-head"><span>Question {view.index + 1} of {view.total}</span>{view.phase === 'question' && <span className="trivia-time">{Math.ceil(remaining)}s</span>}</div>
            <div className="trivia-bar"><div style={{ width: view.phase === 'question' ? `${(remaining / view.seconds) * 100}%` : '0%' }} /></div>
            <h2>{view.question.q}</h2>
            <div className="trivia-options">
              {view.question.options.map((o, i) => {
                const chosen = view.yourAnswer === i;
                const reveal = view.phase === 'reveal';
                const cls = reveal ? (i === view.answer ? 'right' : chosen ? 'wrong' : 'dim') : chosen ? 'chosen' : '';
                return <button key={i} className={`trivia-option ${cls}`} disabled={view.phase !== 'question' || view.yourAnswer !== undefined} onClick={() => send({ t: 'game', action: { type: 'answer', choice: i } })}><span>{LETTERS[i]}</span>{o}</button>;
              })}
            </div>
            {view.phase === 'question' && view.yourAnswer !== undefined && <p className="trivia-note">Answered · waiting for the others</p>}
            {view.phase === 'reveal' && <p className={`trivia-note ${me?.correct ? 'ok' : ''}`}>{me?.correct ? 'Correct!' : me?.correct === false ? 'Not quite' : 'Time’s up'}{view.fact ? ` · Did you know? ${view.fact}` : ''}</p>}
          </div>
        )}
        {view.phase === 'done' && <div className="trivia-card trivia-ready"><h2>Quiz complete</h2><p>Final scores are on the podium.</p></div>}
      </div>
    </div>
  );
}
