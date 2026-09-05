import {
  cellKey,
  directions,
  initialState,
  type Board,
  type Request,
  type Puzzle,
  type Point,
  type TileKind,
} from '../core/model';
import { transition } from '../core/transition';
import { solve } from '../solver/bfs';
import { random, puzzleCode, campaignRequest, hash } from './seed';
import { tutorials } from './tutorials';
import { manifestV1 } from './manifest-v1';

export function candidate(request: Request, attempt: number): Board {
  if (request.mode === 'campaign' && tutorials[Number(request.key)])
    return structuredClone(tutorials[Number(request.key)]);
  const rng = random(`PULSECHAIN|RULE-V1|GEN-V1|${puzzleCode(request)}|${attempt}`);
  const pick = (n: number) => Math.floor(rng() * n);
  const rank = { easy: 0, normal: 1, hard: 2, expert: 3, extreme: 4 }[request.difficulty];
  const stage = request.mode === 'campaign' ? Number(request.key) : [50, 210, 450, 900, 1200][rank];
  const easy = request.difficulty === 'easy';
  const celebration = request.mode === 'campaign' && stage >= 50 && stage % 50 === 0;
  const size = easy && !celebration ? 7 : 9;
  const shape = ['square', 'diamond', 'cross', 'notched', 'ring', 'wide', 'twin'][pick(7)];
  const valid = (p: Point) =>
    p.x >= 0 &&
    p.y >= 0 &&
    p.x < size &&
    p.y < size &&
    !(shape === 'diamond' && Math.abs(p.x - (size - 1) / 2) + Math.abs(p.y - (size - 1) / 2) > size - 2) &&
    !(shape === 'cross' && Math.abs(p.x - (size - 1) / 2) > 1 && Math.abs(p.y - (size - 1) / 2) > 1) &&
    !(shape === 'notched' && p.x < 2 && p.y < 2) &&
    !(shape === 'ring' && Math.abs(p.x - (size - 1) / 2) < 1 && Math.abs(p.y - (size - 1) / 2) < 1) &&
    !(shape === 'wide' && (p.y === 0 || p.y === size - 1)) &&
    !(shape === 'twin' && p.x === Math.floor(size / 2) && p.y !== Math.floor(size / 2));
  const board: Board = {
    ruleVersion: 1,
    generatorVersion: 1,
    cols: size,
    rows: size,
    cores: [],
    tiles: [],
    voids: [],
    shape,
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) if (!valid({ x, y })) board.voids.push({ x, y });
  const occupied = new Set<string>(),
    routes = new Set<string>();
  const add = (p: Point, hp = 1) => {
    board.cores.push({ ...p, hp });
    occupied.add(cellKey(p));
  };
  add({ x: Math.floor(size / 2), y: Math.floor(size / 2) + (shape === 'ring' ? 1 : 0) });
  const target = stage === 1 ? 4 : celebration ? 18 : [5, 8, 11, 13, 15][rank] + pick(3);
  const kinds: TileKind[] = [];
  if (stage >= 91) kinds.push('mirror');
  if (stage >= 141) kinds.push('splitter');
  if (stage >= 301) kinds.push('gate');
  if (stage >= 451) kinds.push('charge');
  if (stage >= 651) kinds.push('rotator');
  if (stage >= 901) kinds.push('portal');
  // At most two route devices plus BLOCK. New-device chapters always include that device.
  const newest = kinds.at(-1);
  const selected = kinds.length ? [newest!, kinds[pick(kinds.length)]] : [];
  // Embed a rooted chain graph. Each new vertex has a clear ray from a previous vertex.
  // Some edges bend at mirrors or branch through splitters; reserved paths stay unobstructed.
  for (let tries = 0; board.cores.length < target && tries < 200; tries++) {
    const source = board.cores[pick(board.cores.length)],
      d = directions[pick(8)];
    const length = 1 + pick(3);
    let p: Point = source,
      dx = d.x,
      dy = d.y;
    const path: Point[] = [];
    let bend: Point | undefined;
    let slash = false;
    let splitter = false;
    for (let step = 0; step < length; step++) {
      p = { x: p.x + dx, y: p.y + dy };
      if (!valid(p) || occupied.has(cellKey(p))) {
        path.length = 0;
        break;
      }
      path.push(p);
      if (
        step === 0 &&
        length > 1 &&
        !routes.has(cellKey(p)) &&
        board.tiles.length < 2 &&
        stage >= 91 &&
        rng() < 0.5
      ) {
        bend = p;
        slash = rng() < 0.5;
        splitter = selected.includes('splitter') && rng() < 0.5;
        [dx, dy] = splitter ? [-dy, dx] : slash ? [-dy, -dx] : [dy, dx];
      }
    }
    if (!path.length || path.slice(0, -1).some((q) => cellKey(q) === cellKey(p))) continue;
    if (bend) {
      board.tiles.push({
        ...bend,
        kind: splitter ? 'splitter' : selected.includes('rotator') ? 'rotator' : 'mirror',
        slash,
      });
      occupied.add(cellKey(bend));
    }
    for (const q of path) routes.add(cellKey(q));
    add(
      p,
      !celebration && stage >= 21 && rng() < [0.2, 0.6, 0.85, 0.95, 1][rank]
        ? stage >= 211 && rng() < (rank >= 3 ? 0.85 : 0.5)
          ? 3
          : 2
        : 1,
    );
  }
  for (const kind of selected.filter((k) => ['gate', 'charge', 'portal'].includes(k))) {
    const available = [...routes]
      .filter((k) => !occupied.has(k))
      .map((k) => {
        const [x, y] = k.split(',').map(Number);
        return { x, y };
      });
    if (!available.length) continue;
    const p = available[pick(available.length)];
    if (kind === 'portal') {
      const q = available.find((q) => Math.abs(q.x - p.x) + Math.abs(q.y - p.y) > 3);
      if (!q) continue;
      board.tiles.push({ ...p, kind, pair: 0 }, { ...q, kind, pair: 0 });
      occupied.add(cellKey(q));
    } else board.tiles.push({ ...p, kind, direction: pick(8), threshold: 2 });
    occupied.add(cellKey(p));
    break;
  }
  // Enforce a readable three-kind vocabulary including blocks.
  const usedKinds = new Set(board.tiles.map((t) => t.kind));
  while (usedKinds.size > 2) {
    const remove = [...usedKinds].find((k) => !selected.includes(k)) ?? [...usedKinds][0];
    board.tiles = board.tiles.filter((t) => t.kind !== remove);
    usedKinds.delete(remove);
  }
  if (stage >= 51)
    for (let i = 0; i < 3; i++) {
      const p = { x: pick(size), y: pick(size) };
      if (valid(p) && !occupied.has(cellKey(p)) && !routes.has(cellKey(p))) {
        board.tiles.push({ ...p, kind: 'block' });
        occupied.add(cellKey(p));
      }
    }
  // Mutate a valid chain graph into a multi-tap dependency puzzle by selectively
  // interrupting a few embedded edges. The shared solver certifies the mutation.
  if (rank >= 1 && stage >= 51) {
    const available = [...routes].filter((k) => !occupied.has(k));
    for (let i = 0; i < rank * 2 && available.length; i++) {
      const [key] = available.splice(pick(available.length), 1);
      const [x, y] = key.split(',').map(Number);
      board.tiles.push({ x, y, kind: 'block' });
      occupied.add(key);
    }
  }
  return board;
}
export function generate(input: Request): Puzzle {
  // Campaign profile is canonical, independent of manipulated share-code difficulty.
  const request =
    input.mode === 'campaign'
      ? campaignRequest(Number(input.key))
      : input.mode === 'daily'
        ? { ...input, difficulty: 'normal' as const }
        : input;
  let best: Puzzle | undefined;
  const pinned = request.mode === 'campaign' ? manifestV1[Number(request.key) - 1] : undefined;
  const attempts = pinned ? [pinned[0]] : Array.from({ length: 12 }, (_, i) => i);
  for (const attempt of attempts) {
    const board = candidate(request, attempt),
      solution = solve(board, initialState(board), 6000);
    if (pinned && (pinned[1] !== solution.par || pinned[2] !== hash(JSON.stringify(board))))
      throw Error('保存されたステージとの互換性を確認できませんでした。');
    if (!solution.complete || solution.par === null || board.cores.length < 4) continue;
    let state = initialState(board),
      maxChain = 0,
      unsafe = false;
    const used = new Set<string>();
    for (const move of solution.moves) {
      const t = transition(board, state, move);
      state = t.state;
      unsafe ||= t.overflow;
      maxChain = Math.max(maxChain, t.chain);
      for (const e of t.events)
        if (e.type === 'reflect' || e.type === 'split' || e.type === 'teleport') used.add(cellKey(e.at));
        else if (e.type === 'device') used.add(cellKey(board.tiles[e.id]));
    }
    if (unsafe || maxChain < 3) continue;
    const ratio = solution.winningFirstMoves.length / board.cores.length;
    const desired = { easy: 1, normal: 2, hard: 3, expert: 4, extreme: 5 }[request.difficulty];
    const decorative = board.tiles.filter(
      (t) => t.kind !== 'block' && t.kind !== 'gate' && !used.has(cellKey(t)),
    ).length;
    const quality = Math.round(
      55 + maxChain * 2 + (1 - ratio) * 18 - Math.abs(solution.par - desired) * 45 - decorative * 15,
    );
    const puzzle: Puzzle = {
      board,
      request,
      code: puzzleCode(request),
      solution,
      quality,
      maxChain,
      attempt,
    };
    if (!best || quality > best.quality) best = puzzle;
  }
  if (!best) throw new Error('生成に失敗しました。別の Puzzle Code をお試しください。');
  return best;
}
