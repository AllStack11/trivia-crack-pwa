import { sendWebPush } from '../../src/services/pushService';

const b64 = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

export default {
  async fetch() {
    const client = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const signing = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const jwk = await crypto.subtle.exportKey('jwk', signing.privateKey);
    const env = {
      VAPID_PUBLIC_KEY: b64(new Uint8Array(await crypto.subtle.exportKey('raw', signing.publicKey))),
      VAPID_PRIVATE_KEY: jwk.d!, VAPID_SUBJECT: 'mailto:test@example.com'
    };
    const keys = { p256dh: b64(new Uint8Array(await crypto.subtle.exportKey('raw', client.publicKey))), auth: b64(crypto.getRandomValues(new Uint8Array(16))) };
    const results: number[] = [];
    for (const host of ['web.push.apple.com', 'fcm.googleapis.com', 'updates.push.services.mozilla.com', 'wns2.notify.windows.com']) {
      const endpoint = `https://${host}/test`;
      results.push(await sendWebPush(endpoint, { accountId: 'test', title: 'Test', body: 'Test', url: '/', tag: 'test', badgeCount: 0 }, { endpoint, keys }, env, 60, 'test'));
    }
    // A redirected endpoint must never forward the VAPID header to its destination.
    const endpoint = 'https://web.push.apple.com/redirect';
    results.push(await sendWebPush(endpoint, { accountId: 'test', title: 'Test', body: 'Test', url: '/', tag: 'test', badgeCount: 0 }, { endpoint, keys }, env, 60, 'test'));
    return Response.json(results);
  }
};
