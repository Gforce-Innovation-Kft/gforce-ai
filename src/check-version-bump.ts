import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter, stringField } from './lib/frontmatter.js';
import { changedFiles, git } from './lib/git.js';

/** A changed skill or agent must bump its frontmatter version. New units and
 *  deletions are exempt. Returns violations; empty means all bumped. */
export function checkVersionBump(root: string, baseRef: string): string[] {
  const units = new Set<string>();
  for (const file of changedFiles(root, baseRef)) {
    if (/^agents\/[^/]+\.md$/.test(file)) {
      units.add(file);
      continue;
    }
    const skill = file.match(/^skills\/([^/]+)\//);
    if (skill) units.add(`skills/${skill[1]}/SKILL.md`);
  }

  const errors: string[] = [];
  for (const unit of units) {
    if (!existsSync(join(root, unit))) continue; // deleted unit
    let baseContent: string;
    try {
      baseContent = git(root, 'show', `${baseRef}:${unit}`);
    } catch {
      continue; // new unit, absent at base
    }
    const oldVersion = versionOf(baseContent);
    const newVersion = versionOf(readFileSync(join(root, unit), 'utf8'));
    if (oldVersion === newVersion) {
      errors.push(`${unit} changed but version stayed '${newVersion ?? '<missing>'}' — bump it`);
    }
  }
  return errors;
}

function versionOf(content: string): string | undefined {
  const fm = parseFrontmatter(content);
  return fm ? stringField(fm, 'version') : undefined;
}
