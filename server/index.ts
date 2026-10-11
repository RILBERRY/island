// L15 game server: presence, chat, parties and the three table games.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { Chess } from 'chess.js';
import type { ClientMessage, ServerMessage, PlayerPublic, ChatMessage, PartyPublic, PartySettings, GameId, Leaderboard, LeaderEntry, ProfileLite, TriviaView, ChessView, PodiumEntry, ChessSide } from '../shared/protocol';
import { PARTY_JOIN_RADIUS, TRANSPORT_MODES } from '../shared/protocol';
import { sanitizeCharacter, sanitizeName, slugUsername, PROFILE_EMOJIS } from '../shared/profile';
import { createUno, applyUno, tickUno, botAction, unoView, DEFAULT_UNO_RULES, type UnoState, type UnoAction } from '../shared/uno';
import { createTrivia, triviaAnswer, tickTrivia, DEFAULT_TRIVIA_SETTINGS, type TriviaState } from '../shared/trivia';
import { pickBotMove } from './chessBot';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0'; // all interfaces: reachable over the local network
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA_DIR = path.join(ROOT, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const CHAT_TTL = 7 * 24 * 3600 * 1000;
const BOT_NAMES = ['Dhon Kalo', 'Maarey', 'Kuda Ibbe', 'Haajara', 'Thuththu', 'Sakeena'];

// ---------- persistent state ----------
interface StoredStats { name: string; emoji: string; wins: number; matches: number; best: number; months: Record<string, { wins: number; matches: number; best: number }> }
interface Persist { profiles: Record<string, ProfileLite>; chat: ChatMessage[]; stats: Record<GameId, Record<string, StoredStats>> }
let persist: Persist = { profiles: {}, chat: [], stats: { uno: {}, trivia: {}, chess: {} } };
try {
  if (fs.existsSync(STATE_FILE)) persist = { ...persist, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
} catch (e) { console.warn('Could not read state file', e); }
let saveTimer: NodeJS.Timeout | null = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(persist)); } catch (e) { console.warn('save failed', e); }
  }, 1500);
}

// ---------- live state ----------
interface Client { ws: WebSocket; token: string; player: PlayerPublic; dirty: boolean; lastPing: number }
const clients = new Map<string, Client>(); // by player id

interface UnoGame { kind: 'uno'; state: UnoState; recorded: boolean }
interface TriviaGame { kind: 'trivia'; state: TriviaState; recorded: boolean }
interface ChessGame { kind: 'chess'; chess: Chess; white: ChessSide; black: ChessSide; clocks: { w: number; b: number }; lastTick: number; status: ChessView['status']; winner: 'w' | 'b' | null; lastMove: { from: string; to: string } | null; minutes: number; strength: 'easy' | 'normal' | 'strong'; botMoveAt: number; recorded: boolean }
interface Party { pub: PartyPublic; game: UnoGame | TriviaGame | ChessGame | null; dirty: boolean }
const parties = new Map<string, Party>();

function idFromToken(token: string): string {
  return 'p' + crypto.createHash('sha256').update(token).digest('hex').slice(0, 10);
}
function send(ws: WebSocket, msg: ServerMessage) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); }
function broadcast(msg: ServerMessage, except?: string) { const s = JSON.stringify(msg); for (const [id, c] of clients) if (id !== except && c.ws.readyState === WebSocket.OPEN) c.ws.send(s); }
function sendParty(party: Party, msg: ServerMessage) { for (const m of party.pub.members) { const c = clients.get(m.id); if (c) send(c.ws, msg); } }

function cleanProfile(p: Partial<ProfileLite> | undefined): ProfileLite {
  const name = sanitizeName(String(p?.name ?? '')) || 'Islander';
  const emoji = PROFILE_EMOJIS.includes(String(p?.emoji)) ? String(p?.emoji) : PROFILE_EMOJIS[0];
  const home = p?.home && typeof p.home.x === 'number' && typeof p.home.z === 'number' ? { x: p.home.x, z: p.home.z, label: sanitizeName(String(p.home.label ?? '')) } : null;
  return { name, username: slugUsername(String(p?.username || name)), emoji, character: sanitizeCharacter(p?.character), home, language: p?.language === 'dv' ? 'dv' : 'en' };
}

