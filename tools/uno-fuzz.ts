// Plays many bot-only UNO matches through the engine to catch exceptions or stalls.
import { createUno, applyUno, botAction, tickUno, unoView } from '../shared/uno';
let games = 0, rounds = 0, timeouts = 0, maxSteps = 0;
for (let g = 0; g < 300; g++) {
  const n = 2 + (g % 3);
  const players = Array.from({ length: n }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, emoji: '🤖', bot: true }));
  const rules = { stackDrawTwo: g % 2 === 0, stackWildDrawFour: g % 3 === 0, drawUntilPlayable: g % 5 === 0, forcePlayDrawnCard: g % 7 === 0, targetScore: g % 4 === 0 ? 200 : 0, turnSeconds: 30 };
  let now = 1_000_000;
  const s = createUno(players, rules, now);
  let steps = 0;
  while (s.phase !== 'matchOver' && steps < 5000) {
    steps++; now += 1000;
    let acted = false;
    for (const p of s.players) {
      const a = botAction(s, p.id);
      if (!a) continue;
      const r = applyUno(s, p.id, a, now);
      if (r.ok && a.type === 'play' && a.color && s.phase === 'chooseColor' && s.pendingWildPlayer === p.id) applyUno(s, p.id, { type: 'chooseColor', color: a.color }, now);
      if (r.ok) { acted = true; break; }
    }
    if (!acted) { now += 31000; if (tickUno(s, now)) timeouts++; }
    unoView(s, s.players[0].id);
    for (const p of s.players) if (p.hand.length < 0) throw new Error('negative hand');
    const total = s.deck.length + s.discard.length + s.players.reduce((a, p) => a + p.hand.length, 0);
    if (total !== 108) throw new Error(`card count drift: ${total} in game ${g} step ${steps}`);
  }
  if (s.phase !== 'matchOver') throw new Error(`game ${g} did not finish (phase ${s.phase}, steps ${steps})`);
  games++; rounds += s.round; maxSteps = Math.max(maxSteps, steps);
}
console.log(`ok: ${games} games, ${rounds} rounds, ${timeouts} timeouts, max steps ${maxSteps}`);
