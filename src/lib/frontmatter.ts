import { parse } from 'yaml';

export interface Frontmatter {
  /** Parsed YAML between the first two `---` markers. */
  data: Record<string, unknown>;
  /** Line count of everything after the closing `---`. */
  bodyLineCount: number;
  /** The raw frontmatter text (for substring checks on the trigger contract). */
  raw: string;
}

/** Returns null when the file has no leading `---` frontmatter block. */
export function parseFrontmatter(content: string): Frontmatter | null {
  const lines = content.split('\n');
  if (lines[0] !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end === -1) return null;

  const raw = lines.slice(1, end).join('\n');
  let data: Record<string, unknown>;
  try {
    data = (parse(raw) ?? {}) as Record<string, unknown>;
  } catch {
    return null;
  }
  const body = lines.slice(end + 1);
  // Trailing newline produces one empty trailing element; don't count it.
  if (body.length > 0 && body[body.length - 1] === '') body.pop();
  return { data, bodyLineCount: body.length, raw };
}

export function stringField(fm: Frontmatter, key: string): string | undefined {
  const v = fm.data[key];
  return typeof v === 'string' ? v : undefined;
}