// ---------- leaderboard ----------
function monthKey(d = new Date()) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; }
function leaderboard(): Leaderboard {
  const out = {} as Leaderboard;
  const mk = monthKey();
  for (const game of ['uno', 'trivia', 'chess'] as GameId[]) {
    const all: LeaderEntry[] = []; const month: LeaderEntry[] = [];
    for (const [id, s] of Object.entries(persist.stats[game] || {})) {
      all.push({ id, name: s.name, emoji: s.emoji, wins: s.wins, matches: s.matches, best: s.best });
      const m = s.months[mk];
      if (m) month.push({ id, name: s.name, emoji: s.emoji, wins: m.wins, matches: m.matches, best: m.best });
    }
    const sorter = game === 'trivia' ? (a: LeaderEntry, b: LeaderEntry) => b.best - a.best || b.matches - a.matches : (a: LeaderEntry, b: LeaderEntry) => b.wins - a.wins || a.matches - b.matches;
    out[game] = { allTime: all.sort(sorter).slice(0, 50), month: month.sort(sorter).slice(0, 50) };
  }
  return out;
}
function recordStat(game: GameId, id: string, name: string, emoji: string, won: boolean, score: number) {
  const g = (persist.stats[game] ||= {});
  const s = (g[id] ||= { name, emoji, wins: 0, matches: 0, best: 0, months: {} });
  s.name = name; s.emoji = emoji; s.matches += 1; if (won) s.wins += 1; s.best = Math.max(s.best, score);
  const m = (s.months[monthKey()] ||= { wins: 0, matches: 0, best: 0 });
  m.matches += 1; if (won) m.wins += 1; m.best = Math.max(m.best, score);
  save();
}

// ---------- chat ----------
function pruneChat() { const cutoff = Date.now() - CHAT_TTL; persist.chat = persist.chat.filter((m) => m.at > cutoff); }

// ---------- parties ----------
function defaultSettings(): PartySettings {
  return { uno: { ...DEFAULT_UNO_RULES }, trivia: { ...DEFAULT_TRIVIA_SETTINGS, topics: [...DEFAULT_TRIVIA_SETTINGS.topics] }, chess: { minutes: 5, strength: 'normal' }, bots: true };
}
function partyOf(playerId: string): Party | null { const c = clients.get(playerId); if (!c?.player.partyId) return null; return parties.get(c.player.partyId) ?? null; }
function publishParty(party: Party) { broadcast({ t: 'party', party: party.pub }); }
function removeParty(id: string) { parties.delete(id); broadcast({ t: 'party_removed', id }); }

function leaveParty(playerId: string) {
  const party = partyOf(playerId);
  const c = clients.get(playerId);
  if (c) { c.player.partyId = null; send(c.ws, { t: 'party_you', partyId: null }); broadcast({ t: 'player_update', player: c.player }); }
  if (!party) return;
  party.pub.members = party.pub.members.filter((m) => m.id !== playerId);
  if (party.game && party.pub.status === 'playing') {
    // A human leaving mid-match ends it without a ranked result (like D15).
    endMatch(party, false, `${c?.player.name ?? 'A player'} left the table`);
  }
  if (party.pub.members.length === 0) { removeParty(party.pub.id); return; }
  if (party.pub.hostId === playerId) party.pub.hostId = party.pub.members[0].id;
  publishParty(party);
}

function botSide(i: number): ChessSide { return { id: `bot${i}`, name: BOT_NAMES[i % BOT_NAMES.length], emoji: '🤖', bot: true }; }

