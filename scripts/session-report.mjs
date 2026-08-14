#!/usr/bin/env node
// Read-only SessionStart governance report for consumer repos. One line when
// clean, detail only on drift. Never writes, never blocks, no dependencies —
// this file is vendored into consumers and must run on bare node.
//
// Usage: node session-report.mjs [consumer-dir]
// Mirrors src/manifest.ts verify logic; kept standalone on purpose so
// consumers need no npm install.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const root = process.argv[2] ?? '.';

const sha256 = (p) => `sha256:${createHash('sha256').update(readFileSync(p)).digest('hex')}`;

function agentFiles(dir) {
  const agents = join(dir, '.claude', 'agents');
  if (!existsSync(agents)) return [];
  return readdirSync(agents)
    .filter((f) => f.endsWith('.md'))
    .map((f) => join(agents, f));
}

const manifestPath = join(root, 'gforce-manifest.json');
if (!existsSync(manifestPath)) {
  console.log('GForce governance: no manifest — this repo is not governed yet');
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const drift = [];
const onDisk = new Map(agentFiles(root).map((f) => [basename(f, '.md'), f]));
for (const [name, expected] of Object.entries(manifest.agents ?? {})) {
  const file = onDisk.get(name);
  if (!file) drift.push(`agent '${name}' is in the manifest but missing from .claude/agents/`);
  else if (sha256(file) !== expected) drift.push(`agent '${name}' was edited locally — changes belong in gforce-ai`);
  onDisk.delete(name);
}
for (const name of onDisk.keys()) drift.push(`agent '${name}' is not in the manifest`);

const fleet = manifest.gforce_ai_release ?? (manifest.gforce_ai_commit ?? '').slice(0, 7);
const local = existsSync(join(root, '.claude', 'references', 'local-standards.md'))
  ? 'local standards active'
  : 'no local standards';

if (drift.length === 0) {
  console.log(`GForce governance: OK — fleet ${fleet} → agents ✓ → ${local}`);
} else {
  console.log(`GForce governance: DRIFT — fleet ${fleet}`);
  for (const d of drift) console.log(`  - ${d}`);
}
