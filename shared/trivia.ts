// Quiz Night question bank and scoring. Questions about Isdhoo, Laamu and the Maldives
// come from Wikipedia and OpenStreetMap; the rest are general knowledge.

export interface TriviaQuestion { q: string; options: string[]; answer: number; fact?: string }
export interface TriviaTopic { id: string; name: string; emoji: string; color: string; questions: TriviaQuestion[] }

export const TRIVIA_TOPICS: TriviaTopic[] = [
  {
    id: 'isdhoo', name: 'Isdhoo & Laamu', emoji: '🏝️', color: '#087887',
    questions: [
      { q: 'Which island shares its landmass with Isdhoo?', options: ['Kalaidhoo', 'Gan', 'Fonadhoo', 'Dhanbidhoo'], answer: 0, fact: 'Isdhoo and Kalaidhoo sit on one long island, connected by road.' },
      { q: 'The Isdhoo Loamaafaanu copper plates date from the end of which century?', options: ['10th', '12th', '15th', '18th'], answer: 1, fact: 'The Loamaafaanu are royal edicts engraved on copper plates, bound with a copper ring.' },
      { q: 'What is the administrative capital of Laamu Atoll?', options: ['Isdhoo', 'Gan', 'Fonadhoo', 'Maavah'], answer: 2 },
      { q: 'Roughly how far is Isdhoo from Malé?', options: ['27 km', '97 km', '227 km', '427 km'], answer: 2, fact: 'About 227 km, or 141 miles, south of the capital.' },
      { q: 'Isdhoo is famous for the remains of a large…', options: ['Lighthouse', 'Buddhist stupa', 'Portuguese fort', 'Royal palace'], answer: 1, fact: 'One of the largest stupas so far found in the Maldives stands on Isdhoo.' },
      { q: 'Which Laamu island has the atoll\'s airport?', options: ['Kadhdhoo', 'Isdhoo', 'Hithadhoo', 'Mundoo'], answer: 0 },
      { q: 'What is the Dhivehi letter code for Laamu Atoll?', options: ['ނ', 'ލ', 'ގ', 'ސ'], answer: 1, fact: 'Laamu is written with the Thaana letter Laamu (ލ); the Latin code is O.' },
      { q: 'Which island lies just south-west of Kalaidhoo, across the channel?', options: ['Dhanbidhoo', 'Maabaidhoo', 'Gaadhoo', 'Kunahandhoo'], answer: 0, fact: 'Dhanbidhoo has its own Loamaafaanu copper plates too.' },
      { q: 'Isdhoo\'s 2022 census population was closest to…', options: ['300', '900', '2,500', '6,000'], answer: 1, fact: '929 residents in 2022, including foreign residents.' },
      { q: 'What is the name of Isdhoo\'s main street on OpenStreetMap?', options: ['Bodumagu', 'Majeedhee Magu', 'Ameenee Magu', 'Orchid Magu'], answer: 0 },
    ],
  },
  {
    id: 'maldives', name: 'Maldives', emoji: '🇲🇻', color: '#c8372d',
    questions: [
      { q: 'What is the currency of the Maldives?', options: ['Rupee', 'Rufiyaa', 'Dinar', 'Ringgit'], answer: 1 },
      { q: 'In which direction is Thaana script written?', options: ['Left to right', 'Right to left', 'Top to bottom', 'In a spiral'], answer: 1 },
      { q: 'Maldives Independence Day is celebrated on…', options: ['26 July', '3 November', '11 November', '1 January'], answer: 0, fact: 'Independence from Britain came on 26 July 1965.' },
      { q: 'What is the traditional Maldivian fishing boat called?', options: ['Dhoni', 'Junk', 'Catamaran', 'Felucca'], answer: 0 },
      { q: 'Which dish is a classic Maldivian breakfast?', options: ['Mas huni', 'Pad thai', 'Shakshuka', 'Congee'], answer: 0, fact: 'Mas huni mixes tuna, coconut, onion and chilli, eaten with roshi.' },
      { q: 'What is the clear fish broth eaten with rice and lime?', options: ['Garudhiya', 'Rihaakuru', 'Hedhikaa', 'Bondibai'], answer: 0 },
      { q: 'Bodu beru is a traditional Maldivian…', options: ['Drum music', 'Boat race', 'Wedding dress', 'Sweet'], answer: 0 },
      { q: 'What colour is the crescent on the Maldivian flag?', options: ['Red', 'Green', 'White', 'Gold'], answer: 2 },
      { q: 'The national flower of the Maldives is the…', options: ['Pink rose', 'Hibiscus', 'Frangipani', 'Lotus'], answer: 0, fact: 'Finifenmaa, the pink rose, was adopted as the national flower in 1985.' },
      { q: 'Roughly how many natural atolls make up the Maldives?', options: ['6', '26', '126', '1,200'], answer: 1, fact: 'About 26 natural atolls, grouped into 20 administrative divisions.' },
    ],
  },
  {
    id: 'ocean', name: 'Ocean & Reef', emoji: '🐠', color: '#2b6fe0',
    questions: [
      { q: 'White sand on Maldivian beaches is largely produced by which fish?', options: ['Parrotfish', 'Tuna', 'Clownfish', 'Barracuda'], answer: 0, fact: 'Parrotfish grind coral while feeding and excrete it as fine white sand.' },
      { q: 'Coral reefs are built by…', options: ['Tiny animals', 'Plants', 'Rocks', 'Shells only'], answer: 0 },
      { q: 'Hanifaru Bay in Baa Atoll is famous for gatherings of…', options: ['Manta rays', 'Penguins', 'Sea otters', 'Orcas'], answer: 0 },
      { q: 'The largest fish in the sea, seen around the Maldives, is the…', options: ['Whale shark', 'Great white', 'Marlin', 'Giant grouper'], answer: 0 },
      { q: 'What causes coral bleaching?', options: ['Warmer water', 'Too much sand', 'Full moon', 'Loud boats'], answer: 0 },
      { q: 'A lagoon is…', options: ['Shallow water inside a reef', 'A deep ocean trench', 'A river mouth', 'A freshwater lake'], answer: 0 },
      { q: 'Green turtles mostly eat…', options: ['Seagrass', 'Fish', 'Crabs', 'Jellyfish'], answer: 0 },
      { q: 'Which ocean surrounds the Maldives?', options: ['Indian', 'Pacific', 'Atlantic', 'Southern'], answer: 0 },
    ],
  },
  {
    id: 'football', name: 'Football', emoji: '⚽', color: '#2f9e7a',
    questions: [
      { q: 'In which year did the Maldives first win the SAFF Championship?', options: ['2003', '2008', '2013', '2018'], answer: 1, fact: 'They beat India 1–0 in the 2008 final in Malé.' },
      { q: 'Who is the Maldives national team\'s record goalscorer?', options: ['Ali Ashfaq', 'Ali Fasir', 'Assadhulla Abdulla', 'Imran Mohamed'], answer: 0 },
      { q: 'How many players does each team have on the pitch?', options: ['9', '10', '11', '12'], answer: 2 },
      { q: 'Which country won the 2022 FIFA World Cup?', options: ['France', 'Argentina', 'Brazil', 'Croatia'], answer: 1 },
      { q: 'A match normally lasts…', options: ['60 minutes', '80 minutes', '90 minutes', '120 minutes'], answer: 2 },
      { q: 'The Maldives won the SAFF Championship a second time in…', options: ['2011', '2015', '2018', '2021'], answer: 2, fact: 'They beat India 2–1 in the 2018 final in Dhaka.' },
      { q: 'What colour card sends a player off?', options: ['Yellow', 'Red', 'Blue', 'Green'], answer: 1 },
      { q: 'Which club has won the most UEFA Champions League titles?', options: ['Real Madrid', 'AC Milan', 'Liverpool', 'Bayern Munich'], answer: 0 },
    ],
  },
  {
    id: 'world', name: 'World', emoji: '🌍', color: '#7a3fb0',
    questions: [
      { q: 'What is the largest ocean on Earth?', options: ['Atlantic', 'Indian', 'Pacific', 'Arctic'], answer: 2 },
      { q: 'Which is the closest country to the Maldives?', options: ['Sri Lanka', 'Thailand', 'Oman', 'Kenya'], answer: 0 },
      { q: 'What is the tallest mountain in the world?', options: ['K2', 'Everest', 'Kilimanjaro', 'Denali'], answer: 1 },
      { q: 'How many continents are there?', options: ['5', '6', '7', '8'], answer: 2 },
      { q: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Mercury'], answer: 1 },
      { q: 'What is the capital of Japan?', options: ['Osaka', 'Kyoto', 'Tokyo', 'Nagoya'], answer: 2 },
      { q: 'Which language has the most native speakers?', options: ['English', 'Mandarin Chinese', 'Spanish', 'Hindi'], answer: 1 },
      { q: 'The Great Barrier Reef lies off the coast of…', options: ['Australia', 'Brazil', 'South Africa', 'Mexico'], answer: 0 },
    ],
  },
  {
    id: 'food', name: 'Food & Snacks', emoji: '🥥', color: '#e9a23b',
    questions: [
      { q: 'Hedhikaa are Maldivian…', options: ['Short eats', 'Boats', 'Dances', 'Hats'], answer: 0 },
      { q: 'Rihaakuru is a thick paste made from…', options: ['Tuna', 'Coconut', 'Chilli', 'Mango'], answer: 0 },
      { q: 'What is bondibai?', options: ['Sweet rice pudding', 'Fish curry', 'Fried banana', 'Tea'], answer: 0 },
      { q: 'Which fruit is the Maldives\' most important tree crop?', options: ['Coconut', 'Apple', 'Olive', 'Grape'], answer: 0 },
      { q: 'Gulha are small fried balls filled with…', options: ['Smoked tuna', 'Chocolate', 'Cheese', 'Potato'], answer: 0 },
      { q: 'Roshi is a type of…', options: ['Flatbread', 'Soup', 'Fish', 'Sweet'], answer: 0 },
      { q: 'Kulhi boakibaa is a savoury…', options: ['Fish cake', 'Salad', 'Drink', 'Rice'], answer: 0 },
      { q: 'What is sai in Dhivehi?', options: ['Tea', 'Rice', 'Salt', 'Bread'], answer: 0 },
    ],
  },
];

export interface TriviaSettings { topics: string[]; questions: number; seconds: number }
export const DEFAULT_TRIVIA_SETTINGS: TriviaSettings = { topics: ['isdhoo', 'maldives'], questions: 10, seconds: 15 };

export interface TriviaPlayer { id: string; name: string; emoji: string; score: number; streak: number; answers: (number | null)[]; answeredAt: number[]; bot: boolean }
export interface TriviaState {
  settings: TriviaSettings;
  questions: TriviaQuestion[];
  players: TriviaPlayer[];
  index: number;
  phase: 'ready' | 'question' | 'reveal' | 'done';
  phaseStartedAt: number;
}

export function shufflePick<T>(arr: T[], n: number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

export function createTrivia(players: { id: string; name: string; emoji: string; bot: boolean }[], settings: Partial<TriviaSettings>, now = Date.now()): TriviaState {
  const s = { ...DEFAULT_TRIVIA_SETTINGS, ...settings };
  const topics = TRIVIA_TOPICS.filter((t) => s.topics.includes(t.id));
  const pool = (topics.length ? topics : TRIVIA_TOPICS).flatMap((t) => t.questions);
  const questions = shufflePick(pool, Math.min(s.questions, pool.length)).map((q) => {
    // Shuffle options per question while tracking the answer.
    const order = shufflePick([0, 1, 2, 3], 4);
    return { q: q.q, fact: q.fact, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
  });
  return {
    settings: s, questions,
    players: players.map((p) => ({ ...p, score: 0, streak: 0, answers: [], answeredAt: [] })),
    index: 0, phase: 'ready', phaseStartedAt: now,
  };
}

export function triviaAnswer(state: TriviaState, playerId: string, choice: number, now = Date.now()): boolean {
  if (state.phase !== 'question') return false;
  const p = state.players.find((x) => x.id === playerId);
  if (!p || p.answers[state.index] !== undefined) return false;
  const q = state.questions[state.index];
  const elapsed = (now - state.phaseStartedAt) / 1000;
  const frac = Math.max(0, 1 - elapsed / state.settings.seconds);
  p.answers[state.index] = choice;
  p.answeredAt[state.index] = now;
  if (choice === q.answer) {
    p.streak += 1;
    p.score += Math.round(500 + 500 * frac) + Math.min(5, p.streak - 1) * 50;
  } else {
    p.streak = 0;
  }
  return true;
}

/** Advance phases on a timer. Returns true if the phase changed. */
export function tickTrivia(state: TriviaState, now = Date.now()): boolean {
  const elapsed = now - state.phaseStartedAt;
  if (state.phase === 'ready' && elapsed > 3000) { state.phase = 'question'; state.phaseStartedAt = now; return true; }
  if (state.phase === 'question') {
    const everyone = state.players.every((p) => p.answers[state.index] !== undefined);
    if (everyone || elapsed > state.settings.seconds * 1000) {
      for (const p of state.players) if (p.answers[state.index] === undefined) { p.answers[state.index] = null; p.streak = 0; }
      state.phase = 'reveal'; state.phaseStartedAt = now; return true;
    }
    // Bots answer at a random time.
    for (const p of state.players) {
      if (p.bot && p.answers[state.index] === undefined && elapsed > 2000 + ((p.id.charCodeAt(p.id.length - 1) * 37) % 6000)) {
        const q = state.questions[state.index];
        const right = Math.random() < 0.6;
        triviaAnswer(state, p.id, right ? q.answer : (q.answer + 1 + Math.floor(Math.random() * 3)) % 4, now);
      }
    }
  }
  if (state.phase === 'reveal' && elapsed > 4500) {
    if (state.index + 1 >= state.questions.length) { state.phase = 'done'; state.phaseStartedAt = now; return true; }
    state.index += 1; state.phase = 'question'; state.phaseStartedAt = now; return true;
  }
  return false;
}
