import { Ajv, type ValidateFunction } from 'ajv';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const schemasDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'schemas');

const ajv = new Ajv({ allErrors: true });
const loadJson = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'));
const catalogValidator = ajv.compile(loadJson(join(schemasDir, 'catalog.schema.json')) as object);
const overridesValidator = ajv.compile(loadJson(join(schemasDir, 'overrides.schema.json')) as object);

/** Returns a list of violations; empty means everything validates. */
export function validateSchemas(root: string): string[] {
  const errors: string[] = [];

  const check = (validator: ValidateFunction, file: string): void => {
    let data: unknown;
    try {
      data = loadJson(file);
    } catch (e) {
      errors.push(`${file}: unreadable JSON — ${(e as Error).message}`);
      return;
    }
    if (!validator(data)) {
      for (const err of validator.errors ?? []) {
        errors.push(`${file}: ${err.instancePath || '/'} ${err.message ?? ''}`);
      }
    }
  };

  const catalog = join(root, 'upstream', 'catalog.json');
  if (existsSync(catalog)) check(catalogValidator, catalog);
  else errors.push(`missing ${catalog}`);

  const skillsDir = join(root, 'skills');
  if (existsSync(skillsDir)) {
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const overrides = join(skillsDir, entry.name, 'overrides.json');
      if (existsSync(overrides)) check(overridesValidator, overrides);
    }
  }

  return errors;
}
