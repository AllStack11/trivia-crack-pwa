import app from './index';
import { getDatabase } from './db/database';
import { drainPushOutbox, type PushEnvironment } from './services/pushService';

export default {
  fetch: app.fetch,
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(getDatabase(env).then(db => drainPushOutbox(db, env)));
  }
} satisfies ExportedHandler<Env & PushEnvironment>;
