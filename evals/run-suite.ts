#!/usr/bin/env node
/**
 * Eval runner: run every asserted fixture for one agent and print a scorecard.
 *
 *   npm run evals -- sf-code-reviewer
 *
 * Shape ported from sf-devops-agent/platform/evals/run-suite.ts. The loop stops
 * handing out sessions once summed cost crosses `maxTotalCents` in the agent's
 * suite.json; remaining fixtures are reported as skipped.
 *
 * Exit codes
 *   0  every fixture passed
 *   1  setup failure — nothing was run
 *   2  one or more fixtures failed or were skipped
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { checkExpected, type Expected, type Finding } from './expected.js';

export interface SuiteConfig {
  description?: string;
  maxTotalCents: number;
}

export interface FixtureResult {
  fixture: string;
  status: 'pass' | 'fail' | 'skipped';
  failures: string[];
  costCents: number | null;
  isCleanControl: boolean;
}

/** Every subdirectory of <agentDir>/fixtures that carries an expected.json. */
export function discoverFixtures(agentDir: string): string[] {
  const root = join(agentDir, 'fixtures');
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .map((entry) => join(root, entry))
    .filter((dir) => statSync(dir).isDirectory() && existsSync(join(dir, 'expected.json')))
    .sort();
}

export function scorecard(results: FixtureResult[]): {
  recallHits: number;
  recallTotal: number;
  falsePositives: number;
  cleanTotal: number;
  totalCostCents: number;
  failed: number;
  skipped: number;
} {
  let recallHits = 0;
  let recallTotal = 0;
  let falsePositives = 0;
  let cleanTotal = 0;
  let totalCostCents = 0;
  let failed = 0;
  let skipped = 0;

  for (const r of results) {
    totalCostCents += r.costCents ?? 0;
    if (r.status === 'skipped') {
      skipped += 1;
      continue;
    }
    if (r.status === 'fail') failed += 1;

    if (r.isCleanControl) {
      cleanTotal += 1;
      if (r.status === 'fail') falsePositives += 1;
    } else {
      recallTotal += 1;
      if (r.status === 'pass') recallHits += 1;
    }
  }

  return { recallHits, recallTotal, falsePositives, cleanTotal, totalCostCents, failed, skipped };
}

/**
 * Invoke the agent against one fixture and return its findings.
 *
 * Not implemented here: dispatching a subagent from a script requires the Agent
 * SDK, which this repo does not depend on. Until it does, run the agent by hand
 * and write its findings to <fixture>/actual.json; this reads that file.
 */
function loadFindings(fixtureDir: string): Finding[] | null {
  const p = join(fixtureDir, 'actual.json');
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8')) as Finding[];
}

function main(): number {
  const agent = process.argv[2];
  if (!agent) {
    console.error('usage: npm run evals -- <agent-name>');
    return 1;
  }

  const agentDir = resolve(process.cwd(), agent);
  const suitePath = join(agentDir, 'suite.json');
  if (!existsSync(suitePath)) {
    console.error(`no suite.json at ${suitePath}`);
    return 1;
  }
  const suite = JSON.parse(readFileSync(suitePath, 'utf8')) as SuiteConfig;

  const fixtures = discoverFixtures(agentDir);
  if (fixtures.length === 0) {
    console.error(`no fixtures with expected.json under ${agentDir}/fixtures`);
    return 1;
  }

  const results: FixtureResult[] = [];
  let spent = 0;

  for (const dir of fixtures) {
    const name = dir.split('/').pop()!;
    const expected = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8')) as Expected;
    const isCleanControl = expected.assert.maxFindings === 0;

    if (spent >= suite.maxTotalCents) {
      results.push({ fixture: name, status: 'skipped', failures: ['budget exhausted'], costCents: null, isCleanControl });
      continue;
    }

    const findings = loadFindings(dir);
    if (findings === null) {
      results.push({
        fixture: name,
        status: 'skipped',
        failures: [`no actual.json — run the agent against ${name} and save its findings there`],
        costCents: null,
        isCleanControl,
      });
      continue;
    }

    const { failures } = checkExpected(expected, findings);
    results.push({
      fixture: name,
      status: failures.length === 0 ? 'pass' : 'fail',
      failures,
      costCents: 0,
      isCleanControl,
    });
    spent += 0;
  }

  for (const r of results) {
    const mark = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '–';
    console.log(`  ${mark} ${r.fixture.padEnd(22)} ${r.status}`);
    for (const f of r.failures) console.log(`      ${f}`);
  }

  const s = scorecard(results);
  console.log(
    `\n  recall ${s.recallHits}/${s.recallTotal} · ` +
      `false-pos ${s.falsePositives}/${s.cleanTotal} · ` +
      `${s.totalCostCents.toFixed(1)}¢`
  );

  if (s.cleanTotal === 0) {
    console.error('\n  WARNING: no clean control (maxFindings: 0) — recall alone is gameable.');
  }

  return s.failed > 0 || s.skipped > 0 ? 2 : 0;
}

process.exit(main());
