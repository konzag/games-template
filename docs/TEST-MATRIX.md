# Test matrix: games-template

Date: 2026-10-29 (CLOSE-ALL §2.1). One row for each of the owner's test types, in the owner's order (the list at the
end of PROMPT-CLOSE-ALL-2026-10-28 has 71 names; every one has its row here).

**This repo seeds new games.** The matrix says what a new game created from it («Use this template», README «Νέο
παιχνίδι από αυτό το πρότυπο») gets on day one: the tests below are copied into the new repo and run in its CI. The
template itself is not served by games-hub, so it has no homelab-acceptance spec and nothing runs against staging for
it; those rows say what the new game must add.

- **Applies**: `yes` = a game from this template has what the type tests; `no` = it does not (reason in the last
  column); `no (manual)` = needs a person, no fake test; `infra: homelab-scripts` = host-level, owned by homelab-scripts.
- **Exists** (only for `yes`): `yes` = the template ships a test that checks it; `partial` = some of it; `missing` =
  nothing yet.
- **Where**: paths in this repo or the CI job. AST-xx = the README «Λίστα χειροκίνητων δοκιμών» rows (a new game
  changes the prefix).
- **Runs**: PR CI = `.github/workflows/ci.yml` job `test` (every PR into staging/main and push to staging/main);
  nightly on staging / after each release = homelab-acceptance, once the game has a spec there; weekly from the
  runner = VM 107, staging only.

A game from the template is static: one `index.html`, served by games-hub at `/<slug>/`. Level A saves are in
localStorage; level B (`CONFIG.save.server`, off by default) uses the games-hub save API (PIN unlock, profiles,
saves). The hub's own database, session, headers, health and metrics are in the games-hub matrix.

