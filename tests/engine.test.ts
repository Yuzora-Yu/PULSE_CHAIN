import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, cleared, stateHash, type Board, type Core, type Tile } from '../src/core/model';
import { transition } from '../src/core/transition';
import { solve } from '../src/solver/bfs';
import { solveDepth } from '../src/solver/depth';
const board = (cores: Core[], tiles: Tile[] = [], voids: { x: number; y: number }[] = []): Board => ({
  ruleVersion: 1,
  generatorVersion: 1,
  cols: 7,
  rows: 7,
  cores,
  tiles,
  voids,
  shape: 'test',
});
test('eight rays, immutable input, exact replay and optimal first moves', () => {
  const b = board([
    { x: 3, y: 3, hp: 1 },
    ...[
      [0, 0],
      [3, 0],
      [6, 0],
      [0, 3],
      [6, 3],
      [0, 6],
      [3, 6],
      [6, 6],
    ].map(([x, y]) => ({ x, y, hp: 1 })),
  ]);
  const s = initialState(b),
    snapshot = JSON.stringify(s),
    t = transition(b, s, 0);
  assert.equal(t.chain, 9);
  assert.ok(cleared(t.state));
  assert.equal(JSON.stringify(s), snapshot);
  assert.deepEqual(t, transition(b, s, 0));
  const solution = solve(b);
  assert.equal(solution.par, 1);
  assert.equal(solution.winningFirstMoves.length, 9);
  assert.equal(solution.solutionCount, 9);
});
test('armor absorbs hits, direct tap detonates any HP', () => {
  const b = board([
    { x: 1, y: 3, hp: 1 },
    { x: 3, y: 3, hp: 3 },
  ]);
  assert.deepEqual(transition(b, initialState(b), 0).state.hp, [0, 2]);
  assert.ok(cleared(transition(b, initialState(b), 1).state));
  assert.equal(solve(b).par, 1);
  assert.deepEqual(solve(b).winningFirstMoves, [1]);
});
test('simultaneous hits are aggregated before exploding; all hit pulses are consumed', () => {
  const b = board([
    { x: 3, y: 5, hp: 1 },
    { x: 1, y: 3, hp: 1 },
    { x: 5, y: 3, hp: 1 },
    { x: 3, y: 1, hp: 2 },
  ]);
  const t = transition(b, initialState(b), 0);
  const hits = t.events.filter((e) => e.type === 'hit' && e.id === 3);
  assert.ok(cleared(t.state));
  assert.equal(hits.length, 1);
  assert.equal((hits[0] as { hp: number }).hp, 0);
});
test('BLOCK and VOID stop a ray', () => {
  const cores = [
    { x: 1, y: 3, hp: 1 },
    { x: 5, y: 3, hp: 1 },
  ];
  for (const b of [board(cores, [{ x: 3, y: 3, kind: 'block' }]), board(cores, [], [{ x: 3, y: 3 }])]) {
    assert.deepEqual(transition(b, initialState(b), 0).state.hp, [0, 1]);
    assert.equal(solve(b).par, 2);
  }
});
test('both mirrors obey geometric reflection', () => {
  for (const slash of [true, false]) {
    const b = board(
      [
        { x: 0, y: 3, hp: 1 },
        { x: 4, y: slash ? 0 : 6, hp: 1 },
      ],
      [{ x: 4, y: 3, kind: 'mirror', slash }],
    );
    const t = transition(b, initialState(b), 0);
    assert.ok(cleared(t.state));
    assert.ok(t.events.some((e) => e.type === 'reflect'));
  }
});
test('splitter emits forward and both perpendicular rays', () => {
  const b = board(
    [
      { x: 0, y: 3, hp: 1 },
      { x: 4, y: 0, hp: 1 },
      { x: 6, y: 3, hp: 1 },
      { x: 4, y: 6, hp: 1 },
    ],
    [{ x: 4, y: 3, kind: 'splitter' }],
  );
  const t = transition(b, initialState(b), 0);
  assert.equal(t.chain, 4);
  assert.ok(t.events.some((e) => e.type === 'split'));
});
test('gates pass exactly the indicated travel vector', () => {
  const b = board(
    [
      { x: 1, y: 3, hp: 1 },
      { x: 5, y: 3, hp: 1 },
    ],
    [{ x: 3, y: 3, kind: 'gate', direction: 2 }],
  );
  assert.ok(cleared(transition(b, initialState(b), 0).state));
  assert.deepEqual(transition(b, initialState(b), 1).state.hp, [1, 0]);
});
test('charge accumulates across taps and emits only once', () => {
  const b = board(
    [
      { x: 0, y: 3, hp: 1 },
      { x: 3, y: 1, hp: 1 },
      { x: 6, y: 3, hp: 1 },
    ],
    [{ x: 3, y: 3, kind: 'charge', threshold: 2 }],
  );
  const first = transition(b, initialState(b), 0);
  assert.equal(first.state.devices[0], 1);
  const second = transition(b, first.state, 1);
  assert.equal(second.state.devices[0], 0);
  assert.ok(cleared(second.state));
});
test('rotator reflects from tick-start state and persists orientation', () => {
  const b = board(
    [
      { x: 0, y: 3, hp: 1 },
      { x: 4, y: 0, hp: 1 },
    ],
    [{ x: 4, y: 3, kind: 'rotator', slash: false }],
  );
  const first = transition(b, initialState(b), 0);
  assert.equal(first.state.hp[1], 1);
  assert.equal(first.state.devices[0], 1);
  assert.notEqual(stateHash(initialState(b)), stateHash({ ...initialState(b), devices: [1] }));
});
test('portal conserves direction and jumps without a board-crossing move', () => {
  const b = board(
    [
      { x: 0, y: 1, hp: 1 },
      { x: 6, y: 5, hp: 1 },
    ],
    [
      { x: 2, y: 1, kind: 'portal', pair: 0 },
      { x: 4, y: 5, kind: 'portal', pair: 0 },
    ],
  );
  const t = transition(b, initialState(b), 0);
  assert.ok(cleared(t.state));
  assert.ok(t.events.some((e) => e.type === 'teleport'));
  assert.ok(
    t.events
      .filter((e) => e.type === 'move')
      .every((e) => Math.abs(e.to.x - e.from.x) <= 1 && Math.abs(e.to.y - e.from.y) <= 1),
  );
});
test('mirror loops terminate and splitter amplification is bounded', () => {
  const b = board(
    [{ x: 1, y: 2, hp: 1 }],
    [
      { x: 1, y: 1, kind: 'mirror', slash: true },
      { x: 5, y: 1, kind: 'mirror', slash: false },
      { x: 5, y: 5, kind: 'mirror', slash: true },
      { x: 1, y: 5, kind: 'mirror', slash: false },
    ],
  );
  const t = transition(b, initialState(b), 0);
  assert.ok(t.ticks < 100);
  assert.equal(t.overflow, false);
  const dense = board(
    [{ x: 0, y: 0, hp: 1 }],
    Array.from({ length: 36 }, (_, i) => ({
      x: (i % 6) + 1,
      y: Math.floor(i / 6) + 1,
      kind: 'splitter' as const,
    })),
  );
  const r = transition(dense, initialState(dense), 0);
  assert.equal(r.overflow, true);
  assert.ok(r.pulseCount < 4096);
});
test('invalid taps fail clearly and incomplete search never invents par', () => {
  const b = board([
    { x: 0, y: 0, hp: 1 },
    { x: 6, y: 5, hp: 1 },
  ]);
  assert.throws(() => transition(b, initialState(b), 20));
  assert.throws(() => transition(b, { ...initialState(b), hp: [0, 1] }, 0));
  assert.equal(solve(b, initialState(b), 0).par, null);
  assert.equal(solve(b, initialState(b), 0).complete, false);
});
test('BFS agrees with independent exhaustive tap sequence enumeration', () => {
  const b = board([
    { x: 1, y: 1, hp: 1 },
    { x: 5, y: 1, hp: 2 },
    { x: 3, y: 4, hp: 2 },
    { x: 6, y: 6, hp: 1 },
  ]);
  let best = Infinity;
  const first = new Set<number>();
  function walk(s: ReturnType<typeof initialState>, moves: number[]) {
    if (cleared(s)) {
      if (moves.length < best) {
        best = moves.length;
        first.clear();
      }
      if (moves.length === best) first.add(moves[0]);
      return;
    }
    if (moves.length >= best) return;
    for (let i = 0; i < s.hp.length; i++) if (s.hp[i]) walk(transition(b, s, i).state, [...moves, i]);
  }
  walk(initialState(b), []);
  const solution = solve(b);
  assert.equal(solution.par, best);
  assert.deepEqual(
    solution.winningFirstMoves,
    [...first].sort((a, b) => a - b),
  );
  const depth = solveDepth(b, initialState(b), 10000);
  assert.equal(depth.par, best);
  assert.deepEqual(depth.winningFirstMoves, solution.winningFirstMoves);
});
