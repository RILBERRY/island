import { useMemo } from 'react';
import { useStore, localPos } from '../store';
import { send } from '../net/socket';
import { Icon } from './icons';
import { NEARBY_RADIUS, VOICE_RADIUS } from '../../shared/protocol';
import { teleportTo } from '../travel';

export function NearbyPanel() {
  const players = useStore((s) => s.players);
  const me = useStore((s) => s.me);
  const nearbyIds = useStore((s) => s.nearbyIds);
  const parties = useStore((s) => s.parties);
  const list = useMemo(() => Object.values(players).filter((p) => p.id !== me).map((p) => ({ p, d: Math.hypot(p.x - localPos.x, p.z - localPos.z) })).sort((a, b) => a.d - b.d), [players, me, nearbyIds]);
  const near = list.filter((x) => x.d <= NEARBY_RADIUS);
  const far = list.filter((x) => x.d > NEARBY_RADIUS);
  const st = useStore.getState();
  const row = ({ p, d }: (typeof list)[number]) => (
    <div className="person" key={p.id}>
      <span className="person-emoji">{p.emoji}</span>
      <div className="person-info"><strong>{p.name}</strong><small>@{p.username} · {d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`}{p.partyId && parties[p.partyId] ? ` · ${parties[p.partyId].status === 'playing' ? 'playing' : 'at a table'}` : ''}</small></div>
      <button className="icon-button" aria-label={`Wave at ${p.name}`} title="Wave" onClick={() => { send({ t: 'wave', to: p.id }); send({ t: 'emote', emote: 'wave' }); if (me) st.setEmote(me, 'wave'); st.toast(`You waved at ${p.name}.`); }}><Icon name="hand" size={16} /></button>
      <button className="icon-button" aria-label={`Teleport to ${p.name}`} title="Teleport next to them" onClick={() => { if (teleportTo(p.x, p.z, p.name)) st.setPanel(null); }}><Icon name="sparkles" size={16} /></button>
      <button className="icon-button" aria-label={`Walk to ${p.name}`} title="Walk there" onClick={() => { const w = st.walkTest; let x = p.x, z = p.z; if (w && !w(x, z)) { st.toast('There is no open walking point near them right now.', 'error'); return; } st.setWalkTarget({ x, z }); st.setPanel(null); }}><Icon name="walk" size={16} /></button>
    </div>
  );
  return (
    <div className="nearby">
      <div className="notice"><Icon name="micoff" size={18} /><p>Nearby voice isn’t part of this build. Voice would reach people within {VOICE_RADIUS} metres; global chat reaches everyone on the island.</p></div>
      <h3>Within {NEARBY_RADIUS} m</h3>
      {near.length === 0 ? <div className="empty-state"><Icon name="users" size={30} /><h4>No players nearby</h4><p>Invite a friend to join from another browser or device. You’ll see them here when they’re nearby.</p></div> : near.map(row)}
      <h3>Active islanders</h3>
      {far.length === 0 ? <p className="muted">Active islanders will appear here when they join.</p> : far.map(row)}
    </div>
  );
}
