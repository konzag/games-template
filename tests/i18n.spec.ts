// L1-21 / L3-06 (owner decision 2026-11-02): every game in Greek (default) and English, with an EL | EN switcher
// on the title screen. File checks (desktop project only): both catalogs have the same keys and {placeholders},
// every data-i18n key exists and every key is used, the built-in texts are the Greek ones. Browser checks (both
// projects): German and English browsers -> Greek (the browser language is never used, W1 decision 2026-11-02),
// a stored English choice -> English, ?lang= wins and is remembered, the switcher changes <html lang>, every text and the dynamic labels,
// survives a reload, keeps game.<slug>.v1 untouched, works with blocked storage; axe clean in English.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAVE_KEY, watch } from './lib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const LANG_KEY = 'games.lang';
type Table = Record<string, string>;
const catalogs = JSON.parse(html.split('/*I18N-CATALOGS*/')[1].split('/*/I18N-CATALOGS*/')[0]) as {
  el: Table;
  en: Table;
};
const placeholders = (s: string) => [...s.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]).sort();
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

test.describe('language catalogs (file check)', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'file check, desktop project only');
  });

  test('el and en have the same keys, non-empty texts and the same placeholders', () => {
    expect(Object.keys(catalogs.en).sort()).toEqual(Object.keys(catalogs.el).sort());
    for (const k of Object.keys(catalogs.el)) {
      expect(catalogs.el[k].trim(), k).not.toBe('');
      expect(catalogs.en[k].trim(), k).not.toBe('');
      expect(placeholders(catalogs.en[k]), k).toEqual(placeholders(catalogs.el[k]));
      expect(catalogs.en[k], `${k} is English`).not.toMatch(/[Ͱ-Ͽ]/);
    }
  });

  test('every key of the page exists, every catalog key is used, the built-in texts are Greek', () => {
    const text = [...html.matchAll(/data-i18n="([a-z_]+)"[^>]*>([^<]*)</g)].map((m) => [m[1], decode(m[2])]);
    const attrs = [...html.matchAll(/<[^>]*data-i18n-attr="([^"]+)"[^>]*>/g)].flatMap((m) =>
      m[1].split(/\s+/).map((pair) => {
        const [attr, key] = pair.split(':');
        const value = m[0].match(new RegExp(`\\s${attr}="([^"]*)"`));
        return [key, decode(value ? value[1] : '')];
      }),
    );
    const code = [...html.matchAll(/\btr\(['`]([a-z_]+)['`]/g)].map((m) => m[1]);
    const themes = ['theme_auto', 'theme_light', 'theme_dark']; // tr(`theme_${store.theme}`)
    const used = new Set([...text.map(([k]) => k), ...attrs.map(([k]) => k), ...code, ...themes]);
    expect([...used].filter((k) => !(k in catalogs.el)), 'keys missing from the catalogs').toEqual([]);
    expect(Object.keys(catalogs.el).filter((k) => !used.has(k)), 'catalog keys never used').toEqual([]);
    for (const [k, v] of [...text, ...attrs]) expect(v, `built-in text of ${k}`).toBe(catalogs.el[k]);
    expect(html).toContain('<html lang="el">');
  });
});

async function expectLang(page: Page, lang: 'el' | 'en') {
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
  await expect(page.locator('#play-btn')).toHaveText(catalogs[lang].play);
  await expect(page.locator(`#lang-${lang}`)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(`#lang-${lang === 'el' ? 'en' : 'el'}`)).toHaveAttribute('aria-pressed', 'false');
  const wrong = await page.evaluate((table) => {
    const out: string[] = [];
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
      if (el.textContent !== table[el.dataset.i18n as string]) out.push(el.dataset.i18n as string);
    });
    document.querySelectorAll<HTMLElement>('[data-i18n-attr]').forEach((el) => {
      for (const pair of (el.dataset.i18nAttr as string).split(/\s+/)) {
        const [attr, key] = pair.split(':');
        if (el.getAttribute(attr) !== table[key]) out.push(`${attr}:${key}`);
      }
    });
    return out;
  }, catalogs[lang]);
  expect(wrong).toEqual([]);
  expect(await page.title()).toBe(catalogs[lang].page_title);
}

test.describe('German browser', () => {
  test.use({ locale: 'de-DE' });
  test('opens in Greek', async ({ page }) => {
    const problems = await watch(page);
    await page.goto('/');
    await expectLang(page, 'el');
    expect(problems).toEqual([]);
  });
});

test.describe('English browser', () => {
  test.use({ locale: 'en-US' });
  test('still opens in Greek: the browser language is never used, nothing is stored', async ({ page }) => {
    await page.goto('/');
    await expectLang(page, 'el');
    expect(await page.evaluate((k) => localStorage.getItem(k), LANG_KEY)).toBeNull();
  });
  test('a stored English choice opens in English', async ({ page }) => {
    await page.addInitScript((k) => localStorage.setItem(k, 'en'), LANG_KEY);
    await page.goto('/');
    await expectLang(page, 'en');
  });
});

test('?lang=en wins over a stored Greek choice and is remembered; ?lang=xx is ignored', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((k) => localStorage.setItem(k, 'el'), LANG_KEY);
  await page.goto('/?lang=en');
  await expectLang(page, 'en');
  await page.goto('/');
  await expectLang(page, 'en');
  await page.goto('/?lang=xx');
  await expectLang(page, 'en');
});

test('the switcher: texts, dynamic labels, reload, cookie, the save key untouched', async ({ page, context }, info) => {
  const problems = await watch(page);
  const press = (sel: string) => (info.project.name === 'tablet' ? page.locator(sel).tap() : page.locator(sel).click());
  await page.goto('/');
  await expectLang(page, 'el');
  const saveBefore = await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY);
  await press('#lang-en');
  await expectLang(page, 'en');
  await expect(page.locator('#theme-btn')).toHaveAttribute('aria-label', 'Colours: like the device');
  expect(await page.evaluate((k) => localStorage.getItem(k), LANG_KEY)).toBe('en');
  expect((await context.cookies()).find((c) => c.name === 'lang')?.value).toBe('en');
  expect(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).toBe(saveBefore);

  await press('#play-btn');
  await expect(page.locator('#slot-list .slot').first()).toContainText('Slot 1');
  await expect(page.locator('#slot-list .slot').first()).toContainText('empty');
  await press('#slots-back');

  await page.reload();
  await expectLang(page, 'en');
  await press('#lang-el');
  await expectLang(page, 'el');
  await expect(page.locator('#theme-btn')).toHaveAttribute('aria-label', 'Χρώματα: όπως η συσκευή');
  await press('#play-btn');
  await expect(page.locator('#slot-list .slot').first()).toContainText('Θέση 1');
  expect(problems).toEqual([]);
});

test('blocked storage: the switcher still works for the page', async ({ page }) => {
  const problems = await watch(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
  });
  await page.goto('/');
  await expectLang(page, 'el');
  await page.locator('#lang-en').click();
  await expectLang(page, 'en');
  expect(problems).toEqual([]);
});

test('the switcher buttons are at least 64 px and fit at 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  for (const id of ['#lang-el', '#lang-en']) {
    const box = await page.locator(id).boundingBox();
    expect(box, id).not.toBeNull();
    expect(box!.height, id).toBeGreaterThanOrEqual(64);
    expect(box!.x, id).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, id).toBeLessThanOrEqual(360);
  }
});

for (const scheme of ['light', 'dark'] as const) {
  test(`axe: 0 serious/critical on the title in English (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/?lang=en');
    await expectLang(page, 'en');
    await page.addStyleTag({ content: 'canvas#game { visibility: hidden !important; }' });
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
    expect(bad).toEqual([]);
  });
}
