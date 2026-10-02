# Agent Context

## Project
Trivia Clash is a turn-based trivia PWA. The client is React/TypeScript/Vite; the API is Hono/TypeScript running on Bun locally or Cloudflare Workers with D1 in production. `shared/src/index.ts` contains contracts used by both sides. Realtime match updates use Server-Sent Events (SSE).

## Product model
- Players create a username-only profile and select it for passwordless sign-in. An optional 4-digit PIN protects a profile. This is the intended flow; do not require email/password or flag passwordless profiles as an authentication bug. Usernames are unique case-insensitively and preserve display casing.
- The server stores PBKDF2 hashes of optional PINs/passwords and SHA-256 hashes of opaque 30-day session tokens. Never log or persist raw tokens outside the client's account session storage.
- Players discover registered accounts, send invitations with selected question-pack IDs, and recipients accept or decline. A match is created on acceptance; sender moves first.
- Match lists include active and completed account-owned games. Every game read, action, and SSE subscription must authenticate the account and verify match membership.
- Room-code creation/joining is removed. Fresh database setup is the deployment target; legacy records and existing production-data preservation are not requirements.
- Game mechanics (wheel, questions, crowns, turns, wins, resign) live in `server/src/services/gameEngine.ts` and should remain unchanged unless requested.
- Email verification and password recovery are not implemented; there is no email-delivery provider.

## Repository map
- `client/src/App.tsx`: account restoration, navigation, game surface.
- `client/src/components/Lobby.tsx`: auth forms, pack selection, player discovery, invitations, and match dashboard.
- `client/src/hooks/useGameSync.ts`: authenticated REST actions and SSE connection.
- `server/src/index.ts`: Hono routes; use validated session identity, never caller-supplied player IDs.
- `server/src/services/authService.ts`: username-only profiles, optional PIN verification, sessions, and player discovery.
- `server/src/services/invitationService.ts`: invitations, acceptance, match listing, and membership checks.
- `server/src/services/gameEngine.ts`: game state machine and game snapshots.
- `server/src/db/database.ts`: `AppDatabase`, Bun/D1 adapters, and fresh local `SCHEMA_SQL`.
- `server/src/db/schema.sql`: canonical SQL schema; `server/src/db/migrations/` is Wrangler's D1 migration directory.
- `server/src/services/gameMutation.ts`: revision guards and atomic game mutation batches.
- `client/src/utils/gameState.ts`: revision acceptance and persisted-deadline calculations.
- `client/src/utils/gameEvents.ts`: fetch-stream SSE parsing and reader cleanup.
- `server/tests/`: engine, profile/session, invitation, D1 integrity, and migration tests.
- `client/tests/`: snapshot ordering, persisted timers, SSE parsing, and question rendering tests.

## Development and verification
From repository root:
- `bun run dev:server` starts the local API on port 3001.
- `bun run dev:client` starts Vite; README quickstart also uses `cd client && bun run dev`.
- `bun test` runs server and client tests.
- `bun run build:client` runs the client TypeScript check and production build.
- `bun run --cwd server build` bundles the Bun server entry point.

Use the local Bun SQLite database only when intentionally running the local server; it persists in the working directory as `trivia-clash.sqlite`. Tests should use in-memory databases. Never run D1 migration commands against production for routine verification; use a disposable local D1 state.

## Data and API invariants
- `users` holds display usernames; `accounts` binds each profile to a user row and unique normalized username. Username-only profiles receive an internal synthetic email; it is not an email-verification flow.
- Session lookups compare a digest of the supplied bearer token and reject/delete expired sessions.
- REST and fetch-based SSE use `Authorization: Bearer <token>`. Never put session tokens in URLs. Request logging includes only method/path, never query strings or headers.
- Invitations have one pending row per sender/recipient direction. Reverse-direction invitations are distinct. Only the recipient may accept/decline a pending invitation.
- Acceptance inserts the game and transitions the invitation in one database batch/transaction. The invitation's selected `pack_ids_json` is copied to the new game.
- `GET /api/games` returns matches for the authenticated account only. Game state, SSE, and actions return not-found for nonparticipants.
- Public question-pack APIs are separate from account/match authorization. Do not accidentally make game routes public while editing shared routing code.
- Keep `SCHEMA_SQL`, `schema.sql`, and the complete fresh D1 migration aligned. The migration chain must initialize an empty database.
- Keep the revision trigger condition in a `WHEN` clause. A nested `CASE ... END` in its body passed local SQLite but failed remote D1 migration parsing; verify trigger edits against disposable D1 before deployment.
- Every game mutation checks its persisted revision and commits all answer claims, logs, crowns and state in one batch/transaction. `game_mutation_guards` rejects stale revisions before any writes.
- SSE connections read committed revisions from D1 within their own request; never store stream writers in module-level maps. Recheck sessions periodically and close completed streams.
- Client snapshots must match the active game/session generation and advance the revision. Delayed REST/SSE responses must not roll state backward or cross match navigation.
- Question deadlines use persisted server timestamps, including the wheel presentation delay. Client-reported elapsed time does not decide correctness. Reads resolve expired questions even when the active player disconnects.
- All fallback pools honor answered IDs. Once content is exhausted, a replay uses a new occurrence ID so duplicate-answer protection does not lock the match.

## Regression verification
- Create profiles with `{ username }` in gameplay and authorization fixtures. Add `{ pin: '1234' }` only when verifying optional-PIN protection. Email/password inputs are optional service capabilities, not the required product flow.
- Route tests must supply an explicit in-memory D1 binding via `server/tests/helpers/d1.ts`; never accidentally initialize the persistent local database. Use `asD1` for all-or-nothing batches rather than sequential statement mocks.
- Keep `server/tests/accounts.test.ts` covering passwordless API registration/login, PIN protection, session restoration, and authentication/membership for every game route, including SSE and actions.
- Keep `server/tests/gameIntegrity.test.ts` covering server deadlines, disconnected-player timeout resolution, invalid inputs, concurrent transitions, rollback/retry, fresh replay IDs, and SSE observation across independent bindings.
- Keep `server/tests/migrations.test.ts` verifying an empty database initializes from the complete baseline and matches both schema definitions. Do not add legacy-data migration expectations.
- Keep client regressions for revision ordering, cross-match stale responses, persisted countdowns, fragmented SSE, and reader cleanup. Pure helper tests do not replace browser checks of hook lifecycle or failed-answer retry.
- Browser smoke checks should exercise two profiles, invitation acceptance, a turn change visible to both, timeout, resignation, reload during a question, and a dropped answer request followed by retry. Use local/disposable accounts.
- Cloudflare verification must separately check Worker entrypoint types, apply migrations to disposable local D1 state, and run a deployment dry run. A Bun bundle or SQLite-backed D1 test binding alone does not verify the Workers runtime. Report any runtime check that could not complete.

## Change guidance
- Update shared API types, server handlers/services, client call sites, tests, and README when changing a cross-layer contract.
- Prefer behavior tests for authentication, authorization, invitation transitions, and game rules; avoid tests that only assert forwarding or incidental presentation details.
- For UI changes, verify the actual browser flow. For behavior changes, run the relevant test/build plus a smoke path through the affected feature.
- Do not add room-code aliases or legacy ownership migration. Preserve username-only and optional-PIN profile behavior.
