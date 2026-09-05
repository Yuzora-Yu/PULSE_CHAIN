import { readFileSync, writeFileSync } from 'node:fs';
import { candidate } from '../src/generator/generate';
import { campaignRequest, hash } from '../src/generator/seed';
import { initialState, stateHash, type Difficulty } from '../src/core/model';
import { transition } from '../src/core/transition';
import { solve } from '../src/solver/bfs';
const path = 'tests/fixtures-v1.json';
const results = [];
for (let i = 0; i < 10000; i++) {
  const request =
    i % 2
      ? campaignRequest(i + 1)
      : {
          mode: 'infinite' as const,
          key: `REGRESSION${i}`,
          difficulty: (['easy', 'normal', 'hard', 'expert', 'extreme'] as Difficulty[])[
            i % 100 === 0 ? Math.floor(i / 100) % 5 : i % 5
          ],
        };
  const b = candidate(request, i % 12),
    t = transition(b, initialState(b), i % b.cores.length, false);
  const signature = [
    hash(JSON.stringify(b)),
    hash(stateHash(t.state)),
    t.chain,
    t.pulseCount,
    Number(t.overflow),
  ];
  if (i % 100 === 0) {
    const sol = solve(b, initialState(b), 1500);
    signature.push(sol.par ?? -1, hash(sol.moves.join(',')), hash(sol.winningFirstMoves.join(',')));
  }
  results.push(signature);
}
const serialized = JSON.stringify(results);
if (process.argv.includes('--write')) {
  writeFileSync(path, serialized + '\n');
  console.log('Frozen 10,000 board/transition signatures and 100 solver signatures.');
} else {
  if (readFileSync(path, 'utf8').trim() !== serialized)
    throw Error(
      'RULE-V1 / GEN-V1 regression changed. Preserve old versions instead of replacing this fixture.',
    );
  console.log('10,000 regression signatures match.');
}
