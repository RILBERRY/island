import type { CSSProperties } from 'react';

const PATHS: Record<string, string> = {
  chat: 'M21 12a8 8 0 0 1-8 8H8l-5 3 1.2-4.2A8 8 0 1 1 21 12z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  map: 'M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  games: 'M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM8 8.5v1M8 9.5v0M16 8.5v0M15.5 15.5v0M8.5 15.5v0M12 12v0',
  settings: 'M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M10 16v4',
  smile: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01',
  x: 'M18 6 6 18M6 6l12 12',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  anchor: 'M12 22V8M5 12H2a10 10 0 0 0 20 0h-3M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  landmark: 'M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2 3 7h18z',
  ball: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 7l4 3-1.5 5h-5L8 10zM12 2v5M16 10l5-1M15 15l3 4M9 15l-3 4M8 10 3 9',
  health: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 8v8M8 12h8',
  road: 'M4 22 9 2M20 22 15 2M12 5v3M12 11v3M12 17v3',
  address: 'M3 11 12 3l9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  home: 'M3 11 12 3l9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  crown: 'M3 18h18M3 18 2 8l5 4 5-7 5 7 5-4-1 10',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3',
  volume: 'M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  back: 'm15 18-6-6 6-6',
  check: 'M20 6 9 17l-5-5',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  hand: 'M18 11V6a2 2 0 0 0-4 0v1M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2a8 8 0 0 1-6.4-3.2L3.1 15a2 2 0 0 1 3.3-2.3L8 14.5',
  micoff: 'M2 2l20 20M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.7-1.3M17 16.9A7 7 0 0 1 5 12v-2M19 10v2a7 7 0 0 1-.1 1.2M12 19v3M8 22h8',
  search: 'M21 21l-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z',
  compass: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM16.2 7.8l-2.1 6.3-6.3 2.1 2.1-6.3z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  locate: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 2v4M12 18v4M2 12h4M18 12h4M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  cards: 'M4 6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM16 6l3.6 1a2 2 0 0 1 1.4 2.4l-3 11',
  quiz: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  chess: 'M8 21h8M9 18l1-6h4l1 6M10 12a4 4 0 1 1 4 0M7 21h10',
  jetski: 'M2 18c2 1 3 1 5 0s3-1 5 0 3 1 5 0 3-1 5 0M5 14l3-5h6l4 5zM11 9V6h3',
  edit: 'M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z',
  copy: 'M9 9h11v11H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  reply: 'M9 17 4 12l5-5M20 18v-2a4 4 0 0 0-4-4H4',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
  flag: 'M4 22V4h12l-1 4 1 4H4',
  dice: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01',
  wifi: 'M5 12.6a11 11 0 0 1 14 0M8.5 16a6 6 0 0 1 7 0M2 9a16 16 0 0 1 20 0M12 20h.01',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  boat: 'M3 16h18l-2 4H5zM12 4v9M12 4l6 9H6z',
  walk: 'M13 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM10 22l2-6 2 2v4M7 13l3-5 3 1 2 3h3M10 8l-2 5-3 2',
  star: 'm12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  bike: 'M5.5 17.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM18.5 17.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM15 6h-3l-3 8h6.5L12 6M9 14l-3.5-4M15 6l3.5 8M14 4h2',
  car: 'M3 17h18v-4l-2-1-1.5-4h-11L5 12l-2 1zM6 17l1.5-5h9L18 17M7 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  bus: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11H4zM4 11h16M8 20v-3M16 20v-3M8 15h.01M16 15h.01',
  plane: 'M2 14l8-2 4-8 2 1-2 7 6 2-1 2-6-1-3 5h-2l1-5-5 1z',
  sparkles: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM5 18l.6 1.6 1.6.6-1.6.6L5 22.4l-.6-1.6-1.6-.6 1.6-.6zM19 2l.5 1.5 1.5.5-1.5.5L19 6l-.5-1.5L17 4l1.5-.5z',
};

export function Icon({ name, size = 18, style }: { name: string; size?: number; style?: CSSProperties }) {
  const d = PATHS[name] ?? PATHS.info;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>
      <path d={d} />
    </svg>
  );
}

export function PlaceIcon({ icon, size = 14 }: { icon: string; size?: number }) {
  const map: Record<string, string> = { landmark: 'landmark', anchor: 'anchor', ball: 'ball', health: 'health', road: 'road', address: 'address', school: 'landmark', shield: 'landmark', plane: 'plane', island: 'map' };
  return <Icon name={map[icon] ?? 'map'} size={size} />;
}
