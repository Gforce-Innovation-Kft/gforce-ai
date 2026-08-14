import { execFileSync } from 'node:child_process';

export function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trimEnd();
}

/** Files changed on our side vs the merge-base with baseRef. Throws on a bad ref —
 *  resolving to zero changed files would read as a pass nobody earned. */
export function changedFiles(root: string, baseRef: string): string[] {
  git(root, 'rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`);
  const out = git(root, 'diff', '--name-only', `${baseRef}...HEAD`);
  return out === '' ? [] : out.split('\n');
}
