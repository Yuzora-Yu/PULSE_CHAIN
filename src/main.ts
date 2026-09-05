import './style.css';
import { utcDay, recentDays, dailyProgress } from './daily';
import { legendHTML } from './core/mechanics';
import { cleared, initialState, type Puzzle, type Request, type Solution, type State } from './core/model';
import { transition } from './core/transition';
import { campaignRequest, parseCode, puzzleCode } from './generator/seed';
import { cachedPuzzle, cachePuzzle } from './storage/cache';
import { loadSave, persist, migrate } from './storage/save';
import { BoardView } from './renderer/board';
import { tone } from './renderer/audio';

const app = document.querySelector<HTMLDivElement>('#app')!;
const save = loadSave();
let worker = new Worker(new URL('./workers/puzzle.worker.ts', import.meta.url), { type: 'module' });
let solverWorker = new Worker(new URL('./workers/puzzle.worker.ts', import.meta.url), { type: 'module' });
let nextInfinite: Request | undefined;
let serial = 0,
  screen = 0,
  active: Puzzle | undefined,
  state: State | undefined,
  boardView: BoardView | undefined;
let appliedMoves: number[] = [];
let undo: State[] = [],
  busy = false,
  currentChain = 0;
const pending = new Map<
  number,
  {
    resolve: (v: unknown) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
    engine: Worker;
  }
>();
const cache = new Map<string, Promise<Puzzle>>();
function attach(engine: Worker) {
  engine.onmessage = ({ data }) => {
    const p = pending.get(data.id);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(data.id);
    data.error ? p.reject(new Error(data.error)) : p.resolve(data.result);
  };
  engine.onerror = (e) => {
    e.preventDefault();
    recover(engine, new Error('計算エンジンを再起動しました。もう一度お試しください。'));
  };
}
function recover(engine: Worker, error: Error) {
  engine.terminate();
  for (const [id, p] of pending) {
    if (p.engine !== engine) continue;
    clearTimeout(p.timer);
    p.reject(error);
    pending.delete(id);
  }
  const replacement = new Worker(new URL('./workers/puzzle.worker.ts', import.meta.url), { type: 'module' });
  if (engine === worker) worker = replacement;
  else solverWorker = replacement;
  attach(replacement);
}
attach(worker);
attach(solverWorker);
function job<T>(payload: Record<string, unknown>): Promise<T> {
  const id = ++serial;
  const engine = payload.type === 'solve' ? solverWorker : worker;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      recover(engine, new Error('計算に時間がかかったため再起動しました。もう一度お試しください。'));
    }, 60000);
    pending.set(id, { resolve: (v) => resolve(v as T), reject, timer, engine });
    engine.postMessage({ id, ...payload });
  });
}
function puzzle(request: Request) {
  const key = puzzleCode(request);
  if (!cache.has(key)) {
    const p = (import.meta.env.DEV ? Promise.resolve(undefined) : cachedPuzzle(key))
      .then(async (cached) => {
        if (cached) return cached;
        const fresh = await job<Puzzle>({ type: 'generate', request });
        void cachePuzzle(fresh);
        return fresh;
      })
      .catch((e) => {
        cache.delete(key);
        throw e;
      });
    cache.set(key, p);
    if (cache.size > 16) cache.delete(cache.keys().next().value!);
  }
  return cache.get(key)!;
}
function writeSave() {
  if (!persist(save)) toast('このブラウザでは保存できません。設定から記録を書き出せます。');
}
function applySettings() {
  document.body.classList.toggle('reduced', !save.settings.motion);
  document.body.classList.toggle('contrast', save.settings.contrast);
}
applySettings();
const icon = (name: string) =>
  (
    ({ home: '⌂', undo: '↶', reset: '⟳', hint: '✧', settings: '☷', share: '↗', next: '→' }) as Record<
      string,
      string
    >
  )[name] ?? name;
