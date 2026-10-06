# Foreground sync verification

## Implementation

- A request-owning client lifecycle deduplicates refreshes, pauses hidden/offline streams and timers, cancels SSE readers, and rejects obsolete continuations. Resume refreshes first; normal rotation avoids an extra REST read. Terminal responses and completed matches stop synchronization. User-submitted mutations are not aborted by visibility changes.
- Dashboard refreshes obey visibility and connectivity, coalesce overlapping reads, and cancel obsolete requests.
- Each SSE invocation uses a request-local 45-statement ceiling. Initial authentication/membership plus one snapshot use ten statements for a two-player match. A coherent snapshot uses at most eight statements and one attempt; conflicts rotate to REST. Each loop reserves twelve statements for authentication (including expired-session deletion), membership, polling, and the whole snapshot. Mutation batches are never split.
- Deadline resolution retains the existing engine on REST reads. Expired SSE snapshots request a fresh authenticated REST read. Normal rotation has a provisional 20-second ceiling. SSE responses explicitly use `no-store`, overriding Hono's default `no-cache`.
- GET/SSE requests do not drain push outboxes. Mutations and the existing minute cron deliver alerts. A timeout-generated alert from a REST read can wait until the scheduled drain.

## Automated checks

Final verification on 2026-10-06:

- `bun test`: 124 passed, 0 failed across 21 files (including real local workerd/D1).
- Final foreground lifecycle rerun: 9 passed, 0 failed.
- `bun run build:client`, `bun run --cwd server build`, and `bun run --cwd server typecheck:worker`: passed. Vite retains its existing bundle-size advisory.
- Wrangler applied all 35 commands of the fresh migration to disposable local D1 state; no production database was touched.
- Final `wrangler deploy --dry-run`: passed, with the intended D1 binding. The sandbox initially prevented Wrangler from resolving parent directories; the local-only dry run succeeded outside that filesystem sandbox.
- `git diff --check`: passed.

The client lifecycle tests cover hidden initial loads, pause beyond the fallback interval, rapid repeated resume, planned and expiry rotation, transient refresh failure, error backoff, terminal HTTP/events, pending-read cancellation, and late stream responses. Existing tests retain snapshot ordering, persisted timers, fragmented events, failed-handler reader cleanup, and gameplay integrity coverage.

Server regressions cover whole-batch budget rejection, actual snapshot cost, frequent committed revisions, push isolation, snapshot conflicts, and session revocation during an open stream. Workers integration uses Node-hosted Miniflare/workerd with real local D1 and the fresh migration schema. Test-only instrumentation counts statements and D1 `rows_read`/`rows_written`; it is not included in the deployed Worker.

Resource runs use 2, 4, 6, and 8 distinct profiles paired into matches. Idle runs finish by the lifetime ceiling. Active runs update committed revisions every 900 ms to stress snapshot budgets; these are synthetic database updates, not a measurement of complete gameplay-action costs. Each client opens one stream and receives one rotation. Hidden lifecycle tests produce no match requests until resume. Dashboard, notifications, question history, and gameplay writes are excluded from these stream measurements.

Measured local D1 totals for one stream per player:

| Players | Idle statements / rows read | Active statements / rows read | SSE rows written |
| --- | --- | --- | --- |
| 2 | 62 / 62 | 74 / 46 | 0 |
| 4 | 124 / 124 | 148 / 92 | 0 |
| 6 | 186 / 186 | 222 / 138 | 0 |
| 8 | 248 / 248 | 296 / 184 | 0 |

Idle streams lasted about 20–21 seconds; active streams rotated after about 4–5.5 seconds. Each idle request issued 31 statements; each active request issued 37. The active write stimulus is separate from the SSE write count. Sparse, newly created matches make these row counts lower than matches with substantial answer history. These small local samples are not production capacity or cost guarantees.

The measured maximum revision-delivery latency in the active samples was 385 ms (2 players), 498 ms (4), 640 ms (6), and 732 ms (8). Updates every 900 ms aligned with the one-second polling loop; these maxima describe the sampled run rather than a latency guarantee.

At a nominal 20-second idle rotation, eight continuously visible players would open roughly 34,560 streams/day and read about 1,071,360 rows/day from streams alone, including rotation overhead (about 21.4% of the 5-million daily Free row-read allowance). This is a projection from the sparse fixture, excluding dashboard, actions, REST recovery and push. Hidden time contributes no match stream requests; actual intermittent usage should be measured by visible time and match history.

## Audit fixes

- Preserve `no-store` after Hono creates the SSE response.
- Stop an open lifecycle immediately when an action or REST refresh applies a completed match.
- Ignore obsolete action failures before refreshing a newly navigated match.
- Preserve the existing notification component's hide-when-enabled behavior while removing unreachable controls that failed TypeScript checking.
- Full-suite failures exposed pack-copy ID collisions and incorrect insertion counts. Expansion now scopes provider IDs to the target pack and reports actual inserted rows; its fixture supplies a novel cached question rather than depending on internet availability.

## Remaining checks

No browser was connected to the available browser tool. Actual React UI smoke flows (two profiles, invitations, hide/resume, offline/online, reload, timeout, resignation, and dropped-answer retry) could not be performed. Pure lifecycle tests do not replace those checks.

No installed mobile device with configured push credentials was available. Background delivery and notification-tap navigation remain unverified on iPhone/Android.

Local workerd verifies execution and D1 behavior, but does not expose production billed CPU or enforce a representative Free-tier CPU budget. The 20-second ceiling must be checked using deployed Worker observability before claiming Free-tier compatibility; shorten it if CPU headroom is insufficient. No production deployment or migration was performed.
