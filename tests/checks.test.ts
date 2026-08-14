import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkScorecards } from '../src/check-scorecard.js';
import { checkVersionBump } from '../src/check-version-bump.js';
import { agentMarkdown, commitAll, initRepo, makeTmpDir, skillMarkdown, writeAgent, writeSkill } from './helpers.js';

let root: string;
let base: string;

beforeAll(() => {
  root = makeTmpDir();
  initRepo(root);
  writeSkill(root, 'gforce-x', skillMarkdown('gforce-x', '1.0.0'));
  writeAgent(root, 'gforce-a.md', agentMarkdown({ name: 'gforce-a' }));
  base = commitAll(root, 'base');
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('checkVersionBump', () => {
  it('flags a changed skill whose version did not move, passes once bumped', () => {
    writeSkill(root, 'gforce-x', skillMarkdown('gforce-x', '1.0.0', 'rule two'));
    commitAll(root, 'change without bump');
    expect(checkVersionBump(root, base).join()).toContain('bump it');

    writeSkill(root, 'gforce-x', skillMarkdown('gforce-x', '1.1.0', 'rule two'));
    commitAll(root, 'bump');
    expect(checkVersionBump(root, base)).toEqual([]);
  });

  it('exempts brand-new units and rejects an unresolvable base ref', () => {
    writeSkill(root, 'gforce-new', skillMarkdown('gforce-new'));
    commitAll(root, 'new skill');
    expect(checkVersionBump(root, base)).toEqual([]);
    expect(() => checkVersionBump(root, 'no-such-ref')).toThrow();
  });
});

describe('checkScorecards', () => {
  it('requires a scorecard whose hash matches the changed agent', () => {
    writeAgent(root, 'gforce-a.md', agentMarkdown({ name: 'gforce-a', version: '1.1.0', bodyLines: 2 }));
    commitAll(root, 'agent change');
    expect(checkScorecards(root, base).join()).toContain('missing');

    mkdirSync(join(root, 'standards', 'evals'), { recursive: true });
    const hash = createHash('sha256')
      .update(readFileSync(join(root, 'agents', 'gforce-a.md')))
      .digest('hex');
    const card = join(root, 'standards', 'evals', 'gforce-a.scorecard.json');
    writeFileSync(card, JSON.stringify({ agent: 'gforce-a', content_sha256: hash }));
    expect(checkScorecards(root, base)).toEqual([]);

    writeFileSync(card, JSON.stringify({ agent: 'gforce-a', content_sha256: 'stale' }));
    expect(checkScorecards(root, base).join()).toContain('stale');
  });
});
