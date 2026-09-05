import { directions, type Board, type State, type Transition, type Point, type Event } from './model';
type Pulse = Point & { dx: number; dy: number; visited: Set<number> };
const geometry = new WeakMap<
  Board,
  {
    cores: Int16Array;
    tiles: ((Board['tiles'][number] & { id: number; exit?: Point }) | undefined)[];
    voids: Uint8Array;
  }
>();
function compile(board: Board) {
  let cached = geometry.get(board);
  if (!cached) {
    const cores = new Int16Array(board.cols * board.rows).fill(-1),
      tiles: Array<(Board['tiles'][number] & { id: number; exit?: Point }) | undefined> = [],
      voids = new Uint8Array(board.cols * board.rows);
    board.cores.forEach((c, i) => (cores[c.y * board.cols + c.x] = i));
    board.tiles.forEach(
      (t, id) =>
        (tiles[t.y * board.cols + t.x] = {
          ...t,
          id,
          exit:
            t.kind === 'portal'
              ? board.tiles.find((q) => q !== t && q.kind === 'portal' && q.pair === t.pair)
              : undefined,
        }),
    );
    board.voids.forEach((p) => (voids[p.y * board.cols + p.x] = 1));
    cached = { cores, tiles, voids };
    geometry.set(board, cached);
  }
  return cached;
}
export const MAX_PULSES = 2048;
/** Integer ticks; all hits at a tick are aggregated before any core explodes.
 * Direct taps detonate armor too. A pulse is absorbed by any core alive at tick start.
 * Splitters emit forward and both perpendicular directions. Children inherit loop history.
 */
export function transition(board: Board, input: State, tapped: number, timeline = true): Transition {
  if (!Number.isInteger(tapped) || !(input.hp[tapped] > 0)) throw new Error('Tap must target a live core');
  const state = { hp: [...input.hp], taps: input.taps + 1, devices: [...input.devices] };
  const events: Event[] = [];
  const emit = (e: Event) => {
    if (timeline) events.push(e);
  };
  const { cores, tiles, voids } = compile(board);
  let pulses: Pulse[] = [],
    pulseCount = 0,
    chain = 0,
    tick = 0,
    overflow = false;
  const spawn = (p: Point, dx: number, dy: number, visited = new Set<number>()) => {
    pulseCount++;
    if (pulseCount > MAX_PULSES) {
      overflow = true;
      return;
    }
    pulses.push({ ...p, dx, dy, visited });
  };
  const explode = (id: number) => {
    state.hp[id] = 0;
    chain++;
    emit({ type: 'explode', tick, id });
    for (const d of directions) spawn(board.cores[id], d.x, d.y);
  };
  explode(tapped);
  while (pulses.length && !overflow) {
    tick++;
    if (tick > board.cols * board.rows * 8 + board.cores.length * 8) {
      overflow = true;
      break;
    }
    const current = pulses;
    pulses = [];
    const hits = new Map<number, number>();
    const deviceHits = new Map<number, number>();
    const memory = state.devices.reduce((a, v) => a * 4 + v, 0);
    for (const p of current) {
      const to = { x: p.x + p.dx, y: p.y + p.dy };
      const key = to.y * board.cols + to.x;
      if (to.x < 0 || to.y < 0 || to.x >= board.cols || to.y >= board.rows || voids[key]) continue;
      if (timeline) emit({ type: 'move', tick: tick - 1, from: { x: p.x, y: p.y }, to });
      const core = cores[key];
      if (core >= 0 && state.hp[core] > 0) {
        hits.set(core, (hits.get(core) ?? 0) + 1);
        continue;
      }
      const tile = tiles[key];
      if (tile && tile.kind !== 'block') {
        const visit = memory * board.cols * board.rows * 9 + key * 9 + (p.dx + 1) * 3 + p.dy + 1;
        if (p.visited.has(visit)) continue;
        p.visited.add(visit);
      }
      p.x = to.x;
      p.y = to.y;
      if (tile?.kind === 'block') continue;
      if (tile?.kind === 'gate') {
        const d = directions[tile.direction ?? 0];
        if (p.dx === d.x && p.dy === d.y) pulses.push(p);
        continue;
      }
      if (tile?.kind === 'charge' && state.devices[tile.id] > 0) {
        deviceHits.set(tile.id, (deviceHits.get(tile.id) ?? 0) + 1);
        continue;
      }
      if (tile?.kind === 'portal') {
        const exit = tile.exit;
        if (exit) {
          emit({ type: 'teleport', tick, at: to });
          emit({ type: 'teleport', tick, at: exit });
          p.x = exit.x;
          p.y = exit.y;
          pulses.push(p);
        }
        continue;
      }
      if (tile?.kind === 'mirror' || tile?.kind === 'rotator') {
        const slash = tile.kind === 'rotator' ? !!state.devices[tile.id] : tile.slash;
        const dx = slash ? -p.dy : p.dy,
          dy = slash ? -p.dx : p.dx;
        emit({ type: 'reflect', tick, at: to });
        if (tile.kind === 'rotator') deviceHits.set(tile.id, (deviceHits.get(tile.id) ?? 0) + 1);
        p.dx = dx;
        p.dy = dy;
        pulses.push(p);
      } else if (tile?.kind === 'splitter') {
        emit({ type: 'split', tick, at: to });
        for (const [dx, dy] of [
          [p.dx, p.dy],
          [-p.dy, p.dx],
          [p.dy, -p.dx],
        ])
          spawn(to, dx, dy, new Set(p.visited));
      } else pulses.push(p);
    }
    for (const [id, count] of [...deviceHits].sort((a, b) => a[0] - b[0])) {
      const tile = board.tiles[id];
      if (tile.kind === 'rotator') state.devices[id] = (state.devices[id] + count) % 2;
      if (tile.kind === 'charge') {
        state.devices[id] = Math.max(0, state.devices[id] - count);
        if (!state.devices[id]) for (const d of directions) spawn(tile, d.x, d.y);
      }
      emit({ type: 'device', tick, id, value: state.devices[id] });
    }
    const detonations: number[] = [];
    for (const [id, count] of [...hits].sort((a, b) => a[0] - b[0])) {
      state.hp[id] = Math.max(0, state.hp[id] - count);
      emit({ type: 'hit', tick, id, hp: state.hp[id] });
      if (!state.hp[id]) detonations.push(id);
    }
    for (const id of detonations) explode(id);
  }
  return { state, events, chain, ticks: tick, pulseCount, overflow };
}
