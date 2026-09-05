import { type Board, type Core, type Tile } from '../core/model';
function make(cores: number[][], tiles: Tile[] = [], size = 7, shape = 'square'): Board {
  return {
    ruleVersion: 1,
    generatorVersion: 1,
    cols: size,
    rows: size,
    shape,
    cores: cores.map(([x, y, hp = 1]) => ({ x, y, hp })) as Core[],
    tiles,
    voids: [],
  };
}
/** Authored introductory layouts, not substituted random seeds. */
export const tutorials: Record<number, Board> = {
  1: make(
    [
      [2, 2],
      [2, 0],
      [0, 2],
      [4, 2],
    ],
    [],
    5,
  ),
  2: make(
    [
      [1, 1],
      [3, 1],
      [1, 3],
      [3, 3],
      [2, 2],
    ],
    [],
    5,
  ),
  3: make(
    [
      [0, 1],
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 3],
    ],
    [],
    5,
  ),
  4: make([
    [1, 1],
    [1, 3],
    [1, 5],
    [3, 3],
    [5, 1],
    [5, 3],
    [5, 5],
  ]),
  5: make([
    [3, 0],
    [1, 2],
    [3, 2],
    [5, 2],
    [3, 4],
    [1, 6],
    [5, 6],
  ]),
  21: make([
    [1, 3],
    [3, 3, 2],
    [3, 1],
    [5, 1],
  ]),
  51: make(
    [
      [0, 3],
      [2, 1],
      [4, 3],
      [6, 1],
      [6, 5],
    ],
    [
      { x: 2, y: 3, kind: 'block' },
      { x: 4, y: 1, kind: 'block' },
    ],
  ),
  91: make(
    [
      [0, 3],
      [4, 0],
      [6, 2],
      [6, 5],
    ],
    [{ x: 4, y: 3, kind: 'mirror', slash: true }],
  ),
  141: make(
    [
      [0, 3],
      [4, 0],
      [6, 3],
      [4, 6],
      [6, 6],
    ],
    [{ x: 4, y: 3, kind: 'splitter' }],
  ),
  211: make([
    [3, 5],
    [1, 3],
    [5, 3],
    [3, 1, 3],
    [1, 1],
    [5, 1],
  ]),
  301: make(
    [
      [1, 3],
      [5, 3],
      [5, 1],
      [5, 5],
    ],
    [{ x: 3, y: 3, kind: 'gate', direction: 2 }],
  ),
  451: make(
    [
      [0, 3],
      [3, 1],
      [6, 3],
      [5, 5],
    ],
    [{ x: 3, y: 3, kind: 'charge', threshold: 2 }],
  ),
  651: make(
    [
      [0, 3],
      [4, 0],
      [6, 3],
      [4, 6, 2],
    ],
    [{ x: 4, y: 3, kind: 'rotator', slash: true }],
  ),
  901: make(
    [
      [0, 1],
      [6, 5],
      [4, 3, 2],
      [6, 1],
    ],
    [
      { x: 2, y: 1, kind: 'portal', pair: 0 },
      { x: 4, y: 5, kind: 'portal', pair: 0 },
    ],
  ),
};
