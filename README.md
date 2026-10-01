# Trivia Clash (Trivia Crack Clone PWA)

A mobile-first Progressive Web App (PWA) clone of Trivia Crack built for friends to play turn-based duels, with 100% free deployment on Cloudflare (Cloudflare Pages + Cloudflare Workers + D1 SQLite + Server-Sent Events).

## Live Production Deployment (Cloudflare)
- **Frontend PWA (Cloudflare Pages)**: [https://triviaclash.pages.dev](https://triviaclash.pages.dev)
- **Backend API (Cloudflare Workers)**: [https://trivia-clash-server.saadmankabir95.workers.dev](https://trivia-clash-server.saadmankabir95.workers.dev)
- **Edge Database (Cloudflare D1)**: `triviaclash-db` (`86030aff-f7e5-4a3d-bdb9-ca2f08a612a3`)

## Features
- **Iconic 7-Slice Wheel**: Physics-based Canvas spinning wheel with decelerating cubic easing curve and deflector flapper with sound ticks and haptic feedback.
- **6 Classic Trivia Categories & Character Crowns**:
  - 🎨 **Art & Literature** (Arthur - Red)
  - 🔬 **Science & Nature** (Albert - Green)
  - 🏆 **Sports & Games** (Bonzo - Orange)
  - 🎬 **Entertainment** (Pop - Pink)
  - 🌍 **Geography & Travel** (Tina - Blue)
  - ⏳ **World History** (Hector - Yellow)
  - 👑 **King Crown** (Gold)
- **3-Point Crown Gauge & Battles**:
  - Consecutive correct answers earn streak points on the 3-point Crown Gauge.
  - Reaching 3 points or landing on the Crown slice triggers Crown Choice:
    - **Claim**: Play for an unowned category crown.
    - **Steal**: Wager one of your own crowns to challenge an opponent's crown!
- **180+ Pre-Bundled Curated Question Bank**:
  - 30 questions per category with rich visual/image questions (flags, landmarks, paintings, historical figures).
- **OpenTDB Integration**:
  - Live dynamic question fetching with fast HTML entity decoding and graceful offline fallback.
- **Custom Question Pack Creator**:
  - In-app pack manager supporting custom image URLs with live thumbnail preview.
  - JSON Import / Export matching standard format.
- **Synthesized Audio Engine**:
  - Pure Web Audio API oscillators for wheel ticks, button pops, correct chimes, incorrect buzzers, and victory fanfare. Zero external MP3 downloads required.
- **PWA Ready**:
  - Service Worker with offline caching, web app manifest, maskable SVG icons, installable on iOS and Android.

---

## Architecture & Cloudflare Deployment

- **Backend**: Hono TypeScript application with dual runtime support:
  - **Local Development**: Runs natively on Bun (`bun run server/src/bunServer.ts`) on port 3001 with built-in SQLite (`bun:sqlite`).
  - **Production Edge**: Compiles directly to Cloudflare Workers with native Cloudflare D1 serverless SQLite binding (`env.DB`).
  - **Realtime Sync**: Server-Sent Events (`/api/games/:gameId/events`) for instantaneous multiplayer push.
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 + Lucide Icons + PWA Service Worker (deployable to Cloudflare Pages for unlimited free CDN bandwidth).

---

## Quickstart (Local Development with Bun)

```bash
# 1. Start backend server (port 3001)
bun run server/src/bunServer.ts

# 2. In a separate terminal, start frontend client (port 5173)
cd client && bun run dev

# 3. Open browser at http://localhost:5173
```

---

## Running Automated Tests

```bash
bun test
```
Runs the full automated test suite covering game creation, join lifecycle, wheel spin category calculation, crown gauge progression, crown claim/steal mechanics, win conditions, pack import/export, and OpenTDB entity decoding.

---

## Deploying to Cloudflare (100% Free Tier)

### 1. Backend: Cloudflare Workers + D1 Database
```bash
# Create D1 database
npx wrangler d1 create triviaclash-db

# Run schema migrations on Cloudflare D1
npx wrangler d1 execute triviaclash-db --remote --file=server/src/db/schema.sql

# Deploy Worker
cd server && npx wrangler deploy
```

### 2. Frontend: Cloudflare Pages
```bash
# Build production client bundle
cd client && bun run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy client/dist --project-name=triviaclash
```
