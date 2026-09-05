import { cellKey, type Board } from './model';
export function validateBoard(b: Board): void {
  if (b.ruleVersion !== 1 || b.generatorVersion !== 1) throw Error('Unsupported version');
  if (
    !Number.isInteger(b.cols) ||
    !Number.isInteger(b.rows) ||
    b.cols < 1 ||
    b.cols > 15 ||
    b.rows < 1 ||
    b.rows > 15
  )
    throw Error('Invalid dimensions');
  if (b.cores.length < 1 || b.cores.length > 28) throw Error('Invalid core count');
  const points = [...b.cores, ...b.tiles, ...b.voids],
    keys = points.map(cellKey);
  if (new Set(keys).size !== keys.length) throw Error('Overlapping objects');
  if (
    points.some(
      (p) =>
        !Number.isInteger(p.x) ||
        !Number.isInteger(p.y) ||
        p.x < 0 ||
        p.y < 0 ||
        p.x >= b.cols ||
        p.y >= b.rows,
    )
  )
    throw Error('Out of bounds');
  if (b.cores.some((c) => ![1, 2, 3].includes(c.hp))) throw Error('Invalid HP');
  for (const t of b.tiles) {
    if (t.kind === 'portal' && b.tiles.filter((q) => q.kind === 'portal' && q.pair === t.pair).length !== 2)
      throw Error('Unpaired portal');
    if (t.kind === 'gate' && (!Number.isInteger(t.direction) || t.direction! < 0 || t.direction! > 7))
      throw Error('Invalid gate');
  }
}
