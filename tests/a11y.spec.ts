// GAME-STANDARD §3a WCAG AA: axe on every shell screen, light and dark, in both projects (desktop keyboard,
// tablet touch). Only serious and critical findings fail the test; the list is printed so a failure says what.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { API_NOISE, fakeHub, serverMode, startSlot, watch } from './lib';

async function seriousOrCritical(page: Page) {
  // axe cannot read canvas pixels, so behind the semi-transparent cards every colour-contrast check would end up
  // "incomplete" (never a violation). Hiding the game canvas leaves the page background (--night, the same dark
  // blue as the drawn meadow) behind the shell, so the contrast of the shell text is really checked.
  await page.addStyleTag({ content: "canvas#game { visibility: hidden !important; }" });
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

const tapOrClick = (page: Page, tap: boolean, sel: string) =>
  tap ? page.locator(sel).first().tap() : page.locator(sel).first().click();

const SCREENS: { name: string; open: (page: Page, tap: boolean) => Promise<void> }[] = [
  {
    name: 'title',
    open: async (page) => {
      await page.goto('/');
      await expect(page.locator('#title-screen')).toBeVisible();
    },
  },
  {
    name: 'playing',
    open: async (page, tap) => {
      await page.goto('/');
      await startSlot(page, tap);
      await expect(page.locator('#status')).toContainText('⭐');
    },
  },
  {
    name: 'pause',
    open: async (page, tap) => {
      await page.goto('/');
      await startSlot(page, tap);
      await tapOrClick(page, tap, '#pause-btn');
      await expect(page.locator('#pause-screen')).toBeVisible();
      await tapOrClick(page, tap, '#save-btn');
      await expect(page.locator('#save-msg')).toHaveText('Αποθηκεύτηκε ✔');
    },
  },
  {
    // The template has no settings screen: the sound switch in the HUD is the only setting (muted state checked).
    name: 'sound off',
    // Switched with M: on the title screen the HUD is under the screen overlay (APP BUG GAMES-TEMPLATE-T1).
    open: async (page) => {
      await page.goto('/');
      await page.keyboard.press('KeyM');
      await expect(page.locator('#sound-btn')).toHaveAttribute('aria-pressed', 'false');
    },
  },
  {
    name: 'level B unlock',
    open: async (page, tap) => {
      await serverMode(page);
      fakeHub(page);
      await page.goto('/');
      await tapOrClick(page, tap, '#play-btn');
      await expect(page.locator('#unlock-box')).toBeVisible();
      await page.locator('#pin').fill('9999');
      await tapOrClick(page, tap, '#unlock-btn');
      await expect(page.locator('#server-msg')).toHaveText('Λάθος κωδικός');
    },
  },
];

test('§3a icon-only buttons have an aria-label', async ({ page }) => {
  await page.goto('/');
  const unlabeled = await page.evaluate(() =>
    [...document.querySelectorAll('button, a')]
      .filter((el) => !/\p{L}/u.test(el.textContent || '') && !(el.getAttribute('aria-label') || '').trim() && !el.closest('[aria-hidden="true"]'))
      .map((el) => el.id || el.outerHTML.slice(0, 60)),
  );
  expect(unlabeled).toEqual([]);
});

for (const scheme of ['light', 'dark'] as const) {
  for (const s of SCREENS) {
    test(`axe: 0 serious/critical on ${s.name} (${scheme})`, async ({ page }, info) => {
      const problems = await watch(page, API_NOISE);
      await page.emulateMedia({ colorScheme: scheme });
      await s.open(page, info.project.name === 'tablet');
      expect(await seriousOrCritical(page)).toEqual([]);
      expect(problems).toEqual([]);
    });
  }
}
