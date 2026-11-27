# TEST-STANDARD v2 (games)

Status: the games copy of TEST-STANDARD v2 (2026-11-27). TEST-STANDARD v1 (approved by the owner on 2026-10-22)
lives in template-app; its rules for every repo (tests in the repo, CI on every PR, no network or secrets in tests,
flaky = broken, a new test must fail on the old code), its «Browser game» row and the ratchet §R-JS apply here
unchanged. v2 adds the test pipeline from the repo to prod, as the owner set it on 2026-11-26 («ιδανικά το 100 %
passed»), adapted to games. [GAME-STANDARD.md](../GAME-STANDARD.md) stays the spec of the game itself.

A game differs from an app in three ways that change the rules below:

| | App (template-app) | Game (this template) |
|---|---|---|
| Server, database | its own service and database | none: static files served by games-hub at `/<slug>/` |
| Saves | database rows | level A in the browser (`localStorage`, key `game.<slug>.v1`, `SCHEMA`); level B through the hub save API |
| Staging gate | yes (gated app) | no service of its own, so the gate refuses a game; the hub's gate covers what the hub serves |
| Default tier of a row | `blocking` | `report`, except the smoke row (`<PREFIX>-01`), which is `blocking` |

## 1. The five test layers

The tests of a game live in two places. **In the game repo**: everything in `tests/` (smoke with keyboard and touch,
a11y, layout, i18n, offline, hub CSP, README check). **In the acceptance suite** (`homelab-acceptance`, one `main`,
one spec per game): one Playwright test per row of the README «Λίστα χειροκίνητων δοκιμών», plus the GAME-STANDARD
rows the hub and its shell give every game.

| Layer | What runs for a game | Where | When | What a red result does |
|---|---|---|---|---|
| **PR** | Playwright (desktop keyboard + tablet touch) under the hub's CSP, axe, test-count floor, gitleaks, CodeQL, K9 | the game repo's CI | every PR into staging / main, every push to them | blocks the merge |
| **Staging** | the game as served by the staging hub; the hub's own gate runs the hub rows | acceptance suite | the game's rows: nightly (reported); a per-game gate is planned (§5) | today: reported, does not hold the game |
| **Release** | the game's release PR merges on green CI; the hub pins that commit as its submodule | release train + a games-hub PR | evening train; then the hub's release | the hub serves exactly the pinned commit |
| **Prod** | the hub's `/version` and health; planned: the read-only game rows | auto-deploy + the morning prod check | after each hub deploy | today: the hub rolls back to its last good sha on a failed version / health check |
| **Night / week** | every row of every game; load, visual, Lighthouse, WCAG 2.2 | acceptance suite | nightly, weekly | never blocks; reported |

## 2. Release rules

### 2.1 100 % of the blocking rows pass

No percentage. One failed **blocking** row holds; a failed **report** row is listed («report failed: <ids>») and
never holds. For a game, the blocking rows are its smoke row and any row listed under `blocking` in the suite's
`catalog/tiers.json`. Today a game has no gate, so its blocking rows are checked in the nightly and reported; they
start to hold when a game gate exists (§5).

### 2.2 Tier and `safe_on_prod` on every row

Every row of `catalog/<game>.json` carries `tier` (`blocking` | `report`) and `safe_on_prod` (`yes` | `no`); the README
wording goes to `note`. `npm run check:catalog` refuses a row without them, with another value or a stale value.

| Tier | Rows of a game |
|---|---|
| `blocking` | the smoke row (`<PREFIX>-01`: the hub card opens the game, it starts and plays); rows the owner lists in `catalog/tiers.json` |
| `report` | everything else by default (the suite-only / game default): visual, theme, layout, sound, speed, minor a11y; every `manual()` row (kids on a tablet, human judgment) |

`safe_on_prod: yes` only when the row never writes on prod **and** its test carries `@prod-safe`. Most game rows are
`yes`: they read pages and write only the test browser's own storage. A row that writes a **level B server save**
(through the hub save API) is `no`.

### 2.3 The GAME-STANDARD rows

`tests/lib/game-standard.ts` in the acceptance suite adds the same eight GAME-STANDARD rows (`<PREFIX>-09` to
`<PREFIX>-16`) to each old hub game; they check what the hub serves and what its shell does, never the kids' code:

| Row | Checks |
|---|---|
| 09 | links of the hub card and inside the game answer 200; outside links open a new tab |
| 10 | nothing third-party is loaded; a strict CSP |
| 11 | offline play through the hub's service worker |
| 12 | the server save stays behind the family code |
| 13 | the public access rule |
| 14 | the shell's «EN» / «ΕΛ» switch |
| 15 | 🔊 off really silences the page |
| 16 | the shell's accessibility (axe + visible focus) |

All eight only read (GET) and write the test browser's storage, so they are `@prod-safe`. They take the game's
default tier (`report`). Today the helper takes the four old games; a game made from this template covers the same
checks with rows in its own spec.

### 2.4 Quarantine instead of a percentage

