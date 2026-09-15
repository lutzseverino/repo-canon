import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const helperPath = fileURLToPath(import.meta.url);

export const DIRECTORY_HASH_SERIALIZATION =
  'repo-canon/directory-sha256/recursive-locale-path-nul-bytes-nul/v1';

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

export function initializeFixtureRepository(root, { author, remote = null }) {
  git(root, ['init', '--quiet', '--initial-branch=main']);
  git(root, ['config', 'user.name', author.name]);
  git(root, ['config', 'user.email', author.email]);
  git(root, ['config', 'commit.gpgsign', 'false']);
  if (remote !== null) git(root, ['remote', 'add', 'origin', remote]);
}

export function commitFixture(root, message) {
  git(root, ['add', '--all']);
  git(root, ['commit', '--quiet', '--no-gpg-sign', '-m', message]);
  return git(root, ['rev-parse', 'HEAD']);
}

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function hashDirectory(root) {
  const digest = createHash('sha256');
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => (
      left.name.localeCompare(right.name)
    ))) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else {
        digest.update(relative(root, absolute).replaceAll('\\', '/'));
        digest.update('\0');
        digest.update(readFileSync(absolute));
        digest.update('\0');
      }
    }
  }
  visit(root);
  return digest.digest('hex');
}

export function identifyFixtureSource({ sourceRoot, builderPath, files = [], directories = {} }) {
  const helperSourcePath = relative(sourceRoot, helperPath).replaceAll('\\', '/');
  const sourceFiles = [...new Set([builderPath, ...files, helperSourcePath])];
  return {
    head: git(sourceRoot, ['rev-parse', 'HEAD']),
    inputFiles: Object.fromEntries(sourceFiles.map(path => [path, {
      sha256: hashFile(join(sourceRoot, path)),
    }])),
    directories: Object.fromEntries(Object.entries(directories).map(([name, path]) => [name, {
      path,
      sha256: hashDirectory(path),
    }])),
    directoryHashSerialization: DIRECTORY_HASH_SERIALIZATION,
  };
}
