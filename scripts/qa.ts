import { fork } from 'node:child_process';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { cpus } from 'node:os';
import { candidate } from '../src/generator/generate';
import { campaignRequest, hash } from '../src/generator/seed';
import { solve } from '../src/solver/bfs';
import { transition } from '../src/core/transition';
import { validateBoard } from '../src/core/validate';
import { initialState, cleared, stateHash, type Difficulty } from '../src/core/model';
const count = Number(process.argv[2] ?? 1000),
  workers = Math.max(1, Math.min(Number(process.env.QA_WORKERS ?? 6), cpus().length)),
  workerIndex = Number(process.argv[4]);
const safety = process.argv.includes('--safety');
mkdirSync('reports', { recursive: true });
if (process.argv[3] === '--worker') {
  const report = {
    tested: 0,
    accepted: 0,
    rejected: {} as Record<string, number>,
    failures: [] as unknown[],
    maxMs: 0,
    elapsedMs: 0,
    checksum: 0,
  };
  const start = performance.now();
  const csv = createWriteStream(`reports/${safety ? 'safety' : 'solver'}-${workerIndex}.csv`);
  csv.write(
    'seed,difficulty,optimalTap,winningFirstMoveRatio,maxChain,quality,generationTime,solverStates,status\n',
  );
  const reject = (reason: string) => (report.rejected[reason] = (report.rejected[reason] ?? 0) + 1);
  for (let i = workerIndex; i < count; i += workers) {
    const difficulty = (['easy', 'normal', 'hard', 'expert', 'extreme'] as Difficulty[])[i % 5];
    const request =
      i % 3 === 0 ? campaignRequest(i + 1) : { mode: 'infinite' as const, key: `QA${i}`, difficulty };
    const st = performance.now();
    try {
      const b = candidate(request, i % 12);
      validateBoard(b);
      const signature = JSON.stringify(b);
      if (signature !== JSON.stringify(candidate(request, i % 12))) throw Error('Seed mismatch');
      let maxChain = 0,
        unsafe = false;
      for (let id = 0; id < b.cores.length; id++) {
        const t = transition(b, initialState(b), id, false);
        unsafe ||= t.overflow;
        maxChain = Math.max(maxChain, t.chain);
        if (t.state.hp.some((h) => h < 0) || t.chain < 1) throw Error('State invariant');
      }
      let par: number | null = null,
        ratio = 0,
        explored = 0,
        status = 'safe';
      if (unsafe) {
        reject('pulse-limit');
        status = 'pulse-limit';
      } else if (!safety) {
        const sol = solve(b, initialState(b), 1500);
        par = sol.par;
        explored = sol.explored;
        ratio = sol.winningFirstMoves.length / b.cores.length;
        if (!sol.complete) {
          reject('solver-budget');
          status = 'solver-budget';
        } else if (par === null) {
          reject('no-safe-solution');
          status = 'no-safe-solution';
        } else {
          let s = initialState(b);
          for (const id of sol.moves) {
            const t = transition(b, s, id);
            if (t.overflow) throw Error('Unsafe solution');
            if (stateHash(t.state) !== stateHash(transition(b, s, id, false).state))
              throw Error('Timeline mismatch');
            s = t.state;
          }
          if (!cleared(s)) throw Error('Invalid solution');
          report.accepted++;
          status = 'solved';
        }
      } else report.accepted++;
      const ms = performance.now() - st;
      report.maxMs = Math.max(report.maxMs, ms);
      report.checksum = (report.checksum + hash(signature)) >>> 0;
      csv.write(
        `${i},${difficulty},${par ?? ''},${ratio},${maxChain},${Math.round(maxChain * 3 + (1 - ratio) * 20)},${ms.toFixed(2)},${explored},${status}\n`,
      );
    } catch (e) {
      report.failures.push({ seed: i, error: String(e) });
    }
    report.tested++;
    if (report.tested % 2000 === 0) process.send?.({ progress: report.tested });
  }
  report.elapsedMs = Math.round(performance.now() - start);
  csv.end(() => {
    process.send?.({ done: report });
    process.disconnect?.();
  });
} else {
  if (!Number.isInteger(count) || count < 1 || count > 10000000) throw Error('Count must be 1..10000000');
  const started = Date.now();
  const result = {
    candidates: count,
    workers,
    safetyOnly: safety,
    tested: 0,
    accepted: 0,
    rejected: {} as Record<string, number>,
    failures: [] as unknown[],
    maxCandidateMs: 0,
    elapsedMs: 0,
    checksum: 0,
    completedAt: '',
  };
  await Promise.all(
    Array.from(
      { length: workers },
      (_, i) =>
        new Promise<void>((resolve, reject) => {
          const child = fork(
            'scripts/qa.ts',
            [String(count), '--worker', String(i), ...(safety ? ['--safety'] : [])],
            { execArgv: ['--import', 'tsx'], stdio: ['ignore', 'ignore', 'inherit', 'ipc'] },
          );
          let delivered = false;
          child.on('message', (m: any) => {
            if (m.progress && m.progress % 10000 === 0)
              console.log(`QA worker ${i}: ${m.progress} candidates checked`);
            if (m.done) {
              delivered = true;
              const r = m.done;
              result.tested += r.tested;
              result.accepted += r.accepted;
              result.failures.push(...r.failures);
              result.maxCandidateMs = Math.max(result.maxCandidateMs, r.maxMs);
              result.checksum = (result.checksum + r.checksum) >>> 0;
              for (const [k, v] of Object.entries(r.rejected))
                result.rejected[k] = (result.rejected[k] ?? 0) + Number(v);
            }
          });
          child.on('exit', (code) =>
            code === 0 && delivered ? resolve() : reject(Error(`QA process ${i} exited ${code}`)),
          );
        }),
    ),
  );
  result.elapsedMs = Date.now() - started;
  result.completedAt = new Date().toISOString();
  writeFileSync(`reports/${safety ? 'safety' : 'qa'}-summary.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (result.failures.length) process.exitCode = 1;
}
