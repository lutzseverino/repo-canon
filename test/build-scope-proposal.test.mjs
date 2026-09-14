import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

const repositoryRoot = new URL('..', import.meta.url).pathname;

test('binds reviewed scope rationale to identities from one public inspection', t => {
  const root = mkdtempSync(join(tmpdir(), 'repo-canon-scope-builder-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const inspectionPath = join(root, 'inspection.json');
  const templatePath = join(root, 'template.json');
  const proposalPath = join(root, 'proposal.json');
  writeFileSync(inspectionPath, JSON.stringify({
    format: 'repo-standards/inspection/v2',
    discovery: {
      identity: 'sha256:request',
      evidence: [
        { kind: 'directory', path: '.', identity: 'sha256:root' },
        { kind: 'file', path: 'module/package.json', identity: 'sha256:manifest' },
      ],
    },
  }));
  writeFileSync(templatePath, JSON.stringify({
    format: 'repo-canon/scope-template/v1',
    declarations: [{
      id: 'project-readmes',
      paths: ['module/README.md'],
      coverage: 'The module is the sole maintained Project.',
      evidence: [{ kind: 'directory', path: '.' }],
      candidates: [{
        path: 'module/README.md',
        decision: 'include',
        reason: 'The manifest establishes the Project and its README is absent.',
        evidence: [
          { kind: 'file', path: 'module/package.json' },
          { kind: 'absence', path: 'module/README.md' },
        ],
      }],
      unresolved: [],
    }],
  }));

  execFileSync('node', ['scripts/build-scope-proposal.mjs', inspectionPath, templatePath, proposalPath], {
    cwd: repositoryRoot,
  });
  assert.deepEqual(JSON.parse(readFileSync(proposalPath, 'utf8')), {
    format: 'repo-standards/scope/v1',
    request: 'sha256:request',
    declarations: [{
      id: 'project-readmes',
      paths: ['module/README.md'],
      coverage: 'The module is the sole maintained Project.',
      evidence: [{ kind: 'directory', path: '.', identity: 'sha256:root' }],
      candidates: [{
        path: 'module/README.md',
        decision: 'include',
        reason: 'The manifest establishes the Project and its README is absent.',
        evidence: [
          { kind: 'file', path: 'module/package.json', identity: 'sha256:manifest' },
          { kind: 'absence', path: 'module/README.md' },
        ],
      }],
      unresolved: [],
    }],
  });

  const repeated = spawnSync('node', [
    'scripts/build-scope-proposal.mjs', inspectionPath, templatePath, proposalPath,
  ], { cwd: repositoryRoot, encoding: 'utf8' });
  assert.notEqual(repeated.status, 0);
  assert.match(repeated.stderr, /EEXIST/);
});

test('rejects rationale that cites evidence absent from the bound inspection', t => {
  const root = mkdtempSync(join(tmpdir(), 'repo-canon-scope-builder-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const inspectionPath = join(root, 'inspection.json');
  const templatePath = join(root, 'template.json');
  writeFileSync(inspectionPath, JSON.stringify({
    format: 'repo-standards/inspection/v2',
    discovery: { identity: 'sha256:request', evidence: [] },
  }));
  writeFileSync(templatePath, JSON.stringify({
    format: 'repo-canon/scope-template/v1',
    declarations: [{
      id: 'project-readmes', paths: [], coverage: 'Reviewed.',
      evidence: [{ kind: 'file', path: 'missing' }], candidates: [], unresolved: [],
    }],
  }));

  const result = spawnSync('node', [
    'scripts/build-scope-proposal.mjs', inspectionPath, templatePath, join(root, 'proposal.json'),
  ], { cwd: repositoryRoot, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not contain file evidence for missing/);
});
