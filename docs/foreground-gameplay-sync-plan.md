# Foreground gameplay synchronization plan

Status: implemented with automated verification; browser/device smoke checks and production CPU measurements remain outstanding. See [verification results](foreground-gameplay-sync-verification.md).

## Goal

Support friends who leave Trivia Clash installed or open all day and play intermittently. Keep visible matches responsive, stop background synchronization, and use existing opt-in Web Push alerts to bring players back. Keep D1 authoritative and preserve all game rules, account authorization, persisted deadlines, and revision ordering.

## Current behavior and constraints

- `client/src/hooks/useGameSync.ts` opens SSE and refreshes REST state on mount. A hidden page does not close its stream or cancel reconnection/fallback polling. Returning to a visible page aborts the stream to restart it indirectly.
- Each SSE request in `server/src/index.ts` reads the match once a second, rechecks authentication and membership every 15 seconds, and builds a full snapshot when the revision changes or a question expires. Its loop has no lifetime or query budget.
- `Lobby.tsx` already skips periodic dashboard refreshes while hidden, but its initial refresh and concurrent refresh paths need lifecycle and request deduplication checks.
- Notifications already cover invitations, acceptance, turn transitions, and completion. D1 triggers enqueue alerts; request background work and the scheduled Worker drain the outbox. Notification taps restore the app through normal authentication.
- Free Workers permit 50 D1 queries per invocation and 10 ms CPU per HTTP request. A fixed stream duration alone cannot guarantee safety: snapshot construction, timeout resolution, retries, and push-outbox work add queries and CPU.

References: [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/). Confirm these limits again before implementation and deployment.

## Desired lifecycle

| Situation | Behavior |
| --- | --- |
| Visible, online, authenticated, unfinished match | Fetch current state on entry/resume and keep one bounded SSE stream open. |
| Hidden page | Abort the SSE reader and background refresh request; cancel reconnect and fallback timers immediately. |
| Offline | Stop synchronization attempts; retain the last snapshot and existing offline UI. |
| Visible again / online again | Coalesce events into one resume operation, refresh persisted state, then reconnect if eligible. |
| Planned SSE rotation | Reconnect promptly with small jitter; use the new stream's initial snapshot rather than issuing an extra REST refresh. |
| Unexpected stream failure | Retry with bounded backoff and jitter; run non-overlapping REST fallback refreshes only while visible and online. |
| Expired session / removed membership | Stop reconnecting and polling; follow the existing unauthorized/not-found flow. |
| Completed match | Display the final snapshot and stop all synchronization. |
| Match navigation / profile change / unmount | Cancel the previous lifecycle; reject all late callbacks from that lifecycle. |

Visibility means `document.visibilityState === 'visible'`, not window focus. Losing focus while a match is still visible should not interrupt live updates. Hidden does not mean a failed connection; avoid showing a transient connection error solely because the app paused itself.

## 1. Implement a single client synchronization lifecycle

Update `client/src/hooks/useGameSync.ts`:

1. Centralize eligibility in one predicate: visible, online, valid game/session, unfinished match, and current lifecycle generation.
2. Give every stream attempt its own identity. An old attempt's `finally` or queued retry must not mark a newer connection disconnected or create a second stream.
3. Implement idempotent start/pause/resume operations. Handle initial hidden loads, `visibilitychange`, `online`, `offline`, and page lifecycle restoration. Remove every listener and timer on cleanup.
4. Use abortable, deduplicated REST refreshes. Coalesce simultaneous resume events and prevent fallback refreshes from overlapping. Retain the existing game/session generation and revision checks.
5. On resume, fetch fresh state before reconnecting. If that fetch fails transiently, enter visible retry/fallback handling; do not become permanently paused. Stop on terminal authorization or not-found responses.
6. Separate planned rotation from transport errors so rotation does not create an error toast, an unnecessary REST request, or exponential backoff.
7. Preserve in-flight gameplay actions when the page becomes hidden: the server may already have committed them. Pause background synchronization, not user-submitted mutations. Preserve the existing failed-answer retry and recover committed results on resume without automatically resubmitting actions.
8. Keep persisted countdown calculations. Backgrounding must never pause, reset, or extend the question's server deadline.

Review `client/src/utils/gameEvents.ts` for explicit reader cancellation on pause and normal rotation. Document any new SSE event in shared contracts and update both parser/client and server call sites.

## 2. Bound each server SSE invocation by actual work

Update the SSE endpoint and database access support without changing gameplay rules:

