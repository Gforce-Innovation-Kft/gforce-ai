export interface Finding {
  file: string;
  category?: string;
  summary?: string;
  failure_scenario?: string;
}

export interface Assertions {
  /** Every entry must be matched by at least one finding. */
  mustFlag?: { file: string; category: string }[];
  /** No finding may carry any of these categories. */
  mustNotFlag?: string[];
  minFindings?: number;
  /** Set to 0 for a clean fixture — this is the false-positive control. */
  maxFindings?: number;
}

export interface Expected {
  description?: string;
  assert: Assertions;
}

export function checkExpected(
  expected: Expected,
  findings: Finding[]
): { failures: string[] } {
  const a = expected.assert;
  const failures: string[] = [];

  for (const want of a.mustFlag ?? []) {
    const hit = findings.some(
      (f) => f.file.endsWith(want.file) && f.category === want.category
    );
    if (!hit) {
      failures.push(
        `missed planted defect: expected a "${want.category}" finding on ${want.file}`
      );
    }
  }

  for (const banned of a.mustNotFlag ?? []) {
    if (findings.some((f) => f.category === banned)) {
      failures.push(`false positive: reported a "${banned}" finding, which is disallowed here`);
    }
  }

  if (a.minFindings !== undefined && findings.length < a.minFindings) {
    failures.push(`only ${findings.length} finding(s), expected at least ${a.minFindings}`);
  }

  if (a.maxFindings !== undefined && findings.length > a.maxFindings) {
    failures.push(
      `${findings.length} finding(s), expected at most ${a.maxFindings}` +
        (a.maxFindings === 0 ? ' — this is a clean fixture' : '')
    );
  }

  return { failures };
}
