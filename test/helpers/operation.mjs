import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';

export function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'repo-canon-operation-'));
  for (const [path, content] of Object.entries(files)) {
    const absolute = join(root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  }
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  return { root, close: () => rmSync(root, { recursive: true, force: true }) };
}

export function invokeCheck(script, root, overrides = {}) {
  const request = {
    format: 'repo-standards/operation/v1',
    operation: { declaration: 'repository-readme', phase: 'checks', id: 'structure' },
    projectRoot: root,
    standards: {
      repository: 'https://github.com/lutzseverino/repo-canon',
      version: 'v0.0.0-test',
      commit: '0000000000000000000000000000000000000000',
    },
    profile: 'complete',
    declarations: [],
    allowedTargets: { paths: ['README.md'], directories: [] },
    ...overrides,
  };
  const child = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: 'utf8',
    input: JSON.stringify(request),
  });
  return {
    ...child,
    result: child.status === 0 && child.stdout.trim() ? JSON.parse(child.stdout) : null,
  };
}

export function snapshot(root) {
  const entries = {};
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const absolute = join(directory, entry.name);
      const path = relative(root, absolute).replaceAll('\\', '/');
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isSymbolicLink()) entries[path] = `symlink:${readlinkSync(absolute)}`;
      else entries[path] = readFileSync(absolute).toString('base64');
    }
  }
  visit(root);
  return entries;
}