1. Inventory all D1 statements incurred by authentication, membership, initial snapshots, polling, session rechecks, snapshot retries, timeout mutations, and notification delivery. Include statements inside batches and any work attached to the same invocation with `waitUntil`.
2. Add request-scoped query accounting using the actual database adapter path. Count before issuing work; reserve headroom below the Free limit. Do not use a global counter or subscriber map.
3. Ensure nested operations fit the remaining budget before starting them. Snapshot retries and timeout resolution must have a bounded work allowance; if the allowance is unavailable, rotate before doing that work. A counter that throws halfway through ordinary operations is not sufficient.
4. Keep mutation batches atomic. Never truncate a batch to fit the budget. If necessary, resolve an expired question through a fresh authenticated request, using the same engine behavior and revision guards.
5. Emit a small `reconnect` SSE control event and close cleanly before exhausting the budget. Add a maximum lifetime as a secondary safeguard; choose its value after query and CPU measurements, rather than assuming a 20- or 30-second stream is safe.
6. Keep the initial `sync` snapshot, bearer authentication, membership checks, periodic session revalidation, no-store headers, committed-revision reads, and completed-stream closure.
7. Review push middleware: SSE must not consume an unreserved outbox-drain budget after closing. Prefer leaving notification delivery to mutation requests and scheduled recovery, or account for it explicitly.
8. Measure CPU in the Workers runtime. Query accounting protects the query limit, not the cumulative CPU limit. Shorten the stream or simplify its work if measurements show insufficient headroom.

If even the initial authenticated snapshot cannot fit reliably within Free runtime limits, address that bounded read path before shipping rotation. Report measured limitations rather than treating successful Bun tests as evidence of Free Workers compatibility.

## 3. Finish dashboard and notification integration

- Retain visible-only dashboard polling. Make initial/resume polling obey the same eligibility rules, cancel obsolete background reads, and deduplicate refreshes after actions and lifecycle events.
- Reuse existing notification subscriptions, outbox, and deep links. Do not request notification permission automatically; retain the explicit enable control and existing unsupported/denied/unconfigured states.
- Verify invitation and turn alerts reach a backgrounded device and tapping them restores the correct authorized match. Users without notifications can still return manually and retrieve current state.
- Document that backgrounding does not stop an active question timer. With no readers connected, timeout resolution occurs on the next read; a turn notification caused by that resolution is correspondingly delayed. This phase does not introduce a background game-deadline scheduler.
- Document that a visible desktop tab still synchronizes continuously. Reducing visible-but-idle usage through a slower polling cadence is a separate follow-up requiring a chosen latency tradeoff.

## 4. Regression and browser verification

Add behavior coverage for:

- Hidden initial load makes no background synchronization requests.
- Hiding cancels stream readers and timers; advancing time causes no reconnect or fallback polling.
- Showing/online events produce one refresh and at most one stream, including rapid event sequences and React effect cleanup/restart.
- Planned rotation reconnects without an extra REST refresh or error state; unexpected failures use fallback and backoff.
- Old stream callbacks and delayed REST/action responses cannot affect a new match or session.
- Completed, unauthorized, and not-found results stop both transports.
- Query-budget rotation occurs before the limit, including frequent revisions, snapshot retry paths, timeout resolution, and configured push delivery.
- Independent D1 bindings still observe committed revisions; session revocation is detected during an open stream.

Run browser smoke checks with two disposable profiles: invitation acceptance, a turn visible to both, hide/resume, offline/online, timeout while one player is hidden, reload during a question, resignation, and a dropped answer response followed by retry. Exercise rapid hide/show and multiple rotations. Verify background notification delivery on an installed mobile PWA with configured push credentials; report device/provider checks that cannot be performed.

Required checks: `bun test`, `bun run build:client`, `bun run --cwd server build`, and `bun run --cwd server typecheck:worker`. Apply the existing migration chain to disposable local D1 state and run a Wrangler deployment dry run. Add a Workers-runtime stream test; do not use production migrations for verification.

## 5. Measure resource use and document results

Measure 2, 4, 6, and 8 connected clients in disposable tests with three workloads: visible idle matches, active gameplay, and mostly hidden clients that resume periodically. Record Worker requests, D1 rows read/written, stream rotations, concurrent streams, update latency, and CPU/resource errors. Use aggregate metrics without tokens or sensitive subscription data.

The current polling baseline is `visible player-seconds` D1 rows read, before other queries. For eight players visible for 24 hours, that is 691,200 rows; for eight players visible for one hour each, it is 28,800. Rotation and snapshot overhead must be measured separately. Hidden time should contribute no client-driven match/dashboard reads, while server notification work continues.

Update README and `docs/mobile-pwa-plan.md` with visibility behavior, notification setup, measured Free-tier limits, and the distinction between baseline and total usage. Do not promise a zero-cost capacity solely from row-read arithmetic.

## Delivery order and acceptance

1. Add lifecycle regression coverage and implement foreground-only client synchronization.
2. Implement query-accounted SSE rotation and its client control event; verify in the Workers runtime.
3. Complete dashboard/notification smoke checks and resource measurements.
4. Update documentation and prepare the verified change for deployment review.

Accept when hidden clients stop background network activity, resume recovers current state without duplicate streams, visible opponents receive updates within the existing approximately one-second polling cadence under healthy conditions, stream rotation remains within measured Free runtime limits, and gameplay/authentication regressions pass. No production deployment is part of writing this plan.
