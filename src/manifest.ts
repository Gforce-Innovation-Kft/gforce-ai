import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { git } from './lib/git.js';

// gforce-manifest.json gives agent copies the hash-pinned provenance that
// skills already have via skills-lock.json. The two never overlap: the
// lockfile belongs to the skills CLI, the manifest to GForce tooling.
// Generated at install/bump time, never hand-edited.

export interface Manifest {
  gforce_ai_commit: string;
  gforce_ai_release: string | null;
  agents: Record<string, string>;
  generated_at: string;
}

const MANIFEST_FILE = 'gforce-manifest.json';

function sha256(path: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
}

function agentFiles(consumerDir: string): string[] {
  const dir = join(consumerDir, '.claude', 'agents');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => join(dir, f));
}

export function generateManifest(consumerDir: string, gforceAiDir: string): Manifest {
  let release: string | null;
  try {
    release = git(gforceAiDir, 'describe', '--tags', '--abbrev=0', '--match', 'v*');
  } catch {
    release = null;
  }
  const agents: Record<string, string> = {};
  for (const file of agentFiles(consumerDir)) {
    agents[basename(file, '.md')] = sha256(file);
  }
  const manifest: Manifest = {
    gforce_ai_commit: git(gforceAiDir, 'rev-parse', 'HEAD'),
    gforce_ai_release: release,
    agents,
    generated_at: new Date().toISOString().slice(0, 10),
  };
  writeFileSync(join(consumerDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

/** Read-only. Empty list = OK; entries describe the drift. */
export function verifyManifest(consumerDir: string): string[] {
  const path = join(consumerDir, MANIFEST_FILE);
  if (!existsSync(path)) return [`${MANIFEST_FILE} is missing — run the manifest generator`];
  const manifest = JSON.parse(readFileSync(path, 'utf8')) as Manifest;

  const drift: string[] = [];
  const onDisk = new Map(agentFiles(consumerDir).map((f) => [basename(f, '.md'), f]));
  for (const [name, expected] of Object.entries(manifest.agents)) {
    const file = onDisk.get(name);
    if (!file) {
      drift.push(`agent '${name}' is in the manifest but missing from .claude/agents/`);
      continue;
    }
    if (sha256(file) !== expected) {
      drift.push(`agent '${name}' does not match its manifest hash — the copy was edited; changes belong in gforce-ai`);
    }
    onDisk.delete(name);
  }
  for (const name of onDisk.keys()) {
    drift.push(`agent '${name}' exists in .claude/agents/ but not in the manifest`);
  }
  return drift;
}