function startMatch(party: Party) {
  const pub = party.pub;
  if (!pub.game) return;
  const humans = pub.members.filter((m) => !m.sittingOut).map((m) => { const c = clients.get(m.id)!; return { id: m.id, name: c.player.name, emoji: c.player.emoji, bot: false }; });
  if (humans.length === 0) return;
  const bots = pub.settings.bots;
  if (pub.game === 'uno') {
    const seats = humans.slice(0, 4);
    let b = 0;
    while (bots && seats.length < Math.max(3, Math.min(4, humans.length + 1)) && seats.length < 4 && humans.length < 4 && b < 3) { const s = botSide(b++); seats.push({ id: s.id, name: s.name, emoji: s.emoji, bot: true }); if (humans.length >= 2 && seats.length >= 3) break; }
    if (seats.length < 2) { sendParty(party, { t: 'toast', text: 'Invite another islander or turn on practice bots.', kind: 'error' }); return; }
    party.game = { kind: 'uno', state: createUno(seats, pub.settings.uno), recorded: false };
  } else if (pub.game === 'trivia') {
    const seats = humans.slice(0, 8);
    if (bots && seats.length < 3) for (let i = 0; seats.length < 3; i++) { const s = botSide(i); seats.push({ id: s.id, name: s.name, emoji: s.emoji, bot: true }); }
    party.game = { kind: 'trivia', state: createTrivia(seats, pub.settings.trivia), recorded: false };
  } else if (pub.game === 'chess') {
    const a = humans[0];
    const b = humans[1] ?? (bots ? botSide(0) : null);
    if (!b) { sendParty(party, { t: 'toast', text: 'Chess needs a second player or the practice bot.', kind: 'error' }); return; }
    const whiteFirst = Math.random() < 0.5;
    const white = whiteFirst ? a : b; const black = whiteFirst ? b : a;
    const ms = pub.settings.chess.minutes * 60 * 1000;
    party.game = { kind: 'chess', chess: new Chess(), white, black, clocks: { w: ms, b: ms }, lastTick: Date.now(), status: 'playing', winner: null, lastMove: null, minutes: pub.settings.chess.minutes, strength: pub.settings.chess.strength, botMoveAt: Date.now() + 1200, recorded: false };
  }
  pub.status = 'playing'; pub.results = null;
  for (const m of pub.members) m.ready = false;
  publishParty(party);
  pushViews(party);
  sendParty(party, { t: 'game_event', partyId: pub.id, event: 'start' });
}

function podiumFrom(entries: { id: string; name: string; emoji: string; score: number; bot: boolean }[]): PodiumEntry[] {
  return entries.slice().sort((a, b) => b.score - a.score).map((e, i) => ({ ...e, place: i + 1 }));
}

function endMatch(party: Party, ranked: boolean, reason?: string) {
  const g = party.game;
  const pub = party.pub;
  if (!g) return;
  let podium: PodiumEntry[] = [];
  const humans = (ids: { id: string; bot: boolean }[]) => ids.filter((p) => !p.bot).length;
  if (g.kind === 'uno') {
    podium = podiumFrom(g.state.players.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, score: p.score, bot: p.bot })));
    const countable = ranked && humans(g.state.players) >= 2 && !g.recorded;
    if (countable) { g.recorded = true; for (const p of g.state.players) if (!p.bot) recordStat('uno', p.id, p.name, p.emoji, p.id === g.state.matchWinner, p.score); }
    ranked = countable;
  } else if (g.kind === 'trivia') {
    podium = podiumFrom(g.state.players.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, score: p.score, bot: p.bot })));
    const countable = ranked && humans(g.state.players) >= 2 && !g.recorded;
    if (countable) { g.recorded = true; const top = podium[0]; for (const p of g.state.players) if (!p.bot) recordStat('trivia', p.id, p.name, p.emoji, p.id === top.id, p.score); }
    ranked = countable;
  } else if (g.kind === 'chess') {
    const ws = g.winner === 'w' ? 1 : g.winner === 'b' ? 0 : 0.5;
    podium = podiumFrom([{ ...g.white, score: ws }, { ...g.black, score: 1 - ws }]);
    const countable = ranked && !g.white.bot && !g.black.bot && !g.recorded;
    if (countable) { g.recorded = true; recordStat('chess', g.white.id, g.white.name, g.white.emoji, g.winner === 'w', ws); recordStat('chess', g.black.id, g.black.name, g.black.emoji, g.winner === 'b', 1 - ws); }
    ranked = countable;
  }
  pub.status = 'finished';
  pub.results = { game: pub.game!, podium, ranked };
  for (const m of pub.members) m.sittingOut = false;
  pushViews(party);
  publishParty(party);
  if (reason) sendParty(party, { t: 'toast', text: reason });
  if (ranked) broadcast({ t: 'leaderboard', leaderboard: leaderboard() });
}

