import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage(),
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const base = 'http://127.0.0.1:4173/games/PULSE_CHAIN/';
await page.goto(base + '?p=PC1-I-N-OFFLINE');
await page.locator('.core:not(.gone)').first().waitFor();
await page.evaluate(async () => {
  await navigator.serviceWorker.ready;
});
await page.reload();
await page.locator('.core:not(.gone)').first().waitFor();
await page.getByRole('button', { name: '設定', exact: true }).click();
await page.getByRole('checkbox', { name: 'アニメーション', exact: true }).uncheck();
await page.getByRole('button', { name: '閉じる', exact: true }).click();
await page.locator('#hint').click();
await page.locator('.core.hint').waitFor();
await page.locator('.core.hint').click();
await page.waitForFunction(() => !document.querySelector('#reset').disabled);
assert.equal(await page.locator('#taps').textContent(), '1');
const live = await page.locator('.core:not(.gone)').count();
await context.setOffline(true);
await page.reload();
await page.locator('.core:not(.gone)').first().waitFor();
assert.equal(await page.locator('#taps').textContent(), '1');
assert.equal(await page.locator('.core:not(.gone)').count(), live);
await page.locator('#reset').click();
assert.equal(await page.locator('#taps').textContent(), '0');
await page.getByRole('button', { name: 'ホーム', exact: true }).first().click();
await page.locator('#daily').click();
await page.locator('#play-daily').click();
await page.locator('.core:not(.gone)').first().waitFor();
assert.match(await page.locator('.game-heading h1').textContent(), /DAILY/);
await page.getByRole('button', { name: 'ホーム', exact: true }).first().click();
await page.locator('#infinite').click();
await page.locator('[data-difficulty="hard"]').click();
await page.locator('.core:not(.gone)').first().waitFor();
await page.locator('#hint').click();
await page.locator('.core.hint').waitFor();
assert.equal(errors.length, 0, errors.join('\n'));
await fs.writeFile(
  'docs/offline-results.json',
  JSON.stringify(
    {
      testedAt: new Date().toISOString(),
      browser: 'Chromium',
      offlineShell: true,
      restorePartialPuzzle: true,
      offlineDaily: true,
      offlineInfinite: true,
      offlineHint: true,
      errors,
    },
    null,
    2,
  ),
);
await browser.close();
console.log('PASS: offline restart, partial save restore, reset, Daily, Infinite and solver hints.');
