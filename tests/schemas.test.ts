import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateSchemas } from '../src/validate-schemas.js';
import { makeTmpDir } from './helpers.js';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function fixtureWithOverrides(overridesJson: string): string {
  const root = makeTmpDir();
  dirs.push(root);
  mkdirSync(join(root, 'upstream'), { recursive: true });
  mkdirSync(join(root, 'skills', 'x'), { recursive: true });
  writeFileSync(
    join(root, 'upstream', 'catalog.json'),
    JSON.stringify({
      sources: {
        'acme/demo-skills': {
          ref: 'main',
          ratified_commit: 'a'.repeat(40),
          ratified_on: '2026-08-14',
          skills: [{ name: 'demo', path: 'skills/demo', marker: 'manual' }],
        },
      },
    }),
  );
  writeFileSync(join(root, 'skills', 'x', 'overrides.json'), overridesJson);
  return root;
}

describe('validateSchemas', () => {
  it('accepts the current format and rejects the pre-tripwires one', () => {
    const good = fixtureWithOverrides(
      JSON.stringify({
        source: 'acme/demo-skills',
        overrides: [
          {
            upstream_paths: ['skills/demo'],
            tripwires: ['WITH SECURITY_ENFORCED'],
            gforce_rule: 'WITH USER_MODE',
            reason: 'USER_MODE supersedes it',
          },
        ],
      }),
    );
    expect(validateSchemas(good)).toEqual([]);

    const old = fixtureWithOverrides(
      JSON.stringify({
        source: 'acme/demo-skills',
        overrides: [{ paths: ['skills/demo'], upstream_rule: 'FOO', gforce_rule: 'BAR' }],
      }),
    );
    expect(validateSchemas(old)).not.toEqual([]);
  });

  it('validates the real repository', () => {
    expect(validateSchemas('.')).toEqual([]);
  });
});
