// Playwright smoke (GAME-STANDARD §7): load, start, 10 s with the keyboard, 10 s with touch, 0 console errors,
// 0 CSP violations under the hub's policy. Plus the shell rules (§3) and both save levels (§5).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { gameCsp } from './hub-csp.mjs';

const SAVE_KEY = 'game.template.v1';

/** Collects everything that must stay empty: console errors, page errors, CSP violations. */
async function watch(page: Page, allow: RegExp[] = []) {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !allow.some((re) => re.test(m.text() + ' ' + (m.location().url || '')))) {
      problems.push(`console: ${m.text()}`);
    }
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  return problems;
}

async function startSlot(page: Page, tap = false) {
  const click = (sel: string) => (tap ? page.locator(sel).first().tap() : page.locator(sel).first().click());
  await click('#play-btn');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'slots');
  await click('#slot-list .slot');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'play');
}

const screen = (page: Page) => page.locator('body').getAttribute('data-screen');

test('GAME-STANDARD §4: one inline <script>, no eval, no inline handlers, no external URLs', async ({}, info) => {
  test.skip(info.project.name !== 'desktop');
  const html = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');
  expect(html).toContain('<html lang="el">');
  expect(html.match(/<script\b/gi)).toHaveLength(1);
  expect(html).not.toMatch(/<script\b[^>]*\bsrc=/i);
  expect(html).not.toMatch(/<[a-z][^>]*\son[a-z]+\s*=/i);
  expect(html).not.toMatch(/\beval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*['"`]/);
  expect(html).not.toMatch(/(?:src|href)\s*=\s*["']?(?:https?:)?\/\//i);
  expect(html).not.toMatch(/@import|fonts\.googleapis|cdn\./i);
  expect(html).toContain('<link rel="stylesheet" href="/static/fonts/comfortaa.css">');
  expect(html).toMatch(/const CONFIG = Object\.freeze\(\{/);
});

test('keyboard: 10 s of play, abilities, pause, sound, 0 errors', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const problems = await watch(page);
  await page.goto('/');
  await expect(page.locator('#title-screen')).toBeVisible();
  for (const id of ['#pause-btn', '#sound-btn', '#full-btn', '#home-btn']) await expect(page.locator(id)).toBeVisible();
  await expect(page.locator('#home-btn')).toHaveAttribute('href', '/');
  await startSlot(page);

  const moves = ['ArrowRight', 'ArrowDown', 'KeyA', 'KeyW', 'ArrowLeft', 'KeyS', 'KeyD', 'ArrowUp'];
  const end = Date.now() + 10_000;
  for (let i = 0; Date.now() < end; i++) {
    if ((await screen(page)) !== 'play') {
      // Νίκη ή ήττα μέσα στα 10 δευτ.: συνεχίζουμε όπως ένα παιδί
      await page.locator('#again-btn:visible, #retry-btn:visible').first().click();
    }
    const key = moves[i % moves.length];
    await page.keyboard.down(key);
    await page.keyboard.press(String((i % 4) + 1));
    if (i % 5 === 0) await page.keyboard.press('Space');
    await page.waitForTimeout(400);
    await page.keyboard.up(key);
  }

  await page.keyboard.press('KeyP');
  await expect(page.locator('#pause-screen')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'play');
  await page.keyboard.press('KeyM');
  await expect(page.locator('#sound-btn')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#sound-btn').click();
  await expect(page.locator('#sound-btn')).toHaveAttribute('aria-pressed', 'true');
  expect(problems).toEqual([]);
});

test('touch: joystick + ability buttons for 10 s, 0 errors', async ({ page }, info) => {
  test.skip(info.project.name !== 'tablet');
  const problems = await watch(page);
  await page.goto('/');
  await startSlot(page, true);
  await expect(page.locator('#stick')).toBeVisible();
  for (const b of await page.locator('.ab').all()) {
    const box = await b.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(64);
    expect(box!.height).toBeGreaterThanOrEqual(64);
  }

  const cdp = await page.context().newCDPSession(page);
  const s = (await page.locator('#stick').boundingBox())!;
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  const end = Date.now() + 10_000;
  for (let round = 0; Date.now() < end; round++) {
    if ((await screen(page)) !== 'play') await page.locator('#again-btn:visible, #retry-btn:visible').first().tap();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] });
    for (let k = 0; k < 15; k++) {
      const a = (round * 15 + k) / 4;
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: cx + Math.cos(a) * 80, y: cy + Math.sin(a) * 80, id: 1 }],
      });
      await page.waitForTimeout(100);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    if ((await screen(page)) === 'play') await page.locator(`.ab[data-ab="${round % 5}"]`).tap();
  }
  expect(problems).toEqual([]);
});

test('auto-pause when the window loses focus or the tab is hidden', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const problems = await watch(page);
  await page.goto('/');
  await startSlot(page);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#pause-screen')).toBeVisible();
  await page.locator('#resume-btn').click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#pause-screen')).toBeVisible();
  expect(problems).toEqual([]);
});

test('portrait tablet shows the rotate hint', async ({ page }, info) => {
  test.skip(info.project.name !== 'tablet');
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('/');
  await expect(page.locator('#rotate')).toBeVisible();
  await page.setViewportSize({ width: 1180, height: 820 });
  await expect(page.locator('#rotate')).toBeHidden();
});

