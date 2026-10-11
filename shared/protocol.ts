import type { Character, HomeLocation } from './profile';
import type { UnoView, UnoRules } from './uno';
import type { TriviaSettings } from './trivia';

export type TransportMode = 'walk' | 'bicycle' | 'car' | 'boat';
export const TRANSPORT_MODES: TransportMode[] = ['walk', 'bicycle', 'car', 'boat'];

export interface ProfileLite {
  name: string;
  username: string;
  emoji: string;
  character: Character;
  home: HomeLocation | null;
  language: 'en' | 'dv';
}

export interface PlayerPublic {
  id: string;
  name: string;
  username: string;
  emoji: string;
  character: Character;
  x: number;
  z: number;
  rot: number;
  anim: string;
  mode: TransportMode;
  joinedAt: number;
  partyId: string | null;
}

export interface ChatAuthor { id: string; name: string; username: string; emoji: string }
export interface ChatMessage {
  id: string;
  scope: 'global' | 'party';
  partyId?: string;
  from: ChatAuthor;
  text: string;
  at: number;
  editedAt?: number;
  deleted?: boolean;
  reactions: Record<string, string[]>;
  replyTo?: { id: string; name: string; text: string };
}

export type GameId = 'uno' | 'trivia' | 'chess';
export const GAME_NAMES: Record<GameId, string> = { uno: 'UNO', trivia: 'Quiz Night', chess: 'Beach Chess' };

export interface PartyMember { id: string; name: string; emoji: string; ready: boolean; sittingOut: boolean }
export interface ChessSettings { minutes: number; strength: 'easy' | 'normal' | 'strong' }
export interface PartySettings { uno: UnoRules; trivia: TriviaSettings; chess: ChessSettings; bots: boolean }
export interface PodiumEntry { id: string; name: string; emoji: string; score: number; place: number; bot: boolean }
export interface PartyPublic {
  id: string;
  hostId: string;
  x: number;
  z: number;
  game: GameId | null;
  settings: PartySettings;
  members: PartyMember[];
  status: 'lobby' | 'playing' | 'finished';
  createdAt: number;
  results: { game: GameId; podium: PodiumEntry[]; ranked: boolean } | null;
}

export interface TriviaView {
  you: string;
  index: number;
  total: number;
  phase: 'ready' | 'question' | 'reveal' | 'done';
  phaseStartedAt: number;
  seconds: number;
  question: { q: string; options: string[] } | null;
  answer: number | null;
  fact: string | null;
  yourAnswer: number | null | undefined;
  players: { id: string; name: string; emoji: string; score: number; streak: number; answered: boolean; correct: boolean | null; bot: boolean }[];
  topics: string[];
}

export interface ChessSide { id: string; name: string; emoji: string; bot: boolean }
export interface ChessView {
  you: string;
  white: ChessSide;
  black: ChessSide;
  fen: string;
  turn: 'w' | 'b';
  history: string[];
  status: 'playing' | 'checkmate' | 'draw' | 'resigned' | 'timeout';
  winner: 'w' | 'b' | null;
  lastMove: { from: string; to: string } | null;
  check: boolean;
  clocks: { w: number; b: number };
  minutes: number;
  legal: { from: string; to: string; promotion?: string }[];
}

export type GameView = { game: 'uno'; view: UnoView } | { game: 'trivia'; view: TriviaView } | { game: 'chess'; view: ChessView };

export interface LeaderEntry { id: string; name: string; emoji: string; wins: number; matches: number; best: number }
export type Leaderboard = Record<GameId, { allTime: LeaderEntry[]; month: LeaderEntry[] }>;

export type ClientMessage =
  | { t: 'hello'; token: string; profile: ProfileLite; x?: number; z?: number }
  | { t: 'move'; x: number; z: number; rot: number; anim: string; mode?: TransportMode }
  | { t: 'profile'; profile: ProfileLite }
  | { t: 'chat'; text: string; scope: 'global' | 'party'; replyTo?: string }
  | { t: 'chat_edit'; id: string; text: string }
  | { t: 'chat_delete'; id: string }
  | { t: 'react'; id: string; emoji: string }
  | { t: 'emote'; emote: string }
  | { t: 'wave'; to: string }
  | { t: 'party_create' }
  | { t: 'party_join'; id: string }
  | { t: 'party_leave' }
  | { t: 'party_select'; game: GameId; settings: Partial<PartySettings> }
  | { t: 'party_ready'; ready: boolean }
  | { t: 'party_start' }
  | { t: 'party_lobby' }
  | { t: 'game'; action: unknown }
  | { t: 'ping' };

export type ServerMessage =
  | { t: 'welcome'; id: string; players: PlayerPublic[]; chat: ChatMessage[]; parties: PartyPublic[]; serverTime: number; leaderboard: Leaderboard; partyId: string | null }
  | { t: 'player_join'; player: PlayerPublic }
  | { t: 'player_leave'; id: string }
  | { t: 'player_update'; player: PlayerPublic }
  | { t: 'players_move'; moves: [string, number, number, number, string, TransportMode][] }
  | { t: 'chat'; message: ChatMessage }
  | { t: 'chat_update'; message: ChatMessage }
  | { t: 'emote'; id: string; emote: string; at: number }
  | { t: 'wave'; from: ChatAuthor }
  | { t: 'party'; party: PartyPublic }
  | { t: 'party_removed'; id: string }
  | { t: 'party_you'; partyId: string | null }
  | { t: 'game'; partyId: string; view: GameView }
  | { t: 'game_event'; partyId: string; event: string; by?: string }
  | { t: 'leaderboard'; leaderboard: Leaderboard }
  | { t: 'toast'; text: string; kind?: 'info' | 'error' | 'success' }
  | { t: 'pong'; serverTime: number };

export const NEARBY_RADIUS = 60;
export const PARTY_JOIN_RADIUS = 45;
export const VOICE_RADIUS = 25;
