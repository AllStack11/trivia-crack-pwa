# Trivia Clash (Trivia Crack Clone PWA)

A mobile-first Progressive Web App (PWA) clone of Trivia Crack built for friends to play turn-based duels, with 100% free deployment on Cloudflare (Cloudflare Workers + Workers Static Assets + D1 SQLite + Server-Sent Events).

## Live Production Deployment (Cloudflare)
- **Frontend PWA (Cloudflare Workers)**: [https://trivia-clash.saadmankabir95.workers.dev](https://trivia-clash.saadmankabir95.workers.dev)
- **Backend API (Cloudflare Workers)**: [https://trivia-clash-server.saadmankabir95.workers.dev](https://trivia-clash-server.saadmankabir95.workers.dev)
- **Edge Database (Cloudflare D1)**: `triviaclash-db-v2` (`50b2d81d-1956-413e-8e59-fb69decf0aca`)

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
- **Multi-Tier Question Caching & Cascading Fallback**:
  - Fast in-memory question pools (`MemoryQuestionCache`) with 2-hour configurable TTL, LRU capacity pruning, and rotation tracking (`servedHistory`) to prevent duplicate questions on consecutive queries.
  - Persistent database storage (`cached_questions` table in SQLite/Cloudflare D1) ordered by lowest served count.
  - Dynamic fetching across **The Trivia API (v2)**, **Open Trivia Database (OpenTDB)**, **The Trivia API (v1)**, and **Will Fry Trivia API** with automatic refill batches.
  - Multi-tier cascading fallback: checks memory cache first $\rightarrow$ SQLite/D1 second $\rightarrow$ external APIs third $\rightarrow$ curated pre-bundled pool on complete network/rate-limit failure.
  - Live pack expansion (`POST /api/packs/:packId/expand`) and live question fetching (`GET /api/questions/fetch`) with `Cache-Control` and `X-Cache-Status` headers.
  - Cache monitoring and management endpoints (`GET /api/questions/cache/stats`, `POST /api/questions/cache/clear`).
  - Pack Studio UI with Fast/Fresh toggle and parallelized 30-question deck autofill.
- **Custom Question Pack Creator**:
  - In-app pack manager supporting custom image URLs with live thumbnail preview.
  - JSON Import / Export matching standard format.
- **Synthesized Audio Engine**:
  - Pure Web Audio API oscillators for wheel ticks, button pops, correct chimes, incorrect buzzers, and victory fanfare. Zero external MP3 downloads required.
- **Account-Based Matchmaking**: Username-only profiles with optional PIN protection, player discovery, accepted invitations, persistent match lists, and account-owned turn-based games.

---

## Architecture & Cloudflare Deployment

- **Backend**: Hono TypeScript application with dual runtime support:
  - **Local Development**: Runs natively on Bun (`bun run server/src/bunServer.ts`) on port 3001 with built-in SQLite (`bun:sqlite`).
  - **Production Edge**: Compiles directly to Cloudflare Workers with native Cloudflare D1 serverless SQLite binding (`env.DB`).
  - **Realtime Sync**: Bearer-authenticated fetch-based SSE (`/api/games/:gameId/events`). Each stream checks D1 revisions every second and sends committed state across Worker isolates. REST polling is a fallback while disconnected. This uses D1 reads while streams are open.
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + PWA Service Worker (deployed to Cloudflare Workers Static Assets).

---

## Quickstart (Local Development with Bun)

```bash
# 1. Start backend server (port 3001)
bun run server/src/bunServer.ts

# 2. In a separate terminal, start frontend client (port 5173)
cd client && bun run dev

# 3. Open browser at http://localhost:5173
```

Create a profile with a unique username and an optional 4-digit PIN. Select a passwordless profile to sign in directly; protected profiles require their PIN. Registration returns `400` for invalid input, `409` for an existing email/username, and `500` for unexpected server or database failures. Find a player in the dashboard, select question packs, and send an invitation; the recipient must accept before the match starts. Sign-in persists across games, and match history is tied to the account. Email verification and password recovery are not available.

---

## Running Automated Tests

```bash
bun test
```
Runs engine rules (including concurrent-action protection, atomic rollback, server-enforced deadlines, fallback exhaustion and database-backed SSE), account/session and game-membership authorization boundaries, invitation transitions, valid pack import/export, and OpenTDB decoding.

---

## Deploying to Cloudflare (100% Free Tier)

### 1. Backend: Cloudflare Workers + D1 Database
```bash
# Run from the directory containing the backend Wrangler configuration
cd server

# Create a fresh D1 database and put its returned ID in wrangler.toml
npx wrangler d1 create triviaclash-db-v2

# Initialize the complete schema in the fresh database
npx wrangler d1 migrations apply triviaclash-db-v2 --remote

# Deploy Worker
npx wrangler deploy
```

### 2. Frontend: Cloudflare Workers (Static Assets)
```bash
# Build production bundle and deploy Worker
cd client && bun run deploy
```

The migration baseline targets a fresh database; it does not upgrade older deployments. Verify migrations with disposable local D1 state, never the production database.

Game actions use monotonic revisions and commit answer claims, scores, crowns and game state atomically. Question deadlines are persisted by the server: ordinary questions include the 4.4-second wheel animation and 0.9-second landing display before their 20-second timer; crown questions start immediately. The server allows 2 seconds for delivery and resolves expired questions on match reads/SSE, even if the player disconnects. Reloading preserves the deadline. If all question sources are exhausted, content can repeat with a new answerable occurrence ID.

Session tokens remain in the client account storage and bearer headers. SSE does not accept query-string session tokens. Request logs omit query strings and headers. Client synchronization ignores older revisions and responses from previous matches or sessions; failed answer requests unlock the options for retry.

### Illustrated mobile interface

The client uses original category mascots and an illustrated game world in `client/public/art/`. Artwork is optimized as WebP with transparency preserved for mascots. The home screen, category gallery, questions, crowns, and spinning wheel share the same characters. Mascot idle animations respect reduced-motion preferences; wheel timing continues to follow the server game contract. The mobile dock provides Play, Friends, Heroes, and Packs. Profile creation and optional PIN entry use bottom sheets.

On Windows, if Vite's bundled config loader cannot load native dependencies, use `bun run --cwd client vite --configLoader native` for development or `bun run --cwd client vite build --configLoader native` after `bun run --cwd client tsc --noEmit` for a build.
