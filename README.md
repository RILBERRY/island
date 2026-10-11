# L15 — Explore Isdhoo. Meet your friends.

A personal clone of [D15](https://d15.live) (the 3D island hangout built for N. Velidhoo), rebuilt for **L. Isdhoo** in Laamu Atoll, Maldives. The name follows D15's pattern: **L** for Laamu, **15** for the atoll's postcode prefix (Isdhoo is 15011).

Walk around a 3D Isdhoo built from real OpenStreetMap geometry, meet other islanders, chat, wave, pat the island cats, and sit down at a table for UNO, Quiz Night or Beach Chess.

## What's inside

- **The island** — Isdhoo's coastline, streets, mapped buildings, harbour piers, old mosque, health centre and football grounds from OpenStreetMap, placed in a local metric frame (x east, z south, metres). Palms, bushes, bougainvillea, boats, cats and the extra houses along the streets are illustrative.
- **Real daylight** — the sun follows the actual solar position for Isdhoo (UTC+5), so the island has mornings, golden sunsets and nights.
- **Multiplayer** — a small Node + WebSocket server shares positions, emotes, waves and global chat (messages expire after 7 days, edit for 15 minutes, delete any time, reactions, replies, @mentions).
- **Games** — open a table where you stand; islanders within 45 m can join. Host picks UNO (house rules, one round or first to 500), Quiz Night (topics, question count, timer) or Beach Chess (clock, bot strength). Practice bots fill empty seats; only matches between real islanders count on the leaderboards (all time / this month).
- **Profiles** — name, username, emoji, a procedural character (humans with hair, hijab, clothes, glasses, beard; or an island animal), home address, English/Dhivehi place names. Guest profiles are saved in the browser.
- **Mobile** — touch joystick, drag to look, pinch to zoom, tap the ground or the minimap to walk.

Not included from the original: Google sign-in, ID verification, nearby voice (LiveKit), GIFs, push notifications, the Jetski race, and the ten Maldivian "Classic Cards" games.

## Run it

```bash
npm install
npm run dev        # Vite on http://localhost:5173 + game server on :3000
```

Production, or to play with others on your network:

```bash
npm run serve      # builds, then serves dist/ + the WebSocket on every interface (port 3000)
npm run stop       # stops it
```

The server prints the addresses to share, for example `http://192.168.1.20:3000`. Anyone on the same Wi-Fi opens that URL (phones work; add it to the home screen). If a firewall blocks it: `sudo ufw allow 3000/tcp`. `npm run dev` also listens on the network (port 5173). To invite people outside your network, put a tunnel such as `cloudflared tunnel --url http://localhost:3000` or `ngrok http 3000` in front of it; WebSockets pass through both.

Options: `PORT=8080 npm start` changes the port, `HOST=127.0.0.1 npm start` keeps it local only.

Rebuild the world file from a fresh OpenStreetMap export:

```bash
curl "https://api.openstreetmap.org/api/0.6/map.json?bbox=73.28,1.76,73.64,2.16" -o data/laamu-osm.json
npm run world
```

Server state (profiles, chat, leaderboards) lives in `data/state.json`.

## Checks

```bash
npm run typecheck            # TypeScript across client, server and shared code
npx tsx tools/uno-fuzz.ts    # 300 bot-only UNO matches through the engine
node tools/smoke.mjs         # two simulated islanders: chat, waves, party, UNO, quiz, chess (needs a running server)
```

## Layout

```
shared/     protocol, profile, daylight, UNO engine, quiz bank (used by client and server)
server/     Express + ws game server, chess bot
src/        React app: scene/ (three.js island), ui/ (HUD, panels), games/ (tables), world/ (geometry)
tools/      build-world.py (OSM → world JSON)
public/world/isdhoo.json
```

## Data & credits

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL. Building coverage for Isdhoo is incomplete; heights are estimated. Quiz facts from Wikipedia and OpenStreetMap. Built with React, three.js, React Three Fiber, zustand, chess.js, Express and ws. All sound is synthesised in the browser.
# island