function chessView(g: ChessGame, you: string): ChessView {
  const legal = g.status === 'playing' ? g.chess.moves({ verbose: true }).map((m) => ({ from: m.from, to: m.to, promotion: m.promotion })) : [];
  return { you, white: g.white, black: g.black, fen: g.chess.fen(), turn: g.chess.turn(), history: g.chess.history(), status: g.status, winner: g.winner, lastMove: g.lastMove, check: g.chess.inCheck(), clocks: { ...g.clocks }, minutes: g.minutes, legal };
}

function triviaView(s: TriviaState, you: string): TriviaView {
  const q = s.questions[s.index];
  const me = s.players.find((p) => p.id === you);
  return {
    you, index: s.index, total: s.questions.length, phase: s.phase, phaseStartedAt: s.phaseStartedAt, seconds: s.settings.seconds,
    question: s.phase === 'question' || s.phase === 'reveal' ? { q: q.q, options: q.options } : null,
    answer: s.phase === 'reveal' || s.phase === 'done' ? q.answer : null,
    fact: s.phase === 'reveal' ? q.fact ?? null : null,
    yourAnswer: me?.answers[s.index],
    players: s.players.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, score: p.score, streak: p.streak, answered: p.answers[s.index] !== undefined, correct: s.phase === 'reveal' || s.phase === 'done' ? (p.answers[s.index] === null || p.answers[s.index] === undefined ? null : p.answers[s.index] === q.answer) : null, bot: p.bot })),
    topics: s.settings.topics,
  };
}

function pushViews(party: Party) {
  const g = party.game;
  if (!g) return;
  for (const m of party.pub.members) {
    const c = clients.get(m.id); if (!c) continue;
    if (g.kind === 'uno') send(c.ws, { t: 'game', partyId: party.pub.id, view: { game: 'uno', view: unoView(g.state, m.id) } });
    else if (g.kind === 'trivia') send(c.ws, { t: 'game', partyId: party.pub.id, view: { game: 'trivia', view: triviaView(g.state, m.id) } });
    else send(c.ws, { t: 'game', partyId: party.pub.id, view: { game: 'chess', view: chessView(g, m.id) } });
  }
}

function handleGameAction(party: Party, playerId: string, action: unknown) {
  const g = party.game;
  if (!g || party.pub.status !== 'playing') return;
  const a = action as Record<string, unknown>;
  if (!a || typeof a.type !== 'string') return;
  if (g.kind === 'uno') {
    const res = applyUno(g.state, playerId, a as unknown as UnoAction);
    if (!res.ok) { const c = clients.get(playerId); if (c && res.error) send(c.ws, { t: 'toast', text: res.error, kind: 'error' }); return; }
    if (res.event) sendParty(party, { t: 'game_event', partyId: party.pub.id, event: res.event, by: playerId });
    if (g.state.phase === 'matchOver') endMatch(party, true); else pushViews(party);
  } else if (g.kind === 'trivia') {
    if (a.type === 'answer' && typeof a.choice === 'number') { if (triviaAnswer(g.state, playerId, a.choice)) pushViews(party); }
  } else if (g.kind === 'chess') {
    const side = g.white.id === playerId ? 'w' : g.black.id === playerId ? 'b' : null;
    if (!side) return;
    if (a.type === 'resign') { g.status = 'resigned'; g.winner = side === 'w' ? 'b' : 'w'; endMatch(party, true); return; }
    if (a.type === 'move' && g.chess.turn() === side) {
      try { const mv = g.chess.move({ from: String(a.from), to: String(a.to), promotion: typeof a.promotion === 'string' ? a.promotion : undefined }); g.lastMove = { from: mv.from, to: mv.to }; }
      catch { const c = clients.get(playerId); if (c) send(c.ws, { t: 'toast', text: 'That move is not legal.', kind: 'error' }); return; }
      g.lastTick = Date.now(); g.botMoveAt = Date.now() + 700;
      sendParty(party, { t: 'game_event', partyId: party.pub.id, event: g.chess.inCheck() ? 'check' : 'move', by: playerId });
      checkChessEnd(party, g);
    }
  }
}

