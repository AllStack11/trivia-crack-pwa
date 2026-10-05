import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('actual Workers runtime sends encrypted push to every provider and never follows redirects', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'trivia-push-worker-'));
  try {
    const result = await Bun.build({ entrypoints: [fileURLToPath(new URL('./fixtures/pushWorker.ts', import.meta.url))], target: 'browser', format: 'esm' });
    expect(result.success).toBe(true);
    const output = join(directory, 'worker.mjs');
    await Bun.write(output, result.outputs[0]);
    const child = Bun.spawn(['node', fileURLToPath(new URL('../scripts/verify-push-worker.mjs', import.meta.url)), output], { stdout: 'pipe', stderr: 'pipe' });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
    expect(stdout).toContain('four providers accepted; redirects are not followed');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);
