import { expect, test, describe, beforeEach } from 'bun:test';
import type { AppDatabase } from '../src/db/database';
import { createBunDatabase, SCHEMA_SQL } from '../src/db/database';
import {
  ensureDefaultPackSeeded,
  listPacks,
  getPack,
  createPack,
  deletePack,
  exportPack,
  importPack,
  getRandomQuestion
} from '../src/services/packService';
import { decodeHtmlEntities } from '../src/services/openTdbService';


describe('Pack Service & OpenTDB Integration', () => {
  let db: AppDatabase;

  beforeEach(async () => {
    db = await createBunDatabase(':memory:');
    await db.exec(SCHEMA_SQL);
  });

  test('Seeding initializes 180 curated questions across 6 categories', async () => {
    await ensureDefaultPackSeeded(db);

    const packs = await listPacks(db);
    expect(packs.length).toBe(1);
    expect(packs[0].isDefault).toBe(true);
    expect(packs[0].questionCount).toBe(180);

    const pack = await getPack(db, 'default');
    expect(pack).not.toBeNull();
    expect(pack?.questions.length).toBe(180);

    // Verify all 6 categories are populated with at least 30 questions
    const categories = ['ART', 'SCIENCE', 'SPORTS', 'ENTERTAINMENT', 'GEOGRAPHY', 'HISTORY'] as const;
    for (const cat of categories) {
      const matching = pack?.questions.filter((q) => q.category === cat) || [];
      expect(matching.length).toBeGreaterThanOrEqual(30);
    }
  });

  test('Custom question pack creation, export, and import', async () => {
    await ensureDefaultPackSeeded(db);

    const packId = await createPack(
      db,
      'Office Friends Trivia',
      'Trivia about our workplace',
      'Tester',
      [
        {
          category: 'GEOGRAPHY',
          question: 'Where is our headquarters located?',
          imageUrl: 'https://flagcdn.com/w320/us.png',
          correctAnswer: 'San Francisco',
          incorrectAnswers: ['New York', 'Austin', 'Seattle'],
          difficulty: 'medium'
        },
        {
          category: 'ENTERTAINMENT',
          question: 'What is the favorite lunch movie?',
          correctAnswer: 'The Matrix',
          incorrectAnswers: ['Inception', 'Pulp Fiction', 'Shrek'],
          difficulty: 'easy'
        }
      ]
    );

    expect(packId.startsWith('pack_')).toBe(true);

    const retrieved = await getPack(db, packId);
    expect(retrieved?.meta.title).toBe('Office Friends Trivia');
    const geoQ = retrieved?.questions.find((q) => q.category === 'GEOGRAPHY');
    expect(geoQ?.imageUrl).toBe('https://flagcdn.com/w320/us.png');

    // Export pack
    const exported = await exportPack(db, packId);
    expect(exported?.title).toBe('Office Friends Trivia');
    expect(exported?.questions.length).toBe(2);

    // Import as new pack
    const importedId = await importPack(db, exported!, 'Importer');
    const importedPack = await getPack(db, importedId);
    expect(importedPack?.meta.title).toBe('Office Friends Trivia');
    expect(importedPack?.questions.length).toBe(2);

    // Delete custom pack
    const deleted = await deletePack(db, packId);
    expect(deleted).toBe(true);

    const checkDeleted = await getPack(db, packId);
    expect(checkDeleted).toBeNull();

    // Default pack cannot be deleted
    const cannotDeleteDefault = await deletePack(db, 'default');
    expect(cannotDeleteDefault).toBe(false);
  });

  test('HTML entity decoding handles complex nested encodings', () => {
    expect(decodeHtmlEntities('&quot;Hello &amp; World&quot;')).toBe('"Hello & World"');
    expect(decodeHtmlEntities('It&#039;s a beautiful day')).toBe("It's a beautiful day");
    expect(decodeHtmlEntities('Beyonc&eacute; and Pok&eacute;mon')).toBe('Beyoncé and Pokémon');
    expect(decodeHtmlEntities('&#38;&#34;&#39;')).toBe('&"\'');
  });

  test('getRandomQuestion selects questions and respects exclusions', async () => {
    await ensureDefaultPackSeeded(db);

    const q1 = await getRandomQuestion(db, ['default'], 'SCIENCE');
    expect(q1.category).toBe('SCIENCE');
    expect(q1.correctAnswer).toBeDefined();
    expect(q1.incorrectAnswers.length).toBe(3);

    // Exclude q1 and request next question
    const q2 = await getRandomQuestion(db, ['default'], 'SCIENCE', [q1.id]);
    expect(q2.id).not.toBe(q1.id);
  });

  test('answered text is excluded even when another pack has a different ID', async () => {
    await ensureDefaultPackSeeded(db);
    const original = await getRandomQuestion(db, ['default'], 'SCIENCE');
    const packId = await createPack(db, 'Copies', '', 'Tester', [
      { ...original, question: `  ${original.question.toUpperCase()}  ` },
      { ...original, question: 'A completely new science question?' }
    ]);
    const picked = await getRandomQuestion(db, [packId], 'SCIENCE', [original.id]);
    expect(picked.question).toBe('A completely new science question?');
  });

  test('import rejects questions with categories outside the game wheel', async () => {
    await expect(importPack(db, {
      title: 'Unsupported category pack',
      questions: [{
        category: 'UNSUPPORTED' as never,
        question: 'A question with an unknown category?',
        correctAnswer: 'Yes',
        incorrectAnswers: ['No']
      }]
    })).rejects.toThrow('No valid questions found');
    const persisted = await db.queryFirst<{ count: number }>(
      'SELECT COUNT(*) as count FROM question_packs WHERE title = ?',
      ['Unsupported category pack']
    );
    expect(persisted?.count ?? 0).toBe(0);
  });
});
