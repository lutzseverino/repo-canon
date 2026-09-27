import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function sha256Directory(path) {
  const files = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(absolute);
      else throw new Error(`unsupported boundary-fixture entry: ${absolute}`);
    }
  }
  visit(path);
  files.sort((left, right) => Buffer.compare(
    Buffer.from(relative(path, left)),
    Buffer.from(relative(path, right)),
  ));

  const digest = createHash('sha256');
  for (const file of files) {
    digest.update(relative(path, file).replaceAll('\\', '/'));
    digest.update('\0');
    digest.update(readFileSync(file));
    digest.update('\0');
  }
  return digest.digest('hex');
}

test('planning and adoption fixture builder creates runnable bounded scenarios', () => {
  const parent = mkdtempSync(join(tmpdir(), 'repo-canon-planning-test-'));
  const target = join(parent, 'fixtures');

  try {
    const output = execFileSync(
      process.execPath,
      ['scripts/create-planning-skill-fixtures.mjs', '--root', target],
      { cwd: root, encoding: 'utf8' },
    );
    const manifest = JSON.parse(readFileSync(join(target, 'manifest.json'), 'utf8'));

    assert.match(output, /Created planning-skill fixtures/);
    assert.doesNotMatch(
      readFileSync(join(root, 'scripts', 'create-planning-skill-fixtures.mjs'), 'utf8'),
      /execFileSync\(['"]codex['"]/,
    );
    assert.deepEqual(Object.keys(manifest.repositories).sort(), [
      'adoption-preparation',
      'delivery',
      'planning',
      'setup',
      'triage-wayfinder',
    ]);
    assert.equal(manifest.source.upstreamCommit, '3cca18b368ae95cdbdebbff572ccafa662551015');
    assert.match(manifest.source.fixtureBuilderSha256, /^[a-f0-9]{64}$/);
    assert.equal(
      manifest.source.directoryHashSerialization,
      'repo-canon/directory-sha256/recursive-locale-path-nul-bytes-nul/v1',
    );
    for (const path of [
      'AGENTS.md',
      'CONTRIBUTING.md',
      'docs/agents/README.md',
      'docs/agents/domain.md',
      'docs/agents/issue-tracker.md',
      'docs/agents/triage-labels.md',
      'scripts/create-planning-skill-fixtures.mjs',
      'scripts/support/fixture-authoring.mjs',
    ]) {
      assert.match(manifest.source.inputFiles[path].sha256, /^[a-f0-9]{64}$/);
    }
    assert.deepEqual(Object.keys(manifest.source.linkedSkillDirectories).sort(), [
      'code-review',
      'domain-modeling',
      'grill-with-docs',
      'grilling',
      'implement',
      'prototype',
      'research',
      'setup-matt-pocock-skills',
      'tdd',
      'to-spec',
      'to-tickets',
      'triage',
      'wayfinder',
      'wizard',
    ]);
    assert.deepEqual(manifest.skills.map(({ name }) => name), [
      'setup-matt-pocock-skills',
      'grill-with-docs',
      'to-spec',
      'to-tickets',
      'triage',
      'wayfinder',
      'implement',
      'prototype',
      'wizard',
    ]);
    for (const skill of manifest.skills) {
      assert.match(skill.sha256, /^[a-f0-9]{64}$/);
    }
    for (const repository of Object.values(manifest.repositories)) {
      assert.equal(execFileSync('git', ['config', '--local', '--get', 'commit.gpgsign'], {
        cwd: repository.path,
        encoding: 'utf8',
      }).trim(), 'false');
      assert.equal(execFileSync('git', ['config', '--local', '--get', 'user.name'], {
        cwd: repository.path,
        encoding: 'utf8',
      }).trim(), 'Repo Canon Exercise');
      assert.equal(execFileSync('git', ['config', '--local', '--get', 'user.email'], {
        cwd: repository.path,
        encoding: 'utf8',
      }).trim(), 'exercise@example.invalid');
      assert.equal(execFileSync('git', ['branch', '--show-current'], {
        cwd: repository.path,
        encoding: 'utf8',
      }).trim(), 'main');
      assert.equal(execFileSync('git', ['remote'], { cwd: repository.path, encoding: 'utf8' }), '');
      for (const skill of readdirSync(join(repository.path, '.agents', 'skills'))) {
        const target = realpathSync(join(repository.path, '.agents', 'skills', skill));
        assert.equal(statSync(target).isDirectory(), true);
        assert.equal(manifest.source.linkedSkillDirectories[skill].path, target);
        assert.match(manifest.source.linkedSkillDirectories[skill].sha256, /^[a-f0-9]{64}$/);
      }
    }

    const setup = join(target, 'setup');
    assert.match(readFileSync(join(setup, 'AGENTS.md'), 'utf8'), /Keep the `Parcel` term/);
    assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: setup, encoding: 'utf8' }), '');

    const preparation = join(target, 'adoption-preparation');
    assert.match(readFileSync(join(preparation, 'candidate', 'AGENTS.md'), 'utf8'), /# Agent guidance/);
    assert.match(readFileSync(join(preparation, 'AGENTS.md'), 'utf8'), /Parcel API/);
    assert.match(readFileSync(join(preparation, 'docs', 'agents', 'issue-tracker.md'), 'utf8'), /Issue tracker/);

    const planning = join(target, 'planning');
    assert.match(readFileSync(join(planning, 'docs', 'agents', 'issue-tracker.md'), 'utf8'), /Local Markdown/);
    assert.match(readFileSync(join(planning, 'CONTEXT.md'), 'utf8'), /\*\*Parcel\*\*/);

    const triage = join(target, 'triage-wayfinder');
    assert.match(readFileSync(join(triage, '.scratch', 'triage', '01-export-receipts.md'), 'utf8'), /Status: needs-triage/);
    assert.match(readFileSync(join(triage, '.scratch', 'shipping-map', 'issues', '03-choose-retry-window.md'), 'utf8'), /Blocked by: 02/);

    const delivery = join(target, 'delivery');
    assert.throws(
      () => execFileSync(process.execPath, ['test/delivery.test.mjs'], { cwd: delivery, encoding: 'utf8', stdio: 'pipe' }),
      /Command failed/,
    );
    assert.match(readFileSync(join(delivery, '.github', 'workflows', 'delivery.yml'), 'utf8'), /secrets\.PARCEL_API_TOKEN/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test('planning builder supports later ordinary commits under hostile host signing', (t) => {
  const parent = mkdtempSync(join(tmpdir(), 'repo-canon-planning-signing-test-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const target = join(parent, 'fixtures');
  const globalGitConfig = join(parent, 'gitconfig');
  const globalGitConfigBytes = '[commit]\n\tgpgSign = true\n[gpg]\n\tprogram = /bin/false\n';
  writeFileSync(globalGitConfig, globalGitConfigBytes);
  execFileSync(process.execPath, ['scripts/create-planning-skill-fixtures.mjs', '--root', target], {
    cwd: root,
    env: { ...process.env, GIT_CONFIG_GLOBAL: globalGitConfig },
    stdio: 'pipe',
  });
  const manifest = JSON.parse(readFileSync(join(target, 'manifest.json'), 'utf8'));
  const repository = manifest.repositories.delivery.path;

  writeFileSync(join(repository, 'later-agent-work.md'), '# Later agent work\n');
  execFileSync('git', ['add', 'later-agent-work.md'], {
    cwd: repository,
    env: { ...process.env, GIT_CONFIG_GLOBAL: globalGitConfig },
  });
  execFileSync('git', ['commit', '--quiet', '-m', 'test: record later agent work'], {
    cwd: repository,
    env: { ...process.env, GIT_CONFIG_GLOBAL: globalGitConfig },
  });
  assert.equal(readFileSync(globalGitConfig, 'utf8'), globalGitConfigBytes);
});

test('managed update evidence is reproducible with fixture prerequisites', () => {
  const expectedSource = '570d12b3caf6c468d77e0aba8602efc7a5346697a77cb5372f623cf67247784b';
  const expectedCandidate = '13af6e0225c89e4b44d4476b4ca87681219f9d5a49566c5f2d3df173f766ee6d';
  const source = realpathSync(join(
    root,
    'vendor',
    'mattpocock-skills',
    'skills',
    'engineering',
    'setup-matt-pocock-skills',
  ));
  const parent = mkdtempSync(join(tmpdir(), 'repo-canon-managed-skill-test-'));
  const candidate = join(parent, 'setup-matt-pocock-skills');

  try {
    const before = sha256Directory(source);
    assert.equal(before, expectedSource);
    cpSync(source, candidate, { recursive: true });

    const skillPath = join(candidate, 'SKILL.md');
    const original = readFileSync(skillPath);
    const text = original.toString('utf8');
    assert.equal(Buffer.from(text, 'utf8').equals(original), true);
    const needle = "# Setup Matt Pocock's Skills\n\n";
    const replacement = `${needle}<!-- Synthetic candidate-only boundary-test change; do not promote. -->\n\n`;
    assert.equal(text.indexOf(needle), text.lastIndexOf(needle));
    assert.notEqual(text.indexOf(needle), -1);
    writeFileSync(skillPath, text.replace(needle, replacement), 'utf8');

    let diff;
    try {
      execFileSync('git', ['diff', '--no-index', '--exit-code', '--no-ext-diff', '--', source, candidate], {
        encoding: 'utf8',
        stdio: 'pipe',
      });
      assert.fail('candidate comparison should report a difference');
    } catch (error) {
      assert.equal(error.status, 1);
      diff = error.stdout;
    }
    assert.match(diff, /Synthetic candidate-only boundary-test change; do not promote/);
    assert.equal(sha256Directory(candidate), expectedCandidate);
    assert.equal(sha256Directory(source), before);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
  assert.equal(existsSync(parent), false);
});
