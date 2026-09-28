// Shared steps of the read-only release scripts. Nothing here changes the
// repository or GitHub: commits are read with `git archive` and `git show`,
// and every extracted tree lives in a temporary directory that is removed.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export class ReleaseCheckFailure extends Error {}

export function fail(message) {
  throw new ReleaseCheckFailure(message);
}

// Runs a script body and turns a failed check into a message and a non-zero
// exit status. Unexpected errors keep their stack trace.
export async function runScript(name, usage, arity, body) {
  const args = process.argv.slice(2);
  try {
    if (args.length !== arity) fail(`Usage: ${usage}`);
    await body(...args);
  } catch (error) {
    if (!(error instanceof ReleaseCheckFailure)) throw error;
    console.error(`${name}: ${error.message}`);
    process.exitCode = 1;
  }
}

export function run(command, args, options = {}) {
  const child = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...options });
  if (child.error) fail(`Could not run ${command}: ${child.error.message}`);
  return child;
}

export function parseJson(text, description) {
  try {
    return JSON.parse(text);
  } catch {
    return fail(`${description} is not JSON: ${text.trim().slice(0, 500)}`);
  }
}

export function git(args) {
  const child = run('git', ['--literal-pathspecs', ...args]);
  if (child.status !== 0) fail(`git ${args[0]} failed: ${child.stderr.trim()}`);
  return child.stdout;
}

export function resolveCommit(revision) {
  const child = run('git', ['rev-parse', '--verify', '--quiet', '--end-of-options', `${revision}^{commit}`]);
  if (child.status !== 0) fail(`${revision} does not name a commit in this repository; fetch it first.`);
  return child.stdout.trim();
}

export function resolveTag(tag) {
  const child = run('git', ['rev-parse', '--verify', '--quiet', '--end-of-options', `refs/tags/${tag}^{commit}`]);
  if (child.status !== 0) fail(`${tag} is not a tag in this repository; fetch the release tags first.`);
  return child.stdout.trim();
}

// Returns a reader of the files at a commit, for checks of its documents.
export function filesAt(commit) {
  return path => git(['show', `${commit}:${path}`]);
}

// The public Repository Standards CLI, installed outside the checkout under
// REPO_STANDARDS_PREFIX as the source profile and CI describe.
export function repoStandardsCli() {
  const prefix = process.env.REPO_STANDARDS_PREFIX;
  if (!prefix) {
    fail('Set REPO_STANDARDS_PREFIX to the directory where the public Repository Standards CLI is installed, '
      + 'as docs/development/source-profile.md describes.');
  }
  const executable = join(prefix, 'node_modules/.bin/repo-standards');
  if (!existsSync(executable)) fail(`No Repository Standards CLI is installed at ${executable}.`);
  return executable;
}

export function withTemporaryDirectory(prefix, body) {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  try {
    return body(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

// Paths that the resolved declarations select: `standards.yaml` and each
// declaration's exact file, guidance, discovery, skill directory, and operation
// scripts and resources.
function selectedPaths(validation) {
  const paths = new Set(['standards.yaml']);
  for (const profile of Object.values(validation.profiles)) {
    for (const declaration of profile.declarations) {
      for (const field of ['exact', 'guidance', 'discovery', 'source']) {
        if (declaration[field] != null) paths.add(declaration[field]);
      }
      for (const operation of [...(declaration.checks ?? []), ...(declaration.fixes ?? [])]) {
        paths.add(operation.run.script);
        for (const resource of operation.run.resources ?? []) paths.add(resource);
      }
    }
  }
  return [...paths].sort();
}

// Lists the source inputs that a commit selects, as `source validate --json`
// reports them for every profile of that commit's tree.
export function sourceInputsAt(commit) {
  const cli = repoStandardsCli();
  return withTemporaryDirectory('repo-canon-release-', directory => {
    const archive = join(directory, 'source.tar');
    const tree = join(directory, 'source');
    git(['archive', '--format=tar', '--prefix=source/', `--output=${archive}`, commit]);
    const extracted = run('tar', ['-x', '-f', archive, '-C', directory]);
    if (extracted.status !== 0) fail(`Could not extract ${commit}: ${extracted.stderr.trim()}`);

    const child = run(cli, ['source', 'validate', tree, '--json']);
    const validation = parseJson(child.stdout || child.stderr, `source validate output for ${commit}`);
    if (child.status !== 0 || validation.valid !== true) {
      const errors = (validation.errors ?? []).map(error => `  ${error.message}`).join('\n');
      fail(`The source at ${commit} does not validate:\n${errors}`);
    }
    return selectedPaths(validation);
  });
}

export function union(...lists) {
  return [...new Set(lists.flat())].sort();
}
