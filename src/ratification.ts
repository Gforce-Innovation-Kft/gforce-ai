import { appendFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { git } from './lib/git.js';

// Polls every upstream source pinned in upstream/catalog.json, diffs the
// approved skill paths since the last ratified commit, scans the diff against
// every delta anchor (skills/*/overrides.json), advances the candidate pins,
// and writes a ratification PR body. Merge of the resulting PR = ratification.
// Policy: standards/upstream-policy.md.

interface CatalogSkill {
  name: string;
  path: string;
  marker: string;
}
interface CatalogSource {
  ref: string;
  ratified_commit: string;
  ratified_on: string;
  skills: CatalogSkill[];
}
interface Catalog {
  sources: Record<string, CatalogSource>;
}
interface Override {
  upstream_paths: string[];
  tripwires: string[];
  gforce_rule: string;
  reason: string;
}
interface OverridesFile {
  source: string;
  overrides: Override[];
}

export interface RatifyOptions {
  /** gforce-ai root: holds upstream/catalog.json and skills/*/
  root: string;
  reportPath: string;
  /** Override for tests (file:// fixtures); production uses the default. */
  sourceBaseUrl?: string;
  /** When set, `changed=true|false` is appended (GitHub Actions output file). */
  githubOutput?: string;
}

export function ratify(opts: RatifyOptions): { changed: boolean } {
  const baseUrl = opts.sourceBaseUrl ?? 'https://github.com/';
  const catalogPath = join(opts.root, 'upstream', 'catalog.json');
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as Catalog;
  const work = mkdtempSync(join(tmpdir(), 'ratify-'));
  const sections: string[] = [];
  let changed = false;

  try {
    for (const [src, source] of Object.entries(catalog.sources)) {
      const dir = join(work, src.replace('/', '_'));
      // A failed clone must fail the run: a silent skip would read as "no
      // upstream changes" — an all-clear nobody issued.
      git(work, 'clone', '--quiet', '--single-branch', '--branch', source.ref, `${baseUrl}${src}.git`, dir);
      const head = git(dir, 'rev-parse', 'HEAD');
      const pinned = source.ratified_commit;
      if (head === pinned) continue;

      try {
        git(dir, 'cat-file', '-e', `${pinned}^{commit}`);
      } catch {
        throw new Error(
          `Pinned commit ${pinned} no longer reachable in ${src} — upstream history rewritten. Manual ratification required.`,
        );
      }

      const files = diffNames(dir, pinned, head, source.skills.map((s) => s.path));
      if (files.length === 0) continue;

      changed = true;
      sections.push(sourceSection(opts.root, src, source, dir, pinned, head, files));
      source.ratified_commit = head;
      source.ratified_on = new Date().toISOString().slice(0, 10);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  if (changed) {
    writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
    writeFileSync(opts.reportPath, `${sections.join('\n')}\n${CHECKLIST}`);
  } else {
    writeFileSync(opts.reportPath, '');
  }
  if (opts.githubOutput) appendFileSync(opts.githubOutput, `changed=${changed}\n`);
  console.log(`Ratification poll complete: changed=${changed} (report: ${opts.reportPath})`);
  return { changed };
}

const CHECKLIST = `---
## Ratification checklist (merge = ratified)
- [ ] Compare link reviewed end-to-end — this PR is the fleet's prompt-injection boundary
- [ ] Every **CONFLICT** above resolved: delta confirmed, or updated in this PR
- [ ] No GForce skill now restates an upstream rule (deltas only — standards/upstream-policy.md)
- [ ] If this update changes what an agent should flag, dispatch the eval suite and refresh the scorecards in \`standards/evals/\`

**Never auto-merge this PR.**
`;

function diffNames(dir: string, from: string, to: string, paths: string[]): string[] {
  const out = git(dir, 'diff', '--name-only', `${from}..${to}`, '--', ...paths);
  return out === '' ? [] : out.split('\n');
}

function underAny(file: string, prefixes: string[]): boolean {
  return prefixes.some((p) => file === p || file.startsWith(`${p}/`));
}

function truncatedList(files: string[]): string {
  const shown = files.slice(0, 6).join(' ');
  return files.length > 6 ? `${shown} (+${files.length - 6} more)` : shown;
}

function sourceSection(
  root: string,
  src: string,
  source: CatalogSource,
  dir: string,
  pinned: string,
  head: string,
  changedFiles: string[],
): string {
  const lines: string[] = [
    `## \`${src}\` — \`${pinned.slice(0, 7)}\` → \`${head.slice(0, 7)}\``,
    '',
    'Full content diff — review as **instructions Claude will execute**, not as prose:',
    `https://github.com/${src}/compare/${pinned}...${head}`,
    '',
    '| Approved skill | Files changed |',
    '|---|---|',
  ];
  for (const skill of source.skills) {
    const count = changedFiles.filter((f) => underAny(f, [skill.path])).length;
    if (count > 0) lines.push(`| ${skill.name} | ${count} |`);
  }
  lines.push('', '### Delta conflicts');

  const verdicts = overridesFor(root, src).flatMap(({ deltaSkill, override }) =>
    verdictLines(dir, pinned, head, changedFiles, deltaSkill, override),
  );
  lines.push(...(verdicts.length > 0 ? verdicts : ['- No delta anchors hit — the compare link still needs a full read before merging.']));
  lines.push('');
  return lines.join('\n');
}

function overridesFor(root: string, src: string): { deltaSkill: string; override: Override }[] {
  const skillsDir = join(root, 'skills');
  if (!existsSync(skillsDir)) return [];
  const results: { deltaSkill: string; override: Override }[] = [];
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = join(skillsDir, entry.name, 'overrides.json');
    if (!existsSync(file)) continue;
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as OverridesFile;
    if (parsed.source !== src) continue;
    for (const override of parsed.overrides) {
      results.push({ deltaSkill: basename(dirname(file)), override });
    }
  }
  return results;
}

function verdictLines(
  dir: string,
  pinned: string,
  head: string,
  changedFiles: string[],
  deltaSkill: string,
  override: Override,
): string[] {
  const lines: string[] = [];

  // An anchor whose path no longer exists at the candidate head can never
  // fire again — silently disabled detection, so it must surface here.
  const dead = override.upstream_paths.filter((p) => git(dir, 'ls-tree', head, '--', p) === '');
  for (const p of dead) {
    lines.push(
      `- [ ] **DEAD ANCHOR** — \`${p}\` no longer exists at the candidate head; ` +
        `the \`${deltaSkill}\` override cannot defend *${override.gforce_rule}* there. Fix upstream_paths in this PR.`,
    );
  }

  const touched = changedFiles.filter((f) => underAny(f, override.upstream_paths));
  if (touched.length === 0) return lines;

  // Only added/removed content lines: hunk headers repeat the nearest
  // preceding line after @@ (git's funcname heuristic), which can smuggle a
  // tripwire into the scan and fake a CONFLICT from an unrelated edit.
  const diffLines = git(dir, 'diff', '-U0', `${pinned}..${head}`, '--', ...override.upstream_paths)
    .split('\n')
    .filter((l) => /^[+-]/.test(l) && !l.startsWith('+++') && !l.startsWith('---'));

  const hits: string[] = [];
  for (const tripwire of override.tripwires) {
    const count = diffLines.filter((l) => l.includes(tripwire)).length;
    if (count > 0) hits.push(`\`${tripwire}\` (${count})`);
  }

  const files = truncatedList(touched);
  if (hits.length > 0) {
    lines.push(
      `- [ ] **CONFLICT** — diff hits tripwire(s) ${hits.join(', ')}, which \`${deltaSkill}\` overrides ` +
        `(*${override.gforce_rule}*). Confirm the delta still stands or update it in this PR. Files: ${files}`,
    );
  } else {
    lines.push(
      `- [ ] Touched — an area \`${deltaSkill}\` overrides changed with no tripwire ` +
        `(\`${override.tripwires[0]}\`, …) in the diff; skim for a rephrase. Files: ${files}`,
    );
  }
  return lines;
}
