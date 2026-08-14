import { rmSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { validateNaming } from '../src/validate-naming.js';
import { agentMarkdown, makeTmpDir, skillMarkdown, writeAgent, writeSkill } from './helpers.js';

const dirs: string[] = [];
function fixture(): string {
  const d = makeTmpDir();
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('validateNaming', () => {
  it('passes a clean, namespaced fixture under strict', () => {
    const root = fixture();
    writeAgent(root, 'gforce-demo-reviewer.md', agentMarkdown({ name: 'gforce-demo-reviewer' }));
    writeSkill(root, 'gforce-demo', skillMarkdown('gforce-demo'));
    const r = validateNaming(root, { strict: true });
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('treats a missing gforce- prefix as a warning by default, an error under strict', () => {
    const root = fixture();
    writeAgent(root, 'demo-reviewer.md', agentMarkdown({ name: 'demo-reviewer' }));
    expect(validateNaming(root).errors).toEqual([]);
    expect(validateNaming(root).warnings).toHaveLength(1);
    expect(validateNaming(root, { strict: true }).errors).toHaveLength(1);
  });

  it('rejects a name that does not match the filename stem', () => {
    const root = fixture();
    writeAgent(root, 'other-file.md', agentMarkdown({ name: 'gforce-demo-reviewer' }));
    expect(validateNaming(root).errors.join()).toContain('filename');
  });

  it('rejects tools: *', () => {
    const root = fixture();
    writeAgent(root, 'gforce-a.md', agentMarkdown({ name: 'gforce-a', tools: '"*"' }));
    expect(validateNaming(root).errors.join()).toContain('explicit list');
  });

  it('requires a positive TRIGGER clause — DO NOT TRIGGER alone is not enough', () => {
    const root = fixture();
    // "DO NOT TRIGGER when:" contains "TRIGGER when:" as a substring; a naive
    // check passes this file. It must fail.
    writeAgent(
      root,
      'gforce-a.md',
      agentMarkdown({
        name: 'gforce-a',
        description: ['Reviews things.', 'DO NOT TRIGGER when: anything.'],
      }),
    );
    expect(validateNaming(root).errors.join()).toContain('TRIGGER when:');
  });

  it('rejects an agent body over 200 lines', () => {
    const root = fixture();
    writeAgent(root, 'gforce-a.md', agentMarkdown({ name: 'gforce-a', bodyLines: 205 }));
    expect(validateNaming(root).errors.join()).toContain('200');
  });

  it('rejects a non-semver version', () => {
    const root = fixture();
    writeAgent(root, 'gforce-a.md', agentMarkdown({ name: 'gforce-a', version: 'v1' }));
    expect(validateNaming(root).errors.join()).toContain('semver');
  });

  it('rejects a skill whose name does not match its directory', () => {
    const root = fixture();
    writeSkill(root, 'gforce-demo', skillMarkdown('gforce-other'));
    expect(validateNaming(root).errors.join()).toContain('directory');
  });

  it('passes the real repository under strict namespace enforcement', () => {
    const r = validateNaming('.', { strict: true });
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
});
