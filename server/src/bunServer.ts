import app from './index';

const port = Number(process.env.PORT || 3001);

console.log(`Trivia Clash server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch
};
