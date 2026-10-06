import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('Workers D1 streams rotate and resume expired games in real workerd', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'trivia-sync-worker-'));
  try {
    const result = await Bun.build({ entrypoints: [fileURLToPath(new URL('./fixtures/gameSyncWorker.ts', import.meta.url))], target: 'browser', format: 'esm' });
    expect(result.success).toBe(true);
    const output = join(directory, 'worker.mjs'); await Bun.write(output, result.outputs[0]);
    const child = Bun.spawn(['node', fileURLToPath(new URL('../scripts/verify-game-sync-worker.mjs', import.meta.url)), output], { stdout: 'pipe', stderr: 'pipe' });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
    expect(stdout).toContain('completed closure passed');
    console.log(stdout);
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 150000);
