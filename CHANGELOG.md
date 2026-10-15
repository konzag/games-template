# Changelog

## [Unreleased]

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
