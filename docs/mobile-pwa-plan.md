# Mobile PWA implementation and setup

## Implemented

- Custom crown PNG install icons, a maskable Android entry, Apple touch icon, and favicon. Installation guidance displays the icon and accurately describes connectivity requirements.
- Signed-in Play tab notification controls: enable, test, off, denied-permission guidance, unsupported-browser guidance, iPhone installation guidance, and an unavailable state when the server is unconfigured.
- Standard Web Push with `@block65/webcrypto-web-push` 2.x, Web Crypto, RFC8291 `aes128gcm` encryption, and VAPID signing. Permission is requested directly from a tap.
- Bearer-authenticated `/api/push/config`, `/api/push/subscription` (GET/POST/DELETE), and `/api/push/test` (POST). Ownership comes from the validated session; body identity fields are ignored. Each account supports up to ten devices. Browser push endpoints are validated; endpoints, encryption keys, and sender errors containing credentials are never logged.
- Transactional D1/SQLite triggers enqueue new invitations, accepted invitations, turn transitions, and completed matches without changing game rules. Request `waitUntil` attempts immediate delivery; a minute cron recovers missed work. Bun checks every five seconds when configured.
- Per-device deduplication, delivery leases, at most twenty deliveries per drain and four concurrent requests, five attempts with backoff, 404/410 endpoint cleanup, stale-event filtering, and turn-alert collapse. Test taps deduplicate per device per minute. Delivery failure cannot roll back gameplay. A crash after acceptance by a push service can cause a retry; tags collapse visible duplicates.
- Session foreign keys detach subscriptions and queued rows on sign-out/expiration. The client unsubscribes on sign-out/profile switching and reconciles on restoration/resume. Only an account ID is stored in worker IndexedDB; session tokens remain in the existing client account storage and bearer headers. In-flight alerts for a former profile become generic and cannot open that profile's match.
- Visible notifications with generic lock-screen copy, safe same-origin match links, and invitation/turn badge counts. Notification taps restore the app through normal authentication and membership checks.
- Network-first navigation, cached shell fallback for offline deep links, hashed entry-asset caching, and an explicit lobby update prompt. One previous cache remains for older open tabs. APIs/SSE are never cached. Multiplayer still requires connectivity.
- Resume/online refresh, stale dashboard-response guards, clear offline/reconnecting copy, saved sign-in during temporary restoration failures, and an eight-second game-action timeout that releases failed answers for retry. Persisted deadlines and revisions remain authoritative.
- Text zoom enabled and desktop-user-agent iPad detection improved. Safe-area/reduced-motion behavior remains. Play/Friends shortcuts remain deferred until their routes reliably restore those screens.

## Local configuration

From the repository root:

```powershell
bun run server/scripts/create-push-keys.ts mailto:you@your-domain.com
```

The generator creates gitignored `server/.dev.vars`, refuses to overwrite it, and never prints keys. Local keys were generated during implementation with the development-only subject `https://example.com`; replace that contact before production export. Keep the key pair stable. Rotation requires devices to subscribe again; the client detects a changed public key and offers re-enablement.

Start the Bun API with these keys:

```powershell
bun --env-file=server/.dev.vars run dev:server
```

For local Workers testing, run `bun run wrangler dev --test-scheduled` from `server`; Wrangler reads `.dev.vars` automatically. Apply the fresh baseline to disposable local D1 state first.

## Production setup (not deployed)

1. Create a fresh D1 database and update `server/wrangler.toml`. The updated baseline includes push tables/triggers; an already-applied `0001` is not rerun on an existing database. Fresh setup is the supported deployment target.
2. Set a real HTTPS contact URL or mailto address in `server/.dev.vars`. From `server`, export and upload secrets without placing their values in shell arguments:

```powershell
bun --env-file=.dev.vars run scripts/export-push-secrets.ts
bun run wrangler secret bulk push-secrets.json
```

The three secrets are `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`. Never commit `.dev.vars` or `push-secrets.json`. The authenticated config endpoint exposes only the public key. Unconfigured notifications display as unavailable while gameplay remains functional.

3. Apply the fresh migration and deploy using the README workflow. The Worker entrypoint is now `src/worker.ts`, with HTTP and scheduled handlers. Deploy the rebuilt client over HTTPS. Production migrations are not routine verification commands.
4. On iPhone/iPad 16.4 or later, add to the Home Screen, open the installed app, and enable alerts from Play. Android users can enable alerts in a supported browser or installed PWA. Browser/OS settings control delivery timing; notifications never decide deadlines.

## Verification

From the repository root:

```powershell
bun test
bun run build:client
bun run --cwd server build
bun run --cwd server typecheck:worker
```

From `server`, check fresh disposable D1 and packaging:

```powershell
bun run wrangler d1 migrations apply triviaclash-db-v2 --local --persist-to .local-push-verification
bun run wrangler deploy --dry-run
```

Final verification passed 103 tests, client/Bun builds, Worker typing, a fresh disposable D1 migration, and the deployment dry run. Automated tests cover ownership, devices, expiration, switching/logout, invalid endpoints/keys, atomic rollback, stale events, concurrent leases, retries, endpoint cleanup, ciphertext decryption, VAPID signature verification, caching, safe click routing, and visible fallback alerts.

Browser smoke checks used in-memory databases: two username-only profiles, invitation acceptance, both players observing timeout turn handoff, reload during a question, resignation, and a failed answer followed by a successful manual retry. The retry fixture used a longer persisted duration to accommodate browser automation; production question timing remains unchanged. The update prompt activated a waiting worker and restored the profile. The 390px phone layout was visually checked.

Still required after deployment: installed iPhone/Android lock-screen receipt with the app closed, test notification receipt, notification taps, OS-disabled/denied/revoked permissions, expired-login clicks, stale completed-match alerts, multi-device delivery, and real-phone large-text/keyboard checks. Desktop automation cannot operate the browser-level permission prompt, so real delivery has not been certified.

## References

- [WebKit: Home Screen Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [MDN: Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Web Crypto Web Push sender](https://github.com/block65/webcrypto-web-push)
- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