test('level A: progress and sound setting survive a reload; broken storage does not crash', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const problems = await watch(page);
  await page.goto('/');
  await startSlot(page);
  await page.keyboard.press('KeyP');
  await page.locator('#save-btn').click();
  await expect(page.locator('#save-msg')).toHaveText('Αποθηκεύτηκε ✔');
  await page.keyboard.press('KeyM');
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), SAVE_KEY);
  expect(saved.v).toBe(1);
  expect(saved.sound).toBe(false);
  expect(saved.slots.local[0].data).toEqual(expect.objectContaining({ stars: expect.any(Number) }));
  expect(saved.slots.local).toHaveLength(3);

  await page.reload();
  await expect(page.locator('#sound-btn')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#play-btn').click();
  await expect(page.locator('#slot-list .slot').first()).toContainText('⭐');
  await expect(page.locator('#slot-list .slot').nth(1)).toContainText('κενή');

  await page.evaluate((k) => localStorage.setItem(k, '{not json'), SAVE_KEY);
  await page.reload();
  await startSlot(page);
  expect(problems).toEqual([]);
});

/** Serves index.html with CONFIG.save.server = true and the hub's CSP for a game with saves. */
async function serverMode(page: Page) {
  await page.route(
    (url) => url.pathname === '/',
    async (route) => {
      const res = await route.fetch();
      const html = (await res.text()).replace('server: false,', 'server: true,');
      expect(html).toContain('server: true,');
      await route.fulfill({
        response: res,
        body: html,
        headers: { ...res.headers(), 'content-security-policy': gameCsp(html, { saves: true }) },
      });
    },
  );
}

/** In-memory fake of the hub save API (games-hub app/api/saves.py). */
function fakeHub(page: Page) {
  const hub = { unlocked: false, down: false, profiles: [] as { id: number; name: string }[], saves: new Map<string, unknown>() };
  page.route('**/api/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (hub.down) return route.abort();
    const json = (status: number, body?: unknown) =>
      route.fulfill({ status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });
    if (path === '/api/unlock') {
      hub.unlocked = req.postDataJSON().pin === '1234';
      return json(hub.unlocked ? 204 : 401, hub.unlocked ? undefined : { error: { code: 'UNAUTHORIZED' } });
    }
    if (!hub.unlocked) return json(401, { error: { code: 'UNAUTHORIZED' } });
    if (path === '/api/profiles' && req.method() === 'GET') return json(200, { profiles: hub.profiles });
    if (path === '/api/profiles' && req.method() === 'POST') {
      const p = { id: hub.profiles.length + 1, name: req.postDataJSON().name };
      hub.profiles.push(p);
      return json(201, p);
    }
    const m = path.match(/^\/api\/save\/template\/(\d+)\/([1-3])$/);
    if (!m) return json(404);
    if (req.method() === 'PUT') {
      hub.saves.set(`${m[1]}/${m[2]}`, req.postDataJSON());
      return json(204);
    }
    const s = hub.saves.get(`${m[1]}/${m[2]}`);
    return s ? json(200, s) : json(404, { error: { code: 'NOT_FOUND' } });
  });
  return hub;
}

// The browser logs every 4xx/5xx and every aborted fetch as a console error; for the save API that is expected.
const API_NOISE = [/\/api\//];

test('level B: unlock with the family PIN, pick a profile, save to the hub', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const problems = await watch(page, API_NOISE);
  await serverMode(page);
  const hub = fakeHub(page);
  await page.goto('/');
  await page.locator('#play-btn').click();
  await expect(page.locator('#unlock-box')).toBeVisible();
  await page.locator('#pin').fill('9999');
  await page.locator('#unlock-btn').click();
  await expect(page.locator('#server-msg')).toHaveText('Λάθος κωδικός');
  await page.locator('#pin').fill('1234');
  await page.locator('#unlock-btn').click();
  await expect(page.locator('#profile-box')).toBeVisible();
  await page.locator('#new-profile').fill('Αριάνα');
  await page.locator('#add-profile').click();
  await page.locator('#profile-list button', { hasText: 'Αριάνα' }).click();
  await page.locator('#slot-list .slot').first().click();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'play');
  await page.keyboard.press('KeyP');
  await page.locator('#save-btn').click();
  await expect.poll(() => hub.saves.get('1/1')).toEqual(
    expect.objectContaining({ schema: 1, saved_at: expect.any(Number), data: expect.objectContaining({ stars: expect.any(Number) }) }),
  );

  // The hub goes away: the save stays on the device (dirty) and is sent after the next visit.
  hub.down = true;
  await page.locator('#save-btn').click();
  await expect(page.locator('#save-msg')).toHaveText('Αποθηκεύτηκε ✔');
  const dirty = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).slots['1'][0], SAVE_KEY);
  expect(dirty.dirty).toBe(true);
  hub.down = false;
  await page.reload();
  await page.locator('#play-btn').click();
  await expect.poll(() => (hub.saves.get('1/1') as { saved_at: number }).saved_at).toBe(dirty.saved_at);
  expect(problems).toEqual([]);
});

test('level B: hub unreachable -> the game still starts and saves on the device', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const problems = await watch(page, API_NOISE);
  await serverMode(page);
  const hub = fakeHub(page);
  hub.down = true;
  await page.goto('/');
  await page.locator('#play-btn').click();
  await expect(page.locator('#server-msg')).toContainText('δεν απαντά');
  await page.locator('#slot-list .slot').first().click();
  await page.keyboard.press('KeyP');
  await page.locator('#save-btn').click();
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
  expect(saved.slots.local[0].dirty).toBe(false);
  expect(problems).toEqual([]);
});
