# games-template: Claude context

Template for the family's browser games. **The spec is [GAME-STANDARD.md](GAME-STANDARD.md) (Greek). Read it
first.** Every rule there applies to this repo and to every game created from it.

## Layout
- `index.html`: the whole game, no build step: one `<style>`, one inline `<script>`. The script starts with
  `CONFIG` (all tuning), then the save client (level A `Local`, level B `Server`), `Sound`, the state `G`, input
  (keyboard + touch), screens, abilities, `update(dt)`, `draw()`, and the `requestAnimationFrame` loop.
- `tests/smoke.spec.ts`: Playwright (Chromium), projects `desktop` (keyboard) and `tablet` (touch, landscape).
- `tests/serve.mjs` + `tests/hub-csp.mjs`: a stand-in for games-hub that sends the hub's game-page CSP.
- `.github/workflows/ci.yml`: `test` (Playwright) + `gitleaks` on every push.

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
- Tests must keep: 10 s keyboard + 10 s touch with 0 console errors and 0 CSP violations.
