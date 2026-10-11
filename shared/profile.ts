// Profile and character definitions shared by the client and the server.

export type HairStyle = 'bald' | 'buzz' | 'short' | 'curly' | 'long' | 'ponytail' | 'quiff' | 'bun';
export type BottomStyle = 'jeans' | 'shorts' | 'skirt' | 'trousers';
export type AnimalId = 'cat' | 'heron' | 'crab' | 'turtle' | 'goat' | 'fruitbat';

export interface Character {
  kind: 'human' | 'animal';
  gender: 'male' | 'female';
  skin: string;
  hair: HairStyle;
  hairColor: string;
  hijab: boolean;
  hijabColor: string;
  top: string;
  bottomStyle: BottomStyle;
  bottom: string;
  glasses: boolean;
  beard: boolean;
  animal: AnimalId;
  clothesColor: string;
}

export interface HomeLocation {
  x: number;
  z: number;
  label: string;
}

export interface Profile {
  token: string;
  name: string;
  username: string;
  emoji: string;
  character: Character;
  home: HomeLocation | null;
  language: 'en' | 'dv';
  createdAt: number;
}

export const SKIN_TONES = ['#f6d3b5', '#e8b894', '#d29a6f', '#b97b52', '#92573a', '#6b3d26'];
export const HAIR_COLORS = ['#1c1a1a', '#3b2a1e', '#6a4529', '#a9733e', '#d9b36b', '#8a8a8a', '#c8372d', '#2b5fb8'];
export const CLOTHES_COLORS = ['#ffffff', '#1e4d8f', '#2f9e7a', '#ffcf3f', '#ff6b57', '#7a3fb0', '#1b1b1b', '#e4c6a0', '#f28fb2', '#087887'];
export const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: 'short', label: 'Short' }, { id: 'buzz', label: 'Buzz' }, { id: 'curly', label: 'Curly' }, { id: 'quiff', label: 'Quiff' },
  { id: 'long', label: 'Long' }, { id: 'ponytail', label: 'Ponytail' }, { id: 'bun', label: 'Bun' }, { id: 'bald', label: 'Bald' },
];
export const BOTTOM_STYLES: { id: BottomStyle; label: string }[] = [
  { id: 'jeans', label: 'Jeans' }, { id: 'shorts', label: 'Shorts' }, { id: 'trousers', label: 'Trousers' }, { id: 'skirt', label: 'Skirt' },
];
export const ANIMALS: { id: AnimalId; name: string; emoji: string; accent: string }[] = [
  { id: 'cat', name: 'Island cat', emoji: '🐈', accent: '#e9a23b' },
  { id: 'heron', name: 'Grey heron', emoji: '🪶', accent: '#8fa3b5' },
  { id: 'crab', name: 'Ghost crab', emoji: '🦀', accent: '#ff6b57' },
  { id: 'turtle', name: 'Green turtle', emoji: '🐢', accent: '#3f9a63' },
  { id: 'goat', name: 'Goat', emoji: '🐐', accent: '#c9b79c' },
  { id: 'fruitbat', name: 'Fruit bat', emoji: '🦇', accent: '#5a4a6e' },
];
export const QUICK_REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🙏', '🔥', '🎉'];
export const EMOTES: { id: string; label: string; emoji: string }[] = [
  { id: 'wave', label: 'Wave', emoji: '👋' }, { id: 'dance', label: 'Dance', emoji: '🕺' }, { id: 'sit', label: 'Sit', emoji: '🪑' },
  { id: 'laugh', label: 'Laugh', emoji: '😂' }, { id: 'heart', label: 'Heart', emoji: '❤️' }, { id: 'sleep', label: 'Sleep', emoji: '😴' },
  { id: 'cheer', label: 'Cheer', emoji: '🎉' }, { id: 'think', label: 'Think', emoji: '🤔' },
];
export const PROFILE_EMOJIS = ['🌴', '🐠', '🌺', '🐚', '⛵', '🥥', '🐢', '🌊', '🦀', '🏝️', '🌙', '⚽', '🎣', '🍉', '🦜', '🛶'];

