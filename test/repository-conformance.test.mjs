import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { lstatSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { invokeCheck } from './helpers/operation.mjs';

// This repository is an adopter of its own published standards, so the three
// shipped checks run against the real tree on every pull request instead of
// against fixtures only. The documentation paths below are the scope the
// completed self-adoption of v0.2.0 confirmed: the documentation tree, the
// repository-root glossary, the authoring notes, and the design review. The
// review drafts, the source-side guidance, the discovery instructions, and the
// vendored material stay out.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rootDocuments = ['CONTEXT.md', 'authoring-notes.md', 'design-review.md'];

// `discovery/documentation.md` keeps the exact-owned shared agent configuration
// outside documentation scope, and `standards.yaml` declares each of those files
// separately. The check still reads every Markdown file under `docs`, so leaving
// them out of this declaration does not reduce what it validates.
const exactOwnedAgentConfiguration = [
  'docs/agents/README.md',
  'docs/agents/domain.md',
  'docs/agents/issue-tracker.md',
  'docs/agents/triage-labels.md',
];

// The CLI's discovery observation refuses any file larger than this, which would
// reject the whole inspection before it reports anything.
const observationFileLimit = 8 * 1024 * 1024;

function trackedFiles() {
  return execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 })
    .split('\0')
    .filter(Boolean);
}

function operation(name) {
  return fileURLToPath(new URL(`../operations/${name}`, import.meta.url));
}

function documentationScope() {
  const documentation = trackedFiles()
    .filter(path => path.startsWith('docs/') && path.toLocaleLowerCase('en-US').endsWith('.md'))
    .filter(path => !exactOwnedAgentConfiguration.includes(path));
  return [...documentation, ...rootDocuments].sort();
}

test('the repository passes the documentation navigation check at its root', () => {
  const outcome = invokeCheck(operation('check-documentation.mjs'), root, {
    operation: { declaration: 'documentation', phase: 'checks', id: 'documentation-navigation' },
    allowedTargets: { paths: documentationScope(), directories: [] },
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'passed', outcome.result.message);
});

test('the repository passes the Project README check at its root', () => {
  const outcome = invokeCheck(operation('check-project-readmes.mjs'), root, {
    operation: { declaration: 'project-readmes', phase: 'checks', id: 'project-readme-structure' },
    allowedTargets: { paths: [], directories: [] },
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'passed', outcome.result.message);
});

test('the repository passes the Repository README check at its root', () => {
  const outcome = invokeCheck(operation('check-repository-readme.mjs'), root, {
    operation: { declaration: 'repository-readme', phase: 'checks', id: 'repository-readme-structure' },
    allowedTargets: { paths: ['README.md'], directories: [] },
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'passed', outcome.result.message);
});

test('no tracked file reaches the observation limit that would reject inspection', () => {
  const oversized = trackedFiles()
    .map(path => ({ path, state: lstatSync(join(root, path)) }))
    .filter(({ state }) => state.isFile() && state.size >= observationFileLimit)
    .map(({ path, state }) => `${path} (${state.size} bytes)`);

  assert.deepEqual(oversized, [], `keep every tracked file below ${observationFileLimit} bytes so the CLI can observe it`);
});
