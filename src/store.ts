import { create } from 'zustand';
import type { World, Place, IllustrativeHouse, Landing, Pt } from './world/types';
import type { Obstacle } from './world/geometry';
import type { Profile } from '../shared/profile';
import type { PlayerPublic, ChatMessage, PartyPublic, GameView, Leaderboard, ChatAuthor, TransportMode } from '../shared/protocol';
import { computeDaylight, type Daylight } from '../shared/daylight';

export type Panel = 'chat' | 'nearby' | 'places' | 'profile' | 'settings' | 'games' | 'reactions' | 'leaderboard' | 'about' | 'travel' | null;
export type Quality = 'low' | 'standard' | 'high';

export interface Settings {
  quality: Quality;
  oceanVolume: number;
  musicVolume: number;
  gameVolume: number;
  daylight: 'auto' | 'day' | 'night';
  illustrativeHouses: boolean;
  houseLabels: boolean;
  language: 'en' | 'dv';
  joystick: 'auto' | 'on' | 'off';
}

export const DEFAULT_SETTINGS: Settings = {
  quality: 'standard', oceanVolume: 0.5, musicVolume: 0.3, gameVolume: 0.7, daylight: 'auto', illustrativeHouses: true, houseLabels: true, language: 'en', joystick: 'auto',
};

/** Mutable, non-reactive local player transform (updated every frame by the scene). */
export const localPos = { x: 0, z: 0, rot: 0, anim: 'idle', mode: 'walk' as TransportMode, ready: false };
/** Interpolation targets for remote players. */
export const remoteTargets = new Map<string, { x: number; z: number; rot: number; anim: string; mode: TransportMode; at: number }>();

export interface Toast { id: number; text: string; kind: 'info' | 'error' | 'success' }

