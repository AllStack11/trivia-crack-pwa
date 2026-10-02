# Trivia Clash (Trivia Crack Clone PWA)

A mobile-first Progressive Web App (PWA) clone of Trivia Crack built for friends to play turn-based duels, with 100% free deployment on Cloudflare (Cloudflare Workers + Workers Static Assets + D1 SQLite + Server-Sent Events).

## Live Production Deployment (Cloudflare)
- **Frontend PWA (Cloudflare Workers)**: [https://trivia-clash-client.saadmankabir95.workers.dev](https://trivia-clash-client.saadmankabir95.workers.dev)
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
- **Account-Based Matchmaking**: Email/password accounts, player discovery, accepted invitations, persistent match lists, and account-owned turn-based games.

---

## Architecture & Cloudflare Deployment

- **Backend**: Hono TypeScript application with dual runtime support:
  - **Local Development**: Runs natively on Bun (`bun run server/src/bunServer.ts`) on port 3001 with built-in SQLite (`bun:sqlite`).
  - **Production Edge**: Compiles directly to Cloudflare Workers with native Cloudflare D1 serverless SQLite binding (`env.DB`).
  - **Realtime Sync**: Server-Sent Events (`/api/games/:gameId/events`) for instantaneous multiplayer push.
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

Create an account with a unique username, email, and password (minimum 8 characters). Registration returns `400` for invalid input, `409` for an existing email/username, and `500` for unexpected server or database failures. Find a player in the dashboard, select question packs, and send an invitation; the recipient must accept before the match starts. Sign-in persists across games, and match history is tied to the account. Email verification and password recovery are not available.

---

## Running Automated Tests

```bash
bun test
```
Runs engine rules (including concurrent duplicate-answer protection), account/session and game-membership authorization boundaries, invitation transitions, valid pack import/export, and OpenTDB decoding.

---

## Deploying to Cloudflare (100% Free Tier)

### 1. Backend: Cloudflare Workers + D1 Database
```bash
# Create D1 database
npx wrangler d1 create triviaclash-db

# Apply all pending account, invitation, and answer-integrity migrations to D1
npx wrangler d1 migrations apply triviaclash-db --remote

# Deploy Worker
cd server && npx wrangler deploy
```

### 2. Frontend: Cloudflare Workers (Static Assets)
```bash
# Build production bundle and deploy Worker
cd client && bun run deploy
```
