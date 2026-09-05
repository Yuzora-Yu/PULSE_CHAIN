import { type Tile, type TileKind } from './model';
export const mechanics: Record<TileKind, { name: string; symbol: string; description: string }> = {
  block: { name: 'BLOCK', symbol: '▰', description: '光を止める' },
  mirror: { name: 'MIRROR', symbol: '╱', description: '鏡の向きに光を反射' },
  splitter: { name: 'SPLITTER', symbol: '✣', description: '直進と左右へ3つに分裂' },
  gate: { name: 'GATE', symbol: '↑', description: '矢印と同じ方向の光だけ通す' },
  charge: { name: 'CHARGE', symbol: '◇', description: '2回当たると8方向へ発射' },
  rotator: { name: 'ROTATOR', symbol: '⟳', description: '反射後、命中数だけ向きを切替' },
  portal: { name: 'PORTAL', symbol: '◎', description: '同じ番号の輪へ光を転送' },
};
export function tileSymbol(tile: Tile, value?: number) {
  if (tile.kind === 'mirror') return tile.slash ? '╱' : '╲';
  if (tile.kind === 'rotator') return `<small>⟳</small>${(value ?? (tile.slash ? 1 : 0)) ? '╱' : '╲'}`;
  if (tile.kind === 'gate') return ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][tile.direction ?? 0];
  if (tile.kind === 'charge') return `<b>${(value ?? tile.threshold ?? 2) || '·'}</b>`;
  if (tile.kind === 'portal') return `<b>${(tile.pair ?? 0) + 1}</b>`;
  return mechanics[tile.kind].symbol;
}
export function legendHTML(tiles: Tile[]) {
  return [...new Set(tiles.map((t) => t.kind))]
    .map((kind) => {
      const m = mechanics[kind];
      return `<div><i class="legend-${kind}">${m.symbol}</i><span>${m.name}<small>${m.description}</small></span></div>`;
    })
    .join('');
}
