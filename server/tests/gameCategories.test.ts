import { expect, test } from 'bun:test';
import { createBunDatabase, createD1Database, SCHEMA_SQL } from '../src/db/database';
import { asD1 } from './helpers/d1';
import { register } from '../src/services/authService';
import { createGame, getGameStateSync, chooseCrown, spinWheel } from '../src/services/gameEngine';
import { sendInvitation, respondToInvitation, listInvitations } from '../src/services/invitationService';
import { CATEGORIES } from '../../shared/src/index';
import app from '../src/index';

test('accepted matches persist six random categories across independent bindings and pool changes', async () => {
  const db = await createBunDatabase(':memory:'); await db.exec(SCHEMA_SQL);
  const a = await register(db, { username: 'Category A' });
  const b = await register(db, { username: 'Category B' });
  await sendInvitation(db, a.account.id, b.account.id);
  const [invitation] = await listInvitations(db, b.account.id);
  const savedRandom = Math.random;
  try {
    Math.random = () => 0;
    const accepted = await respondToInvitation(db, invitation.id, b.account.id, 'accept');
    const state = (await getGameStateSync(db, accepted.gameId!))!;
    const categories = state.activeCategories!;
    expect(categories.length).toBe(6); expect(new Set(categories).size).toBe(6);
    expect(categories).not.toContain('CUSTOM'); expect(categories).toContain('MEMES');
    expect(categories.every(category => Object.hasOwn(CATEGORIES, category))).toBe(true);
    const outsider = (Object.keys(CATEGORIES) as Array<keyof typeof CATEGORIES>).find(category => !categories.includes(category))!;
    await db.execute("UPDATE games SET active_mode = 'CROWN_CHOICE' WHERE id = ?", [state.id]);
    await expect(chooseCrown(db, state.id, a.account.id, 'claim', outsider)).rejects.toThrow('Invalid crown choice');
    await db.execute("UPDATE games SET active_mode = 'SPIN' WHERE id = ?", [state.id]);
    await app.request('/api/questions/custom', { method: 'POST', headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ question: 'Community pool?', correctAnswer: 'Yes', incorrectAnswers: ['No', 'Maybe', 'Never'] }) }, { DB: asD1(db) });
    const independent = createD1Database(asD1(db));
    expect((await getGameStateSync(independent, state.id))?.activeCategories).toEqual(categories);
    const spin = await spinWheel(independent, state.id, a.account.id);
    expect(spin.sliceIndex).toBe(0); expect(spin.slice).toBe(categories[0]);
    expect((await getGameStateSync(db, state.id))?.activeCategories).toEqual(categories);
    const next = await createGame(db, a.account.id, b.account.id);
    expect((await getGameStateSync(db, next.gameId))?.activeCategories).toContain('CUSTOM');
  } finally { Math.random = savedRandom; }
});
