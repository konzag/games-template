// Playwright smoke (GAME-STANDARD §7): load, start, 10 s with the keyboard, 10 s with touch, 0 console errors,
// 0 CSP violations under the hub's policy. Plus the shell rules (§3) and both save levels (§5).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { API_NOISE, SAVE_KEY, fakeHub, screen, serverMode, startSlot, unlockedWithProfile, watch } from './lib';

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

// ===== Level B error paths (GAME-STANDARD §5): the hub answers 401 / 429 / 413; the device save always wins. =====

const LEVEL_A = { v: 1, sound: true, profile: null, slots: { local: [{ saved_at: 1, data: { stars: 7, wins: 2 }, dirty: false }, null, null] } };

/** Puts a level A save on the device before the game reads it (one time only, not on later reloads). */
async function seedLevelA(page: Page) {
  await page.addInitScript(
    ([k, v]) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(k, v);
        sessionStorage.setItem('seeded', '1');
      }
    },
    [SAVE_KEY, JSON.stringify(LEVEL_A)],
  );
}

const stored = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);

async function saveFromPause(page: Page) {
  await page.keyboard.press('KeyP');
  await expect(page.locator('#pause-screen')).toBeVisible();
  await page.locator('#save-btn').click();
  await expect(page.locator('#save-msg')).toHaveText('Αποθηκεύτηκε ✔');
}

/** The game is still alive: back to play, the loop runs, the HUD status is drawn. */
async function stillPlaying(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'play');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowRight');
  await expect(page.locator('body')).toHaveAttribute('data-screen', /play|win|lose/);
  await expect(page.locator('#status')).toContainText('⭐');
}

test('level B: 401 after expiry asks for the PIN again and keeps the local save', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const problems = await watch(page, API_NOISE);
  await seedLevelA(page);
  const hub = await unlockedWithProfile(page);
  hub.override = (path) => (path.startsWith('/api/save/') ? { status: 401, body: { error: { code: 'UNAUTHORIZED' } } } : undefined);
  await page.locator('#slot-list .slot').first().click();
  await saveFromPause(page);
  const after = await stored(page);
  expect(after.slots.local).toEqual(LEVEL_A.slots.local);
  expect(after.slots['1'][0]).toEqual(expect.objectContaining({ dirty: true }));
  await stillPlaying(page);
  expect(problems).toEqual([]);
  // The hub said «not unlocked»: the next visit to the slot screen asks for the family PIN again.
  await page.keyboard.press('KeyP');
  await page.locator('#quit-btn').click();
  await page.locator('#play-btn').click();
  await expect(page.locator('#unlock-box')).toBeVisible({ timeout: 3_000 });
});

test('level B: whole session expired -> the slot screen asks for the PIN again, local save kept, dirty save sent after unlock', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const problems = await watch(page, API_NOISE);
  await seedLevelA(page);
  const hub = await unlockedWithProfile(page);
  await page.locator('#slot-list .slot').first().click();
  hub.unlocked = false; // the hub cookie expired: every call except /api/unlock answers 401
  await saveFromPause(page);
  const dirty = (await stored(page)).slots['1'][0];
  expect(dirty.dirty).toBe(true);
  await stillPlaying(page);
  await page.keyboard.press('KeyP');
  await page.locator('#quit-btn').click();
  await page.locator('#play-btn').click();
  await expect(page.locator('#unlock-box')).toBeVisible();
  expect((await stored(page)).slots.local).toEqual(LEVEL_A.slots.local);
  await page.locator('#pin').fill('1234');
  await page.locator('#unlock-btn').click();
  await expect(page.locator('#profile-box')).toBeVisible();
  await expect.poll(() => (hub.saves.get('1/1') as { saved_at?: number } | undefined)?.saved_at).toBeGreaterThanOrEqual(dirty.saved_at);
  expect(problems).toEqual([]);
});

test('level B: 429 lockout shows a wait message', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const problems = await watch(page, API_NOISE);
  const consoleText: string[] = [];
  const urls: string[] = [];
  page.on('console', (m) => consoleText.push(m.text()));
  page.on('request', (r) => urls.push(r.url()));
  await serverMode(page);
  const hub = fakeHub(page);
  hub.override = (path) => (path === '/api/unlock' ? { status: 429, body: { error: { code: 'TOO_MANY_REQUESTS' } } } : undefined);
  await page.goto('/');
  await page.locator('#play-btn').click();
  await expect(page.locator('#unlock-box')).toBeVisible();
  await page.locator('#pin').fill('1234');
  await page.locator('#unlock-btn').click();
  await expect(page.locator('#server-msg')).toHaveText('Περίμενε λίγο και ξαναδοκίμασε');
  await expect(page.locator('#pin')).toHaveValue('');
  await expect(page.locator('#unlock-box')).toBeVisible();
  // No crash: the device slots still work.
  await page.locator('#slot-list .slot').first().click();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'play');
  expect(hub.requests.filter((r) => r.url.endsWith('/api/unlock'))).toHaveLength(1);
  expect(consoleText.filter((t) => t.includes('1234'))).toEqual([]);
  expect([...urls, ...hub.requests.map((r) => r.url)].filter((u) => u.includes('1234'))).toEqual([]);
  expect(JSON.stringify(await page.evaluate(() => ({ ...localStorage, ...sessionStorage })))).not.toContain('1234');
  expect(problems).toEqual([]);
});