function checkChessEnd(party: Party, g: ChessGame) {
  if (g.chess.isCheckmate()) { g.status = 'checkmate'; g.winner = g.chess.turn() === 'w' ? 'b' : 'w'; endMatch(party, true); return true; }
  if (g.chess.isDraw() || g.chess.isStalemate()) { g.status = 'draw'; g.winner = null; endMatch(party, true); return true; }
  pushViews(party);
  return false;
}

// ---------- game loop ----------
setInterval(() => {
  const now = Date.now();
  for (const party of parties.values()) {
    const g = party.game;
    if (!g || party.pub.status !== 'playing') continue;
    if (g.kind === 'uno') {
      let changed = false;
      const ev = tickUno(g.state, now);
      if (ev) { changed = true; sendParty(party, { t: 'game_event', partyId: party.pub.id, event: ev }); }
      // Bots act after a short think.
      for (const p of g.state.players) {
        if (!p.bot) continue;
        const myTurn = g.state.phase === 'playing' && g.state.players[g.state.current].id === p.id;
        const myChoice = g.state.phase === 'chooseColor' && g.state.pendingWildPlayer === p.id;
        const roundOver = g.state.phase === 'roundOver';
        if ((myTurn || myChoice) && now - g.state.turnStartedAt < 900 + Math.random() * 400) continue;
        if (roundOver && now - g.state.turnStartedAt < 5000) continue;
        const act = botAction(g.state, p.id);
        if (!act) continue;
        if (act.type === 'catchUno' && Math.random() < 0.7) continue;
        const res = applyUno(g.state, p.id, act, now);
        if (res.ok) { changed = true; if (res.event) sendParty(party, { t: 'game_event', partyId: party.pub.id, event: res.event, by: p.id }); }
        if (act.type === 'play' && act.color && g.state.phase === 'chooseColor' && g.state.pendingWildPlayer === p.id) {
          applyUno(g.state, p.id, { type: 'chooseColor', color: act.color }, now);
        }
        break;
      }
      if (g.state.phase === 'matchOver') { endMatch(party, true); continue; }
      if (changed) pushViews(party);
    } else if (g.kind === 'trivia') {
      const before = g.state.players.map((p) => p.answers.length).join(',');
      const changed = tickTrivia(g.state, now);
      const after = g.state.players.map((p) => p.answers.length).join(',');
      if (g.state.phase === 'done') { endMatch(party, true); continue; }
      if (changed || before !== after) pushViews(party);
    } else if (g.kind === 'chess') {
      const turn = g.chess.turn();
      const dt = now - g.lastTick; g.lastTick = now;
      g.clocks[turn] = Math.max(0, g.clocks[turn] - dt);
      if (g.clocks[turn] === 0) { g.status = 'timeout'; g.winner = turn === 'w' ? 'b' : 'w'; endMatch(party, true); continue; }
      const mover = turn === 'w' ? g.white : g.black;
      if (mover.bot && now >= g.botMoveAt) {
        const mv = pickBotMove(g.chess.fen(), g.strength);
        if (mv) { const m = g.chess.move(mv); g.lastMove = { from: m.from, to: m.to }; }
        g.lastTick = Date.now();
        sendParty(party, { t: 'game_event', partyId: party.pub.id, event: g.chess.inCheck() ? 'check' : 'move', by: mover.id });
        if (checkChessEnd(party, g)) continue;
      } else if (Math.floor(now / 1000) !== Math.floor((now - dt) / 1000)) {
        // Push once per second so clocks stay in sync.
        pushViews(party);
      }
    }
  }
}, 400);

