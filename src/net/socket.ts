import { useStore, localPos, remoteTargets } from '../store';
import type { ClientMessage, ServerMessage, ProfileLite, PlayerPublic } from '../../shared/protocol';
import type { Profile } from '../../shared/profile';
import { sfx } from '../audio';

let ws: WebSocket | null = null;
let retry = 0;
let closedByUs = false;
let pingTimer: number | null = null;
let moveTimer: number | null = null;
let lastSent = { x: NaN, z: NaN, rot: NaN, anim: '', mode: '' };

function profileLite(p: Profile): ProfileLite {
  return { name: p.name, username: p.username, emoji: p.emoji, character: p.character, home: p.home, language: p.language };
}

export function send(msg: ClientMessage): boolean {
  if (ws && ws.readyState === WebSocket.OPEN) { ws.send(JSON.stringify(msg)); return true; }
  return false;
}

export function connect(): void {
  const store = useStore.getState();
  const profile = store.profile;
  if (!profile) return;
  closedByUs = false;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${proto}://${location.host}/ws`;
  store.setConnection(retry === 0 ? 'connecting' : 'reconnecting');
  ws = new WebSocket(url);
  ws.onopen = () => {
    retry = 0;
    send({ t: 'hello', token: profile.token, profile: profileLite(profile), x: localPos.x, z: localPos.z });
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = window.setInterval(() => send({ t: 'ping' }), 20000);
    if (moveTimer) clearInterval(moveTimer);
    moveTimer = window.setInterval(flushMove, 100);
  };
  ws.onmessage = (ev) => {
    let msg: ServerMessage;
    try { msg = JSON.parse(ev.data); } catch { return; }
    handle(msg);
  };
  ws.onclose = () => {
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
    if (moveTimer) { clearInterval(moveTimer); moveTimer = null; }
    useStore.getState().setConnection('offline');
    if (closedByUs) return;
    const delay = Math.min(15000, 1000 * Math.pow(1.7, retry++));
    setTimeout(() => { if (!closedByUs && useStore.getState().phase === 'island') connect(); }, delay);
  };
  ws.onerror = () => { /* handled by onclose */ };
}

export function disconnect(): void { closedByUs = true; ws?.close(); ws = null; }

function flushMove() {
  if (!localPos.ready) return;
  const moved = Math.abs(localPos.x - lastSent.x) > 0.01 || Math.abs(localPos.z - lastSent.z) > 0.01 || Math.abs(localPos.rot - lastSent.rot) > 0.01 || localPos.anim !== lastSent.anim || localPos.mode !== lastSent.mode;
  if (!moved) return;
  lastSent = { x: localPos.x, z: localPos.z, rot: localPos.rot, anim: localPos.anim, mode: localPos.mode };
  send({ t: 'move', x: Math.round(localPos.x * 100) / 100, z: Math.round(localPos.z * 100) / 100, rot: Math.round(localPos.rot * 1000) / 1000, anim: localPos.anim, mode: localPos.mode });
}

export function sendProfile(): void {
  const p = useStore.getState().profile;
  if (p) send({ t: 'profile', profile: profileLite(p) });
}

function handle(msg: ServerMessage) {
  const s = useStore.getState();
  switch (msg.t) {
    case 'welcome': {
      const players: Record<string, PlayerPublic> = {};
      for (const p of msg.players) { players[p.id] = p; if (p.id !== msg.id) remoteTargets.set(p.id, { x: p.x, z: p.z, rot: p.rot, anim: p.anim, mode: p.mode ?? 'walk', at: Date.now() }); }
      const parties: Record<string, (typeof msg.parties)[number]> = {};
      for (const p of msg.parties) parties[p.id] = p;
      useStore.setState({ me: msg.id, players, chat: msg.chat, parties, leaderboard: msg.leaderboard, connection: 'online', serverOffset: msg.serverTime - Date.now(), myPartyId: msg.partyId, game: null });
      break;
    }
    case 'player_join': s.upsertPlayer(msg.player); remoteTargets.set(msg.player.id, { x: msg.player.x, z: msg.player.z, rot: msg.player.rot, anim: msg.player.anim, mode: msg.player.mode ?? 'walk', at: Date.now() }); break;
    case 'player_update': { const existing = s.players[msg.player.id]; s.upsertPlayer(existing ? { ...msg.player, x: existing.x, z: existing.z } : msg.player); break; }
    case 'player_leave': s.removePlayer(msg.id); break;
    case 'players_move': {
      const now = Date.now();
      for (const [id, x, z, rot, anim, mode] of msg.moves) {
        if (id === s.me) continue;
        remoteTargets.set(id, { x, z, rot, anim, mode: mode ?? 'walk', at: now });
        const existing = s.players[id];
        if (existing && existing.mode !== (mode ?? 'walk')) s.upsertPlayer({ ...existing, mode: mode ?? 'walk' });
      }
      break;
    }
    case 'chat': s.addChat(msg.message); if (msg.message.from.id !== s.me && msg.message.scope === 'global' && s.panel !== 'chat') sfx('message'); break;
    case 'chat_update': s.updateChat(msg.message); break;
    case 'emote': s.setEmote(msg.id, msg.emote); break;
    case 'wave': s.setWave({ from: msg.from, at: Date.now() }); sfx('wave'); break;
    case 'party': s.upsertParty(msg.party); break;
    case 'party_removed': s.removeParty(msg.id); break;
    case 'party_you': s.setMyPartyId(msg.partyId); break;
    case 'game': s.setGame({ partyId: msg.partyId, view: msg.view }); break;
    case 'game_event': s.setGameEvent({ event: msg.event, by: msg.by, at: Date.now() }); break;
    case 'leaderboard': s.setLeaderboard(msg.leaderboard); break;
    case 'toast': s.toast(msg.text, msg.kind ?? 'info'); break;
    case 'pong': s.setServerOffset(msg.serverTime - Date.now()); break;
  }
}
