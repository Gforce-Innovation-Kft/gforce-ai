import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseFrontmatter, stringField, type Frontmatter } from './lib/frontmatter.js';

const NAMESPACE = /^gforce-[a-z0-9-]+$/;
const SEMVER = /^\d+\.\d+\.\d+$/;
const MAX_AGENT_BODY_LINES = 200;

export interface NamingResult {
  errors: string[];
  warnings: string[];
}

export interface NamingOptions {
  /** With strict, a missing gforce- namespace is an error instead of a warning. */
  strict?: boolean;
}

export function validateNaming(root: string, opts: NamingOptions = {}): NamingResult {
  const result: NamingResult = { errors: [], warnings: [] };

  const agentsDir = join(root, 'agents');
  if (existsSync(agentsDir)) {
    for (const file of readdirSync(agentsDir).filter((f) => f.endsWith('.md'))) {
      checkAgent(join(agentsDir, file), opts, result);
    }
  }

  const skillsDir = join(root, 'skills');
  if (existsSync(skillsDir)) {
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (entry.isDirectory()) checkSkill(join(skillsDir, entry.name), opts, result);
    }
  }

  return result;
}

function checkNamespace(
  name: string,
  where: string,
  opts: NamingOptions,
  result: NamingResult,
): void {
  if (NAMESPACE.test(name)) return;
  const message = `${where}: name '${name}' lacks the gforce- namespace`;
  if (opts.strict) result.errors.push(message);
  else result.warnings.push(message);
}

function checkVersion(fm: Frontmatter, where: string, result: NamingResult): void {
  const version = stringField(fm, 'version');
  if (!version || !SEMVER.test(version)) {
    result.errors.push(`${where}: 'version' must be semver (got '${version ?? '<missing>'}')`);
  }
}

function checkAgent(file: string, opts: NamingOptions, result: NamingResult): void {
  const fm = parseFrontmatter(readFileSync(file, 'utf8'));
  if (!fm) {
    result.errors.push(`${file}: missing or unparsable frontmatter`);
    return;
  }
  const stem = basename(file, '.md');
  const name = stringField(fm, 'name');
  if (!name) {
    result.errors.push(`${file}: missing frontmatter 'name'`);
    return;
  }
  if (name !== stem) result.errors.push(`${file}: name '${name}' must equal filename stem '${stem}'`);
  checkNamespace(name, file, opts, result);

  const tools = stringField(fm, 'tools');
  if (!tools) result.errors.push(`${file}: missing explicit 'tools' list`);
  else if (tools.includes('*')) result.errors.push(`${file}: tools must be an explicit list, never '*'`);

  if (!stringField(fm, 'model')) result.errors.push(`${file}: missing 'model'`);
  checkVersion(fm, file, result);

  // "DO NOT TRIGGER when:" contains "TRIGGER when:" as a substring, so the
  // positive check must look at the frontmatter with DO-NOT lines removed.
  const positiveLines = fm.raw
    .split('\n')
    .filter((l) => !l.includes('DO NOT TRIGGER'))
    .join('\n');
  if (!positiveLines.includes('TRIGGER when:')) {
    result.errors.push(`${file}: description must contain 'TRIGGER when:'`);
  }
  if (!fm.raw.includes('DO NOT TRIGGER when:')) {
    result.errors.push(`${file}: description must contain 'DO NOT TRIGGER when:'`);
  }

  if (fm.bodyLineCount > MAX_AGENT_BODY_LINES) {
    result.errors.push(`${file}: body exceeds ${MAX_AGENT_BODY_LINES} lines (agent-standard budget)`);
  }
}

function checkSkill(dir: string, opts: NamingOptions, result: NamingResult): void {
  const file = join(dir, 'SKILL.md');
  if (!existsSync(file)) {
    result.errors.push(`${dir}: missing SKILL.md`);
    return;
  }
  const fm = parseFrontmatter(readFileSync(file, 'utf8'));
  if (!fm) {
    result.errors.push(`${file}: missing or unparsable frontmatter`);
    return;
  }
  const name = stringField(fm, 'name');
  if (!name) {
    result.errors.push(`${file}: missing frontmatter 'name'`);
    return;
  }
  const dirName = basename(dir);
  if (name !== dirName) {
    result.errors.push(`${file}: name '${name}' must equal directory name '${dirName}'`);
  }
  checkNamespace(name, file, opts, result);
  checkVersion(fm, file, result);
  if (!stringField(fm, 'description')) result.errors.push(`${file}: missing 'description'`);
}
