import './style.css';
import { type Puzzle, type Difficulty } from './core/model';
import { evaluate } from './generator/quality';
import { BoardView } from './renderer/board';
import { initialState } from './core/model';
const root = document.querySelector('#inspector')!;
root.innerHTML =
  '<header><a href="./" style="color:var(--mint)">← PULSE CHAIN</a><h1 style="font-size:18px">GENERATOR INSPECTOR</h1></header><main style="max-width:1300px;margin:auto;padding:25px"><p>生成品質のレビュー用。各問題の最短解、正解初手比率、連鎖構造を比較できます。ゲーム画面で遊んで評価すると、設定の記録書き出しに評価が含まれます。</p><form style="display:flex;gap:20px;align-items:end;flex-wrap:wrap"><label>SEED<input id="seed" value="REVIEW" maxlength="30" pattern="[A-Za-z0-9-]+" required></label><label>DIFFICULTY<select id="difficulty"><option>easy</option><option selected>normal</option><option>hard</option><option>expert</option><option>extreme</option></select></label><button class="primary">12 問を比較</button><button type="button" id="export">JSON を書き出す</button></form><p id="progress" role="status"></p><div id="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px"></div></main>';
const worker = new Worker(new URL('./workers/puzzle.worker.ts', import.meta.url), { type: 'module' });
const puzzles: (Puzzle & { metrics: ReturnType<typeof evaluate> })[] = [];
let remaining = 0,
  seed = '',
  difficulty: Difficulty = 'normal';
function next() {
  worker.postMessage({
    id: 12 - remaining,
    type: 'generate',
    request: { mode: 'infinite', key: `${seed}-${12 - remaining}`, difficulty },
  });
}
worker.onmessage = ({ data }) => {
  if (data.error) {
    root.querySelector('#progress')!.textContent = data.error;
    remaining = 0;
    root.querySelector<HTMLButtonElement>('.primary')!.disabled = false;
    return;
  }
  const p = data.result as Puzzle,
    metrics = evaluate(p.board, p.solution);
  puzzles.push({ ...p, metrics });
  const card = document.createElement('section');
  card.style.cssText = 'padding:18px;background:#111d25;border:1px solid #31434b;border-radius:12px';
  const title = document.createElement('h2');
  title.style.fontSize = '12px';
  title.textContent = p.code;
  card.append(title);
  const host = document.createElement('div');
  host.className = 'board';
  card.append(host);
  const view = new BoardView(host, p.board, () => {});
  view.update(initialState(p.board), true);
  view.hint(p.solution.winningFirstMoves);
  const text = document.createElement('p');
  text.style.cssText = 'font-size:11px;line-height:1.9;color:#a6bbc7';
  text.textContent = `PAR ${p.solution.par} · CHAIN ${p.maxChain} · QUALITY ${p.quality}\n正解初手 ${(metrics.winningFirstMoveRatio * 100).toFixed(0)}% · 探索 ${p.solution.explored}\n深さ ${metrics.chainDepth} · 未使用装置 ${(metrics.deadDeviceRatio * 100).toFixed(0)}%\n構造 ${metrics.solutionSignature} · ${metrics.fingerprint}`;
  text.style.whiteSpace = 'pre-line';
  card.append(text);
  const link = document.createElement('a');
  link.href = `./?p=${encodeURIComponent(p.code)}`;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'プレイして評価 →';
  link.style.cssText = 'color:var(--mint);font-size:12px';
  card.append(link);
  root.querySelector('#grid')!.append(card);
  remaining--;
  root.querySelector('#progress')!.textContent = `${12 - remaining} / 12 問を生成・検証済み`;
  if (remaining) next();
  else root.querySelector<HTMLButtonElement>('.primary')!.disabled = false;
};
root.querySelector('form')!.addEventListener('submit', (e) => {
  e.preventDefault();
  seed = root.querySelector<HTMLInputElement>('#seed')!.value.toUpperCase();
  difficulty = root.querySelector<HTMLSelectElement>('#difficulty')!.value as Difficulty;
  root.querySelector<HTMLButtonElement>('.primary')!.disabled = true;
  root.querySelector('#grid')!.innerHTML = '';
  puzzles.length = 0;
  remaining = 12;
  root.querySelector('#progress')!.textContent = '生成中…';
  next();
});
root.querySelector('#export')!.addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(puzzles, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pulse-chain-review.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
