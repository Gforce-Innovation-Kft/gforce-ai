import { checkExpected } from './expected.js';

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
