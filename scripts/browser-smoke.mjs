import { chromium, firefox, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = process.env.TEST_URL ?? 'http://127.0.0.1:5173/games/PULSE_CHAIN/';
const results = [];
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  let browser;
  try {
    browser = await engine.launch();
  } catch (error) {
    results.push({ browser: name, unavailable: String(error).split('\n')[0] });
    continue;
  }
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
      hasTouch: mobile,
    });
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base);
    await page.getByRole('button', { name: /つづきから/ }).click();
    await page.locator('.core').first().waitFor();
    await page.screenshot({ path: `docs/game-${name}-${mobile ? 'mobile' : 'desktop'}.png`, fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('.core.hint').click();
    await page.locator('.clear-card').waitFor();
    assert.match(await page.locator('.clear-card h2').innerText(), /PERFECT/);
    await page.locator('#next').click();
    await page.locator('.game-heading h1').filter({ hasText: '002' }).waitFor();
    await page.getByRole('button', { name: '設定', exact: true }).click();
    await page.getByRole('checkbox', { name: 'アニメーション', exact: true }).uncheck();
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    await page.locator('#hint').click();
    await page.locator('.core.hint').waitFor();
    await page.locator('.core.hint').click();
    await page.locator('.clear-card').waitFor();
    await page.reload();
    await page.locator('.game-heading').waitFor();
    assert.equal(errors.length, 0, errors.join('\n'));
    await page.getByRole('button', { name: 'ホーム', exact: true }).first().click();
    await page.locator('#infinite').click();
    await page.locator('[data-difficulty="normal"]').click();
    await page.locator('.core').first().waitFor();
    await page.locator('#hint').click();
    await page.locator('.core.hint').waitFor();
    await page.locator('.core.hint').click();
    await page.waitForFunction(() => !document.querySelector('#reset').disabled);
    await page.locator('#undo').click();
    assert.equal(await page.locator('#taps').textContent(), '0');
    await page.locator('#share').click();
    assert.match(await page.locator('#share-code').inputValue(), /^PC1-I-N-/);
    await page.keyboard.press('Escape');
    results.push({ browser: name, mobile, errors });
    await context.close();
  }
  await browser.close();
}
await fs.writeFile(
  'docs/browser-results.json',
  JSON.stringify({ testedAt: new Date().toISOString(), results }, null, 2),
);
console.log(JSON.stringify(results));
if (process.env.STRICT_BROWSERS && results.some((r) => 'unavailable' in r)) process.exitCode = 1;
