import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'gforce-test-'));
}

export interface AgentOptions {
  name: string;
  tools?: string;
  model?: string;
  version?: string;
  description?: string[];
  bodyLines?: number;
}

export function agentMarkdown(opts: AgentOptions): string {
  const description = opts.description ?? [
    'Reviews things.',
    'TRIGGER when: reviewing X.',
    'DO NOT TRIGGER when: anything else.',
  ];
  const body = ['# Agent', '', ...Array(opts.bodyLines ?? 1).fill('body line')];
  return [
    '---',
    `name: ${opts.name}`,
    'description: >',
    ...description.map((l) => `  ${l}`),
    `tools: ${opts.tools ?? 'Read, Grep'}`,
    `model: ${opts.model ?? 'sonnet'}`,
    `version: ${opts.version ?? '1.0.0'}`,
    '---',
    '',
    ...body,
    '',
  ].join('\n');
}

export function skillMarkdown(name: string, version = '1.0.0', extraBody = ''): string {
  return [
    '---',
    `name: ${name}`,
    'description: Demo skill.',
    `version: ${version}`,
    '---',
    '',
    '# Skill',
    'rule one',
    ...(extraBody ? [extraBody] : []),
    '',
  ].join('\n');
}

export function writeAgent(root: string, filename: string, content: string): void {
  mkdirSync(join(root, 'agents'), { recursive: true });
  writeFileSync(join(root, 'agents', filename), content);
}

export function writeSkill(root: string, dir: string, content: string): void {
  mkdirSync(join(root, 'skills', dir), { recursive: true });
  writeFileSync(join(root, 'skills', dir, 'SKILL.md'), content);
}

export function git(cwd: string, ...args: string[]): string {
  return execFileSync(
    'git',
    ['-c', 'user.email=t@test', '-c', 'user.name=t', ...args],
    { cwd, encoding: 'utf8' },
  ).trim();
}

export function initRepo(dir: string): void {
  git(dir, 'init', '-q', '-b', 'main', '.');
}

export function commitAll(dir: string, message: string): string {
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', message);
  return git(dir, 'rev-parse', 'HEAD');
}
