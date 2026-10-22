# games-template: Claude context

Template for the family's browser games. **The spec is [GAME-STANDARD.md](GAME-STANDARD.md) (Greek). Read it
first.** Every rule there applies to this repo and to every game created from it.

## Layout
- `index.html`: the whole game, no build step: one `<style>`, one inline `<script>`. The script starts with
  `CONFIG` (all tuning), then the save client (level A `Local`, level B `Server`), `Sound`, the state `G`, input
  (keyboard + touch), screens, abilities, `update(dt)`, `draw()`, and the `requestAnimationFrame` loop.
- `tests/smoke.spec.ts`: Playwright (Chromium), projects `desktop` (keyboard) and `tablet` (touch, landscape).
  Also level B error paths (401/429/413 from the mocked hub) and keyboard-only menus.
- `tests/a11y.spec.ts` (axe, 0 serious/critical, light + dark), `tests/layout.spec.ts` (§3a sizes 1280x800,
  1180x820, 820x1180, 360x740), `tests/lib.ts` (shared helpers, fake hub API; fake PIN `1234`).
- `tests/serve.mjs` + `tests/hub-csp.mjs`: a stand-in for games-hub that sends the hub's game-page CSP;
  `tests/hub-csp.spec.ts` pins it to games-hub `page_csp` (update both when the hub policy changes).
- Test-count ratchet (TEST-STANDARD v1 §R-JS): `npm run test:count` fails when the listed Playwright tests are
  fewer than `tests/floors.json` `tests`; `.coverage-floor` holds the same number and `tools/coverage-floor-check.sh`
  (canonical copy from template-app) fails when it goes down (owner-only trailer `Coverage-Floor-Lowered-By: owner`).
  **A game made from this template keeps `tests/floors.json` + `.coverage-floor` and raises both with new tests.**
- `test.fail(true, 'APP BUG GAMES-TEMPLATE-T<n>: …')` marks a known template bug; fixing it turns the test into an
  "unexpected pass", so the fix removes the mark.
- `.github/workflows/ci.yml`: `test` (floor check, test count, Playwright) + `gitleaks` on every PR into staging/main
  and every push to staging/main. A ruleset requires these two check names: a game keeps the job ids and
  `tests/ci-workflow.spec.ts`.

## Rules
- Served by games-hub at `/<slug>/` behind its CSP: one inline `<script>` (hashed by the hub), no `<script src>`
  from elsewhere, no `eval`/`new Function`/string timers, **no inline handlers** (`onclick="…"`); use
  `addEventListener`. No external URLs at all (fonts come from the hub: `/static/fonts/comfortaa.css`).
- Network: none, except the hub save API (`/api/...`) when `CONFIG.save.server` is true. The hub then serves
  the page with `connect-src 'self'` (only for slugs with `saves=True` in games-hub `GAMES`).
- localStorage only through `Local` (try/catch). Key `game.<slug>.v1`, schema `SCHEMA`; bump it when the shape
  changes and migrate old data instead of dropping it.
- Text the player types (profile names) goes into the DOM with `textContent`, never `innerHTML`.
- Kids: nothing scary; enemies turn into sparks; losing returns to a safe point and keeps progress;
  shape + colour (not colour alone); text ≥ 18 px; Greek, `lang="el"`.
- Flow: feature branch → PR to `staging` → CI green → release PR `staging → main` → owner GO. Signed commits.
- README.md (Greek) is also the tester guide (GAME-STANDARD v1.2 §2a): nine fixed section headings, checked by
  `tests/readme.spec.ts`; a new game keeps them, changes the test-ID prefix (AST) there and in the README, and the
  game name in `.github/ISSUE_TEMPLATE/*.yml`. Public repo: no hostnames or IPs in any README.
- Tests must keep: 10 s keyboard + 10 s touch with 0 console errors and 0 CSP violations.
