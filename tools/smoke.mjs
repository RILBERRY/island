// End-to-end smoke test: two simulated islanders chat, open a table and play UNO, Quiz Night and chess.
import WebSocket from 'ws';
const URL = process.env.L15_URL || 'ws://localhost:3000/ws';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client(name, token) {
  const ws = new WebSocket(URL);
  const c = { name, ws, id: null, partyId: null, party: null, game: null, log: [], send: (m) => ws.send(JSON.stringify(m)), waiters: [] };
  ws.on('message', (raw) => {
    const m = JSON.parse(String(raw));
    c.log.push(m);
    if (m.t === 'welcome') c.id = m.id;
    if (m.t === 'party_you') c.partyId = m.partyId;
    if (m.t === 'party' && m.party.id === c.partyId) c.party = m.party;
    if (m.t === 'game') c.game = m.view;
    if (m.t === 'toast' && m.kind === 'error') console.log(`  [${name}] toast: ${m.text}`);
    for (const w of c.waiters.slice()) if (w.pred(m)) { c.waiters.splice(c.waiters.indexOf(w), 1); w.res(m); }
  });
  c.wait = (pred, ms = 20000) => new Promise((res, rej) => { const w = { pred, res }; c.waiters.push(w); setTimeout(() => { if (c.waiters.includes(w)) { c.waiters.splice(c.waiters.indexOf(w), 1); rej(new Error(`${name}: timeout waiting`)); } }, ms); });
  c.open = new Promise((r) => ws.on('open', r));
  c.profile = { name, username: name.toLowerCase(), emoji: '🌴', character: { kind: 'human' }, home: null, language: 'en' };
  c.token = token;
  return c;
}

const A = client('Aishath', 'token-aaaaaaaaaaaa'); const B = client('Hassan', 'token-bbbbbbbbbbbb');
await Promise.all([A.open, B.open]);
A.send({ t: 'hello', token: A.token, profile: A.profile, x: 10, z: 10 }); B.send({ t: 'hello', token: B.token, profile: B.profile, x: 12, z: 11 });
await Promise.all([A.wait((m) => m.t === 'welcome'), B.wait((m) => m.t === 'welcome')]);
console.log('welcome ok', A.id, B.id);
A.send({ t: 'chat', text: `Hello @${B.profile.username}!`, scope: 'global' });
const chat = await B.wait((m) => m.t === 'chat');
console.log('chat ok:', chat.message.text);
B.send({ t: 'react', id: chat.message.id, emoji: '❤️' }); await A.wait((m) => m.t === 'chat_update');
A.send({ t: 'wave', to: B.id }); await B.wait((m) => m.t === 'wave'); console.log('wave ok');
A.send({ t: 'move', x: 20, z: 20, rot: 1, anim: 'walk' }); await B.wait((m) => m.t === 'players_move'); console.log('move ok');

// ---- party + UNO
A.send({ t: 'party_create' }); await A.wait((m) => m.t === 'party_you' && m.partyId);
B.send({ t: 'party_join', id: A.partyId }); await B.wait((m) => m.t === 'party_you' && m.partyId);
console.log('party ok', A.partyId);
A.send({ t: 'party_select', game: 'uno', settings: { bots: true, uno: { stackDrawTwo: true, targetScore: 0 } } }); await sleep(200);
B.send({ t: 'party_ready', ready: true }); await sleep(200);
A.send({ t: 'party_start' });
await Promise.all([A.wait((m) => m.t === 'game'), B.wait((m) => m.t === 'game')]);
console.log('uno started with', A.game.view.players.map((p) => p.name).join(', '));
async function playUno(c) {
  while (true) {
    const party = c.party; if (party && party.status === 'finished') return party;
    const v = c.game?.view; if (!v || c.game.game !== 'uno') { await sleep(100); continue; }
    if (v.phase === 'chooseColor' && v.pendingWildPlayer === c.id) c.send({ t: 'game', action: { type: 'chooseColor', color: 'red' } });
    else if (v.phase === 'playing' && v.current === c.id) {
      if (v.playable.length) c.send({ t: 'game', action: { type: 'play', cardId: v.playable[0] } });
      else if (v.drawn) c.send({ t: 'game', action: { type: 'pass' } });
      else c.send({ t: 'game', action: { type: 'draw' } });
      if (v.hand.length === 2) c.send({ t: 'game', action: { type: 'callUno' } });
    } else if (v.phase === 'roundOver') c.send({ t: 'game', action: { type: 'nextRound' } });
    await sleep(120);
  }
}
const t0 = Date.now();
const res = await Promise.race([Promise.all([playUno(A), playUno(B)]), sleep(120000).then(() => { throw new Error('uno did not finish'); })]);
console.log(`uno finished in ${((Date.now() - t0) / 1000).toFixed(1)}s:`, res[0].results.podium.map((p) => `${p.name}:${p.score}`).join(' '), 'ranked:', res[0].results.ranked);