test('level B: a save over 64 KB is refused cleanly', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const problems = await watch(page, API_NOISE);
  const hub = await unlockedWithProfile(page);
  let refused = 0;
  hub.override = (path, method) => {
    if (method === 'PUT' && path.startsWith('/api/save/') && refused === 0) {
      refused++;
      return { status: 413, body: { error: { code: 'PAYLOAD_TOO_LARGE' } } };
    }
    return undefined;
  };
  await page.locator('#slot-list .slot').first().click();
  await saveFromPause(page);
  await expect.poll(() => refused).toBe(1);
  expect(hub.saves.size).toBe(0);
  const kept = (await stored(page)).slots['1'][0];
  expect(kept).toEqual(expect.objectContaining({ dirty: true, data: expect.objectContaining({ stars: expect.any(Number) }) }));
  await stillPlaying(page);
  // The next save goes out normally and clears the dirty mark.
  await saveFromPause(page);
  await expect.poll(() => hub.saves.has('1/1')).toBe(true);
  await expect.poll(async () => (await stored(page)).slots['1'][0].dirty).toBe(false);
  expect(problems).toEqual([]);
});

// ===== §3a keyboard: every menu reachable with Tab + Enter, and the focus ring is visible. =====

/** Presses Tab until `sel` has the focus (at most 20 times) and returns its focus ring. */
async function tabTo(page: Page, sel: string) {
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab');
    const ring = await page.evaluate((s) => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || !el.matches(s)) return null;
      const st = getComputedStyle(el);
      return { visible: el.matches(':focus-visible'), style: st.outlineStyle, width: parseFloat(st.outlineWidth) };
    }, sel);
    if (ring) return ring;
  }
  throw new Error(`Tab never reached ${sel}`);
}

async function tabEnter(page: Page, sel: string) {
  const ring = await tabTo(page, sel);
  expect(ring, sel).toEqual({ visible: true, style: 'solid', width: expect.any(Number) });
  expect(ring.width, `${sel} outline width`).toBeGreaterThanOrEqual(2);
  await page.keyboard.press('Enter');
}

test('keyboard only: every menu reachable with Tab/Enter, focus visible', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const problems = await watch(page);
  await page.goto('/');
  for (const id of ['#pause-btn', '#sound-btn', '#full-btn', '#home-btn']) {
    const ring = await tabTo(page, id);
    expect(ring.visible && ring.style !== 'none', id).toBe(true);
  }
  await tabEnter(page, '#play-btn');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'slots');
  await tabEnter(page, '#slots-back');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'title');
  await tabEnter(page, '#play-btn');
  await expect(page.locator('#slot-list .slot')).toHaveCount(3);
  await tabEnter(page, '#slot-list .slot:nth-child(2)');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'play');
  await page.keyboard.press('KeyP');
  await expect(page.locator('#pause-screen')).toBeVisible();
  await tabEnter(page, '#save-btn');
  await expect(page.locator('#save-msg')).toHaveText('Αποθηκεύτηκε ✔');
  await tabEnter(page, '#resume-btn');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'play');
  await page.keyboard.press('KeyP');
  await tabEnter(page, '#quit-btn');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'title');
  // The end screens: their single button is reachable too (setScreen = the game's own global, only to get there).
  for (const [s, btn] of [['win', '#again-btn'], ['lose', '#retry-btn']] as const) {
    await page.evaluate((name) => (window as unknown as { setScreen: (n: string) => void }).setScreen(name), s);
    await tabEnter(page, btn);
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'play');
  }
  expect(problems).toEqual([]);
});

// ===== P3: old or foreign data on the device =====

test('an older or foreign level A save is ignored', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const problems = await watch(page);
  await page.addInitScript((k) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem(k, '{"v":0,"slots":{"local":[{"saved_at":1,"data":{"stars":9}}]}}');
    localStorage.setItem('game.other.v1', '{"v":1,"keep":true}');
    localStorage.setItem('unrelated', 'x');
    sessionStorage.setItem('seeded', '1');
  }, SAVE_KEY);
  await page.goto('/');
  await page.locator('#play-btn').click();
  await expect(page.locator('#slot-list .slot').first()).toContainText('κενή');
  await page.locator('#slot-list .slot').first().click();
  await saveFromPause(page);
  const s = await stored(page);
  expect(s.v).toBe(1);
  expect(s.slots.local).toHaveLength(3);
  expect(s.slots.local[0]).toEqual(expect.objectContaining({ dirty: false, data: expect.objectContaining({ stars: expect.any(Number) }) }));
  expect(await page.evaluate(() => [localStorage.getItem('game.other.v1'), localStorage.getItem('unrelated')])).toEqual(['{"v":1,"keep":true}', 'x']);
  expect(problems).toEqual([]);
});
