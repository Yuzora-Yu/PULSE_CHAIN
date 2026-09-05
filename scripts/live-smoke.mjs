import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await c.newPage();
p.setDefaultTimeout(60000);
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
const rows = [];
for (const code of ['PC1-C-H-91', 'PC1-C-H-141', 'PC1-C-X-451', 'PC1-C-Z-901', 'PC1-I-Z-RELEASE']) {
  const start = Date.now();
  const r = await p.goto('https://yu-zora.com/games/PULSE_CHAIN/?p=' + code);
  await p.locator('.core').first().waitFor();
  await p.getByRole('button', { name: '設定', exact: true }).click();
  await p.getByRole('checkbox', { name: 'アニメーション', exact: true }).uncheck();
  await p.getByRole('button', { name: '閉じる', exact: true }).click();
  let taps = 0;
  while (!(await p.locator('.clear-card').count()) && taps < 20) {
    await p.locator('#hint').click();
    await p.locator('.core.hint').waitFor();
    await p.locator('.core.hint').click();
    await p.waitForFunction(() => !document.querySelector('#reset').disabled);
    taps++;
  }
  assert.match(await p.locator('.clear-card h2').innerText(), /PERFECT/);
  rows.push({ code, status: r.status(), taps, totalMs: Date.now() - start });
}
assert.equal(errors.length, 0);
await fs.writeFile(
  'docs/live-results.json',
  JSON.stringify({ testedAt: new Date().toISOString(), rows, errors }, null, 2),
);
console.log(JSON.stringify(rows));
await b.close();