interface Store {
  phase: 'loading' | 'start' | 'onboarding' | 'island';
  setPhase: (p: Store['phase']) => void;
  world: World | null;
  houses: IllustrativeHouse[];
  obstacles: Obstacle[];
  walkTest: ((x: number, z: number) => boolean) | null;
  waterTest: ((x: number, z: number) => boolean) | null;
  roadTest: ((x: number, z: number) => boolean) | null;
  setWorld: (w: World, houses: IllustrativeHouse[], obstacles: Obstacle[], walkTest: (x: number, z: number) => boolean, waterTest: (x: number, z: number) => boolean, roadTest: (x: number, z: number) => boolean) => void;
  sailing: { dest: Landing; waypoints: Pt[]; index: number; speed: number; total: number; startedAt: number } | null;
  setSailing: (s: Store['sailing']) => void;
  driving: { label: string; waypoints: Pt[]; index: number; speed: number; total: number; startedAt: number } | null;
  setDriving: (d: Store['driving']) => void;
  profile: Profile | null;
  setProfile: (p: Profile) => void;
  settings: Settings;
  setSettings: (s: Partial<Settings>) => void;
  connection: 'connecting' | 'online' | 'offline' | 'reconnecting';
  setConnection: (c: Store['connection']) => void;
  me: string | null;
  players: Record<string, PlayerPublic>;
  setPlayers: (p: Record<string, PlayerPublic>) => void;
  upsertPlayer: (p: PlayerPublic) => void;
  removePlayer: (id: string) => void;
  chat: ChatMessage[];
  partyChat: ChatMessage[];
  addChat: (m: ChatMessage) => void;
  updateChat: (m: ChatMessage) => void;
  unread: number;
  clearUnread: () => void;
  parties: Record<string, PartyPublic>;
  setParties: (p: Record<string, PartyPublic>) => void;
  upsertParty: (p: PartyPublic) => void;
  removeParty: (id: string) => void;
  myPartyId: string | null;
  setMyPartyId: (id: string | null) => void;
  game: { partyId: string; view: GameView } | null;
  setGame: (g: Store['game']) => void;
  gameEvent: { event: string; by?: string; at: number } | null;
  setGameEvent: (e: Store['gameEvent']) => void;
  leaderboard: Leaderboard | null;
  setLeaderboard: (l: Leaderboard) => void;
  panel: Panel;
  setPanel: (p: Panel) => void;
  toasts: Toast[];
  toast: (text: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
  wave: { from: ChatAuthor; at: number } | null;
  setWave: (w: Store['wave']) => void;
  emotes: Record<string, { emote: string; at: number }>;
  setEmote: (id: string, emote: string) => void;
  walkTarget: { x: number; z: number } | null;
  setWalkTarget: (t: Store['walkTarget']) => void;
  selectedPlace: Place | null;
  setSelectedPlace: (p: Place | null) => void;
  followAvatar: boolean;
  setFollowAvatar: (f: boolean) => void;
  daylight: Daylight;
  setDaylight: (d: Daylight) => void;
  nearbyIds: string[];
  setNearbyIds: (ids: string[]) => void;
  replyTo: ChatMessage | null;
  setReplyTo: (m: ChatMessage | null) => void;
  catPopup: { id: string; name: string; status: string; x: number; z: number } | null;
  setCatPopup: (c: Store['catPopup']) => void;
  serverOffset: number;
  setServerOffset: (o: number) => void;
  mode: TransportMode;
  setMode: (m: TransportMode) => void;
  teleporting: { label: string; at: number } | null;
  setTeleporting: (t: Store['teleporting']) => void;
}

let toastSeq = 1;

function loadSettings(): Settings {
  try { const raw = localStorage.getItem('l15.settings'); if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }; } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

export const useStore = create<Store>((set, get) => ({
  phase: 'loading',
  setPhase: (phase) => set({ phase }),
  world: null, houses: [], obstacles: [], walkTest: null, waterTest: null, roadTest: null,
  setWorld: (world, houses, obstacles, walkTest, waterTest, roadTest) => set({ world, houses, obstacles, walkTest, waterTest, roadTest }),
  sailing: null,
  setSailing: (sailing) => set({ sailing }),
  driving: null,
  setDriving: (driving) => set({ driving }),
  profile: null,
  setProfile: (profile) => { try { localStorage.setItem('l15.profile', JSON.stringify(profile)); } catch { /* ignore */ } set({ profile }); },
  settings: loadSettings(),
  setSettings: (s) => { const settings = { ...get().settings, ...s }; try { localStorage.setItem('l15.settings', JSON.stringify(settings)); } catch { /* ignore */ } set({ settings }); },
  connection: 'connecting',
  setConnection: (connection) => set({ connection }),
  me: null,
  players: {},
  setPlayers: (players) => set({ players }),
  upsertPlayer: (p) => set((s) => ({ players: { ...s.players, [p.id]: p } })),
  removePlayer: (id) => set((s) => { const players = { ...s.players }; delete players[id]; remoteTargets.delete(id); return { players }; }),
  chat: [], partyChat: [],
  addChat: (m) => set((s) => {
    if (m.scope === 'party') return { partyChat: [...s.partyChat.filter((x) => x.id !== m.id), m].slice(-200) };
    const mine = m.from.id === s.me;
    const open = s.panel === 'chat';
    return { chat: [...s.chat.filter((x) => x.id !== m.id), m].slice(-400), unread: mine || open ? s.unread : s.unread + 1 };
  }),
  updateChat: (m) => set((s) => (m.scope === 'party' ? { partyChat: s.partyChat.map((x) => (x.id === m.id ? m : x)) } : { chat: s.chat.map((x) => (x.id === m.id ? m : x)) })),
  unread: 0,
  clearUnread: () => set({ unread: 0 }),
  parties: {},
  setParties: (parties) => set({ parties }),
  upsertParty: (p) => set((s) => ({ parties: { ...s.parties, [p.id]: p } })),
  removeParty: (id) => set((s) => { const parties = { ...s.parties }; delete parties[id]; return { parties, myPartyId: s.myPartyId === id ? null : s.myPartyId, game: s.game?.partyId === id ? null : s.game }; }),
  myPartyId: null,
  setMyPartyId: (myPartyId) => set((s) => ({ myPartyId, game: myPartyId ? s.game : null, partyChat: myPartyId ? s.partyChat : [] })),
  game: null,
  setGame: (game) => set({ game }),
  gameEvent: null,
  setGameEvent: (gameEvent) => set({ gameEvent }),
  leaderboard: null,
  setLeaderboard: (leaderboard) => set({ leaderboard }),
  panel: null,
  setPanel: (panel) => set((s) => ({ panel, unread: panel === 'chat' ? 0 : s.unread, replyTo: panel === 'chat' ? s.replyTo : null })),
  toasts: [],
  toast: (text, kind = 'info') => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, kind }] }));
    setTimeout(() => get().dismissToast(id), kind === 'error' ? 6000 : 4000);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  wave: null,
  setWave: (wave) => set({ wave }),
  emotes: {},
  setEmote: (id, emote) => set((s) => ({ emotes: { ...s.emotes, [id]: { emote, at: Date.now() } } })),
  walkTarget: null,
  setWalkTarget: (walkTarget) => set({ walkTarget }),
  selectedPlace: null,
  setSelectedPlace: (selectedPlace) => set({ selectedPlace }),
  followAvatar: true,
  setFollowAvatar: (followAvatar) => set({ followAvatar }),
  daylight: computeDaylight(new Date(), 2.1265, 73.5795),
  setDaylight: (daylight) => set({ daylight }),
  nearbyIds: [],
  setNearbyIds: (nearbyIds) => set({ nearbyIds }),
  replyTo: null,
  setReplyTo: (replyTo) => set({ replyTo }),
  catPopup: null,
  setCatPopup: (catPopup) => set({ catPopup }),
  serverOffset: 0,
  setServerOffset: (serverOffset) => set({ serverOffset }),
  mode: 'walk',
  setMode: (mode) => { localPos.mode = mode; set({ mode }); },
  teleporting: null,
  setTeleporting: (teleporting) => set({ teleporting }),
}));

export function loadProfile(): Profile | null {
  try { const raw = localStorage.getItem('l15.profile'); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
  return null;
}

export function placeName(p: { name: string; nameDv?: string }, language: 'en' | 'dv'): string {
  return language === 'dv' && p.nameDv ? p.nameDv : p.name;
}
