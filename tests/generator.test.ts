import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../src/generator/generate';
import { campaignRequest, parseCode, puzzleCode, random } from '../src/generator/seed';
import { initialState, cleared, cellKey, type Difficulty } from '../src/core/model';
import { transition } from '../src/core/transition';
test('seed protocol, dates and random stream', () => {
  const a = random('fixed'),
    b = random('fixed');
  for (let i = 0; i < 30; i++) assert.equal(a(), b());
  for (const difficulty of ['easy', 'normal', 'hard', 'expert', 'extreme'] as Difficulty[]) {
    const r = { mode: 'infinite' as const, key: 'TEST', difficulty };
    assert.deepEqual(parseCode(puzzleCode(r)), r);
  }
  for (const code of ['PC9-I-E-A', 'PC1-C-E-0', 'PC1-D-N-2026-02-31', '<script>'])
    assert.throws(() => parseCode(code));
});
test('campaign unlocks and all profiles produce valid solved boards', () => {
  for (const stage of [1, 20, 21, 51, 91, 141, 211, 301, 451, 651, 901, 10000, 100000]) {
    const p = generate(campaignRequest(stage));
    assert.ok(p.solution.par);
    let s = initialState(p.board);
    const all = [...p.board.cores, ...p.board.tiles, ...p.board.voids].map(cellKey);
    assert.equal(new Set(all).size, all.length);
    for (const id of p.solution.moves) {
      const t = transition(p.board, s, id);
      assert.equal(t.overflow, false);
      s = t.state;
    }
    assert.ok(cleared(s));
    if (stage <= 20) assert.ok(p.board.cores.every((c) => c.hp === 1));
    if (stage < 91) assert.ok(p.board.tiles.every((t) => t.kind === 'block'));
  }
});
test('generation repeats exactly, and canonical campaign profile cannot change a stage', () => {
  const r = campaignRequest(147);
  assert.deepEqual(generate(r), generate(r));
  assert.deepEqual(generate(r), generate({ ...r, difficulty: 'easy' }));
});