export const HUMAN_PRESETS: { id: string; name: string; patch: Partial<Character> }[] = [
  { id: 'aishath', name: 'Aishath', patch: { gender: 'female', skin: '#d29a6f', hair: 'long', hairColor: '#1c1a1a', hijab: true, hijabColor: '#1b1b1b', top: '#ffcf3f', bottomStyle: 'skirt', bottom: '#1b1b1b', glasses: true } },
  { id: 'hassan', name: 'Hassan', patch: { gender: 'male', skin: '#b97b52', hair: 'curly', hairColor: '#1c1a1a', hijab: false, top: '#ffffff', bottomStyle: 'trousers', bottom: '#2f9e7a', beard: false } },
  { id: 'mariyam', name: 'Mariyam', patch: { gender: 'female', skin: '#e8b894', hair: 'ponytail', hairColor: '#3b2a1e', hijab: false, top: '#ff6b57', bottomStyle: 'jeans', bottom: '#1e4d8f' } },
  { id: 'ibrahim', name: 'Ibrahim', patch: { gender: 'male', skin: '#92573a', hair: 'quiff', hairColor: '#1c1a1a', hijab: false, top: '#1e4d8f', bottomStyle: 'shorts', bottom: '#e4c6a0', beard: true } },
  { id: 'fathimath', name: 'Fathimath', patch: { gender: 'female', skin: '#f6d3b5', hair: 'bun', hairColor: '#6a4529', hijab: true, hijabColor: '#ffffff', top: '#7a3fb0', bottomStyle: 'skirt', bottom: '#1b1b1b' } },
  { id: 'ahmed', name: 'Ahmed', patch: { gender: 'male', skin: '#d29a6f', hair: 'short', hairColor: '#1c1a1a', hijab: false, top: '#087887', bottomStyle: 'jeans', bottom: '#1b1b1b', glasses: true } },
];

export function defaultCharacter(): Character {
  return {
    kind: 'human', gender: 'male', skin: '#d29a6f', hair: 'short', hairColor: '#1c1a1a', hijab: false, hijabColor: '#1b1b1b',
    top: '#ffffff', bottomStyle: 'trousers', bottom: '#1e4d8f', glasses: false, beard: false, animal: 'cat', clothesColor: '#ff6b57',
  };
}

export function randomToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 24; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function slugUsername(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 16) || 'islander';
}

export function sanitizeName(name: string): string {
  return name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24);
}

export function sanitizeCharacter(c: Partial<Character> | undefined): Character {
  const d = defaultCharacter();
  if (!c || typeof c !== 'object') return d;
  const hex = (v: unknown, fb: string) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fb);
  const pick = <T extends string>(v: unknown, list: readonly T[], fb: T): T => (list.includes(v as T) ? (v as T) : fb);
  return {
    kind: pick(c.kind, ['human', 'animal'] as const, 'human'),
    gender: pick(c.gender, ['male', 'female'] as const, 'male'),
    skin: hex(c.skin, d.skin),
    hair: pick(c.hair, HAIR_STYLES.map((h) => h.id), d.hair),
    hairColor: hex(c.hairColor, d.hairColor),
    hijab: !!c.hijab,
    hijabColor: hex(c.hijabColor, d.hijabColor),
    top: hex(c.top, d.top),
    bottomStyle: pick(c.bottomStyle, BOTTOM_STYLES.map((b) => b.id), d.bottomStyle),
    bottom: hex(c.bottom, d.bottom),
    glasses: !!c.glasses,
    beard: !!c.beard,
    animal: pick(c.animal, ANIMALS.map((a) => a.id), d.animal),
    clothesColor: hex(c.clothesColor, d.clothesColor),
  };
}
