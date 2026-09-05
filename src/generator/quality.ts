import { initialState, cellKey, type Board, type Solution } from '../core/model';
import { transition } from '../core/transition';
import { hash } from './seed';
export function fingerprint(b: Board) {
  // Canonicalize all eight dihedral transforms so rotated copies collide.
  const variants: string[] = [];
  for (let transform = 0; transform < 8; transform++) {
    const encode = (x: number, y: number) => {
      if (transform & 1) x = b.cols - 1 - x;
      if (transform & 2) y = b.rows - 1 - y;
      return transform & 4 ? `${y},${x}` : `${x},${y}`;
    };
    variants.push(
      [
        ...b.cores.map((c) => `c${c.hp}@${encode(c.x, c.y)}`),
        ...b.tiles.map((t) => `${t.kind}@${encode(t.x, t.y)}`),
        ...b.voids.map((v) => `v@${encode(v.x, v.y)}`),
      ]
        .sort()
        .join(';'),
    );
  }
  return hash(variants.sort()[0]).toString(36);
}
export function evaluate(b: Board, solution: Solution) {
  let state = initialState(b),
    chainDepth = 0,
    maxChain = 0,
    reflections = 0,
    splits = 0,
    interactions = 0;
  const used = new Set<string>(),
    signature: number[] = [];
  for (const id of solution.moves) {
    const t = transition(b, state, id);
    state = t.state;
    maxChain = Math.max(maxChain, t.chain);
    chainDepth = Math.max(chainDepth, ...t.events.filter((e) => e.type === 'explode').map((e) => e.tick));
    signature.push(t.chain);
    for (const e of t.events) {
      if (e.type === 'reflect') {
        reflections++;
        used.add(cellKey(e.at));
      }
      if (e.type === 'split') {
        splits++;
        used.add(cellKey(e.at));
      }
      if (e.type === 'device') used.add(cellKey(b.tiles[e.id]));
      if (e.type === 'teleport') used.add(cellKey(e.at));
      if (e.type === 'hit') interactions++;
    }
  }
  const devices = b.tiles.filter((t) => t.kind !== 'block' && t.kind !== 'gate');
  const winningFirstMoveRatio = solution.winningFirstMoves.length / b.cores.length;
  const deadDeviceRatio = devices.length
    ? devices.filter((t) => !used.has(cellKey(t))).length / devices.length
    : 0;
  return {
    qualityVersion: 1,
    winningFirstMoveRatio,
    trapMoves: b.cores.length - solution.winningFirstMoves.length,
    chainDepth,
    maxChain,
    reflections,
    splits,
    interactionDensity: interactions / b.cores.length,
    deadDeviceRatio,
    fingerprint: fingerprint(b),
    solutionSignature: signature.join('-'),
    difficultyScore: Math.round(
      (solution.par ?? 0) * 12 +
        (1 - winningFirstMoveRatio) * 25 +
        Math.log2(solution.explored + 1) * 3 +
        chainDepth / 2,
    ),
  };
}
