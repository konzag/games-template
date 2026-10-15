# UI identity: games-template

UIX-01 Phase 4 (owner GO UIX01-TABLE, 2026-10-15). The template follows **GAME-STANDARD v1** (`GAME-STANDARD.md`)
and the hub (konzag/games-hub); a game made from it inherits this identity and then picks its own world colours.
Docs only: nothing here changes code.

## Palette (as implemented in `index.html`)

| token | value | use |
|---|---|---|
| `--night` | `#16213e` | ground (full-screen game shell) |
| `--ink` | `#fdfdfd` | text |
| `--muted` | `#c8d0ec` | secondary text |
| `--sun` | `#ffd23f` | primary action, highlights |
| `--grass` | `#3bceac` | success |
| `--berry` | `#ee4266` | danger / hits |
| `--sky` | `#5aa9e6` | info |

## Type, density, shape

- **Comfortaa from the hub** (`/static/fonts/comfortaa.css`); no third-party font or CDN.
- Large: 20 px base text, 64 px icon buttons and big buttons (touch targets for ages 7-9).
- Shapes: 28 px card radius, 20 px buttons, 18 px icon buttons; emoji as icons.
- Layout: full-screen game shell, 🏠 back to the hub and 🔊 sound on every screen (GAME-STANDARD §9).

## How it differs from every other app (>= 3 dimensions)

Same family as games-hub (GAME-STANDARD v1), different from every admin app: rounded kids' typeface, large density
with 64 px targets, emoji icons, full-screen game layout instead of a page layout.

## UI test

CI job `test` is the Playwright smoke under the hub CSP (desktop keyboard + tablet touch, 0 console errors,
0 CSP violations): `npm ci && npx playwright install chromium && npx playwright test`.
