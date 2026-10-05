import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

// Native Node runs the workerd host; Bun's undici compatibility cannot reliably dispatch it.
const script = await readFile(process.argv[2], 'utf8');
let requests = 0;
const simulator = new Miniflare(convertV4MiniflareOptions({
  host: '127.0.0.1', modules: true, script,
  compatibilityDate: '2026-10-03', compatibilityFlags: ['nodejs_compat'],
  outboundService: async request => {
    requests++;
    const url = new URL(request.url);
    assert.notEqual(url.hostname, 'redirect.invalid');
    assert.equal(request.method, 'POST');
    assert.equal(request.headers.get('content-encoding'), 'aes128gcm');
    assert.equal(request.headers.get('urgency'), 'high');
    assert.equal((await request.arrayBuffer()).byteLength, 4096);
    return url.pathname === '/redirect'
      ? new Response(null, { status: 302, headers: { Location: 'https://redirect.invalid/' } })
      : new Response(null, { status: 201 });
  }
}));
try {
  const response = await simulator.dispatchFetch('http://localhost/');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [201, 201, 201, 201, 302]);
  assert.equal(requests, 5);
  console.log('Workers push transport: four providers accepted; redirects are not followed.');
} finally {
  await simulator.dispose();
}
