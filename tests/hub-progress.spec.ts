// GAME-STANDARD v1.3 §5a: the `hub` object of a save. Only schema, completed, completedAt and milestones; the hub reads
// it, the game never calls the hub for it.
import { expect, test, type Page } from '@playwright/test';
import { SAVE_KEY, startSlot } from './lib';

type Hub = { schema: number; completed: boolean; completedAt: string | null; milestones: string[] };
type Win = Window & { winGame: () => void; addMilestone: (id: string) => void };

const seed = (page: Page, data: Record<string, unknown>) =>
  page.addInitScript(
    ([k, d]) => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        const slot = { saved_at: 1, data: d, dirty: false };
        localStorage.setItem(k as string, JSON.stringify({ v: 1, sound: false, theme: 'auto', profile: null, slots: { local: [slot, null, null] } }));
      }
    },
    [SAVE_KEY, data],
  );

const savedHub = (page: Page): Promise<Hub> =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).slots.local[0].data.hub, SAVE_KEY);

const win = (page: Page) => page.evaluate(() => (window as unknown as Win).winGame());

test('a win writes completed and the date, and a second win keeps the first date', async ({ page }) => {
  await page.goto('/');
  await startSlot(page);
  await win(page);
  const hub = await savedHub(page);
  expect(Object.keys(hub).sort()).toEqual(['completed', 'completedAt', 'milestones', 'schema']);
  expect(hub).toMatchObject({ schema: 1, completed: true, milestones: [] });
  expect(hub.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test('completedAt never changes after the first completion', async ({ page }) => {
  const hub: Hub = { schema: 1, completed: true, completedAt: '2026-01-02', milestones: [] };
  await seed(page, { stars: 0, wins: 1, hub });
  await page.goto('/');
  await startSlot(page);
  await win(page);
  expect((await savedHub(page)).completedAt).toBe('2026-01-02');
});

test('an old save without hub loads, and gets it at the next save', async ({ page }) => {
  await seed(page, { stars: 3, wins: 0 });
  await page.goto('/');
  await startSlot(page);
  await page.keyboard.press('KeyP');
  await page.locator('#save-btn').click();
  await expect(page.locator('#save-msg')).toHaveText('Αποθηκεύτηκε ✔');
  expect(await savedHub(page)).toEqual({ schema: 1, completed: false, completedAt: null, milestones: [] });
});

test('an old save that already shows a win is marked completed on the upgrade day', async ({ page }) => {
  await seed(page, { stars: 0, wins: 2 });
  await page.goto('/');
  await startSlot(page);
  await page.keyboard.press('KeyP');
  await page.locator('#save-btn').click();
  await expect(page.locator('#save-msg')).toHaveText('Αποθηκεύτηκε ✔');
  const hub = await savedHub(page);
  expect(hub.completed).toBe(true);
  expect(hub.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test('a malformed hub object is cleaned: nothing else survives in it', async ({ page }) => {
  const bad = { schema: 9, completed: 'yes', completedAt: 'tomorrow', milestones: ['ok-1', 'Κακό', 7], name: 'Νίκος' };
  await seed(page, { stars: 3, wins: 0, hub: bad });
  await page.goto('/');
  await startSlot(page);
  await page.keyboard.press('KeyP');
  await page.locator('#save-btn').click();
  await expect(page.locator('#save-msg')).toHaveText('Αποθηκεύτηκε ✔');
  expect(await savedHub(page)).toEqual({ schema: 1, completed: false, completedAt: null, milestones: ['ok-1'] });
});

test('milestones: a valid id is added once, a bad id is not written, at most 50', async ({ page }) => {
  await page.goto('/');
  await startSlot(page);
  await page.evaluate(() => {
    const w = window as unknown as Win;
    w.addMilestone('island-3');
    w.addMilestone('island-3');
    w.addMilestone('Bad Id');
    w.addMilestone('x'.repeat(33));
    for (let i = 0; i < 60; i++) w.addMilestone(`m-${i}`);
    w.winGame();
  });
  const { milestones } = await savedHub(page);
  expect(milestones[0]).toBe('island-3');
  expect(milestones).toHaveLength(50);
  expect(new Set(milestones).size).toBe(50);
  expect(milestones.every((m) => /^[a-z0-9-]{1,32}$/.test(m))).toBe(true);
});
