// Generates local VAPID keys without printing secrets or passing them as shell arguments.
const subject = process.argv[2];
if (!subject || !/^(mailto:|https:\/\/)/.test(subject) || /[\r\n"]/.test(subject)) {
  throw new Error('Usage: bun run scripts/create-push-keys.ts <mailto:contact@example.com or https://your-site>');
}
const output = new URL('../.dev.vars', import.meta.url);
if (await Bun.file(output).exists()) throw new Error('.dev.vars already exists; keep existing keys or move it before generating new keys.');
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
const publicKey = btoa(String.fromCharCode(...raw)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
await Bun.write(output, `VAPID_PUBLIC_KEY="${publicKey}"\nVAPID_PRIVATE_KEY="${privateJwk.d}"\nVAPID_SUBJECT="${subject}"\n`);
console.log('VAPID configuration saved to server/.dev.vars (gitignored). No keys were printed.');
