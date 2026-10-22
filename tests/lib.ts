// Shared Playwright helpers: the problem watcher (console errors, page errors, CSP violations), starting a slot,
// level B server mode and the in-memory fake of the hub save API. No network: every /api call is answered here.
import { expect, type Page } from '@playwright/test';
import { gameCsp } from './hub-csp.mjs';

export const SAVE_KEY = 'game.template.v1';

// The browser logs every 4xx/5xx and every aborted fetch as a console error; for the save API that is expected.
export const API_NOISE = [/\/api\//];

/** Collects everything that must stay empty: console errors, page errors, CSP violations. */
export async function watch(page: Page, allow: RegExp[] = []) {
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

export async function startSlot(page: Page, tap = false) {
  const click = (sel: string) => (tap ? page.locator(sel).first().tap() : page.locator(sel).first().click());
  await click('#play-btn');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'slots');
  await click('#slot-list .slot');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'play');
}

export const screen = (page: Page) => page.locator('body').getAttribute('data-screen');

/** Serves index.html with CONFIG.save.server = true and the hub's CSP for a game with saves. */
export async function serverMode(page: Page) {
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

type Reply = { status: number; body?: unknown };

/**
 * In-memory fake of the hub save API (games-hub app/api/saves.py). The family PIN is the fake 1234.
 * `override(path, method)` may answer a request first (e.g. a 401, 413 or 429); `requests` lists every call.
 */
export function fakeHub(page: Page) {
  const hub = {
    unlocked: false,
    down: false,
    profiles: [] as { id: number; name: string }[],
    saves: new Map<string, unknown>(),
    requests: [] as { method: string; url: string; body: string }[],
    override: undefined as undefined | ((path: string, method: string) => Reply | undefined),
  };
  page.route('**/api/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    hub.requests.push({ method: req.method(), url: req.url(), body: req.postData() || '' });
    if (hub.down) return route.abort();
    const json = (status: number, body?: unknown) =>
      route.fulfill({ status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });
    const forced = hub.override?.(path, req.method());
    if (forced) return json(forced.status, forced.body);
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

/** Level B up to the slot list: server mode, unlock with the fake PIN, one profile «Αριάνα» chosen. */
export async function unlockedWithProfile(page: Page) {
  await serverMode(page);
  const hub = fakeHub(page);
  await page.goto('/');
  await page.locator('#play-btn').click();
  await page.locator('#pin').fill('1234');
  await page.locator('#unlock-btn').click();
  await expect(page.locator('#profile-box')).toBeVisible();
  await page.locator('#new-profile').fill('Αριάνα');
  await page.locator('#add-profile').click();
  await page.locator('#profile-list button', { hasText: 'Αριάνα' }).click();
  await expect(page.locator('#profile-list button', { hasText: '👉 Αριάνα' })).toBeVisible();
  return hub;
}