| Type | Applies | Exists | Where | Runs | Why not / gap |
|---|---|---|---|---|---|
| unit | yes | partial | tests/ci-workflow.spec.ts, tests/hub-csp.spec.ts (hash / policy builder), tests/count-floor.mjs | PR CI | No direct test of the example game's pure functions via `page.evaluate`, so a new game has no pattern to copy |
| component | yes | yes | tests/layout.spec.ts «§3 HUD buttons ⏸ 🔊 🌓 ⛶ 🏠…», «touch controls and HUD stay inside the screen…» | PR CI | |
| integration | yes | yes | tests/smoke.spec.ts «level B: unlock with the family PIN, pick a profile, save to the hub» with the fake hub API in tests/lib.ts, under tests/serve.mjs + tests/hub-csp.mjs | PR CI | |
| API | no | | | | A game exposes no API; the hub save API is tested in games-hub |
| contract | yes | partial | tests/hub-csp.spec.ts (pins tests/hub-csp.mjs to games-hub `page_csp`); tests/lib.ts (hand-written fake of the hub save API) | PR CI | The fake save API has no shared schema with games-hub |
| end-to-end | yes | missing | | nightly on staging (once added) | No homelab-acceptance spec pattern for a new game; README step 5 does not ask for `tests/NN-<slug>.spec.ts` |
| functional | yes | yes | tests/smoke.spec.ts (keyboard 10 s, abilities, pause, sound; touch 10 s) | PR CI | |
| positive | yes | yes | tests/smoke.spec.ts (keyboard + touch play, level B save) | PR CI | |
| negative | yes | yes | tests/smoke.spec.ts «an older or foreign level A save is ignored», «hub unreachable…», «broken storage does not crash» | PR CI | |
| boundary | yes | partial | tests/smoke.spec.ts «a save over 64 KB is refused cleanly», tests/layout.spec.ts (360x740) | PR CI | No test of the profile name length |
| validation | yes | partial | tests/smoke.spec.ts (foreign / older save rejected) | PR CI | No test for an empty or invalid PIN / profile name |
| state transition | yes | yes | tests/smoke.spec.ts «auto-pause when the window loses focus…», «whole session expired -> … after unlock» | PR CI | |
| business rule | yes | partial | rules in CLAUDE.md (losing returns to a safe point and keeps progress) | PR CI | The example game's rules (safe point, progress kept) have no test |
| acceptance/UAT | yes | partial | README AST-01..AST-21 (manual list) | | No Playwright acceptance spec (homelab-acceptance) to copy |
| smoke | yes | yes | tests/smoke.spec.ts (10 s keyboard + 10 s touch, 0 errors, 0 CSP violations) | PR CI | |
| sanity | yes | yes | tests/smoke.spec.ts «GAME-STANDARD §4…» | PR CI | |
| regression | yes | partial | convention `test.fail(true, 'APP BUG GAMES-TEMPLATE-T<n>: …')` (CLAUDE.md); tests/floors.json + tools/coverage-floor-check.sh (tests never drop) | PR CI | No regression test yet; README does not say «one test per fixed bug» |
| retesting/confirmation | yes | partial | same `test.fail` convention: a fix turns the mark into an unexpected pass | PR CI | No retest step in README «Τι άλλαξε» |
| UI | yes | yes | tests/layout.spec.ts, tests/a11y.spec.ts | PR CI | |
| visual regression | yes | missing | | PR CI (to add) | No screenshots and no `toHaveScreenshot` baselines at 1280, 820x1180, 1180x820, 360, light + dark |
| responsive | yes | yes | tests/layout.spec.ts «fits WxH (scheme)» at 1280x800, 1180x820, 820x1180, 360x740, «§3a portrait touch…» | PR CI | |
| cross-browser | yes | partial | playwright.config.ts (Chromium only) | PR CI | Firefox and WebKit not run |
| cross-device/OS | yes | yes | playwright.config.ts projects desktop (keyboard), tablet (touch); tests/smoke.spec.ts «portrait tablet shows the rotate hint» | PR CI | |
| usability | no (manual) | | | | Needs the kids and a person |
| accessibility | yes | yes | tests/a11y.spec.ts (axe 0 serious/critical, light + dark; aria-labels), tests/smoke.spec.ts «keyboard only…» | PR CI | |
| localization/internationalization | no | | | | Greek only (`lang="el"`), one language |
| content | yes | yes | tests/readme.spec.ts (nine sections, unique IDs, issue forms, no hostnames) | PR CI | |
| performance | yes | missing | | weekly from the runner (to add) | No frame-budget test (kryfes-maches / magic-islands have tests/perf.spec.ts) |
| load | yes | missing | | weekly from the runner (to add) | A new game is not in homelab-acceptance load/targets.json until someone adds it; README does not say so |
| stress | yes | missing | | weekly from the runner (to add) | Nothing yet |
| spike | yes | missing | | weekly from the runner (to add) | Nothing yet |
| soak/endurance | yes | missing | | weekly from the runner (to add) | Nothing yet |
| scalability | yes | missing | | weekly from the runner (to add) | Nothing yet |
| volume | yes | partial | tests/smoke.spec.ts «a save over 64 KB is refused cleanly» | PR CI | No server-side volume run against staging |
| concurrency | yes | missing | | weekly from the runner (to add) | No concurrent-users run; no test of two devices saving the same slot |
| frontend performance | yes | missing | | weekly from the runner (to add) | No Lighthouse CI budgets |
| authentication | yes | yes | tests/smoke.spec.ts «level B: unlock with the family PIN…», «401 after expiry asks for the PIN again…» | PR CI | Level B only; the PIN check itself is games-hub's |
| authorization | no | | | | No roles in a game; profile access is enforced by games-hub |
| session | yes | yes | tests/smoke.spec.ts «whole session expired -> the slot screen asks for the PIN again…» | PR CI | The client half: the session cookie itself is games-hub's |
| input security | yes | partial | tests/smoke.spec.ts §4 (no eval, no inline handlers); rule: profile names via `textContent` | PR CI | No test that a profile name with markup stays text |
| request security | no | | | | Same-origin `fetch` only; CSRF, methods and headers are enforced and tested in games-hub |
| file upload | no | | | | No upload |
| rate limiting/abuse | yes | yes | tests/smoke.spec.ts «level B: 429 lockout shows a wait message» | PR CI | |
| security configuration | yes | yes | tests/hub-csp.mjs + tests/hub-csp.spec.ts (the hub's CSP), tests/smoke.spec.ts §4; CI job `gitleaks` | PR CI | |
| dependency scans | yes | partial | .github/dependabot.yml | weekly (Dependabot) | No `npm audit` / OSV step in CI |
| SAST/DAST | yes | missing | | PR CI (SAST); weekly from the runner (ZAP, to add) | No Semgrep/CodeQL job; no ZAP baseline |
| penetration | no (manual) | | | | Manual only |
| privacy | yes | partial | tests/smoke.spec.ts §4 (no external URLs), tests/readme.spec.ts (no hostnames / private IPs) | PR CI | No test that the PIN is never stored, logged or put in a URL (kryfes-maches has one) |
| database | no | | | | No server DB in a game (saves are stored by games-hub) |
| data integrity/transaction | yes | yes | tests/smoke.spec.ts «level A: progress… survive a reload; broken storage does not crash», «dirty save sent after unlock» | PR CI | |
| migration | no | | | | No server schema; the localStorage `SCHEMA` is covered by row compatibility |
| import/export | no | | | | No import or export |
| caching | no | | | | The example game has no cache of its own; HTTP caching is games-hub's |
| third-party integration | no | | | | No third party (tests/smoke.spec.ts §4) |
| webhook/queue/background job | no | | | | No jobs |
| idempotency | yes | missing | | PR CI (to add) | No test that a retried save (after offline / 401) leaves one unchanged slot |
| error handling | yes | yes | tests/smoke.spec.ts (0 console errors, hub unreachable, 401/429/413) | PR CI | |
| network | infra: homelab-scripts | | | | App part (hub unreachable never shows an error) is in row error handling |
| offline/PWA | no | | | | No service worker (owner rule; GAMES-OFFLINE dropped 29/10) |
| resilience/failover | infra: homelab-scripts | | | | App part: hub down = level A saves (tests/smoke.spec.ts «hub unreachable…») |
| recovery/disaster recovery | infra: homelab-scripts | | | | |
| backup/restore | infra: homelab-scripts | | | | Level B saves are backed up with the games-hub data |
| chaos | infra: homelab-scripts | | | | |
| deployment/rollback | infra: homelab-scripts | | | | Release = games-hub submodule SHA |
| configuration | yes | partial | tests/smoke.spec.ts (level B on via the fake hub; hub unreachable) | PR CI | No test with `CONFIG.save.server` true while the hub answers 503 (saves off for the slug) |
| observability | no | | | | Static page: health, metrics and X-Request-ID are games-hub's |
| SEO | yes | missing | | | A new game is a public page: `lang="el"` and `<title>` exist, no meta description and no test |
| analytics | no | | | | Policy: no analytics; tests/smoke.spec.ts §4 proves no external URL loads |
| exploratory | no (manual) | | | | Needs a person |
| ad hoc | no (manual) | | | | Needs a person |
| compatibility/backward compatibility | yes | partial | tests/smoke.spec.ts «an older or foreign level A save is ignored» | PR CI | No fixture save from the previous release that must load unchanged (kryfes-maches has tests/fixtures/save-v1.json) |

## Gaps

1. unit (partial): a pattern test of the example game's pure functions through `page.evaluate`.
2. contract (partial): a shared JSON schema of the hub save API answers, checked against the fake in tests/lib.ts.
3. end-to-end (missing): README step to add a homelab-acceptance `tests/NN-<slug>.spec.ts` (one test per README row).
4. boundary (partial): profile name length (longest accepted, one longer).
5. validation (partial): empty / non-numeric PIN and empty profile name.
6. business rule (partial): losing returns to a safe point and keeps progress.
7. acceptance/UAT (partial): same as 3: the AST rows as Playwright tests in homelab-acceptance.
8. regression (partial): README rule «one test per fixed bug» with an example.
9. retesting/confirmation (partial): README «Τι άλλαξε» step: re-run the fixed row on staging.
10. visual regression (missing): `toHaveScreenshot` baselines at 1280, 820x1180, 1180x820, 360, light + dark.
11. cross-browser (partial): Firefox and WebKit projects.
12. performance (missing): tests/perf.spec.ts frame budget with a failing threshold.
13. load (missing): README step to add the slug to homelab-acceptance load/targets.json + thresholds.json.
14. stress (missing): step load on `/<slug>/` on staging.
15. spike (missing): burst on `/<slug>/` on staging.
16. soak/endurance (missing): up to 60 minutes on staging.
17. scalability (missing): p95 at 1x/2x/4x users on staging.
18. volume (partial): many profiles / full slots on the staging hub save API.
19. concurrency (missing): two devices saving the same slot; concurrent users on staging.
20. frontend performance (missing): Lighthouse CI budgets for `/<slug>/`.
21. input security (partial): a profile name with markup stays plain text.
22. dependency scans (partial): `npm audit` / OSV step in CI.
23. SAST/DAST (missing): Semgrep (or CodeQL) on PRs; ZAP baseline against staging weekly.
24. privacy (partial): the PIN is never stored, logged or sent in a URL.
25. idempotency (missing): a retried save leaves one unchanged slot.
26. configuration (partial): level B on while the hub answers 503: no PIN box, saves on the device.
27. SEO (missing): meta description + a test of title, lang and description.
28. compatibility (partial): a fixture save from the previous release that loads unchanged.
