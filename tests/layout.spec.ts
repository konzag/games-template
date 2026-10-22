// GAME-STANDARD §3a devices + light/dark: the shell fits 1280x800, 1180x820, 820x1180 and 360x740 in both projects,
// every menu button stays inside the viewport, 0 console errors and 0 CSP violations. The screens are opened with
// the keyboard (focus + Enter) so these checks do not depend on what covers what; that is checked separately below.
import { expect, test, type Page } from '@playwright/test';
import { startSlot, watch } from './lib';

const SIZES = [
  [1280, 800],
  [1180, 820],
  [820, 1180],
  [360, 740],
] as const;

const press = async (page: Page, sel: string) => {
  await page.locator(sel).first().focus();
  await page.keyboard.press('Enter');
};

/** Every visible button, link and input, with its box, and whether the page is wider than the viewport. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    const { innerWidth: w, innerHeight: h } = window;
    for (const el of document.querySelectorAll<HTMLElement>('button, a, input')) {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height || getComputedStyle(el).visibility === 'hidden') continue;
      if (b.left < 0 || b.top < 0 || b.right > w + 0.5 || b.bottom > h + 0.5) {
        out.push(`${el.id || el.className} at ${Math.round(b.left)},${Math.round(b.top)}-${Math.round(b.right)},${Math.round(b.bottom)}`);
      }
    }
    const d = document.documentElement;
    if (d.scrollWidth > d.clientWidth) out.push(`page ${d.scrollWidth} px wide in ${d.clientWidth}`);
    if (document.body.scrollWidth > document.body.clientWidth) out.push(`body ${document.body.scrollWidth} px wide`);
    return out;
  });
}

/** Opens title, slots, play and pause with the keyboard and lists what is outside the viewport on each. */
async function walkScreens(page: Page) {
  const outside: string[] = [];
  const check = async (name: string) => outside.push(...(await measure(page)).map((m) => `${name}: ${m}`));
  await page.goto('/');
  await expect(page.locator('#title-screen')).toBeVisible();
  await check('title');
  await press(page, '#play-btn');
  await expect(page.locator('#slot-list .slot')).toHaveCount(3);
  await check('slots');
  await press(page, '#slot-list .slot');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'play');
  await expect(page.locator('#status')).toContainText('⭐');
  await check('play');
  await page.keyboard.press('KeyP');
  await expect(page.locator('#pause-screen')).toBeVisible();
  await check('pause');
  return outside;
}

for (const scheme of ['light', 'dark'] as const) {
  for (const [w, h] of SIZES) {
    test(`fits ${w}x${h} (${scheme})`, async ({ page }) => {
      test.fail(w === 360, 'APP BUG GAMES-TEMPLATE-T2: at 360 px the HUD row (status + 4 buttons) is wider than the screen during play, 🏠 is cut off');
      const problems = await watch(page);
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width: w, height: h });
      expect(await walkScreens(page)).toEqual([]);
      expect(problems).toEqual([]);
    });
  }
}

/** For each selector: is the element itself what a finger or mouse hits at its centre? */
async function covered(page: Page, sels: string[]) {
  return page.evaluate((list) => {
    const out: string[] = [];
    for (const sel of list) {
      const el = document.querySelector(sel)!;
      const b = el.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      if (!hit || !(hit === el || el.contains(hit))) out.push(`${sel} under ${hit ? hit.id || hit.className || hit.tagName : 'nothing'}`);
    }
    return out;
  }, sels);
}

const HUD = ['#pause-btn', '#sound-btn', '#full-btn', '#home-btn'];

test('§3 HUD buttons ⏸ 🔊 ⛶ 🏠 can be pressed on every screen', async ({ page }) => {
  test.fail(true, 'APP BUG GAMES-TEMPLATE-T1: every .screen overlay (z-index 20) covers the HUD (z-index 10), so on title, slots, pause, win and lose the HUD buttons cannot be clicked or tapped');
  const problems = await watch(page);
  await page.goto('/');
  const hits: string[] = [];
  hits.push(...(await covered(page, HUD)).map((m) => `title: ${m}`));
  await press(page, '#play-btn');
  await expect(page.locator('#slot-list .slot')).toHaveCount(3);
  hits.push(...(await covered(page, HUD)).map((m) => `slots: ${m}`));
  await press(page, '#slot-list .slot');
  await page.keyboard.press('KeyP');
  hits.push(...(await covered(page, HUD)).map((m) => `pause: ${m}`));
  for (const s of ['win', 'lose']) {
    // setScreen is the game's own global; used here only to reach the end screens without playing them out.
    await page.evaluate((name) => (window as unknown as { setScreen: (n: string) => void }).setScreen(name), s);
    hits.push(...(await covered(page, HUD)).map((m) => `${s}: ${m}`));
  }
  expect(hits).toEqual([]);
  expect(problems).toEqual([]);
});

for (const [w, h] of [
  [820, 1180],
  [360, 740],
] as const) {
  test(`§3a portrait touch ${w}x${h}: title and slot menus stay readable and reachable`, async ({ page }, info) => {
    test.skip(info.project.name !== 'tablet', 'the rotate hint is shown only for a coarse pointer');
    test.fail(true, 'APP BUG GAMES-TEMPLATE-T3: in portrait on touch the rotate hint (#rotate, z-index 50) covers the whole page, so the title and slot menus cannot be read or tapped');
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await expect(page.locator('#rotate')).toBeVisible();
    const hits = (await covered(page, ['#play-btn'])).map((m) => `title: ${m}`);
    await press(page, '#play-btn');
    await expect(page.locator('#slot-list .slot')).toHaveCount(3);
    hits.push(...(await covered(page, ['#slot-list .slot', '#slots-back'])).map((m) => `slots: ${m}`));
    expect(hits).toEqual([]);
  });
}

test('§3a the shell follows the device light/dark setting', async ({ page }) => {
  test.fail(true, 'APP BUG GAMES-TEMPLATE-T4: no prefers-color-scheme styles and no theme switch; the shell is dark in both schemes');
  const look = async (scheme: 'light' | 'dark') => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    return page.evaluate(() => {
      const card = getComputedStyle(document.querySelector('#title-screen .card')!);
      return `${getComputedStyle(document.body).backgroundColor} / ${card.backgroundColor} / ${card.color}`;
    });
  };
  expect(await look('light')).not.toEqual(await look('dark'));
});

test('touch controls and HUD stay inside the screen while playing (landscape tablet)', async ({ page }, info) => {
  test.skip(info.project.name !== 'tablet');
  const problems = await watch(page);
  await page.goto('/');
  await startSlot(page, true);
  await expect(page.locator('#stick')).toBeVisible();
  expect(await measure(page)).toEqual([]);
  expect(await covered(page, [...HUD, '.ab[data-ab="0"]', '.ab[data-ab="4"]', '#stick'])).toEqual([]);
  expect(problems).toEqual([]);
});
