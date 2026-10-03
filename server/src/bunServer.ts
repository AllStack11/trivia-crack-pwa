import app from './index';
import { getDatabase } from './db/database';
import { drainPushOutbox, pushConfigured } from './services/pushService';

const port = Number(process.env.PORT || 3001);

console.log(`Trivia Clash server running on http://localhost:${port}`);

const pushEnv = {
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  VAPID_SUBJECT: process.env.VAPID_SUBJECT
};
let delivering = false;
if (pushConfigured(pushEnv)) setInterval(async () => {
  if (delivering) return;
  delivering = true;
  try { await drainPushOutbox(await getDatabase(), pushEnv); }
  catch { console.warn('Push delivery deferred'); }
  finally { delivering = false; }
}, 5000);

export default {
  port,
  fetch: (request: Request) => app.fetch(request, pushEnv)
};
