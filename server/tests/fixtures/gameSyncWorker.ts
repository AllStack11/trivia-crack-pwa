import app from '../../src/index';

/** Test-only request metrics from real D1 metadata, appended after stream closure. */
export default {
  async fetch(request: Request, env: { DB: D1Database }, ctx: ExecutionContext) {
    const metrics = { queries: 0, rowsRead: 0, rowsWritten: 0 };
    const originals = new WeakMap<object, D1PreparedStatement>();
    const track = <T>(result: D1Result<T>) => {
      metrics.rowsRead += result.meta.rows_read;
      metrics.rowsWritten += result.meta.rows_written;
      return result;
    };
    const wrap = (statement: D1PreparedStatement): any => {
      const wrapped = {
      bind: (...values: unknown[]) => wrap(statement.bind(...values)),
      all: async () => { metrics.queries++; return track(await statement.all()); },
      first: async () => { metrics.queries++; return track(await statement.all()).results[0] ?? null; },
      run: async () => { metrics.queries++; return track(await statement.run()); }
      };
      originals.set(wrapped, statement);
      return wrapped;
    };
    const db = {
      prepare: (sql: string) => wrap(env.DB.prepare(sql)),
      batch: async (statements: object[]) => {
        metrics.queries += statements.length;
        return (await env.DB.batch(statements.map(statement => originals.get(statement)!))).map(track);
      }
    };
    const response = await app.fetch(request, { DB: db as any }, ctx);
    if (!request.url.endsWith('/events') || !response.ok || !response.body) return response;
    const reader = response.body.getReader();
    return new Response(new ReadableStream({
      async pull(controller) {
        const item = await reader.read();
        if (!item.done) controller.enqueue(item.value);
        else {
          controller.enqueue(new TextEncoder().encode(`event: test-metrics\ndata: ${JSON.stringify(metrics)}\n\n`));
          reader.releaseLock(); controller.close();
        }
      },
      async cancel() { await reader.cancel(); reader.releaseLock(); }
    }), { headers: response.headers, status: response.status });
  }
};
