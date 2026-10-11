// UNO-style card game engine. Pure functions over a plain state object so the
// server can run it authoritatively and the client can render views of it.

export type UnoColor = 'red' | 'yellow' | 'green' | 'blue';
export type UnoValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';
export interface UnoCard { id: number; color: UnoColor | 'wild'; value: UnoValue }

export interface UnoRules {
  stackDrawTwo: boolean;
  stackWildDrawFour: boolean;
  drawUntilPlayable: boolean;
  forcePlayDrawnCard: boolean;
  targetScore: number; // 0 = single round
  turnSeconds: number;
}

export const DEFAULT_UNO_RULES: UnoRules = {
  stackDrawTwo: false, stackWildDrawFour: false, drawUntilPlayable: false, forcePlayDrawnCard: false, targetScore: 0, turnSeconds: 30,
};

export interface UnoPlayer {
  id: string;
  name: string;
  emoji: string;
  bot: boolean;
  hand: UnoCard[];
  score: number;
  calledUno: boolean;
  roundsWon: number;
}

export type UnoPhase = 'playing' | 'chooseColor' | 'roundOver' | 'matchOver';

export interface UnoState {
  players: UnoPlayer[];
  deck: UnoCard[];
  discard: UnoCard[];
  current: number;
  direction: 1 | -1;
  activeColor: UnoColor;
  pendingDraw: number;
  pendingKind: 'draw2' | 'wild4' | null;
  phase: UnoPhase;
  drawn: { playerId: string; card: UnoCard } | null;
  pendingWildPlayer: string | null;
  roundWinner: string | null;
  matchWinner: string | null;
  turnStartedAt: number;
  round: number;
  rules: UnoRules;
  log: string[];
  lastAction: { type: string; playerId: string; card?: UnoCard; at: number } | null;
  catchable: { playerId: string; until: number } | null;
}

export type UnoAction =
  | { type: 'play'; cardId: number; color?: UnoColor }
  | { type: 'draw' }
  | { type: 'pass' }
  | { type: 'chooseColor'; color: UnoColor }
  | { type: 'callUno' }
  | { type: 'catchUno'; targetId: string }
  | { type: 'nextRound' };

export const UNO_COLORS: UnoColor[] = ['red', 'yellow', 'green', 'blue'];

export function buildDeck(): UnoCard[] {
  const cards: UnoCard[] = [];
  let id = 1;
  for (const color of UNO_COLORS) {
    cards.push({ id: id++, color, value: '0' });
    for (let n = 1; n <= 9; n++) {
      const v = String(n) as UnoValue;
      cards.push({ id: id++, color, value: v }, { id: id++, color, value: v });
    }
    for (const v of ['skip', 'reverse', 'draw2'] as UnoValue[]) cards.push({ id: id++, color, value: v }, { id: id++, color, value: v });
  }
  for (let i = 0; i < 4; i++) cards.push({ id: id++, color: 'wild', value: 'wild' }, { id: id++, color: 'wild', value: 'wild4' });
  return cards;
}

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function cardPoints(card: UnoCard): number {
  if (card.value === 'wild' || card.value === 'wild4') return 50;
  if (card.value === 'skip' || card.value === 'reverse' || card.value === 'draw2') return 20;
  return Number(card.value);
}

export function cardLabel(card: UnoCard): string {
  const v = card.value === 'draw2' ? 'Draw Two' : card.value === 'wild4' ? 'Wild Draw Four' : card.value === 'wild' ? 'Wild' : card.value === 'skip' ? 'Skip' : card.value === 'reverse' ? 'Reverse' : card.value;
  return card.color === 'wild' ? v : `${card.color[0].toUpperCase()}${card.color.slice(1)} ${v}`;
}

export function createUno(players: { id: string; name: string; emoji: string; bot: boolean }[], rules: Partial<UnoRules> = {}, now = Date.now()): UnoState {
  const state: UnoState = {
    players: players.map((p) => ({ ...p, hand: [], score: 0, calledUno: false, roundsWon: 0 })),
    deck: [], discard: [], current: 0, direction: 1, activeColor: 'red', pendingDraw: 0, pendingKind: null,
    phase: 'playing', drawn: null, pendingWildPlayer: null, roundWinner: null, matchWinner: null, turnStartedAt: now,
    round: 0, rules: { ...DEFAULT_UNO_RULES, ...rules }, log: [], lastAction: null, catchable: null,
  };
  startRound(state, now);
  return state;
}