function toast(message: string) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 4500);
}
function shell(content: string, game = false) {
  boardView?.destroy();
  boardView = undefined;
  app.innerHTML = `<header><button class="wordmark" id="brand" aria-label="ホーム"><i class="brand-icon">✳</i><span>PULSE<span class="thin">CHAIN</span></span></button><div class="header-right"><span class="small-label desktop">TAP ONE. TRIGGER THEM ALL.</span><button class="icon-button" id="settings" aria-label="設定">${icon('settings')}</button></div></header><main class="${game ? 'game' : 'home'}">${content}</main><footer><span>YU-ZORA <i>／</i> PULSE CHAIN</span><button id="help">遊び方</button><span class="footer-note">ひとつ押す。全部つながる。</span></footer><div id="announce" class="sr-only" aria-live="polite"></div>`;
  document.querySelector('#brand')!.addEventListener('click', home);
  document.querySelector('#settings')!.addEventListener('click', settings);
  document.querySelector('#help')!.addEventListener('click', help);
}
function home() {
  screen++;
  active = undefined;
  busy = false;
  history.replaceState(null, '', location.pathname);
  const daily = new Date().toISOString().slice(0, 10);
  shell(
    `<section class="hero"><div class="eyebrow"><span class="status-dot"></span> THE CHAIN STARTS WITH YOU</div><h1>ひとつの光から、<br><em>すべてがつながる。</em></h1><p class="intro">起点を見つける。光が駆ける。<br>ひらめきが、気持ちいい連鎖になる。</p><button class="continue" id="continue"><span><small>CAMPAIGN</small><strong>つづきから</strong><span>STAGE ${String(save.stage).padStart(3, '0')}</span></span><b>↗</b></button><div class="mode-row"><button class="mode-card" id="daily"><span class="mode-symbol">◈</span><strong>DAILY</strong><small>${daily.replaceAll('-', '.')} · 世界共通</small><b>→</b></button><button class="mode-card" id="infinite"><span class="mode-symbol lavender">∞</span><strong>INFINITE</strong><small>好きな難しさで、どこまでも</small><b>→</b></button></div><div class="home-links"><button id="stages">ステージを選ぶ →</button><button id="enter-code">Puzzle Code を開く ↗</button></div><div class="collection-link"><button id="collection">◇ コレクション</button>${save.session ? '<button id="resume-session">途中のパズルへ →</button>' : ''}</div></section><section class="showcase" aria-label="光の連鎖のイメージ"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="hero-grid">${Array.from({ length: 49 }, (_, i) => `<i class="${[9, 15, 17, 22, 24, 26, 31, 33, 39].includes(i) ? 'lit' : ''} ${[17, 24, 31].includes(i) ? 'bright' : ''}">${i === 24 ? '<span>✳</span>' : ''}</i>`).join('')}</div><div class="showcase-label"><span>ONE TAP.</span><strong>ENDLESS POSSIBILITIES.</strong></div><div class="float-tag"><i></i> FIND YOUR FIRST SPARK</div></section><section class="home-stats"><div><strong>${Math.max(0, save.stage - 1)}</strong><span>STAGES CLEARED</span></div><div><strong>${Object.keys(save.best).length}</strong><span>PUZZLES SOLVED</span></div><div><strong>×${save.maxChain}</strong><span>LONGEST CHAIN</span></div><p>時間制限なし。<br>あなたのペースで、次のひらめきへ。</p></section>`,
  );
  document
    .querySelector('#continue')!
    .addEventListener('click', () => void start(campaignRequest(save.stage)));
  document.querySelector('#daily')!.addEventListener('click', dailyMenu);
  document.querySelector('#collection')!.addEventListener('click', collection);
  document.querySelector('#resume-session')?.addEventListener('click', () => {
    if (save.session) void start(parseCode(save.session.code));
  });
  document.querySelector('#infinite')!.addEventListener('click', infinite);
  document.querySelector('#enter-code')!.addEventListener('click', enterCode);
  document.querySelector('#stages')!.addEventListener('click', stages);
  void puzzle(campaignRequest(save.stage)).catch(() => {});
}
async function start(request: Request) {
  const token = ++screen;
  active = undefined;
  busy = true;
  shell(
    '<div class="loading"><span class="loader">✳</span><h2>次のひらめきを準備中</h2><p>光の道筋をつないでいます。</p></div>',
    true,
  );
  try {
    const p = await puzzle(request);
    if (token !== screen) return;
    active = p;
    state = initialState(p.board);
    undo = [];
    appliedMoves = [];
    if (save.session?.code === p.code) {
      try {
        for (const id of save.session.moves) {
          undo.push(structuredClone(state));
          const t = transition(p.board, state, id);
          if (t.overflow) throw Error('Unsafe saved move');
          state = t.state;
          appliedMoves.push(id);
        }
      } catch {
        state = initialState(p.board);
        undo = [];
        appliedMoves = [];
      }
    }
    busy = false;
    currentChain = 0;
    history.replaceState(null, '', `${location.pathname}?p=${encodeURIComponent(p.code)}`);
    renderGame();
    if (state && cleared(state)) finish();
    if (request.mode === 'infinite') {
      nextInfinite = { ...request, key: newSeed() };
      void puzzle(nextInfinite).catch(() => {});
    }
    if (request.mode === 'campaign')
      for (let i = 1; i <= 3; i++) void puzzle(campaignRequest(Number(request.key) + i)).catch(() => {});
  } catch (e) {
    if (token !== screen) return;
    busy = false;
    shell(
      '<div class="loading"><h2>準備ができませんでした</h2><p id="error"></p><button class="primary" id="retry">もう一度</button></div>',
    );
    document.querySelector('#error')!.textContent = (e as Error).message;
    document.querySelector('#retry')!.addEventListener('click', () => void start(request));
  }
}
function renderGame() {
  if (!active || !state) return;
  const p = active;
  const name =
    p.request.mode === 'campaign'
      ? `STAGE ${String(p.request.key).padStart(3, '0')}`
      : p.request.mode === 'daily'
        ? `DAILY ${p.request.key}`
        : 'INFINITE';
  shell(
    `<div class="game-top"><button class="text-button" id="back">← ホーム</button><span class="eyebrow">${p.request.difficulty.toUpperCase()} <i>／</i> ${p.board.shape.toUpperCase()}</span><button class="text-button" id="share">共有 ${icon('share')}</button></div><div class="play-layout"><section class="play-area"><div class="game-heading"><div><span class="small-label">${p.request.mode.toUpperCase()}</span><h1>${name}</h1></div><div class="tap-counter"><strong id="taps">${state.taps}</strong><span> / ${p.solution.par}<small>TAPS / BEST</small></span></div></div><div class="board-wrap"><div id="board" class="board" role="group" aria-label="パズル盤面"></div><div id="result"></div></div><div class="board-caption"><span id="status">CORE をひとつ選んで、連鎖をはじめよう。</span><strong id="chain">CHAIN <b>×0</b></strong></div><div class="controls"><button id="undo">${icon('undo')}<span>UNDO</span><small>ひとつ戻す</small></button><button id="reset">${icon('reset')}<span>RESET</span><small>はじめから</small></button><button id="hint">${icon('hint')}<span>HINT</span><small>ひらめきのヒント</small></button></div></section><aside class="game-aside"><div class="aside-heading"><span class="status-dot"></span> FIND THE CONNECTION</div><h2>よく見て。<br>ひとつ、選んで。</h2><p>光は8方向へ進み、<br>ほかの CORE に当たると連鎖。<br>すべて消せばクリアです。</p><div class="legend"><div><i class="legend-core"></i><span>CORE<small>タップで起爆</small></span></div>${p.board.cores.some((c) => c.hp > 1) ? '<div><i class="legend-armor">2</i><span>ARMOR<small>数字の回数だけ光を当てる</small></span></div>' : ''}${legendHTML(p.board.tiles)}</div><div class="par-note"><span>PERFECT CASCADE</span><p>${p.solution.par} TAP で、すべてをつなごう。<br>何度でもやり直せます。</p></div><button class="code-button" id="code">${p.code} ↗</button></aside></div>`,
    true,
  );
  boardView = new BoardView(document.querySelector('#board')!, p.board, (id) => void tap(id));
  boardView.update(state);
  document.querySelector('#back')!.addEventListener('click', home);
  document.querySelector('#share')!.addEventListener('click', share);
  document.querySelector('#code')!.addEventListener('click', share);
  document.querySelector('#undo')!.addEventListener('click', () => {
    if (busy || !undo.length) return;
    state = undo.pop()!;
    appliedMoves.pop();
    saveSession();
    currentChain = 0;
    renderGame();
  });
  document.querySelector('#reset')!.addEventListener('click', () => {
    if (busy) return;
    state = initialState(p.board);
    undo = [];
    appliedMoves = [];
    saveSession();
    currentChain = 0;
    renderGame();
  });
  document.querySelector('#hint')!.addEventListener('click', () => void hint());
  updateControls();
  if (p.request.mode === 'campaign' && p.request.key === '1') boardView.hint([p.solution.moves[0]]);
}
function updateControls() {
  for (const id of ['undo', 'reset', 'hint']) {
    const b = document.querySelector<HTMLButtonElement>(`#${id}`);
    if (b)
      b.disabled = busy || (id === 'undo' && !undo.length) || (id === 'hint' && !!state && cleared(state));
  }
}
async function tap(id: number) {
  if (busy || !active || !state || !state.hp[id]) return;
  const token = screen,
    p = active;
  const t = transition(p.board, state, id);
  if (t.overflow) {
    toast('光の上限に達しました。別の起点を選んでください。');
    return;
  }
  undo.push(structuredClone(state));
  busy = true;
  updateControls();
  document.querySelector('#status')!.textContent = '光をつないでいます…';
  document.querySelector('#taps')!.textContent = String(t.state.taps);
  await boardView!.play(t, save.settings.motion, (n) => {
    currentChain = n;
    document.querySelector('#chain')!.innerHTML = `CHAIN <b>×${n}</b>`;
    if (save.settings.sound) tone(save.settings.reducedSound ? 1 : n, save.settings.volume);
    if (n >= 7 && save.settings.haptics) navigator.vibrate?.(12);
  });
  if (screen !== token) return;
  state = t.state;
  save.maxChain = Math.max(save.maxChain, t.chain);
  appliedMoves.push(id);
  saveSession();
  busy = false;
  boardView!.update(state);
  updateControls();
  if (cleared(state)) finish();
  else {
    document.querySelector('#status')!.textContent =
      `あと ${state.hp.filter(Boolean).length} CORE。次の起点を探そう。`;
    document.querySelector('#announce')!.textContent = document.querySelector('#status')!.textContent!;
  }
}
async function hint() {
  if (busy || !active || !state) return;
  const token = screen;
  busy = true;
  updateControls();
  try {
    const result = await job<Solution>({ type: 'solve', board: active.board, state });
    if (token !== screen) return;
    if (result.moves.length) {
      boardView!.hint([result.moves[0]]);
      toast(`光っている CORE がヒント。ここから最短 ${result.par} TAP。`);
    } else toast(result.complete ? 'すべて消去済みです。' : 'この盤面のヒントを計算しきれませんでした。');
  } catch (e) {
    toast((e as Error).message);
  } finally {
    if (token === screen) {
      busy = false;
      updateControls();
    }
  }
}
function saveSession() {
  if (active) {
    save.session = { code: active.code, moves: [...appliedMoves] };
    writeSave();
  }
}
function finish() {
  if (!active || !state) return;
  const p = active;
  const perfect = state.taps === p.solution.par;
  if (perfect && !save.perfect.includes(p.code)) save.perfect.push(p.code);
  save.session = undefined;
  save.best[p.code] = Math.min(save.best[p.code] ?? Infinity, state.taps);
  save.maxChain = Math.max(save.maxChain, currentChain);
  if (p.request.mode === 'campaign') save.stage = Math.max(save.stage, Number(p.request.key) + 1);
  writeSave();
  document.querySelector('#status')!.textContent = 'すべての光がつながりました。';
  document.querySelector('#announce')!.textContent = perfect ? 'Perfect cascade!' : 'Clear!';
  const result = document.querySelector('#result')!;
  result.innerHTML = `<div class="clear-card"><span class="clear-symbol">✳</span><div class="eyebrow">${state.taps === 1 ? 'ONE TAP. ALL CONNECTED.' : 'ALL CONNECTED.'}</div><h2>${perfect ? 'PERFECT<br>CASCADE' : state.taps === p.solution.par! + 1 ? 'GREAT<br>CASCADE' : 'STAGE<br>CLEAR'}</h2><p>${state.taps} TAP <i>／</i> CHAIN ×${currentChain}</p><button class="primary" id="next">${p.request.mode === 'daily' ? 'もうひとつ遊ぶ' : '次のパズルへ'} <b>→</b></button><button class="text-button" id="replay">もう一度ひらめく ↶</button><div class="clear-extras"><button id="favorite">◇ お気に入り</button><button id="rate">このパズルを評価</button></div></div>`;
  document
    .querySelector('#next')!
    .addEventListener('click', () =>
      p.request.mode === 'campaign'
        ? void start(campaignRequest(Number(p.request.key) + 1))
        : p.request.mode === 'daily'
          ? infinite()
          : void start(nextInfinite ?? { ...p.request, key: newSeed() }),
    );
  document.querySelector('#replay')!.addEventListener('click', () => {
    state = initialState(p.board);
    undo = [];
    appliedMoves = [];
    saveSession();
    renderGame();
  });
  document.querySelector('#favorite')!.addEventListener('click', () => {
    if (!save.favorites.includes(p.code)) {
      save.favorites.push(p.code);
      writeSave();
    }
    toast('コレクションに保存しました。');
  });
  document.querySelector('#rate')!.addEventListener('click', () => ratePuzzle(p.code));
  document.querySelector<HTMLButtonElement>('#next')!.focus();
}
function newSeed() {
  return Array.from(crypto.getRandomValues(new Uint32Array(2)), (n) => n.toString(36))
    .join('')
    .toUpperCase();
}
function modal(title: string, html: string) {
  document.querySelector('dialog')?.remove();
  const d = document.createElement('dialog');
  d.innerHTML = `<div class="dialog-head"><h2>${title}</h2><button class="icon-button" id="close-dialog" aria-label="閉じる">×</button></div>${html}`;
  document.body.append(d);
  d.querySelector('#close-dialog')!.addEventListener('click', () => d.close());
  d.addEventListener('click', (e) => {
    if (e.target === d) {
      const r = d.getBoundingClientRect();
      if (
        (e as MouseEvent).clientX < r.left ||
        (e as MouseEvent).clientX > r.right ||
        (e as MouseEvent).clientY < r.top ||
        (e as MouseEvent).clientY > r.bottom
      )
        d.close();
    }
  });
  d.addEventListener('close', () => d.remove());
  d.showModal();
  return d;
}
function infinite() {
  const d = modal(
    'INFINITE',
    '<p class="dialog-intro">今日は、どんなひらめきに出会おう。</p><div class="difficulty-list">' +
      [
        ['easy', 'EASY', '気軽に、心地よい連鎖を。'],
        ['normal', 'NORMAL', '少し考えて、きれいにつなぐ。'],
        ['hard', 'HARD', '起点と順番を、じっくり読む。'],
        ['expert', 'EXPERT', '変わる道筋。その先を見抜く。'],
        ['extreme', 'EXTREME', 'すべてのつながりを、読み解く。'],
      ]
        .map(
          ([v, n, t]) =>
            `<button data-difficulty="${v}"><span><strong>${n}</strong><small>${t}</small></span><b>→</b></button>`,
        )
        .join('') +
      '</div>',
  );
  d.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach((b) =>
    b.addEventListener('click', () => {
      d.close();
      void start({
        mode: 'infinite',
        key: newSeed(),
        difficulty: b.dataset.difficulty as Request['difficulty'],
      });
    }),
  );
}
function enterCode() {
  const d = modal(
    'PUZZLE CODE',
    '<p class="dialog-intro">同じコードから、同じパズルがはじまります。</p><form id="code-form"><label>コードまたは共有 URL<input id="code-input" required placeholder="PC1-I-N-…" autocomplete="off" maxlength="500"></label><p class="form-error" id="code-error" role="alert"></p><button class="primary">パズルを開く →</button></form>',
  );
  d.querySelector('form')!.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      let code = d.querySelector<HTMLInputElement>('input')!.value.trim();
      if (code.startsWith('https://') || code.startsWith('http://'))
        code = new URL(code).searchParams.get('p') ?? '';
      const r = parseCode(code);
      d.close();
      void start(r);
    } catch (e) {
      d.querySelector('#code-error')!.textContent = (e as Error).message;
    }
  });
}
function stages() {
  const from = Math.max(1, save.stage - 29),
    to = save.stage;
  const d = modal(
    'CAMPAIGN',
    `<p class="dialog-intro">あなたの光の軌跡。クリアしたステージをもう一度。</p><div class="stage-list">${Array.from({ length: to - from + 1 }, (_, i) => `<button data-stage="${from + i}">${from + i}<small>${from + i < save.stage ? '✓' : '→'}</small></button>`).join('')}</div><form id="stage-form"><label>ステージ番号（1〜${save.stage}）<input type="number" min="1" max="${save.stage}" value="${save.stage}" required></label><button class="primary">開く →</button></form>`,
  );
  d.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach((b) =>
    b.addEventListener('click', () => {
      d.close();
      void start(campaignRequest(Number(b.dataset.stage)));
    }),
  );
  d.querySelector('form')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const n = Number(d.querySelector('input')!.value);
    if (n >= 1 && n <= save.stage) {
      d.close();
      void start(campaignRequest(n));
    }
  });
}
function settings() {
  const d = modal(
    'SETTINGS',
    `<div class="setting-row"><span>サウンド<small>連鎖に合わせて音が重なります</small></span><input id="sound" type="checkbox" ${save.settings.sound ? 'checked' : ''} aria-label="サウンド"></div><div class="setting-row"><label for="volume">音量</label><input id="volume" type="range" min="0" max="1" step="0.05" value="${save.settings.volume}"></div><div class="setting-row"><span>アニメーション<small>オフで動きを控えめに</small></span><input id="motion" type="checkbox" ${save.settings.motion ? 'checked' : ''} aria-label="アニメーション"></div><div class="setting-row"><span>ハイコントラスト</span><input id="contrast" type="checkbox" ${save.settings.contrast ? 'checked' : ''} aria-label="ハイコントラスト"></div><div class="setting-row"><span>控えめなサウンド</span><input id="reducedSound" type="checkbox" ${save.settings.reducedSound ? 'checked' : ''} aria-label="控えめなサウンド"></div><div class="setting-row"><span>振動<small>対応している端末のみ</small></span><input id="haptics" type="checkbox" ${save.settings.haptics ? 'checked' : ''} aria-label="振動"></div><div class="save-actions"><button id="export">記録を書き出す ↗</button><label class="import-label">記録を読み込む<input id="import" type="file" accept="application/json" class="sr-only"></label></div><p class="privacy-note">記録はこのブラウザに保存されます。<br>ログイン不要。プレイデータを外部に送信しません。</p>`,
  );
  for (const key of ['sound', 'motion', 'contrast', 'haptics', 'reducedSound'] as const)
    d.querySelector<HTMLInputElement>(`#${key}`)!.addEventListener('change', (e) => {
      save.settings[key] = (e.target as HTMLInputElement).checked;
      applySettings();
      writeSave();
    });
  d.querySelector<HTMLInputElement>('#volume')!.addEventListener('input', (e) => {
    save.settings.volume = Number((e.target as HTMLInputElement).value);
    writeSave();
  });
  d.querySelector('#export')!.addEventListener('click', () =>
    download('pulse-chain-save.json', JSON.stringify(save, null, 2)),
  );
  d.querySelector<HTMLInputElement>('#import')!.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      if (file.size > 2e6) throw Error('ファイルが大きすぎます');
      const raw = JSON.parse(await file.text());
      if (raw.version !== 1) throw Error('対応していない保存形式です');
      const imported = migrate(raw);
      save.stage = Math.max(save.stage, imported.stage);
      save.maxChain = Math.max(save.maxChain, imported.maxChain);
      for (const [k, v] of Object.entries(imported.best))
        save.best[k] = Math.min(save.best[k] ?? Infinity, v);
      save.perfect = [...new Set([...save.perfect, ...imported.perfect])];
      save.favorites = [...new Set([...save.favorites, ...imported.favorites])];
      Object.assign(save.ratings, imported.ratings);
      writeSave();
      d.close();
      toast('記録を統合しました。');
    } catch (e) {
      toast((e as Error).message);
    }
  });
}
function download(name: string, data: string) {
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function help() {
  modal(
    'HOW TO PLAY',
    '<div class="help-steps"><div><b>01</b><h3>ひとつ、選ぶ。</h3><p>光る CORE をタップ。光が8方向へ走ります。</p></div><div><b>02</b><h3>光が、つながる。</h3><p>ほかの CORE に当たると次の光が生まれます。数字つきの CORE は、数字の回数だけ光を当てましょう。直接タップすると一度で起爆します。</p></div><div><b>03</b><h3>すべて消して、クリア。</h3><p>表示された最小 TAP で消せば PERFECT CASCADE。UNDO と HINT は何度でも使えます。</p></div></div><p class="privacy-note">キーボード：Tab で選択、矢印キーで盤面移動、Enter / Space で起爆。<br>DAILY は UTC 0:00（日本時間 9:00）に切り替わります。</p>',
  );
}
function share() {
  if (!active) return;
  const url = new URL(location.href);
  url.searchParams.set('p', active.code);
  const d = modal(
    'このひらめきを、シェア。',
    `<p class="dialog-intro">${active.solution.par} TAP で、全部つなげられる？</p><label>PUZZLE CODE<input readonly id="share-code"></label><label>共有リンク<input readonly id="share-url"></label><button class="primary" id="copy">リンクをコピー ↗</button><p class="form-error" role="status" id="copy-status"></p>`,
  );
  d.querySelector<HTMLInputElement>('#share-code')!.value = active.code;
  d.querySelector<HTMLInputElement>('#share-url')!.value = url.href;
  d.querySelector('#copy')!.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url.href);
      d.querySelector('#copy-status')!.textContent = 'コピーしました。';
    } catch {
      d.querySelector<HTMLInputElement>('#share-url')!.select();
      d.querySelector('#copy-status')!.textContent = 'リンクを選択しました。コピーしてください。';
    }
  });
}
function dailyMenu() {
  const progress = dailyProgress(save.best);
  const today = utcDay();
  const d = modal(
    'DAILY PUZZLE',
    `<p class="dialog-intro">世界中で、今日ひとつのパズル。<br>${today.replaceAll('-', '.')} · UTC</p><div class="daily-stats"><strong>${progress.days.length}<small>遊んだ日</small></strong><strong>${progress.streak}<small>日つながった光</small></strong></div><div class="daily-calendar">${recentDays()
      .map(
        (day) =>
          `<span class="${progress.set.has(day) ? 'done' : ''}" title="${day}">${day.slice(8)}<i>${progress.set.has(day) ? '✳' : '·'}</i></span>`,
      )
      .join(
        '',
      )}</div><button id="play-daily" class="primary">${progress.set.has(today) ? '今日のパズルをもう一度' : '今日のパズルを遊ぶ'} →</button><p class="privacy-note">毎日 日本時間 9:00 に新しいパズル。<br>休んだ日も、いつでも戻ってきてください。</p>`,
  );
  d.querySelector('#play-daily')!.addEventListener('click', () => {
    d.close();
    void start({ mode: 'daily', key: today, difficulty: 'normal' });
  });
}
function collection() {
  const d = modal(
    'COLLECTION',
    `<p class="dialog-intro">お気に入りのひらめきを、何度でも。<br>PERFECT CASCADE : ${save.perfect.length}</p><div class="favorite-list">${
      save.favorites.length
        ? save.favorites
            .slice()
            .reverse()
            .map((c) => `<button data-puzzle="${c}">◇ ${c}<span>→</span></button>`)
            .join('')
        : '<p class="privacy-note">クリア画面の「お気に入り」で保存できます。</p>'
    }</div>`,
  );
  d.querySelectorAll<HTMLButtonElement>('[data-puzzle]').forEach((b) =>
    b.addEventListener('click', () => {
      d.close();
      void start(parseCode(b.dataset.puzzle!));
    }),
  );
}
function ratePuzzle(code: string) {
  const d = modal(
    'このひらめき、どうだった？',
    '<p class="dialog-intro">また遊びたいと思った度合いを教えてください。<br>評価はこの端末の記録に保存されます。</p><div class="rating">' +
      [1, 2, 3, 4, 5].map((n) => '<button data-rating="' + n + '">' + n + '</button>').join('') +
      '</div><div class="rating-labels"><span>いまひとつ</span><span>とてもよかった</span></div>',
  );
  d.querySelectorAll<HTMLButtonElement>('[data-rating]').forEach((b) =>
    b.addEventListener('click', () => {
      save.ratings[code] = Number(b.dataset.rating);
      writeSave();
      d.close();
      toast('評価を保存しました。');
    }),
  );
}
const incoming = new URLSearchParams(location.search).get('p');
if (incoming) {
  try {
    void start(parseCode(incoming));
  } catch (e) {
    home();
    toast((e as Error).message);
  }
} else home();
if ('serviceWorker' in navigator && import.meta.env.PROD)
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(() => toast('オフライン保存ができませんでした。オンラインで遊べます。'));
  });
