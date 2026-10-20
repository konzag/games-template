# Changelog

## [Unreleased]

### Changed
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
