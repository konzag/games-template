// Test-count floor (TEST-STANDARD v1 §R-JS, Playwright-only fallback): the game logic is one inline script in
// index.html, so no coverage tool can measure it; the ratchet is the number of listed Playwright tests instead.
// Usage: playwright test --list --reporter=json | node tests/count-floor.mjs   (npm run test:count)
// Fails when the count (both projects) is below tests/floors.json `tests`, when .coverage-floor (the file that
// tools/coverage-floor-check.sh keeps from going down) holds another number, or when the list cannot be read.
import fs from 'node:fs';

const fail = (msg, code = 1) => {
  console.error(`::error::count-floor: ${msg}`);
  process.exit(code);
};

let input = '';
for await (const chunk of process.stdin) input += chunk;
let report;
try {
  report = JSON.parse(input);
} catch {
  fail('no JSON on stdin (run it through `npm run test:count`)', 2);
}
if (report.errors?.length) fail(`playwright --list reported errors: ${report.errors.map((e) => e.message).join('; ')}`, 2);

let count = 0;
const walk = (suite) => {
  for (const s of suite.suites || []) walk(s);
  for (const spec of suite.specs || []) count += spec.tests.length;
};
for (const s of report.suites || []) walk(s);

const floor = JSON.parse(fs.readFileSync(new URL('./floors.json', import.meta.url), 'utf8')).tests;
const ratchet = Number(fs.readFileSync(new URL('../.coverage-floor', import.meta.url), 'utf8').match(/^\d+/m)?.[0]);
if (!Number.isInteger(floor) || floor <= 0) fail('tests/floors.json has no positive "tests" number', 2);
if (ratchet !== floor) fail(`.coverage-floor (${ratchet}) and tests/floors.json (${floor}) must hold the same number`, 2);
console.log(`test count: ${count} listed (floor ${floor})`);
if (count < floor) fail(`test count ${count} is below the floor ${floor} (tests/floors.json): a test was removed`);