export function startRound(state: UnoState, now = Date.now()): void {
  state.round += 1;
  state.deck = shuffle(buildDeck());
  state.discard = [];
  for (const p of state.players) { p.hand = []; p.calledUno = false; }
  for (let i = 0; i < 7; i++) for (const p of state.players) p.hand.push(state.deck.pop()!);
  // First discard must not be a Wild Draw Four.
  let first = state.deck.pop()!;
  while (first.value === 'wild4') { state.deck.unshift(first); first = state.deck.pop()!; }
  state.discard.push(first);
  state.activeColor = first.color === 'wild' ? UNO_COLORS[Math.floor(Math.random() * 4)] : first.color;
  state.current = (state.round - 1) % state.players.length;
  state.direction = 1;
  state.pendingDraw = 0; state.pendingKind = null; state.drawn = null; state.pendingWildPlayer = null;
  state.roundWinner = null; state.phase = 'playing'; state.catchable = null;
  state.turnStartedAt = now;
  state.log = [`Round ${state.round} · ${state.players[state.current].name} starts`];
  // Apply the first card's effect like a played card.
  if (first.value === 'skip') advance(state, 1);
  else if (first.value === 'reverse') { state.direction = -1; if (state.players.length === 2) advance(state, 1); }
  else if (first.value === 'draw2') { state.pendingDraw = 2; state.pendingKind = 'draw2'; }
}

function advance(state: UnoState, steps = 1): void {
  const n = state.players.length;
  state.current = (((state.current + state.direction * steps) % n) + n) % n;
}

function topCard(state: UnoState): UnoCard { return state.discard[state.discard.length - 1]; }

function refillDeck(state: UnoState): void {
  if (state.deck.length > 0) return;
  const top = state.discard.pop()!;
  state.deck = shuffle(state.discard);
  state.discard = [top];
}

function dealTo(state: UnoState, player: UnoPlayer, count: number): UnoCard[] {
  const out: UnoCard[] = [];
  for (let i = 0; i < count; i++) {
    refillDeck(state);
    if (state.deck.length === 0) break;
    const c = state.deck.pop()!;
    player.hand.push(c); out.push(c);
  }
  return out;
}

export function canPlay(state: UnoState, card: UnoCard): boolean {
  const top = topCard(state);
  if (state.pendingDraw > 0) {
    if (state.pendingKind === 'draw2') return card.value === 'draw2' && state.rules.stackDrawTwo || (card.value === 'wild4' && state.rules.stackWildDrawFour && false);
    if (state.pendingKind === 'wild4') return card.value === 'wild4' && state.rules.stackWildDrawFour;
    return false;
  }
  if (card.color === 'wild') return true;
  return card.color === state.activeColor || card.value === top.value;
}

export function playableCards(state: UnoState, playerId: string): UnoCard[] {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return [];
  if (state.drawn && state.drawn.playerId === playerId) {
    return canPlay(state, state.drawn.card) ? [state.drawn.card] : [];
  }
  return p.hand.filter((c) => canPlay(state, c));
}

function endTurn(state: UnoState, now: number, steps = 1): void {
  state.drawn = null;
  advance(state, steps);
  state.turnStartedAt = now;
}

function finishRound(state: UnoState, winner: UnoPlayer, now: number): void {
  let gained = 0;
  for (const p of state.players) if (p !== winner) for (const c of p.hand) gained += cardPoints(c);
  winner.score += gained;
  winner.roundsWon += 1;
  state.roundWinner = winner.id;
  state.log.push(`${winner.name} wins the round (+${gained})`);
  if (state.rules.targetScore > 0 && winner.score >= state.rules.targetScore) {
    state.phase = 'matchOver'; state.matchWinner = winner.id;
  } else if (state.rules.targetScore === 0) {
    state.phase = 'matchOver'; state.matchWinner = winner.id;
  } else {
    state.phase = 'roundOver';
  }
  state.turnStartedAt = now;
}

