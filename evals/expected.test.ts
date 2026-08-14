import { checkExpected } from './expected.js';
import { hasCleanControl, type FixtureResult } from './run-suite.js';

const finding = (file: string, category: string) => ({ file, category, summary: '', failure_scenario: '' });

// mustFlag satisfied
const a = checkExpected(
  { assert: { mustFlag: [{ file: 'X.cls', category: 'security' }] } },
  [finding('X.cls', 'security')]
);
if (a.failures.length !== 0) throw new Error(`expected pass, got ${a.failures}`);

// mustFlag violated — right file, wrong category
const b = checkExpected(
  { assert: { mustFlag: [{ file: 'X.cls', category: 'security' }] } },
  [finding('X.cls', 'style')]
);
if (b.failures.length !== 1) throw new Error('expected one failure');

// maxFindings 0 is the false-positive control
const c = checkExpected({ assert: { maxFindings: 0 } }, [finding('Y.cls', 'style')]);
if (c.failures.length !== 1) throw new Error('clean fixture must fail when findings appear');

console.log('expected.ts: 3/3 passed');

// --- hasCleanControl -------------------------------------------------------
// Distinguishes "this suite has no clean control" from "nothing was scored yet".
// The flag must come from what's discovered on disk (expected.json), not from
// whether the fixture happened to get scored this run.

const result = (overrides: Partial<FixtureResult>): FixtureResult => ({
  fixture: 'x',
  status: 'skipped',
  failures: [],
  costCents: null,
  isCleanControl: false,
  ...overrides,
});

// one fixture asserts maxFindings: 0 but was SKIPPED (no actual.json yet) — still counts
const d = hasCleanControl([
  result({ fixture: 'clean-selector', isCleanControl: true, status: 'skipped' }),
  result({ fixture: 'soql-in-loop', isCleanControl: false, status: 'skipped' }),
]);
if (d !== true) throw new Error('expected hasCleanControl to be true regardless of scoring');

// no fixture asserts maxFindings: 0, some scored, some not — never true
const e = hasCleanControl([
  result({ fixture: 'soql-in-loop', isCleanControl: false, status: 'pass' }),
  result({ fixture: 'no-user-mode', isCleanControl: false, status: 'skipped' }),
]);
if (e !== false) throw new Error('expected hasCleanControl to be false when no fixture is a clean control');

// no fixtures at all — false, not a crash
if (hasCleanControl([]) !== false) throw new Error('expected hasCleanControl([]) to be false');

console.log('run-suite.ts: 3/3 passed');
