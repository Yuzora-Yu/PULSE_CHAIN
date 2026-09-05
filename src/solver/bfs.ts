import { cleared, initialState, stateHash, type Board, type State, type Solution } from '../core/model';
import { transition } from '../core/transition';
import { solveDepth } from './depth';
/** Breadth-first graph search. Merged nodes retain all optimal first moves and path counts. */
export function solve(board: Board, start: State = initialState(board), budget = 20000): Solution {
  if (start.hp.filter(Boolean).length > 12) return solveDepth(board, start, budget);
  type Node = { state: State; path: number[]; first: Set<number>; count: number };
  if (cleared(start))
    return { complete: true, par: 0, moves: [], winningFirstMoves: [], solutionCount: 1, explored: 0 };
  let layer: Node[] = [{ state: start, path: [], first: new Set(), count: 1 }],
    explored = 0;
  const visited = new Set([stateHash(start)]);
  while (layer.length) {
    const next = new Map<string, Node>();
    let winner: Node | undefined;
    for (const node of layer) {
      if (++explored > budget)
        return { complete: false, par: null, moves: [], winningFirstMoves: [], solutionCount: 0, explored };
      for (let id = 0; id < node.state.hp.length; id++) {
        if (!node.state.hp[id]) continue;
        const result = transition(board, node.state, id, false);
        if (result.overflow) continue;
        const first = node.path.length ? node.first : new Set([id]);
        const candidate: Node = {
          state: result.state,
          path: [...node.path, id],
          first: new Set(first),
          count: node.count,
        };
        if (cleared(result.state)) {
          if (!winner) winner = candidate;
          else {
            for (const f of first) winner.first.add(f);
            winner.count = Math.min(1e9, winner.count + node.count);
          }
          continue;
        }
        const hash = stateHash(result.state);
        if (visited.has(hash)) continue;
        const existing = next.get(hash);
        if (existing) {
          for (const f of first) existing.first.add(f);
          existing.count = Math.min(1e9, existing.count + node.count);
        } else next.set(hash, candidate);
      }
    }
    if (winner)
      return {
        complete: true,
        par: winner.path.length,
        moves: winner.path,
        winningFirstMoves: [...winner.first].sort((a, b) => a - b),
        solutionCount: winner.count,
        explored,
      };
    for (const hash of next.keys()) visited.add(hash);
    layer = [...next.values()];
  }
  return { complete: true, par: null, moves: [], winningFirstMoves: [], solutionCount: 0, explored };
}
