import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { changedFiles } from './lib/git.js';

/** A PR that changes an agent must carry a current eval scorecard
 *  (standards/evals/<name>.scorecard.json with a matching content_sha256).
 *  This never runs the evals — burning eval tokens is always an explicit
 *  human decision; it only verifies the recorded result is current. */
export function checkScorecards(root: string, baseRef: string): string[] {
  const problems: string[] = [];
  for (const file of changedFiles(root, baseRef)) {
    if (!/^agents\/[^/]+\.md$/.test(file)) continue;
    const path = join(root, file);
    if (!existsSync(path)) continue; // deleted agent
    const name = basename(file, '.md');
    const card = join(root, 'standards', 'evals', `${name}.scorecard.json`);
    if (!existsSync(card)) {
      problems.push(
        `${file} changed but standards/evals/${name}.scorecard.json is missing — dispatch the eval suite and record the score`,
      );
      continue;
    }
    const want = createHash('sha256').update(readFileSync(path)).digest('hex');
    const have = (JSON.parse(readFileSync(card, 'utf8')) as { content_sha256?: string }).content_sha256;
    if (want !== have) {
      problems.push(`${file} changed but its scorecard hash is stale — re-run the eval suite against the new content`);
    }
  }
  return problems;
}
