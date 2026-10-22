# Changelog

## [Unreleased]

### Fixed
- Template shell bugs found by the tests (GAMES-TEMPLATE-T1..T5): T1 the HUD (z-index 30) is above the screen
  overlays, so ⏸ 🔊 🌓 ⛶ 🏠 can be clicked/tapped on title, slots, pause, win and lose; T2 at ≤ 520 px the HUD
  buttons are 56 px and the status line wraps under them (fits 360 px); T3 in portrait on touch the rotate hint
  covers the screen only while playing, on the menus it is a bottom strip that lets taps through; T4 light
  palette for the shell and a 🌓 switch in the HUD (auto → light → dark), stored as `theme` in `game.<slug>.v1`
  (schema stays 1, missing = `auto`); the canvas world keeps its colours; T5 a 401 from `/api/save` locks the
  level B session again (save stays dirty, level A kept), so the slot screen asks for the family PIN.
  The five `test.fail` marks are removed; a new test for the switch raises the floor 86 -> 88.

### Changed
- **CI on every PR** (owner decision D21, rulesets with required checks): `.github/workflows/ci.yml` now runs on
  `pull_request` into staging/main, on `push` to staging/main only (a PR branch commit runs CI once, not twice) and
  on `workflow_dispatch`. Before, CI ran on push only, so a PR whose branch moved through GITHUB_TOKEN showed no
  checks. Job ids / check names stay `test` and `gitleaks`.
  - Tests: new `tests/ci-workflow.spec.ts` (file check, desktop project): triggers and branches, no paths filter,
    workflow name `CI`, required jobs present, unconditioned and keeping their check names, no `${{ }}` inside a
    `run:` script. Red on the old ci.yml. Test-count floor 88 → 94 (`tests/floors.json` + `.coverage-floor`).
- README pass 02 (GAME-STANDARD v1.2 §2a): the README has the tester sections as a skeleton for every new game
  («Οθόνες και ροή», «Αποθήκευση», «Λίστα χειροκίνητων δοκιμών» AST-01..AST-21, «Τι άλλαξε στην τελευταία
  έκδοση», «Γνωστοί περιορισμοί», «Ασφαλής δοκιμή», «Αναφορά προβλήματος»), filled in for the Αστερόσκονη example.
  Issue forms `bug.yml` / `update.yml`, PR template checkbox, `tests/readme.spec.ts` (nine headings in order,
  unique numbered IDs, issue forms, no hostnames/IPs). `GAME-STANDARD.md` synced to v1.2.


## [2026-10-15] v1 (PR #1, release PR #2; UI identity doc PR #3, release PR #4)

### Added
- Template for the family's games (GAME-STANDARD v1): the "Αστερόσκονη" example game in one `index.html`.
- Common shell: title → slots/profile → game → win/lose; always-visible pause, sound, fullscreen and
  back-to-games buttons; keyboard map (arrows/WASD, 1–4, Space, P/Esc, M, F); touch joystick left and
  ability buttons right (≥ 64 px); rotate hint in portrait; auto-pause on hidden tab / lost focus; Web Audio
  sounds and music made in code, started on the first tap; canvas 2D loop with delta time; `CONFIG` at the top.
- Saves: level A on the device (`game.<slug>.v1`, schema version, 3 slots, try/catch) and level B on the hub
  (`/api/save/<slug>/<profile>/<slot>`, family PIN, profiles) with fallback to level A and later sync. Off by
  default (`CONFIG.save.server`).
- Playwright smoke (Chromium, desktop + touch tablet) under the hub's CSP; CI with gitleaks; Dependabot.
