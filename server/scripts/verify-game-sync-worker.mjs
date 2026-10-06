import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const simulator = new Miniflare(convertV4MiniflareOptions({
  host: '127.0.0.1', modules: true, script: await readFile(process.argv[2], 'utf8'),
  compatibilityDate: '2026-10-03', compatibilityFlags: ['nodejs_compat'],
  d1Databases: { DB: 'sync-verification' }
}));
try {
  const db = await simulator.getD1Database('DB');
  const schema = await readFile(new URL('../src/db/migrations/0001_initial_schema.sql', import.meta.url), 'utf8');
  // D1 exec accepts one line per statement, including complete trigger bodies.
  const triggers = [];
  const ordinary = schema.replace(/--[^\n]*/g, '').replace(/CREATE TRIGGER[\s\S]*?END;/g, sql => { triggers.push(sql); return ''; });
  for (const sql of [...ordinary.split(';').filter(sql => sql.trim()), ...triggers]) await db.prepare(sql.trim()).run();
  const now = Date.now();
  for (let i = 0; i < 8; i++) {
    await db.prepare('INSERT INTO users VALUES (?, ?, ?)').bind(`p${i}`, `Player${i}`, now).run();
    await db.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?)').bind(`p${i}`, `${i}@local`, `${i}@local`, `player${i}`, '').run();
    await db.prepare('INSERT INTO auth_sessions VALUES (?, ?, ?, ?)').bind(createHash('sha256').update(`disposable-${i}`).digest('base64url'), `p${i}`, now + 3600000, now).run();
  }
  for (let i = 0; i < 4; i++) await db.prepare("INSERT INTO games(id, invite_code, player1_id, player2_id, status, current_turn_player_id, created_at, updated_at) VALUES (?, ?, ?, ?, 'IN_PROGRESS', ?, ?, ?)").bind(`match${i}`, `unused${i}`, `p${i * 2}`, `p${i * 2 + 1}`, `p${i * 2}`, now, now).run();
  const request = (path, i = 0) => simulator.dispatchFetch(`http://localhost/api/games/match${Math.floor(i / 2)}${path}`, { headers: { Authorization: `Bearer disposable-${i}` } });
  for (const workload of ['visible-idle', 'active-revisions']) for (const count of [2, 4, 6, 8]) {
    // Independent authorized players, paired into separate matches.
    const start = performance.now();
    const workloadStartedAt = Date.now();
    let changing = false;
    const updates = workload === 'active-revisions' ? setInterval(async () => {
      if (changing) return;
      changing = true;
      try { await db.prepare("UPDATE games SET revision = revision + 1, updated_at = ?").bind(Date.now()).run(); }
      finally { changing = false; }
    }, 900) : undefined;
    const results = await Promise.all(Array.from({ length: count }, async (_, i) => {
      const response = await request('/events', i);
      assert.equal(response.status, 200);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let text = '', pending = '', maxUpdateLatencyMs = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        const decoded = decoder.decode(chunk.value, { stream: true });
        text += decoded; pending += decoded;
        let end;
        while ((end = pending.indexOf('\n\n')) >= 0) {
          const frame = pending.slice(0, end); pending = pending.slice(end + 2);
          if (workload === 'active-revisions' && frame.startsWith('event: sync')) {
            const state = JSON.parse(frame.match(/data: (.*)/)[1]);
            if (state.updatedAt >= workloadStartedAt) maxUpdateLatencyMs = Math.max(maxUpdateLatencyMs, Date.now() - state.updatedAt);
          }
        }
      }
      reader.releaseLock();
      assert.match(text, /event: sync/); assert.match(text, /event: reconnect/);
      assert.match(text, /"refresh":false/);
      const metrics = JSON.parse(text.match(/event: test-metrics\ndata: (.*)/)[1]);
      assert.ok(metrics.queries <= 45); assert.equal(metrics.rowsWritten, 0);
      assert.ok(maxUpdateLatencyMs < 2500);
      return { ...metrics, maxUpdateLatencyMs };
    }));
    clearInterval(updates);
    while (changing) await new Promise(resolve => setTimeout(resolve, 10));
    console.log(JSON.stringify({ workload, clients: count, streams: results.length, rotations: results.length, elapsedMs: Math.round(performance.now() - start), queries: results.reduce((sum, m) => sum + m.queries, 0), rowsRead: results.reduce((sum, m) => sum + m.rowsRead, 0), rowsWritten: results.reduce((sum, m) => sum + m.rowsWritten, 0), maxUpdateLatencyMs: Math.max(...results.map(m => m.maxUpdateLatencyMs)) }));
  }
  const expired = { questionData: { id: 'deadline', category: 'ART', question: 'Q?', correctAnswer: 'Yes', incorrectAnswers: ['No', 'Maybe', 'Never'] }, shuffledOptions: ['Yes', 'No', 'Maybe', 'Never'], correctIndex: 0, startedAt: now - 60000, durationMs: 20000, isCrown: false };
  await db.prepare("UPDATE games SET active_mode = 'QUESTION', active_question_json = ? WHERE id = 'match0'").bind(JSON.stringify(expired)).run();
  assert.match(await (await request('/events')).text(), /"refresh":true/);
  const state = await (await request('')).json();
  assert.equal(state.mode, 'SPIN'); assert.equal(state.currentTurnPlayerId, 'p1');
  // A new invocation retrieves the resolved revision and completed streams close.
  await db.prepare("UPDATE games SET status = 'COMPLETED', revision = revision + 1 WHERE id = 'match0'").run();
  const completed = await (await request('/events')).text();
  assert.match(completed, /COMPLETED/); assert.doesNotMatch(completed, /event: reconnect/);
  console.log('Workers SSE: rotation, expired-deadline REST resolution and completed closure passed. CPU billing is unavailable in local workerd.');
} finally { await simulator.dispose(); }
