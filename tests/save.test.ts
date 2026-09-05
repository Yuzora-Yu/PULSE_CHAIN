import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../src/storage/save';
test('missing/corrupt/unknown saves recover safely; valid v1 records migrate', () => {
  for (const raw of [null, {}, 'garbage', { version: 99 }]) assert.equal(migrate(raw).stage, 1);
  const s = migrate({
    version: 1,
    stage: Infinity,
    best: { 'PC1-C-E-1': 1, bad: 7, 'PC1-I-N-TEST': -1 },
    settings: { sound: true, volume: 8 },
    session: { code: 'PC1-C-E-1', moves: [0] },
    favorites: ['PC1-C-E-1'],
  });
  assert.equal(s.stage, 1);
  assert.equal(s.settings.volume, 1);
  assert.equal(s.settings.sound, true);
  assert.deepEqual(s.best, { 'PC1-C-E-1': 1 });
  assert.deepEqual(s.session?.moves, [0]);
  assert.equal(s.favorites.length, 1);
});