export function applyUno(state: UnoState, playerId: string, action: UnoAction, now = Date.now()): { ok: boolean; error?: string; event?: string } {
  const idx = state.players.findIndex((p) => p.id === playerId);
  if (idx < 0) return { ok: false, error: 'Not at this table' };
  const player = state.players[idx];

  if (action.type === 'nextRound') {
    if (state.phase !== 'roundOver') return { ok: false, error: 'Round is not over' };
    startRound(state, now);
    return { ok: true, event: 'round' };
  }
  if (action.type === 'callUno') {
    if (state.phase !== 'playing' && state.phase !== 'chooseColor') return { ok: false };
    player.calledUno = true;
    state.lastAction = { type: 'uno', playerId, at: now };
    return { ok: true, event: 'uno' };
  }
  if (action.type === 'catchUno') {
    const target = state.players.find((p) => p.id === action.targetId);
    if (!target || target.id === playerId) return { ok: false };
    if (target.hand.length === 1 && !target.calledUno && state.catchable && state.catchable.playerId === target.id && now <= state.catchable.until) {
      dealTo(state, target, 2);
      state.catchable = null;
      state.log.push(`${player.name} caught ${target.name} without calling UNO`);
      state.lastAction = { type: 'catch', playerId, at: now };
      return { ok: true, event: 'catch' };
    }
    return { ok: false, error: 'Too late' };
  }

  if (state.phase === 'chooseColor') {
    if (action.type !== 'chooseColor') return { ok: false, error: 'Choose a colour first' };
    if (state.pendingWildPlayer !== playerId) return { ok: false, error: 'Not your choice' };
    state.activeColor = action.color;
    state.phase = 'playing';
    state.pendingWildPlayer = null;
    state.log.push(`${player.name} chose ${action.color}`);
    if (player.hand.length === 0) { finishRound(state, player, now); return { ok: true, event: 'win' }; }
    const wasWild4 = topCard(state).value === 'wild4';
    if (wasWild4 && !state.rules.stackWildDrawFour) {
      endTurn(state, now, 1);
      const victim = state.players[state.current];
      dealTo(state, victim, state.pendingDraw);
      state.log.push(`${victim.name} draws ${state.pendingDraw}`);
      state.pendingDraw = 0; state.pendingKind = null;
      endTurn(state, now, 1);
    } else {
      endTurn(state, now, 1);
    }
    return { ok: true, event: 'play' };
  }

  if (state.phase !== 'playing') return { ok: false, error: 'Round over' };
  if (state.current !== idx) return { ok: false, error: 'Not your turn' };

  if (action.type === 'play') {
    const card = player.hand.find((c) => c.id === action.cardId);
    if (!card) return { ok: false, error: 'Card not in hand' };
    if (state.drawn && state.drawn.playerId === playerId && state.drawn.card.id !== card.id) return { ok: false, error: 'Play the drawn card or keep it' };
    if (!canPlay(state, card)) return { ok: false, error: 'That card cannot be played' };
    player.hand = player.hand.filter((c) => c.id !== card.id);
    state.discard.push(card);
    state.drawn = null;
    state.lastAction = { type: 'play', playerId, card, at: now };
    state.log.push(`${player.name} played ${cardLabel(card)}`);
    if (player.hand.length === 1) {
      player.calledUno = false;
      state.catchable = { playerId, until: now + 4000 };
    } else {
      player.calledUno = false;
    }
    if (card.color !== 'wild') state.activeColor = card.color;

    if (card.value === 'wild' || card.value === 'wild4') {
      if (card.value === 'wild4') { state.pendingDraw += 4; state.pendingKind = 'wild4'; }
      state.phase = 'chooseColor';
      state.pendingWildPlayer = playerId;
      return { ok: true, event: 'play' };
    }
    if (player.hand.length === 0) { finishRound(state, player, now); return { ok: true, event: 'win' }; }

    if (card.value === 'draw2') {
      state.pendingDraw += 2; state.pendingKind = 'draw2';
      if (state.rules.stackDrawTwo) {
        endTurn(state, now, 1);
        const next = state.players[state.current];
        if (!next.hand.some((c) => canPlay(state, c))) {
          dealTo(state, next, state.pendingDraw);
          state.log.push(`${next.name} draws ${state.pendingDraw}`);
          state.pendingDraw = 0; state.pendingKind = null;
          endTurn(state, now, 1);
        }
      } else {
        endTurn(state, now, 1);
        const victim = state.players[state.current];
        dealTo(state, victim, 2);
        state.log.push(`${victim.name} draws 2`);
        state.pendingDraw = 0; state.pendingKind = null;
        endTurn(state, now, 1);
      }
      return { ok: true, event: 'play' };
    }
    if (card.value === 'skip') { endTurn(state, now, 2); return { ok: true, event: 'play' }; }
    if (card.value === 'reverse') {
      state.direction = state.direction === 1 ? -1 : 1;
      endTurn(state, now, state.players.length === 2 ? 2 : 1);
      return { ok: true, event: 'reverse' };
    }
    endTurn(state, now, 1);
    return { ok: true, event: 'play' };
  }

  if (action.type === 'draw') {
    if (state.drawn && state.drawn.playerId === playerId) return { ok: false, error: 'Already drew' };
    if (state.pendingDraw > 0) {
      // Accept the stacked penalty.
      dealTo(state, player, state.pendingDraw);
      state.log.push(`${player.name} draws ${state.pendingDraw}`);
      state.pendingDraw = 0; state.pendingKind = null;
      endTurn(state, now, 1);
      state.lastAction = { type: 'draw', playerId, at: now };
      return { ok: true, event: 'draw' };
    }
    if (state.rules.drawUntilPlayable) {
      let drawnCard: UnoCard | null = null;
      for (let i = 0; i < 30; i++) {
        const [c] = dealTo(state, player, 1);
        if (!c) break;
        if (canPlay(state, c)) { drawnCard = c; break; }
      }
      state.lastAction = { type: 'draw', playerId, at: now };
      if (drawnCard) {
        state.drawn = { playerId, card: drawnCard };
        state.log.push(`${player.name} drew until playable`);
        if (state.rules.forcePlayDrawnCard) return applyUno(state, playerId, { type: 'play', cardId: drawnCard.id }, now);
        return { ok: true, event: 'draw' };
      }
      endTurn(state, now, 1);
      return { ok: true, event: 'draw' };
    }
    const [c] = dealTo(state, player, 1);
    state.lastAction = { type: 'draw', playerId, at: now };
    state.log.push(`${player.name} drew a card`);
    if (c && canPlay(state, c)) {
      state.drawn = { playerId, card: c };
      if (state.rules.forcePlayDrawnCard) return applyUno(state, playerId, { type: 'play', cardId: c.id }, now);
      return { ok: true, event: 'draw' };
    }
    endTurn(state, now, 1);
    return { ok: true, event: 'draw' };
  }

  if (action.type === 'pass') {
    if (!(state.drawn && state.drawn.playerId === playerId)) return { ok: false, error: 'Draw first' };
    if (state.rules.forcePlayDrawnCard) return { ok: false, error: 'You must play the drawn card' };
    endTurn(state, now, 1);
    return { ok: true, event: 'pass' };
  }
  return { ok: false, error: 'Unknown action' };
}

