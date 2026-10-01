# Agent Context

## Project
Trivia Clash is a turn-based trivia PWA. The client is React/TypeScript/Vite; the API is Hono/TypeScript running on Bun locally or Cloudflare Workers with D1 in production. `shared/src/index.ts` contains contracts used by both sides. Realtime match updates use Server-Sent Events (SSE).

## Product model
- Players register and log in with email/password; usernames are unique case-insensitively and preserve display casing.
- The server stores PBKDF2 password hashes and SHA-256 hashes of opaque 30-day session tokens. Never log or persist raw tokens outside the client's account session storage.
- Players discover registered accounts, send invitations with selected question-pack IDs, and recipients accept or decline. A match is created on acceptance; sender moves first.
- Match lists include active and completed account-owned games. Every game read, action, and SSE subscription must authenticate the account and verify match membership.
- Legacy anonymous room records remain in storage but are not associated with accounts. Room-code creation/joining is removed; do not reintroduce compatibility shims.
- Game mechanics (wheel, questions, crowns, turns, wins, resign) live in `server/src/services/gameEngine.ts` and should remain unchanged unless requested.
- Email verification and password recovery are not implemented; there is no email-delivery provider.

## Repository map
- `client/src/App.tsx`: account restoration, navigation, game surface.
- `client/src/components/Lobby.tsx`: auth forms, pack selection, player discovery, invitations, and match dashboard.
- `client/src/hooks/useGameSync.ts`: authenticated REST actions and SSE connection.
- `server/src/index.ts`: Hono routes; use validated session identity, never caller-supplied player IDs.
- `server/src/services/authService.ts`: account registration, password verification, sessions, player discovery.
- `server/src/services/invitationService.ts`: invitations, acceptance, match listing, and membership checks.
- `server/src/services/gameEngine.ts`: game state machine and game snapshots.
- `server/src/db/database.ts`: `AppDatabase`, Bun/D1 adapters, and fresh local `SCHEMA_SQL`.
- `server/src/db/schema.sql`: canonical SQL schema; `server/src/db/migrations/` is Wrangler's D1 migration directory.
- `server/tests/`: engine, account/session, and invitation tests.

## Development and verification
From repository root:
- `bun run dev:server` starts the local API on port 3001.
- `bun run dev:client` starts Vite; README quickstart also uses `cd client && bun run dev`.
- `bun test` runs all server tests.
- `bun run build:client` runs the client TypeScript check and production build.
- `bun run --cwd server build` bundles the Bun server entry point.

Use the local Bun SQLite database only when intentionally running the local server; it persists in the working directory as `trivia-clash.sqlite`. Tests should use in-memory databases. Never run D1 migration commands against production for routine verification; use a disposable local D1 state.

## Data and API invariants
- `users` holds display usernames; `accounts` binds registered identity and normalized unique email/username to a user row. Legacy users without an account remain legacy.
- Session lookups compare a digest of the supplied bearer token and reject/delete expired sessions.
- Normal REST calls use `Authorization: Bearer <token>`. Native EventSource cannot set request headers, so `/api/games/:gameId/events` also accepts `?session=<token>`.
- Invitations have one pending row per sender/recipient direction. Reverse-direction invitations are distinct. Only the recipient may accept/decline a pending invitation.
- Acceptance inserts the game and transitions the invitation in one database batch/transaction. The invitation's selected `pack_ids_json` is copied to the new game.
- `GET /api/games` returns matches for the authenticated account only. Game state, SSE, and actions return not-found for nonparticipants.
- Public question-pack APIs are separate from account/match authorization. Do not accidentally make game routes public while editing shared routing code.
- Keep `SCHEMA_SQL`, `schema.sql`, and D1 migrations aligned. Existing deployments have the legacy `users`/`games` tables; migration changes must preserve their rows.

## Change guidance
- Update shared API types, server handlers/services, client call sites, tests, and README when changing a cross-layer contract.
- Prefer behavior tests for authentication, authorization, invitation transitions, and game rules; avoid tests that only assert forwarding or incidental presentation details.
- For UI changes, verify the actual browser flow. For behavior changes, run the relevant test/build plus a smoke path through the affected feature.
- Do not add room-code aliases, fake auth fallbacks, or username-based ownership migration for legacy matches.
