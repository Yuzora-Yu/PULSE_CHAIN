export const RULE_VERSION = 1;
export const GENERATOR_VERSION = 1;
export const DIFFICULTY_VERSION = 1;
export type Point = { x: number; y: number };
export type Core = Point & { hp: number };
export type TileKind = 'block' | 'mirror' | 'splitter' | 'gate' | 'charge' | 'rotator' | 'portal';
export type Tile = Point & {
  kind: TileKind;
  slash?: boolean;
  direction?: number;
  threshold?: number;
  pair?: number;
};
export type Difficulty = 'easy' | 'normal' | 'hard' | 'expert' | 'extreme';
export type Request = { mode: 'campaign' | 'infinite' | 'daily'; key: string; difficulty: Difficulty };
export type Board = {
  ruleVersion: 1;
  generatorVersion: 1;
  cols: number;
  rows: number;
  cores: Core[];
  tiles: Tile[];
  voids: Point[];
  shape: string;
};
export type State = { hp: number[]; taps: number; devices: number[] };
export type Event =
  | { type: 'move'; tick: number; from: Point; to: Point }
  | { type: 'explode'; tick: number; id: number }
  | { type: 'hit'; tick: number; id: number; hp: number }
  | { type: 'reflect' | 'split' | 'teleport'; tick: number; at: Point }
  | { type: 'device'; tick: number; id: number; value: number };
export type Transition = {
  state: State;
  events: Event[];
  chain: number;
  ticks: number;
  pulseCount: number;
  overflow: boolean;
};
export type Solution = {
  complete: boolean;
  par: number | null;
  moves: number[];
  winningFirstMoves: number[];
  solutionCount: number;
  explored: number;
};
export type Puzzle = {
  board: Board;
  request: Request;
  code: string;
  solution: Solution;
  quality: number;
  maxChain: number;
  attempt: number;
};
export const directions: Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
];
export const initialState = (board: Board): State => ({
  hp: board.cores.map((c) => c.hp),
  taps: 0,
  devices: board.tiles.map((t) =>
    t.kind === 'charge' ? (t.threshold ?? 2) : t.kind === 'rotator' ? (t.slash ? 1 : 0) : 0,
  ),
});
export const stateHash = (state: State) => state.hp.join(',') + '|' + state.devices.join(',');
export const cleared = (state: State) => state.hp.every((hp) => hp === 0);
export const cellKey = (p: Point) => `${p.x},${p.y}`;