/** Called by the server timer: auto-draw when a player's turn runs out. */
export function tickUno(state: UnoState, now = Date.now()): string | null {
  if (state.phase === 'roundOver' && now - state.turnStartedAt > 8000) { startRound(state, now); return 'round'; }
  if (state.phase !== 'playing' && state.phase !== 'chooseColor') return null;
  const limit = state.rules.turnSeconds * 1000;
  if (now - state.turnStartedAt < limit) return null;
  const p = state.players[state.current];
  if (state.phase === 'chooseColor') {
    const pid = state.pendingWildPlayer!;
    const owner = state.players.find((x) => x.id === pid)!;
    const best = bestColor(owner.hand);
    applyUno(state, pid, { type: 'chooseColor', color: best }, now);
    return 'timeout';
  }
  if (state.drawn && state.drawn.playerId === p.id) {
    if (state.rules.forcePlayDrawnCard) applyUno(state, p.id, { type: 'play', cardId: state.drawn.card.id }, now);
    else applyUno(state, p.id, { type: 'pass' }, now);
  } else {
    applyUno(state, p.id, { type: 'draw' }, now);
    if (state.drawn && state.drawn.playerId === p.id) applyUno(state, p.id, { type: 'pass' }, now);
  }
  state.log.push(`${p.name} ran out of time`);
  return 'timeout';
}

