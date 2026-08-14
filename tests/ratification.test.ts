import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ratify } from '../src/ratification.js';
import { commitAll, git, initRepo, makeTmpDir } from './helpers.js';

let tmp: string;
let upstream: string;
let remotes: string;
let root: string;
let pinA: string;

function writeCatalog(pin: string): void {
  writeFileSync(
    join(root, 'upstream', 'catalog.json'),
    JSON.stringify({
      sources: {
        'acme/demo-skills': {
          ref: 'main',
          ratified_commit: pin,
          ratified_on: '2026-08-14',
          skills: [{ name: 'demo', path: 'skills/demo', marker: 'manual' }],
        },
      },
    }),
  );
}

function writeOverrides(paths: string[]): void {
  writeFileSync(
    join(root, 'skills', 'deltas', 'overrides.json'),
    JSON.stringify({
      source: 'acme/demo-skills',
      overrides: [
        {
          upstream_paths: paths,
          tripwires: ['WITH SECURITY_ENFORCED', 'SECURITY_ENFORCED'],
          gforce_rule: 'WITH USER_MODE',
          reason: 'USER_MODE supersedes SECURITY_ENFORCED',
        },
      ],
    }),
  );
}

function pushUpstream(message: string): void {
  commitAll(upstream, message);
  git(upstream, 'push', '-q', `file://${remotes}/acme/demo-skills.git`, 'main:main');
}

function run(): { changed: boolean; report: string } {
  writeCatalog(pinA);
  const reportPath = join(tmp, 'report.md');
  rmSync(reportPath, { force: true });
  const result = ratify({ root, reportPath, sourceBaseUrl: `file://${remotes}/` });
  const report = existsSync(reportPath) ? readFileSync(reportPath, 'utf8') : '';
  return { changed: result.changed, report };
}

beforeAll(() => {
  tmp = makeTmpDir();
  upstream = join(tmp, 'src');
  remotes = join(tmp, 'remotes');
  root = join(tmp, 'fixture');
  mkdirSync(join(upstream, 'skills', 'demo'), { recursive: true });
  mkdirSync(join(root, 'upstream'), { recursive: true });
  mkdirSync(join(root, 'skills', 'deltas'), { recursive: true });

  writeFileSync(
    join(upstream, 'skills', 'demo', 'SKILL.md'),
    '# Demo skill\nAlways query records WITH SECURITY_ENFORCED to stay safe.\nOther guidance line.\n',
  );
  initRepo(upstream);
  pinA = commitAll(upstream, 'pin');
  mkdirSync(join(remotes, 'acme'), { recursive: true });
  git(tmp, 'clone', '-q', '--bare', upstream, join(remotes, 'acme', 'demo-skills.git'));
  writeOverrides(['skills/demo']);
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('ratify', () => {
  it('UNCHANGED: head equals pin — nothing reported', () => {
    const { changed, report } = run();
    expect(changed).toBe(false);
    expect(report).toBe('');
  });

  it('TOUCHED: anchored path edited without any tripwire in the diff', () => {
    const skill = join(upstream, 'skills', 'demo', 'SKILL.md');
    writeFileSync(skill, readFileSync(skill, 'utf8').replace('Other guidance line.', 'Other guidance line, edited.'));
    pushUpstream('touch unrelated line');

    const { changed, report } = run();
    expect(changed).toBe(true);
    expect(report).toContain('Touched —');
    // The checklist footer always mentions CONFLICT; only verdicts use "**CONFLICT** —".
    expect(report).not.toContain('**CONFLICT** —');
    // Pin advanced to the candidate head in the working catalog.
    const catalog = JSON.parse(readFileSync(join(root, 'upstream', 'catalog.json'), 'utf8')) as {
      sources: Record<string, { ratified_commit: string }>;
    };
    expect(catalog.sources['acme/demo-skills']?.ratified_commit).not.toBe(pinA);
  });

  it('CONFLICT via the secondary tripwire variant only', () => {
    appendFileSync(join(upstream, 'skills', 'demo', 'SKILL.md'), 'Remember the SECURITY_ENFORCED keyword.\n');
    pushUpstream('mention keyword without WITH');

    const { report } = run();
    expect(report).toContain('**CONFLICT** —');
    expect(report).toContain('`SECURITY_ENFORCED` (1)');
    expect(report).not.toContain('`WITH SECURITY_ENFORCED` (');
  });

  it('CONFLICT via the primary when the tripwire line itself is reworded', () => {
    const skill = join(upstream, 'skills', 'demo', 'SKILL.md');
    writeFileSync(skill, readFileSync(skill, 'utf8').replace('WITH SECURITY_ENFORCED', 'WITH USER_MODE'));
    pushUpstream('upstream adopts USER_MODE');

    const { report } = run();
    expect(report).toContain('`WITH SECURITY_ENFORCED` (');
  });

  it('DEAD ANCHOR: an override prefix that no longer exists at the candidate head', () => {
    writeOverrides(['skills/gone']);
    const { report } = run();
    expect(report).toContain('DEAD ANCHOR');
    writeOverrides(['skills/demo']); // restore
  });
});