// Movement broadcast at 10 Hz.
setInterval(() => {
  const moves: [string, number, number, number, string, (typeof TRANSPORT_MODES)[number]][] = [];
  for (const c of clients.values()) if (c.dirty) { c.dirty = false; moves.push([c.player.id, c.player.x, c.player.z, c.player.rot, c.player.anim, c.player.mode]); }
  if (moves.length) broadcast({ t: 'players_move', moves });
}, 100);

// Drop dead sockets.
setInterval(() => {
  const now = Date.now();
  for (const c of clients.values()) if (now - c.lastPing > 45000) c.ws.terminate();
  pruneChat();
}, 15000);

// ---------- http ----------
const app = express();
app.use(express.json());
app.get('/api/health', (_req, res) => res.json({ ok: true, players: clients.size, parties: parties.size }));
app.get('/api/config', (_req, res) => res.json({ google: false, voice: false, gifs: false, announcement: null, maintenanceBanner: null, worldReview: 'OpenStreetMap geometry; not locally surveyed. Building and address coverage is incomplete.' }));
app.get('/api/world/current', (_req, res) => res.sendFile(path.join(ROOT, 'public', 'world', 'isdhoo.json')));
app.get('/api/leaderboard', (_req, res) => res.json(leaderboard()));
if (process.env.NODE_ENV === 'production') {
  const dist = path.join(ROOT, 'dist');
  app.use(express.static(dist, { maxAge: '1h' }));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  let me: Client | null = null;
  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    if (!me) {
      if (msg.t !== 'hello' || typeof msg.token !== 'string' || msg.token.length < 8) { ws.close(); return; }
      const id = idFromToken(msg.token);
      const profile = cleanProfile(msg.profile);
      persist.profiles[msg.token] = profile; save();
      const old = clients.get(id);
      if (old) { send(old.ws, { t: 'toast', text: 'You opened L15 somewhere else. This tab was disconnected.', kind: 'error' }); old.ws.close(); clients.delete(id); }
      const player: PlayerPublic = { id, ...profile, x: Number(msg.x) || 0, z: Number(msg.z) || 0, rot: 0, anim: 'idle', mode: 'walk', joinedAt: Date.now(), partyId: null };
      me = { ws, token: msg.token, player, dirty: false, lastPing: Date.now() };
      clients.set(id, me);
      pruneChat();
      send(ws, { t: 'welcome', id, players: [...clients.values()].map((c) => c.player), chat: persist.chat.filter((m) => m.scope === 'global').slice(-200), parties: [...parties.values()].map((p) => p.pub), serverTime: Date.now(), leaderboard: leaderboard(), partyId: null });
      broadcast({ t: 'player_join', player }, id);
      return;
    }
    me.lastPing = Date.now();
    const p = me.player;
    switch (msg.t) {
      case 'ping': send(ws, { t: 'pong', serverTime: Date.now() }); break;
      case 'move': {
        if (![msg.x, msg.z, msg.rot].every((n) => typeof n === 'number' && Number.isFinite(n))) break;
        p.x = msg.x; p.z = msg.z; p.rot = msg.rot; p.anim = String(msg.anim).slice(0, 12); p.mode = TRANSPORT_MODES.includes(msg.mode as never) ? msg.mode! : 'walk'; me.dirty = true; break;
      }
      case 'profile': {
        const profile = cleanProfile(msg.profile);
        persist.profiles[me.token] = profile; save();
        Object.assign(p, profile);
        broadcast({ t: 'player_update', player: p });
        const party = partyOf(p.id);
        if (party) { const m = party.pub.members.find((x) => x.id === p.id); if (m) { m.name = p.name; m.emoji = p.emoji; publishParty(party); } }
        break;
      }
      case 'chat': {
        const text = String(msg.text ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, 500);
        if (!text) break;
        const party = msg.scope === 'party' ? partyOf(p.id) : null;
        if (msg.scope === 'party' && !party) break;
        const reply = msg.replyTo ? persist.chat.find((m) => m.id === msg.replyTo) : undefined;
        const message: ChatMessage = { id: crypto.randomUUID(), scope: party ? 'party' : 'global', partyId: party?.pub.id, from: { id: p.id, name: p.name, username: p.username, emoji: p.emoji }, text, at: Date.now(), reactions: {}, replyTo: reply ? { id: reply.id, name: reply.from.name, text: reply.deleted ? 'Original message was deleted' : reply.text.slice(0, 120) } : undefined };
        persist.chat.push(message); if (persist.chat.length > 3000) persist.chat.splice(0, persist.chat.length - 3000); save();
        if (party) sendParty(party, { t: 'chat', message }); else broadcast({ t: 'chat', message });
        break;
      }
      case 'chat_edit': case 'chat_delete': case 'react': {
        const m = persist.chat.find((x) => x.id === msg.id);
        if (!m) break;
        if (msg.t === 'react') {
          const emoji = String(msg.emoji).slice(0, 8);
          const list = (m.reactions[emoji] ||= []);
          const i = list.indexOf(p.id); if (i >= 0) list.splice(i, 1); else list.push(p.id);
          if (list.length === 0) delete m.reactions[emoji];
        } else if (m.from.id !== p.id) break;
        else if (msg.t === 'chat_delete') { m.deleted = true; m.text = ''; }
        else if (Date.now() - m.at <= 15 * 60 * 1000) { const text = String(msg.text).trim().slice(0, 500); if (text) { m.text = text; m.editedAt = Date.now(); } }
        save();
        const party = m.partyId ? parties.get(m.partyId) : null;
        if (party) sendParty(party, { t: 'chat_update', message: m }); else broadcast({ t: 'chat_update', message: m });
        break;
      }
      case 'emote': broadcast({ t: 'emote', id: p.id, emote: String(msg.emote).slice(0, 12), at: Date.now() }); break;
      case 'wave': { const target = clients.get(String(msg.to)); if (target) send(target.ws, { t: 'wave', from: { id: p.id, name: p.name, username: p.username, emoji: p.emoji } }); break; }
      case 'party_create': {
        if (p.partyId) leaveParty(p.id);
        const id = crypto.randomBytes(4).toString('hex');
        const party: Party = { pub: { id, hostId: p.id, x: p.x, z: p.z, game: null, settings: defaultSettings(), members: [{ id: p.id, name: p.name, emoji: p.emoji, ready: false, sittingOut: false }], status: 'lobby', createdAt: Date.now(), results: null }, game: null, dirty: false };
        parties.set(id, party);
        p.partyId = id; send(ws, { t: 'party_you', partyId: id });
        broadcast({ t: 'player_update', player: p });
        publishParty(party);
        break;
      }
      case 'party_join': {
        const party = parties.get(String(msg.id));
        if (!party) { send(ws, { t: 'toast', text: 'That table has closed.', kind: 'error' }); break; }
        if (Math.hypot(party.pub.x - p.x, party.pub.z - p.z) > PARTY_JOIN_RADIUS) { send(ws, { t: 'toast', text: 'Walk closer to the table to join.', kind: 'error' }); break; }
        if (party.pub.members.length >= 8) { send(ws, { t: 'toast', text: 'That party is full.', kind: 'error' }); break; }
        if (p.partyId) leaveParty(p.id);
        party.pub.members.push({ id: p.id, name: p.name, emoji: p.emoji, ready: false, sittingOut: party.pub.status === 'playing' });
        p.partyId = party.pub.id; send(ws, { t: 'party_you', partyId: party.pub.id });
        broadcast({ t: 'player_update', player: p });
        publishParty(party);
        // Party chat history
        for (const m of persist.chat.filter((x) => x.partyId === party.pub.id).slice(-50)) send(ws, { t: 'chat', message: m });
        break;
      }
      case 'party_leave': leaveParty(p.id); break;
      case 'party_select': {
        const party = partyOf(p.id); if (!party || party.pub.hostId !== p.id || party.pub.status === 'playing') break;
        if (['uno', 'trivia', 'chess'].includes(msg.game)) party.pub.game = msg.game;
        const s = msg.settings || {};
        if (s.uno) party.pub.settings.uno = { ...party.pub.settings.uno, ...s.uno, turnSeconds: 30 };
        if (s.trivia) party.pub.settings.trivia = { topics: Array.isArray(s.trivia.topics) ? s.trivia.topics.map(String).slice(0, 8) : party.pub.settings.trivia.topics, questions: [5, 10, 15].includes(Number(s.trivia.questions)) ? Number(s.trivia.questions) : party.pub.settings.trivia.questions, seconds: [10, 15, 20].includes(Number(s.trivia.seconds)) ? Number(s.trivia.seconds) : party.pub.settings.trivia.seconds };
        if (s.chess) party.pub.settings.chess = { minutes: [3, 5, 10].includes(Number(s.chess.minutes)) ? Number(s.chess.minutes) : party.pub.settings.chess.minutes, strength: ['easy', 'normal', 'strong'].includes(String(s.chess.strength)) ? (s.chess.strength as 'easy') : party.pub.settings.chess.strength };
        if (typeof s.bots === 'boolean') party.pub.settings.bots = s.bots;
        for (const m of party.pub.members) m.ready = false;
        publishParty(party);
        break;
      }
      case 'party_ready': { const party = partyOf(p.id); if (!party) break; const m = party.pub.members.find((x) => x.id === p.id); if (m) m.ready = !!msg.ready; publishParty(party); break; }
      case 'party_start': {
        const party = partyOf(p.id); if (!party || party.pub.hostId !== p.id || party.pub.status === 'playing') break;
        if (!party.pub.game) { send(ws, { t: 'toast', text: 'Choose a game first.', kind: 'error' }); break; }
        const notReady = party.pub.members.filter((m) => !m.sittingOut && m.id !== p.id && !m.ready);
        if (notReady.length) { send(ws, { t: 'toast', text: 'Waiting for selected players to be ready', kind: 'error' }); break; }
        startMatch(party);
        break;
      }
      case 'party_lobby': {
        const party = partyOf(p.id); if (!party || party.pub.hostId !== p.id) break;
        if (party.pub.status === 'playing') endMatch(party, false, 'The host returned everyone to the lobby');
        party.pub.status = 'lobby'; party.game = null; party.pub.results = null;
        for (const m of party.pub.members) { m.ready = false; m.sittingOut = false; }
        publishParty(party);
        break;
      }
      case 'game': { const party = partyOf(p.id); if (party) handleGameAction(party, p.id, msg.action); break; }
    }
  });
  ws.on('close', () => {
    if (!me) return;
    const id = me.player.id;
    if (clients.get(id) === me) {
      leaveParty(id);
      clients.delete(id);
      broadcast({ t: 'player_leave', id });
    }
  });
});

server.listen(PORT, HOST, () => {
  const urls = [`http://localhost:${PORT}`];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    if (/^(docker|br-|veth|virbr|vmnet|tun)/.test(name)) continue; // skip container and VM bridges
    for (const n of list ?? []) if (n.family === 'IPv4' && !n.internal) urls.push(`http://${n.address}:${PORT}`);
  }
  console.log(`L15 ${process.env.NODE_ENV === 'production' ? '(serving dist/)' : '(API + WebSocket only; run vite for the client)'} listening on:`);
  for (const u of urls) console.log(`  ${u}`);
  if (process.env.NODE_ENV === 'production') console.log('Share the network address with other devices on your Wi-Fi.');
});