// ---- trivia
A.send({ t: 'party_lobby' }); await sleep(200);
A.send({ t: 'party_select', game: 'trivia', settings: { bots: false, trivia: { topics: ['isdhoo', 'maldives'], questions: 5, seconds: 10 } } }); await sleep(200);
B.send({ t: 'party_ready', ready: true }); await sleep(200);
A.send({ t: 'party_start' }); await Promise.all([A.wait((m) => m.t === 'game'), B.wait((m) => m.t === 'game')]);
console.log('trivia started');
async function playTrivia(c) {
  let answered = -1;
  while (true) {
    const party = c.party; if (party && party.status === 'finished') return party;
    const v = c.game?.view; if (!v || c.game.game !== 'trivia') { await sleep(100); continue; }
    if (v.phase === 'question' && answered !== v.index) { answered = v.index; c.send({ t: 'game', action: { type: 'answer', choice: Math.floor(Math.random() * 4) } }); }
    await sleep(100);
  }
}
const t1 = Date.now();
const tr = await Promise.race([Promise.all([playTrivia(A), playTrivia(B)]), sleep(90000).then(() => { throw new Error('trivia did not finish'); })]);
console.log(`trivia finished in ${((Date.now() - t1) / 1000).toFixed(1)}s:`, tr[0].results.podium.map((p) => `${p.name}:${p.score}`).join(' '), 'ranked:', tr[0].results.ranked);

// ---- chess (A vs B, random moves, then A resigns)
A.send({ t: 'party_lobby' }); await sleep(200);
A.send({ t: 'party_select', game: 'chess', settings: { bots: false, chess: { minutes: 3, strength: 'easy' } } }); await sleep(200);
B.send({ t: 'party_ready', ready: true }); await sleep(200);
A.send({ t: 'party_start' }); await Promise.all([A.wait((m) => m.t === 'game'), B.wait((m) => m.t === 'game')]);
console.log('chess started');
async function playChess(c, resignAfter) {
  let moves = 0;
  while (true) {
    const party = c.party; if (party && party.status === 'finished') return party;
    const v = c.game?.view; if (!v || c.game.game !== 'chess') { await sleep(100); continue; }
    const mine = v.white.id === c.id ? 'w' : 'b';
    if (v.status === 'playing' && v.turn === mine && v.legal.length) {
      if (moves >= resignAfter) c.send({ t: 'game', action: { type: 'resign' } });
      else { const m = v.legal[Math.floor(Math.random() * v.legal.length)]; c.send({ t: 'game', action: { type: 'move', from: m.from, to: m.to, promotion: m.promotion } }); moves++; }
    }
    await sleep(80);
  }
}
const t2 = Date.now();
const ch = await Promise.race([Promise.all([playChess(A, 12), playChess(B, 100)]), sleep(60000).then(() => { throw new Error('chess did not finish'); })]);
console.log(`chess finished in ${((Date.now() - t2) / 1000).toFixed(1)}s:`, ch[0].results.podium.map((p) => `${p.name}:${p.score}`).join(' '), 'ranked:', ch[0].results.ranked);

// ---- chess vs bot (solo)
B.send({ t: 'party_leave' }); await sleep(200);
A.send({ t: 'party_select', game: 'chess', settings: { bots: true, chess: { minutes: 3, strength: 'normal' } } }); await sleep(200);
A.send({ t: 'party_start' }); await A.wait((m) => m.t === 'game');
const t3 = Date.now();
const vb = await Promise.race([playChess(A, 10), sleep(60000).then(() => { throw new Error('bot chess did not finish'); })]);
console.log(`bot chess finished in ${((Date.now() - t3) / 1000).toFixed(1)}s:`, vb.results.podium.map((p) => `${p.name}:${p.score}`).join(' '), 'ranked:', vb.results.ranked);
const lb = A.log.filter((m) => m.t === 'leaderboard').pop();
console.log('leaderboard uno:', lb?.leaderboard.uno.allTime.map((e) => `${e.name}:${e.wins}/${e.matches}`).join(' '), '| trivia:', lb?.leaderboard.trivia.allTime.map((e) => `${e.name}:${e.best}`).join(' '), '| chess:', lb?.leaderboard.chess.allTime.map((e) => `${e.name}:${e.wins}/${e.matches}`).join(' '));
A.ws.close(); B.ws.close();
console.log('SMOKE OK');
process.exit(0);
