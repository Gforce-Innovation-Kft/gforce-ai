#!/usr/bin/env npx tsx
// Governance CLI — every command is static (zero LLM tokens). CI and humans
// call the same entry points: npx tsx src/cli.ts <command>
import { checkScorecards } from './check-scorecard.js';
import { checkVersionBump } from './check-version-bump.js';
import { ratify } from './ratification.js';
import { validateNaming } from './validate-naming.js';
import { validateSchemas } from './validate-schemas.js';

const USAGE = `usage: cli.ts <command>
  naming [--strict]            agent/skill frontmatter, namespace, structure
  schemas                      catalog.json + overrides.json against schemas/
  version-bump <base-ref>      changed skills/agents must bump their version
  scorecards [--advisory] <base-ref>
                               changed agents must carry a current scorecard
  ratify                       poll upstream pins (env: REPORT_PATH,
                               GITHUB_OUTPUT, SOURCE_BASE_URL)`;

function report(errors: string[], warnings: string[] = []): never {
  for (const w of warnings) console.warn(`WARN: ${w}`);
  for (const e of errors) console.error(`ERROR: ${e}`);
  console.log(`${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(errors.length === 0 ? 0 : 1);
}

const [command, ...args] = process.argv.slice(2);
switch (command) {
  case 'naming': {
    const { errors, warnings } = validateNaming('.', { strict: args.includes('--strict') });
    report(errors, warnings);
    break;
  }
  case 'schemas':
    report(validateSchemas('.'));
    break;
  case 'version-bump': {
    const base = args[0];
    if (!base) throw new Error(USAGE);
    report(checkVersionBump('.', base));
    break;
  }
  case 'scorecards': {
    const advisory = args.includes('--advisory');
    const base = args.filter((a) => a !== '--advisory')[0];
    if (!base) throw new Error(USAGE);
    const problems = checkScorecards('.', base);
    if (advisory) report([], problems);
    report(problems);
    break;
  }
  case 'ratify': {
    const reportPath = process.env['REPORT_PATH'] ?? '/tmp/ratification-report.md';
    ratify({
      root: '.',
      reportPath,
      ...(process.env['SOURCE_BASE_URL'] ? { sourceBaseUrl: process.env['SOURCE_BASE_URL'] } : {}),
      ...(process.env['GITHUB_OUTPUT'] ? { githubOutput: process.env['GITHUB_OUTPUT'] } : {}),
    });
    break;
  }
  default:
    console.error(USAGE);
    process.exit(2);
}
