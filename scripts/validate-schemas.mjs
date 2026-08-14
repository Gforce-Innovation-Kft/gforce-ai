#!/usr/bin/env node
// Validates upstream/catalog.json and every skills/*/overrides.json under the
// given root (default: repo root) against the schemas in schemas/.
// Zero LLM tokens, zero network. Exit 1 on any violation.
import Ajv from 'ajv';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] ?? join(here, '..');

const load = (p) => JSON.parse(readFileSync(p, 'utf8'));
const ajv = new Ajv({ allErrors: true });
const validateCatalog = ajv.compile(load(join(here, '..', 'schemas', 'catalog.schema.json')));
const validateOverrides = ajv.compile(load(join(here, '..', 'schemas', 'overrides.schema.json')));

let failed = false;

function check(validate, file) {
  let data;
  try {
    data = load(file);
  } catch (e) {
    console.error(`${file}: unreadable JSON — ${e.message}`);
    failed = true;
    return;
  }
  if (!validate(data)) {
    failed = true;
    for (const err of validate.errors) {
      console.error(`${file}: ${err.instancePath || '/'} ${err.message}`);
    }
  }
}

const catalog = join(root, 'upstream', 'catalog.json');
if (existsSync(catalog)) {
  check(validateCatalog, catalog);
} else {
  console.error(`missing ${catalog}`);
  failed = true;
}

const skillsDir = join(root, 'skills');
if (existsSync(skillsDir)) {
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const overrides = join(skillsDir, entry.name, 'overrides.json');
    if (existsSync(overrides)) check(validateOverrides, overrides);
  }
}

process.exit(failed ? 1 : 0);
