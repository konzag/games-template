// tests/hub-csp.mjs is a copy of the games-hub page policy. This pins it to the hub's exact string, so a drift shows
// up here. Source of truth: games-hub app/services/catalog.py, page_csp() (checked against games-hub staging 5818b3a).
// When the hub changes page_csp, copy its new directive list into EXPECTED and into tests/hub-csp.mjs.
import { expect, test } from '@playwright/test';
import { gameCsp } from './hub-csp.mjs';

// A fixed page with two inline scripts (one repeated) and one external script: hashes are de-duplicated, src is skipped.
const HTML = '<script>console.log(1)</script><script src="/x.js"></script><script>a()</script><script>console.log(1)</script>';
const SCRIPTS = "script-src 'self' 'sha256-CihokcEcBW4atb/CW/XWsvWwbTjqwQlE9nj9ii5ww5M=' 'sha256-qVpDBgj7bpq5hMAcGp3AOc79J3Y1Z4HvySTwKrWDoy4='";
const EXPECTED = (connect: string) =>
  [
    "default-src 'none'",
    SCRIPTS,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data:",
    "manifest-src 'self'",
    "media-src 'self'",
    `connect-src ${connect}`,
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');

test('hub-csp.mjs still matches games-hub', async ({}, info) => {
  test.skip(info.project.name !== 'desktop');
  expect(gameCsp(HTML)).toBe(EXPECTED("'none'"));
  expect(gameCsp(HTML, { saves: true })).toBe(EXPECTED("'self'"));
});
