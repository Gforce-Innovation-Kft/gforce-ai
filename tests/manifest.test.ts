import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateManifest, verifyManifest } from '../src/manifest.js';
import { agentMarkdown, makeTmpDir } from './helpers.js';

let consumer: string;
const agentPath = (): string => join(consumer, '.claude', 'agents', 'gforce-demo.md');

beforeAll(() => {
  consumer = makeTmpDir();
  mkdirSync(join(consumer, '.claude', 'agents'), { recursive: true });
  writeFileSync(agentPath(), agentMarkdown({ name: 'gforce-demo' }));
});
afterAll(() => rmSync(consumer, { recursive: true, force: true }));

function sessionReport(): string {
  return execFileSync('node', ['scripts/session-report.mjs', consumer], { encoding: 'utf8' });
}

describe('manifest + session report', () => {
  it('generates, verifies OK, and reports one clean line', () => {
    const manifest = generateManifest(consumer, '.');
    expect(Object.keys(manifest.agents)).toEqual(['gforce-demo']);
    expect(verifyManifest(consumer)).toEqual([]);
    expect(sessionReport()).toContain('GForce governance: OK —');
  });

  it('detects an edited agent copy as DRIFT', () => {
    writeFileSync(agentPath(), agentMarkdown({ name: 'gforce-demo', bodyLines: 3 }));
    expect(verifyManifest(consumer).join()).toContain('edited');
    expect(sessionReport()).toContain('GForce governance: DRIFT');
    generateManifest(consumer, '.'); // regenerate → clean again
    expect(verifyManifest(consumer)).toEqual([]);
  });
});
