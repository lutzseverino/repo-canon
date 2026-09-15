import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { basename, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
}

function sha256Directory(root) {
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

test('every builder identifies dirty source bytes independently of source HEAD', (t) => {
  const parent = mkdtempSync(join(tmpdir(), 'repo-canon-builder-provenance-test-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const source = join(parent, 'source');
  cpSync(repositoryRoot, source, {
    recursive: true,
    filter: (path) => basename(path) !== '.git',
  });
  git(source, 'init', '--quiet', '--initial-branch=main');
  git(source, 'config', 'user.name', 'Repo Canon provenance test');
  git(source, 'config', 'user.email', 'provenance@example.invalid');
  git(source, 'config', 'commit.gpgsign', 'false');
  git(source, 'add', '--all');
  git(source, 'commit', '--quiet', '-m', 'chore: establish provenance source');
  const sourceHead = git(source, 'rev-parse', 'HEAD');

  const dirtySharedPath = 'AGENTS.md';
  const dirtyHelperPath = 'scripts/support/fake-gh-adoption.mjs';
  const dirtyEngineeringSkill = 'vendor/mattpocock-skills/skills/engineering/tdd';
  const dirtyProductivitySkill = 'vendor/mattpocock-skills/skills/productivity/grilling';
  const committedEngineeringSkillSha256 = sha256Directory(join(source, dirtyEngineeringSkill));
  const committedProductivitySkillSha256 = sha256Directory(join(source, dirtyProductivitySkill));
  appendFileSync(join(source, dirtySharedPath), '\n<!-- uncommitted provenance test -->\n');
  appendFileSync(join(source, dirtyHelperPath), '\n// uncommitted provenance test\n');
  appendFileSync(join(source, dirtyEngineeringSkill, 'SKILL.md'), '\n<!-- uncommitted provenance test -->\n');
  appendFileSync(join(source, dirtyProductivitySkill, 'SKILL.md'), '\n<!-- uncommitted provenance test -->\n');
  const dirtySharedSha256 = sha256(readFileSync(join(source, dirtySharedPath)));
  const committedSharedSha256 = sha256(execFileSync('git', ['show', `HEAD:${dirtySharedPath}`], { cwd: source }));
  const dirtyHelperSha256 = sha256(readFileSync(join(source, dirtyHelperPath)));
  const dirtyEngineeringSkillSha256 = sha256Directory(join(source, dirtyEngineeringSkill));
  const dirtyProductivitySkillSha256 = sha256Directory(join(source, dirtyProductivitySkill));
  assert.notEqual(dirtySharedSha256, committedSharedSha256);
  assert.notEqual(dirtyEngineeringSkillSha256, committedEngineeringSkillSha256);
  assert.notEqual(dirtyProductivitySkillSha256, committedProductivitySkillSha256);

  const engineeringRoot = join(parent, 'engineering');
  const engineering = JSON.parse(execFileSync(
    process.execPath,
    [join(source, 'scripts/create-engineering-skill-fixtures.mjs'), '--root', engineeringRoot],
    { cwd: source, encoding: 'utf8' },
  ));
  assert.equal(engineering.source.worktreeCommit, sourceHead);
  assert.equal(engineering.source.inputFiles[dirtySharedPath].sha256, dirtySharedSha256);
  assert.equal(engineering.skills.tdd.sha256, dirtyEngineeringSkillSha256);

  const productivityRoot = join(parent, 'productivity');
  const productivity = JSON.parse(execFileSync(
    process.execPath,
    [join(source, 'scripts/create-productivity-skill-fixtures.mjs'), '--root', productivityRoot],
    { cwd: source, encoding: 'utf8' },
  ));
  assert.equal(productivity.source.worktreeCommit, sourceHead);
  assert.equal(productivity.source.inputFiles[dirtySharedPath].sha256, dirtySharedSha256);
  assert.equal(productivity.source.skills.grilling.sha256, dirtyProductivitySkillSha256);

  const planningRoot = join(parent, 'planning');
  execFileSync(
    process.execPath,
    [join(source, 'scripts/create-planning-skill-fixtures.mjs'), '--root', planningRoot],
    { cwd: source, stdio: 'pipe' },
  );
  const planning = JSON.parse(readFileSync(join(planningRoot, 'manifest.json'), 'utf8'));
  assert.equal(planning.source.repositoryHead, sourceHead);
  assert.equal(planning.source.inputFiles[dirtySharedPath].sha256, dirtySharedSha256);
  assert.equal(planning.source.linkedSkillDirectories.tdd.sha256, dirtyEngineeringSkillSha256);
  assert.equal(planning.source.linkedSkillDirectories.grilling.sha256, dirtyProductivitySkillSha256);

  const adoptionRoot = join(parent, 'adoption');
  execFileSync(process.execPath, [join(source, 'scripts/prepare-adoption-fixtures.mjs'), adoptionRoot], {
    cwd: source,
    stdio: 'pipe',
  });
  const adoption = JSON.parse(readFileSync(join(adoptionRoot, 'plan.json'), 'utf8'));
  assert.equal(adoption.createdWith.sourceHead, sourceHead);
  assert.equal(adoption.createdWith.inputFiles[dirtyHelperPath].sha256, dirtyHelperSha256);
});
