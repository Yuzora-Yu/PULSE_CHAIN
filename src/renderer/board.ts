import { cellKey, type Board, type Event, type State, type Transition } from '../core/model';
import { mechanics, tileSymbol } from '../core/mechanics';

export class BoardView {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private layer: HTMLElement;
  private frame = 0;
  private buttons: HTMLButtonElement[] = [];
  private tiles: HTMLElement[] = [];
  private cancelPlayback?: () => void;
  constructor(
    private host: HTMLElement,
    private board: Board,
    private onTap: (id: number) => void,
  ) {
    host.innerHTML =
      '<div class="cells" aria-hidden="true"></div><div class="objects"></div><canvas aria-hidden="true"></canvas>';
    this.layer = host.querySelector('.objects')!;
    this.canvas = host.querySelector('canvas')!;
    this.canvas.width = 840;
    this.canvas.height = 840;
    this.context = this.canvas.getContext('2d')!;
    const voids = new Set(board.voids.map(cellKey));
    const cells = host.querySelector('.cells')!;
    for (let y = 0; y < board.rows; y++)
      for (let x = 0; x < board.cols; x++) {
        if (voids.has(`${x},${y}`)) continue;
        const cell = document.createElement('i');
        cell.className = 'cell';
        this.position(cell, x, y);
        cells.append(cell);
      }
    board.tiles.forEach((t) => {
      const tile = document.createElement('div');
      tile.className = `tile ${t.kind}`;
      tile.innerHTML = `<span>${tileSymbol(t)}</span>`;
      tile.title = mechanics[t.kind].name + ' · ' + mechanics[t.kind].description;
      this.position(tile, t.x, t.y);
      this.layer.append(tile);
      this.tiles.push(tile);
    });
    board.cores.forEach((c, id) => {
      const b = document.createElement('button');
      b.className = `core ${c.hp > 1 ? 'armor' : ''}`;
      b.dataset.core = String(id);
      b.innerHTML = `<span>${c.hp > 1 ? c.hp : '<i></i>'}</span>`;
      this.position(b, c.x, c.y);
      b.addEventListener('click', () => onTap(id));
      b.addEventListener('keydown', (e) => {
        const delta = (
          { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] } as Record<
            string,
            number[]
          >
        )[e.key];
        if (!delta) return;
        e.preventDefault();
        const candidates = board.cores
          .map((p, i) => ({ p, i, score: Math.abs(p.x - c.x) + Math.abs(p.y - c.y) }))
          .filter(
            ({ p, i }) => !this.buttons[i].disabled && (p.x - c.x) * delta[0] + (p.y - c.y) * delta[1] > 0,
          )
          .sort((a, b) => a.score - b.score);
        if (candidates[0]) this.buttons[candidates[0].i].focus();
      });
      this.buttons.push(b);
      this.layer.append(b);
    });
  }
  private position(el: HTMLElement, x: number, y: number) {
    const { cols, rows } = this.board;
    el.style.left = `${((x + 0.5) / cols) * 100}%`;
    el.style.top = `${((y + 0.5) / rows) * 100}%`;
    el.style.width = `${100 / cols}%`;
    el.style.height = `${100 / rows}%`;
  }
  update(state: State, locked = false) {
    this.tiles.forEach(
      (t, i) => (t.innerHTML = `<span>${tileSymbol(this.board.tiles[i], state.devices[i])}</span>`),
    );
    this.buttons.forEach((b, id) => {
      const hp = state.hp[id];
      b.disabled = locked || !hp;
      b.classList.toggle('gone', !hp);
      b.classList.toggle('armor', hp > 1);
      b.classList.remove('hint', 'hit');
      b.innerHTML = `<span>${hp > 1 ? hp : '<i></i>'}</span>`;
      const c = this.board.cores[id];
      b.setAttribute('aria-label', `CORE ${id + 1}, ${c.x + 1}列 ${c.y + 1}行, HP ${hp}`);
    });
  }
  hint(ids: number[]) {
    for (const id of ids) this.buttons[id]?.classList.add('hint');
  }
  destroy() {
    cancelAnimationFrame(this.frame);
    this.cancelPlayback?.();
  }
  async play(t: Transition, motion: boolean, onChain: (n: number) => void) {
    this.buttons.forEach((b) => (b.disabled = true));
    const duration = motion ? 85 : 25,
      start = performance.now();
    let processed = 0,
      chain = 0;
    const ordered = t.events.filter((e) => e.type !== 'move').sort((a, b) => a.tick - b.tick);
    const moves = t.events.filter((e): e is Extract<Event, { type: 'move' }> => e.type === 'move');
    return new Promise<void>((resolve) => {
      this.cancelPlayback = resolve;
      const render = (now: number) => {
        const tick = (now - start) / duration;
        while (processed < ordered.length && ordered[processed].tick <= tick) {
          const e = ordered[processed++];
          if (e.type === 'device')
            this.tiles[e.id].innerHTML = `<span>${tileSymbol(this.board.tiles[e.id], e.value)}</span>`;
          if (e.type === 'explode') {
            this.buttons[e.id].classList.add('gone');
            onChain(++chain);
          }
          if (e.type === 'hit' && e.hp > 0) {
            const b = this.buttons[e.id];
            b.innerHTML = `<span>${e.hp > 1 ? e.hp : '<i></i>'}</span>`;
            b.classList.toggle('armor', e.hp > 1);
            b.classList.add('hit');
          }
        }
        const ctx = this.context;
        ctx.clearRect(0, 0, 840, 840);
        if (motion) {
          ctx.globalCompositeOperation = 'lighter';
          for (const e of ordered) {
            if (e.type !== 'teleport' && e.type !== 'reflect' && e.type !== 'split') continue;
            const age = tick - e.tick;
            if (age < 0 || age > 2) continue;
            ctx.globalAlpha = 1 - age / 2;
            ctx.strokeStyle = e.type === 'teleport' ? '#f4a0e0' : e.type === 'split' ? '#df9fff' : '#c3cbff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(
              ((e.at.x + 0.5) / this.board.cols) * 840,
              ((e.at.y + 0.5) / this.board.rows) * 840,
              6 + age * 9,
              0,
              Math.PI * 2,
            );
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          for (const e of moves) {
            const f = tick - e.tick;
            if (f < 0 || f > 1) continue;
            const x = ((e.from.x + (e.to.x - e.from.x) * f + 0.5) / this.board.cols) * 840,
              y = ((e.from.y + (e.to.y - e.from.y) * f + 0.5) / this.board.rows) * 840;
            ctx.strokeStyle = '#4ef1db88';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x - (e.to.x - e.from.x) * 12, y - (e.to.y - e.from.y) * 12);
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.fillStyle = '#dbfff8';
            ctx.shadowBlur = 18;
            ctx.shadowColor = '#5cffe1';
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
          for (const e of ordered) {
            if (e.type !== 'explode') continue;
            const age = tick - e.tick;
            if (age < 0 || age > 4) continue;
            const core = this.board.cores[e.id],
              x = ((core.x + 0.5) / this.board.cols) * 840,
              y = ((core.y + 0.5) / this.board.rows) * 840;
            ctx.globalAlpha = (1 - age / 4) * 0.7;
            ctx.strokeStyle = '#8affdf';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 12 + age * 14, 0, Math.PI * 2);
            ctx.stroke();
            for (let k = 0; k < 8; k++) {
              const a = (k * Math.PI) / 4 + e.id;
              ctx.fillStyle = '#9bffe2';
              ctx.fillRect(x + Math.cos(a) * age * 16, y + Math.sin(a) * age * 16, 3, 3);
            }
            ctx.globalAlpha = 1;
          }
          ctx.globalCompositeOperation = 'source-over';
        }
        if (tick < t.ticks + 4) this.frame = requestAnimationFrame(render);
        else {
          ctx.clearRect(0, 0, 840, 840);
          this.cancelPlayback = undefined;
          resolve();
        }
      };
      this.frame = requestAnimationFrame(render);
    });
  }
}
