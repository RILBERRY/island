import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { send } from '../net/socket';
import { Icon } from './icons';
import { QUICK_REACTIONS } from '../../shared/profile';
import type { ChatMessage } from '../../shared/protocol';

function fmtTime(at: number): string { return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function dayLabel(at: number): string { const d = new Date(at); const today = new Date(); if (d.toDateString() === today.toDateString()) return 'Today'; const y = new Date(); y.setDate(today.getDate() - 1); if (d.toDateString() === y.toDateString()) return 'Yesterday'; return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }); }

function renderText(text: string, me: string | undefined) {
  const parts = text.split(/(@[a-z0-9]+)/g);
  return parts.map((p, i) => (p.startsWith('@') ? <span key={i} className={`gc-mention ${me && p.slice(1) === me ? 'me' : ''}`}>{p}</span> : p));
}

export function ChatPanel({ scope, compact }: { scope: 'global' | 'party'; compact?: boolean }) {
  const messages = useStore((s) => (scope === 'party' ? s.partyChat : s.chat));
  const me = useStore((s) => s.me);
  const myUsername = useStore((s) => s.profile?.username);
  const players = useStore((s) => s.players);
  const connection = useStore((s) => s.connection);
  const replyTo = useStore((s) => s.replyTo);
  const setReplyTo = useStore((s) => s.setReplyTo);
  const [text, setText] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = list.current; if (el) el.scrollTop = el.scrollHeight; }, [messages.length, scope]);
  useEffect(() => { useStore.getState().clearUnread(); }, [messages.length]);

  const mention = useMemo(() => { const m = text.match(/@([a-z0-9]*)$/i); if (!m) return []; const q = m[1].toLowerCase(); return Object.values(players).filter((p) => p.id !== me && p.username.startsWith(q)).slice(0, 5); }, [text, players, me]);

  const submit = () => {
    const t = text.trim(); if (!t) return;
    if (editing) { send({ t: 'chat_edit', id: editing.id, text: t }); setEditing(null); }
    else send({ t: 'chat', text: t, scope, replyTo: replyTo?.id });
    setText(''); setReplyTo(null);
  };

  let lastDay = ''; let lastFrom = '';
  return (
    <div className={`gc ${compact ? 'compact' : ''}`}>
      {!compact && <p className="gc-notice">Messages are automatically deleted 7 days after they’re sent. Don’t share private information. Keep it friendly.</p>}
      <div className="gc-scroller" ref={list} onClick={() => setActive(null)}>
        {messages.length === 0 && <div className="gc-empty"><span><Icon name="chat" size={26} /></span><h3>No messages yet</h3><p>{scope === 'party' ? 'Say hello to your party.' : 'This is the start of global chat. Say hello to everyone on the island.'}</p></div>}
        {messages.map((m, i) => {
          const day = dayLabel(m.at); const showDay = day !== lastDay; lastDay = day;
          const first = showDay || m.from.id !== lastFrom; lastFrom = m.from.id;
          const next = messages[i + 1]; const last = !next || next.from.id !== m.from.id;
          const mine = m.from.id === me;
          const forMe = !mine && myUsername && m.text.includes(`@${myUsername}`);
          return (
            <div key={m.id}>
              {showDay && <div className="gc-day"><span>{day}</span></div>}
              <div className={`gc-row ${mine ? 'mine' : 'theirs'} ${first ? 'first' : ''} ${last ? 'last' : ''}`}>
                {!mine && (first ? <div className="gc-avatar">{m.from.emoji}</div> : <div className="gc-avatar-space" />)}
                <div className="gc-stack">
                  {first && !mine && <div className="gc-author">{m.from.name} <span className="gc-user">@{m.from.username}</span></div>}
                  <button className={`gc-bubble ${forMe ? 'for-me' : ''} ${active === m.id ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setActive(active === m.id ? null : m.id); }}>
                    {m.replyTo && <div className="gc-quote"><strong>{m.replyTo.name}</strong><span>{m.replyTo.text}</span></div>}
                    <p>{m.deleted ? <em>Message deleted</em> : renderText(m.text, myUsername)}</p>
                    <div className="gc-meta">{m.editedAt && <span>edited</span>}<span>{fmtTime(m.at)}</span></div>
                  </button>
                  {Object.keys(m.reactions).length > 0 && (
                    <div className="gc-reactions">{Object.entries(m.reactions).map(([emoji, ids]) => <button key={emoji} className={ids.includes(me ?? '') ? 'on' : ''} onClick={() => send({ t: 'react', id: m.id, emoji })}><span>{emoji}</span>{ids.length}</button>)}</div>
                  )}
                  {active === m.id && !m.deleted && (
                    <div className="gc-tray" onClick={(e) => e.stopPropagation()}>
                      <div className="gc-tray-reactions">{QUICK_REACTIONS.map((r) => <button key={r} className={m.reactions[r]?.includes(me ?? '') ? 'on' : ''} onClick={() => { send({ t: 'react', id: m.id, emoji: r }); setActive(null); }}>{r}</button>)}</div>
                      <div className="gc-tray-actions">
                        <button onClick={() => { setReplyTo(m); setActive(null); box.current?.focus(); }}><Icon name="reply" size={14} /> Reply</button>
                        <button onClick={() => { navigator.clipboard?.writeText(m.text); useStore.getState().toast('Message copied.'); setActive(null); }}><Icon name="copy" size={14} /> Copy</button>
                        {mine && Date.now() - m.at < 15 * 60 * 1000 && <button onClick={() => { setEditing(m); setText(m.text); setActive(null); box.current?.focus(); }}><Icon name="edit" size={14} /> Edit</button>}
                        {mine && <button onClick={() => { send({ t: 'chat_delete', id: m.id }); setActive(null); }}><Icon name="trash" size={14} /> Delete</button>}
                        {!mine && <button onClick={() => { useStore.getState().toast('Thanks. Reports go to the island moderators in the full app.'); setActive(null); }}><Icon name="flag" size={14} /> Report</button>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="gc-composer">
        {(replyTo || editing) && (
          <div className="gc-replying"><strong>{editing ? 'Editing your message' : `Replying to ${replyTo?.from.name}`}</strong><span>{editing ? '' : replyTo?.text.slice(0, 80)}</span><button className="quiet" onClick={() => { setReplyTo(null); setEditing(null); setText(''); }} aria-label="Cancel"><Icon name="x" size={14} /></button></div>
        )}
        {mention.length > 0 && <div className="gc-mentions">{mention.map((p) => <button key={p.id} onClick={() => { setText(text.replace(/@([a-z0-9]*)$/i, `@${p.username} `)); box.current?.focus(); }}>{p.emoji} {p.name} <small>@{p.username}</small></button>)}</div>}
        <div className="gc-input">
          <textarea ref={box} rows={1} value={text} placeholder={scope === 'party' ? 'Message your party…' : 'Message everyone…'} maxLength={500} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} />
          <button className="send" onClick={submit} disabled={!text.trim() || connection !== 'online'} aria-label="Send"><Icon name="send" size={18} /></button>
        </div>
        {connection !== 'online' && <small className="gc-offline">Reconnecting to the island…</small>}
      </div>
    </div>
  );
}