export function bestColor(hand: UnoCard[]): UnoColor {
  const counts: Record<UnoColor, number> = { red: 0, yellow: 0, green: 0, blue: 0 };
  for (const c of hand) if (c.color !== 'wild') counts[c.color]++;
  return UNO_COLORS.reduce((a, b) => (counts[b] > counts[a] ? b : a), 'red');
}

/** Simple bot: prefer action cards when the next player is low, otherwise highest points. */
export function botAction(state: UnoState, playerId: string): UnoAction | null {
  const idx = state.players.findIndex((p) => p.id === playerId);
  if (idx < 0) return null;
  const me = state.players[idx];
  if (state.phase === 'roundOver') return { type: 'nextRound' };
  if (state.phase === 'chooseColor') return state.pendingWildPlayer === playerId ? { type: 'chooseColor', color: bestColor(me.hand) } : null;
  if (state.phase !== 'playing' || state.current !== idx) {
    // Try to catch someone who forgot UNO.
    const c = state.catchable;
    if (c && c.playerId !== playerId && Math.random() < 0.3) {
      const t = state.players.find((p) => p.id === c.playerId);
      if (t && t.hand.length === 1 && !t.calledUno) return { type: 'catchUno', targetId: t.id };
    }
    return null;
  }
  const options = playableCards(state, playerId);
  if (options.length === 0) {
    if (state.drawn && state.drawn.playerId === playerId) return { type: 'pass' };
    return { type: 'draw' };
  }
  const n = state.players.length;
  const next = state.players[(((idx + state.direction) % n) + n) % n];
  const nextLow = next.hand.length <= 2;
  const score = (c: UnoCard) => {
    let s = cardPoints(c);
    if (nextLow && (c.value === 'skip' || c.value === 'draw2' || c.value === 'wild4' || c.value === 'reverse')) s += 40;
    if (c.color === 'wild' && me.hand.length > 2) s -= 30; // keep wilds for later
    if (c.color !== 'wild' && c.color === bestColor(me.hand)) s += 5;
    return s;
  };
  const best = options.slice().sort((a, b) => score(b) - score(a))[0];
  if (me.hand.length === 2 && Math.random() < 0.85) {
    // Bot calls UNO most of the time.
    me.calledUno = true;
  }
  return { type: 'play', cardId: best.id, color: best.color === 'wild' ? bestColor(me.hand.filter((c) => c.id !== best.id)) : undefined };
}

export interface UnoView {
  you: string;
  players: { id: string; name: string; emoji: string; bot: boolean; cards: number; score: number; calledUno: boolean; roundsWon: number }[];
  hand: UnoCard[];
  top: UnoCard;
  activeColor: UnoColor;
  current: string;
  direction: 1 | -1;
  phase: UnoPhase;
  pendingDraw: number;
  drawn: UnoCard | null;
  pendingWildPlayer: string | null;
  roundWinner: string | null;
  matchWinner: string | null;
  turnStartedAt: number;
  turnSeconds: number;
  round: number;
  rules: UnoRules;
  deckCount: number;
  log: string[];
  lastAction: UnoState['lastAction'];
  catchable: UnoState['catchable'];
  playable: number[];
}

export function unoView(state: UnoState, playerId: string): UnoView {
  const me = state.players.find((p) => p.id === playerId);
  return {
    you: playerId,
    players: state.players.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, bot: p.bot, cards: p.hand.length, score: p.score, calledUno: p.calledUno, roundsWon: p.roundsWon })),
    hand: me ? me.hand : [],
    top: topCard(state),
    activeColor: state.activeColor,
    current: state.players[state.current].id,
    direction: state.direction,
    phase: state.phase,
    pendingDraw: state.pendingDraw,
    drawn: state.drawn && state.drawn.playerId === playerId ? state.drawn.card : null,
    pendingWildPlayer: state.pendingWildPlayer,
    roundWinner: state.roundWinner,
    matchWinner: state.matchWinner,
    turnStartedAt: state.turnStartedAt,
    turnSeconds: state.rules.turnSeconds,
    round: state.round,
    rules: state.rules,
    deckCount: state.deck.length,
    log: state.log.slice(-8),
    lastAction: state.lastAction,
    catchable: state.catchable,
    playable: me ? playableCards(state, playerId).map((c) => c.id) : [],
  };
}
