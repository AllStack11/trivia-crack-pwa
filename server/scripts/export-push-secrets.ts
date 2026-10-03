const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) throw new Error('Load .dev.vars using bun --env-file=.dev.vars before exporting.');
if (VAPID_SUBJECT.includes('example.com')) throw new Error('Replace the local example contact with your real HTTPS site or mailto contact before exporting production secrets.');
await Bun.write(new URL('../push-secrets.json', import.meta.url), JSON.stringify({ VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT }, null, 2));
console.log('Saved server/push-secrets.json (gitignored) for wrangler secret bulk. No keys were printed.');
