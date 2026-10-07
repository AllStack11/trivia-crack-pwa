# Trivia Clash (Trivia Crack Clone PWA)

A mobile-first Progressive Web App (PWA) clone of Trivia Crack built for friends to play turn-based duels, with 100% free deployment on Cloudflare (Cloudflare Workers + Workers Static Assets + D1 SQLite + Server-Sent Events).

## Live Production Deployment (Cloudflare)
- **Frontend PWA (Cloudflare Workers)**: [https://trivia-clash.saadmankabir95.workers.dev](https://trivia-clash.saadmankabir95.workers.dev)
- **Backend API (Cloudflare Workers)**: [https://trivia-clash-server.saadmankabir95.workers.dev](https://trivia-clash-server.saadmankabir95.workers.dev)
- **Edge Database (Cloudflare D1)**: `triviaclash-db-v3` (`bc0e5a84-b5d5-4ae2-bdac-2a198edfd9db`)

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
- **In-App Turn Reminders**: Outside a game, a modal lists matches where it is your turn, with buttons to play or dismiss for later. Visible, online pages check every 10 seconds and when returning to the app. Dismissed reminders return after an observed turn change or after leaving a game.

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

Push tests also run the real sender inside the Workers runtime with synthetic subscriptions for Apple, Google, Mozilla, and Windows. Native Node is required for this regression. The notification test endpoint reports push-service acceptance or delivery failure; acceptance does not prove that the OS displayed an alert. See [mobile PWA setup and delivery verification](docs/mobile-pwa-plan.md).

---

## Deploying to Cloudflare (100% Free Tier)

### 1. Backend: Cloudflare Workers + D1 Database
```bash
# Run from the directory containing the backend Wrangler configuration
cd server

# Create a fresh D1 database and put its returned ID in wrangler.toml
npx wrangler d1 create triviaclash-db-v3

# Initialize the complete schema in the fresh database
npx wrangler d1 migrations apply triviaclash-db-v3 --remote

# Deploy Worker
npx wrangler deploy
```

### 2. Frontend: Cloudflare Workers (Static Assets)
```bash
# Build production bundle and deploy Worker
cd client && bun run deploy
```

The migration baseline targets a fresh database; it does not upgrade older deployments. Verify migrations with disposable local D1 state, never the production database.

Game actions use monotonic revisions and commit answer claims, scores, crowns and game state atomically. Question deadlines are persisted by the server: ordinary questions include the 6.4-second wheel animation and 0.9-second landing display before their 20-second timer; crown questions start immediately. The server allows 2 seconds for delivery and resolves expired questions on authenticated REST match reads, even if the player disconnects. SSE requests a fresh REST read when a deadline expires. Reloading preserves the deadline. If all question sources are exhausted, content can repeat with a new answerable occurrence ID.

Session tokens remain in the client account storage and bearer headers. SSE does not accept query-string session tokens. Request logs omit query strings and headers. Client synchronization ignores older revisions and responses from previous matches or sessions; failed answer requests unlock the options for retry.

### Illustrated mobile interface

The client uses original category mascots and an illustrated game world in `client/public/art/`. Artwork is optimized as WebP with transparency preserved for mascots. The home screen, category gallery, questions, crowns, and spinning wheel share the same characters. Answer reviews feature a larger character reaction, rotating personality dialogue, the correct answer, and an immediately available Continue button. Reviews clear automatically after six seconds for both players. Crown wins and steals add a dismissible four-second sidekick bubble after review, suppressed during active questions. Reaction animations and confetti respect reduced-motion preferences. Mascot idle animations respect reduced-motion preferences; wheel timing continues to follow the server game contract. The mobile dock provides Play, Friends, Heroes, and Packs. Profile creation and optional PIN entry use bottom sheets.

On Windows, if Vite's bundled config loader cannot load native dependencies, use `bun run --cwd client vite --configLoader native` for development or `bun run --cwd client vite build --configLoader native` after `bun run --cwd client tsc --noEmit` for a build.

### Game audio

Original procedural game-show effects add mechanical wheel clicks and a spin swoosh, question reveals, layered answer stingers, crown/steal celebrations, turn prompts, and victory/defeat cues. Your own question plays urgency pulses during the final five seconds. No audio files, music, or external downloads are required.

Use the header sound button to mute all effects; the preference persists on this device and muting immediately cancels playing and scheduled sounds. Audio unlocks after a click, tap, or key press. Hidden pages remain silent, and restoring a match does not replay historical results. Game timing and answer correctness remain server-controlled.

### Installed app icons and notification roadmap

Custom crown PNG icons in `client/public/icons/` provide 192px/512px install assets, a maskable Android icon, a 180px Apple touch icon, and a favicon. The manifest has a stable app ID; the service-worker cache includes the new assets. The source image and generation prompt are retained alongside the exports.

Each production client build automatically stamps `sw.js` with a unique cache version. No manual cache-version bump is needed for deployments. The app checks for updates on startup and when returning to the foreground; an installed update shows the lobby's **Update app** button and waits for the player to apply it. Deployments do not send phone push notifications for app updates.

Opt-in Web Push alerts cover incoming invitations, accepted invitations, your turn, and completed matches. The Play tab includes enable, test, and off controls. iPhone/iPad users must install to the Home Screen before enabling alerts. Each device subscription belongs to the authenticated session; sign-out, expiration, and profile switching detach it. Endpoints and encryption keys are never logged. A transactional D1 outbox records events alongside game mutations, with bounded delivery retries, endpoint cleanup, and minute-by-minute scheduled recovery.

The service worker uses fresh network navigation, caches hashed app assets, and opens cached deep links when offline. Multiplayer still requires connectivity. A lobby update prompt activates new versions without interrupting a question. Returning to the app refreshes dashboard and match state. Game actions have an eight-second network timeout so failed answers can be retried; server revisions and deadlines remain authoritative. Text zoom is enabled.

See [notification setup and verification](docs/mobile-pwa-plan.md) before deploying. Configure VAPID secrets and use a fresh database containing the updated baseline; existing initialized databases are not upgraded by changing the baseline file. Real installed iPhone/Android lock-screen delivery must be checked after deployment.

### Foreground synchronization and Cloudflare usage

Match streams and dashboard reads pause when the page is hidden or offline. Returning fetches current persisted state before reopening one stream. Submitted gameplay actions continue independently of visibility; failed answers remain retryable. A visible desktop tab keeps synchronizing even when you are away from the keyboard.

Each SSE invocation counts database statements, including batches, against a 45-query ceiling and reserves a complete coherent snapshot before doing more work. Streams rotate after at most 20 seconds, or sooner when query headroom runs low. A normal `reconnect` event uses the next stream's initial snapshot; an expired question or snapshot conflict requests a REST refresh. Push outbox draining runs after mutations and through the minute cron, rather than after SSE/GET reads.

Backgrounding does not extend question deadlines. If everyone is hidden, timeout resolution and its turn notification wait for the next authenticated match read. Notifications remain opt-in and do not require a background SSE connection.

The one-second polling baseline is visible player-seconds: eight players visible for one hour each contribute 28,800 poll reads, versus 691,200 for 24 hours. Authentication, rotating snapshots, answer-history scans, dashboard reads, actions, and push delivery add overhead. The 20-second lifetime is a conservative provisional ceiling; local workerd cannot establish production billed CPU headroom under the Free 10 ms limit. See [verification results and remaining device/runtime checks](docs/foreground-gameplay-sync-verification.md). No Free-tier capacity guarantee follows from the baseline alone.
