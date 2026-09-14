import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const script = join(repositoryRoot, 'scripts/create-engineering-skill-fixtures.mjs');

test('creates disposable engineering-skill repositories with their runtime prerequisites', t => {
  const parent = mkdtempSync(join(tmpdir(), 'repo-canon-engineering-skills-test-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const root = join(parent, 'fixtures');

  const child = spawnSync(process.execPath, [script, '--root', root], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  assert.equal(child.status, 0, child.stderr);
  const manifest = JSON.parse(child.stdout);

  assert.equal(manifest.format, 'repo-canon/engineering-skill-fixtures/v1');
  assert.equal(manifest.root, root);
  assert.ok(manifest.source.repository === null || typeof manifest.source.repository === 'string');
  assert.match(manifest.source.worktreeCommit, /^[a-f0-9]{40}$/);
  assert.match(manifest.source.fixtureBuilderSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(manifest.skills).sort(), [
    'ask-matt',
    'code-review',
    'codebase-design',
    'diagnosing-bugs',
    'domain-modeling',
    'improve-codebase-architecture',
    'research',
    'resolving-merge-conflicts',
    'tdd',
  ]);
  assert.deepEqual(Object.keys(manifest.repositories).sort(), [
    'architecture',
    'debugging',
    'merge-conflict',
    'modeling-research',
    'routing-review',
    'tdd',
  ]);

  for (const [name, repository] of Object.entries(manifest.repositories)) {
    assert.equal(execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: repository.path,
      encoding: 'utf8',
    }).trim(), 'true', name);
    assert.equal(
      readFileSync(join(repository.path, 'AGENTS.md'), 'utf8'),
      readFileSync(join(repositoryRoot, 'AGENTS.md'), 'utf8'),
      `${name} has the shared agent entry point`,
    );
    assert.equal(
      readFileSync(join(repository.path, 'CONTRIBUTING.md'), 'utf8'),
      readFileSync(join(repositoryRoot, 'CONTRIBUTING.md'), 'utf8'),
      `${name} has the shared contribution contract`,
    );
    assert.match(readFileSync(join(repository.path, 'docs/agents/project.md'), 'utf8'), /disposable local repository/);
    assert.match(readFileSync(join(repository.path, 'CONTEXT.md'), 'utf8'), /## Language/);
    assert.match(readFileSync(join(repository.path, 'docs/development/README.md'), 'utf8'), /npm test/);
    if (['architecture', 'debugging', 'modeling-research'].includes(name)) {
      assert.match(readFileSync(join(repository.path, 'docs/adr/README.md'), 'utf8'), /Architecture decisions/);
    }

    for (const skill of repository.skills) {
      const link = join(repository.path, '.agents/skills', skill);
      assert.equal(lstatSync(link).isSymbolicLink(), true, `${name} exposes ${skill} as a repo skill`);
      assert.equal(readlinkSync(link), manifest.skills[skill].path);
      assert.match(manifest.skills[skill].sha256, /^[a-f0-9]{64}$/);
    }
  }

  const conflict = manifest.repositories['merge-conflict'];
  assert.equal(execFileSync('git', ['diff', '--name-only', '--diff-filter=U'], {
    cwd: conflict.path,
    encoding: 'utf8',
  }).trim(), 'src/order-intake.mjs');
  assert.equal(execFileSync('git', ['rev-parse', '-q', '--verify', 'MERGE_HEAD'], {
    cwd: conflict.path,
    encoding: 'utf8',
  }).trim().length, 40);

  const shimDirectory = join(parent, 'bin');
  const gitShim = join(shimDirectory, 'git');
  const actualGit = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
  mkdirSync(shimDirectory);
  writeFileSync(gitShim, `#!/bin/sh\nif [ "$1" = config ] && [ "$2" = --get ] && [ "$3" = remote.origin.url ]; then\n  exit 1\nfi\nexec "${actualGit}" "$@"\n`);
  chmodSync(gitShim, 0o755);
  const remoteLessRoot = join(parent, 'remote-less-fixtures');
  const remoteLess = spawnSync(process.execPath, [script, '--root', remoteLessRoot], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${shimDirectory}:${process.env.PATH}`,
      GIT_CONFIG_COUNT: '3',
      GIT_CONFIG_KEY_0: 'commit.gpgSign',
      GIT_CONFIG_VALUE_0: 'true',
      GIT_CONFIG_KEY_1: 'gpg.program',
      GIT_CONFIG_VALUE_1: '/bin/false',
      GIT_CONFIG_KEY_2: 'gpg.format',
      GIT_CONFIG_VALUE_2: 'openpgp',
    },
  });
  assert.equal(remoteLess.status, 0, remoteLess.stderr);
  assert.equal(JSON.parse(remoteLess.stdout).source.repository, null);
});
