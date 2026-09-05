import { cleared, stateHash, type Board, type State, type Solution } from '../core/model';
import { transition } from '../core/transition';
/** Exact iterative-depth proof with transpositions; counts are a lower-bound estimate.
 * Each tap removes a core, so depth is bounded by the remaining core count.
 * Transition results are shared across depth iterations and first-move proofs.
 */
export function solveDepth(board: Board, start: State, budget: number): Solution {
  type Edge = { id: number; state: State; chain: number };
  const edges = new Map<string, Edge[]>(),
    failed = new Map<string, number>();
  let explored = 0,
    exhausted = false;
  function successors(state: State) {
    const key = stateHash(state);
    let result = edges.get(key);
    if (result) return result;
    if (++explored > budget) {
      exhausted = true;
      return [];
    }
    result = [];
    for (let id = 0; id < state.hp.length; id++) {
      if (!state.hp[id]) continue;
      const t = transition(board, state, id, false);
      if (!t.overflow) result.push({ id, state: t.state, chain: t.chain });
    }
    result.sort(
      (a, b) =>
        b.chain - a.chain ||
        a.state.hp.reduce((s, h) => s + h, 0) - b.state.hp.reduce((s, h) => s + h, 0) ||
        a.id - b.id,
    );
    edges.set(key, result);
    return result;
  }
  function visit(state: State, depth: number): number[] | null {
    if (cleared(state)) return [];
    if (depth === 0 || exhausted) return null;
    const key = stateHash(state);
    if ((failed.get(key) ?? -1) >= depth) return null;
    for (const edge of successors(state)) {
      const tail = visit(edge.state, depth - 1);
      if (tail) return [edge.id, ...tail];
      if (exhausted) return null;
    }
    failed.set(key, depth);
    return null;
  }
  if (cleared(start))
    return { complete: true, par: 0, moves: [], winningFirstMoves: [], solutionCount: 1, explored: 0 };
  for (let depth = 1; depth <= start.hp.filter(Boolean).length; depth++) {
    const moves = visit(start, depth);
    if (exhausted) break;
    if (moves) {
      const winningFirstMoves: number[] = [];
      for (const edge of successors(start)) {
        if (visit(edge.state, depth - 1)) winningFirstMoves.push(edge.id);
        if (exhausted) break;
      }
      if (exhausted) break;
      return {
        complete: true,
        par: depth,
        moves,
        winningFirstMoves: winningFirstMoves.sort((a, b) => a - b),
        solutionCount: winningFirstMoves.length,
        explored,
      };
    }
  }
  return { complete: !exhausted, par: null, moves: [], winningFirstMoves: [], solutionCount: 0, explored };
}