A **blocking** row that fails or flakes may be parked in the suite's `catalog/quarantine.json`, only with: its `id`,
a `reason`, an `issue` link, an `owner` (`owner` | `infra` | `suite`), `since` and `until` (at most **14 days**
later), and at most **3** parked rows per game. A parked row keeps running and does not hold. An expired entry, a
4th entry or an invalid entry fails the gate. The morning prod message lists the parked rows with their expiry.
`manual()` rows are not quarantine; they keep their written reason.

### 2.5 How the gate counts

| A row that ... | blocking | report |
|---|---|---|
| passes | ok | ok |
| fails | **holds** | listed, never holds |
| fails with a valid quarantine entry | listed as quarantined, does not hold | (not allowed in quarantine) |
| is `manual()` | listed apart | listed apart |
| skips at run time (`infra:`, `owner:`, `no data:`) | counted as skipped, does not hold (open question, §5) | counted as skipped |

### 2.6 Prod rows are read-only

The prod run takes only the rows with `tier: blocking` and `safe_on_prod: yes`. The prod fixture blocks every write,
so a wrong `yes` turns red instead of writing on prod.

### 2.7 Rollback (no database)

A game has no database and no migrations, so the app rule «expand, then contract, plus a previous-release smoke
against the new schema» applies like this:

- **Rolling back a game** = the hub pins the previous game commit again (a games-hub change) or the hub itself rolls
  back to its last good sha. No data step is needed.
- **The save is the schema.** A change of the save shape bumps `SCHEMA` and **migrates** old saves on load; it never
  drops them (GAME-STANDARD §5). The template's tests already prove an older or foreign save neither crashes the
  game nor touches other keys.
- **A `SCHEMA` bump is one-way.** The previous release ignores a newer save and overwrites it at its next save. A
  release that bumps `SCHEMA` says so in its PR and release notes and is marked «no automatic rollback»: it waits
  for the owner. A release without a bump rolls back freely.
- **Level B saves** live in the hub's database: the hub follows the template-app rule (expand-then-contract and the
  previous-release smoke) for its own schema; a game only sends `schema` with each save.

### 2.8 Same artifact

The commit that passed the game's CI is the commit the hub pins; the hub's staging-verified tree is the tree that
reaches prod. Nothing is rebuilt (no build step: one `index.html`).

## 3. Definition of done

Every change to a game:

- [ ] tests in this repo for the change, seen red on the old code; all green except a documented `test.fail`;
- [ ] `tests/floors.json` and `.coverage-floor` kept or raised (never lowered);
- [ ] 10 s keyboard + 10 s touch with 0 console errors and 0 CSP violations; axe 0 serious / critical, light + dark;
- [ ] every behaviour the family can see has a README row and an acceptance row with `tier` and `safe_on_prod`;
- [ ] a save shape change bumps `SCHEMA`, migrates old saves, and the release is marked «no automatic rollback»;
- [ ] CI green on the PR; merged to staging; the kids' tablet check of GAME-STANDARD §7 before main.

A **new game** in addition, before its first release:

- [ ] the nine README sections, with a new test-ID prefix (also in `tests/readme.spec.ts`) and «safe on prod» per row;
- [ ] its spec and catalog in the acceptance suite (one test per README row); its smoke row listed as `blocking`;
- [ ] the GAME-STANDARD checks of §2.3 as rows of its spec;
- [ ] its line in the suite's app list (as a game) and in the release train's games list; its catalog floor;
- [ ] its row in the suite's test catalog and in the load targets;
- [ ] in games-hub: the submodule `games/<slug>`, its card, its line in the hub's offline e2e (GAME-STANDARD §7).

## 4. In this repo

| Rule | Where |
|---|---|
| Test-count ratchet (§R-JS) | `tests/floors.json`, `.coverage-floor`, `tools/coverage-floor-check.sh`, `npm run test:count` |
| Hub CSP | `tests/serve.mjs`, `tests/hub-csp.mjs`, `tests/hub-csp.spec.ts` |
| Saves (level A, level B errors, old / foreign save) | `tests/smoke.spec.ts` |
| Offline through the hub's worker | `tests/offline.spec.ts` |
| README as tester guide | `tests/readme.spec.ts` |
| Which test types a new game gets | [docs/TEST-MATRIX.md](TEST-MATRIX.md) |

## 5. Pipeline state (live and planned)

State on 2026-11-28. Steps refer to the test pipeline plan of 2026-11-26.

| Part | State |
|---|---|
| Tier + `safe_on_prod` on every row, `check:catalog` (step 2) | live: homelab-acceptance #189 (merged 2026-11-27) |
| Quarantine and its gate rules (step 3); the gate counts by tier | live: homelab-acceptance #192 and #197 (merged 2026-11-27) |
| **A gate for a game on every staging change** (step 4) | **planned**: waits for an owner decision (the bot login for day gates); today a game has no gate |
| **Prod smoke after each deploy + revert on red** (step 5) | **planned**: waits for owner decisions (the automated prod run and its login; revert or hold); today prod checks the hub's `/version` and health only |
| A blocking row that skips holds the release | open question for the owner; today a skip is counted and does not hold |
