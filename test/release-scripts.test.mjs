import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

// The release scripts run against disposable repositories. The public CLI and
// `gh` are external boundaries, so stubs stand in for them: the CLI stub
// reports the declarations a commit's `declarations.json` lists, and the `gh`
// stub reports the release state it is given.
const scripts = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'scripts/release');

const cliStub = `#!/usr/bin/env node
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const [command, subcommand, ...rest] = process.argv.slice(2);
if (command === 'source' && subcommand === 'validate') {
  const declarations = JSON.parse(readFileSync(join(rest[0], 'declarations.json'), 'utf8'));
  if (declarations === 'invalid') {
    console.log(JSON.stringify({ valid: false, errors: [{ message: 'Stub rejected the source.' }] }));
    process.exit(1);
  }
  console.log(JSON.stringify({ valid: true, errors: [], profiles: { complete: { declarations } } }));
} else if (command === 'inspect') {
  const args = process.argv.slice(2);
  const version = args[args.indexOf('--standards-version') + 1];
  const profile = args[args.indexOf('--profile') + 1];
  console.log(JSON.stringify({
    selection: {
      cli: { version: process.env.STUB_CLI_VERSION },
      standards: { version, commit: process.env.STUB_RESOLVED_COMMIT },
      profile,
    },
    sourceResolved: { declarations: [{ id: 'agent-guidance' }] },
  }));
} else {
  process.exit(2);
}
`;

const ghStub = `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'release' && args[1] === 'view' && process.env.STUB_RELEASE) {
  console.log(process.env.STUB_RELEASE);
} else {
  console.error('release not found');
  process.exit(1);
}
`;

// Fixture repositories ignore the maintainer's Git configuration, such as tag
// signing, so that they build the same everywhere.
const identity = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Fixture',
  GIT_AUTHOR_EMAIL: 'fixture@example.com',
  GIT_COMMITTER_NAME: 'Fixture',
  GIT_COMMITTER_EMAIL: 'fixture@example.com',
};

function executable(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  chmodSync(path, 0o755);
}

function fixture(t) {
  const base = mkdtempSync(join(tmpdir(), 'repo-canon-release-scripts-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const repository = join(base, 'repository');
  const prefix = join(base, 'cli');
  const bin = join(base, 'bin');
  executable(join(prefix, 'node_modules/.bin/repo-standards'), cliStub);
  executable(join(bin, 'gh'), ghStub);
  mkdirSync(repository);
  const git = (...args) => execFileSync('git', args, { cwd: repository, encoding: 'utf8', env: { ...process.env, ...identity } }).trim();
  git('init', '--quiet', '--initial-branch=main');
  git('init', '--quiet', '--bare', join(base, 'origin.git'));
  git('remote', 'add', 'origin', join(base, 'origin.git'));

  const commit = (files, message) => {
    for (const [path, content] of Object.entries(files)) {
      const absolute = join(repository, path);
      if (content === null) {
        rmSync(absolute);
        continue;
      }
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, typeof content === 'string' ? content : JSON.stringify(content));
    }
    git('add', '--all');
    git('commit', '--quiet', '--message', message);
    return git('rev-parse', 'HEAD');
  };

  const run = (script, args, environment = {}) => {
    const child = spawnSync(process.execPath, [join(scripts, script), ...args], {
      cwd: repository,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        REPO_STANDARDS_PREFIX: prefix,
        STUB_CLI_VERSION: '2.0.0',
        ...environment,
      },
    });
    return { status: child.status, output: `${child.stdout}${child.stderr}` };
  };

  return { git, commit, run };
}

const previousDeclarations = [
  { id: 'kept', kind: 'file', target: 'kept.md', exact: 'kept.md' },
  { id: 'dropped', kind: 'file', target: 'dropped.md', exact: 'dropped.md' },
  { id: 'skill', kind: 'skill', name: 'skill', source: 'skill' },
  {
    id: 'checked',
    kind: 'repository',
    guidance: 'guidance.md',
    checks: [{ id: 'check', run: { script: 'check.mjs', resources: ['lib'] } }],
    fixes: [],
  },
];
const candidateDeclarations = previousDeclarations.filter(declaration => declaration.id !== 'dropped');

function releasedSource(t) {
  const repository = fixture(t);
  repository.commit({
    'declarations.json': previousDeclarations,
    'kept.md': 'kept\n',
    'dropped.md': 'dropped\n',
    'skill/SKILL.md': 'skill\n',
    'guidance.md': 'guidance\n',
    'check.mjs': 'check\n',
    'lib/support.mjs': 'support\n',
    'notes.md': 'not an input\n',
  }, 'previous release');
  repository.git('tag', '--annotate', 'v1.0.0', '--message', 'Repo Canon v1.0.0');
  return repository;
}

test('release:inputs lists the inputs, the dropped inputs, and the diff stat from the previous tag', t => {
  const repository = releasedSource(t);
  repository.commit({
    'declarations.json': candidateDeclarations,
    'dropped.md': null,
    'lib/support.mjs': 'changed support\n',
    'notes.md': 'changed, but not an input\n',
  }, 'candidate');

  const { status, output } = repository.run('inputs.mjs', ['v1.0.0']);

  assert.equal(status, 0, output);
  for (const path of ['check.mjs', 'guidance.md', 'kept.md', 'lib', 'skill', 'standards.yaml']) {
    assert.match(output, new RegExp(`^  ${path.replaceAll('.', '\\.')}$`, 'm'));
  }
  assert.match(output, /no longer selects[^\n]*\n {2}dropped\.md$/m);
  assert.match(output, /lib\/support\.mjs \| 2 \+-/);
  assert.match(output, /dropped\.md\s+\| 1 -/);
  assert.doesNotMatch(output, /notes\.md/);
});

test('release:inputs reports an empty reviewed diff', t => {
  const repository = releasedSource(t);
  repository.commit({ 'notes.md': 'changed, but not an input\n' }, 'documentation only');

  const { status, output } = repository.run('inputs.mjs', ['v1.0.0']);

  assert.equal(status, 0, output);
  assert.match(output, /No source input changed since v1\.0\.0\./);
});

test('release:inputs fails clearly for a missing tag or CLI', t => {
  const repository = releasedSource(t);

  const missingTag = repository.run('inputs.mjs', ['v0.9.0']);
  assert.notEqual(missingTag.status, 0);
  assert.match(missingTag.output, /v0\.9\.0 is not a tag in this repository/);

  const missingCli = repository.run('inputs.mjs', ['v1.0.0'], { REPO_STANDARDS_PREFIX: '' });
  assert.notEqual(missingCli.status, 0);
  assert.match(missingCli.output, /Set REPO_STANDARDS_PREFIX/);

  const noArgument = repository.run('inputs.mjs', []);
  assert.notEqual(noArgument.status, 0);
  assert.match(noArgument.output, /Usage: npm run release:inputs -- <previous-tag>/);

  const emptyArgument = repository.run('inputs.mjs', ['']);
  assert.notEqual(emptyArgument.status, 0);
  assert.match(emptyArgument.output, /Usage: npm run release:inputs -- <previous-tag>/);
});

test('release:inputs fails with the CLI errors when a commit does not validate', t => {
  const repository = releasedSource(t);
  repository.commit({ 'declarations.json': '"invalid"' }, 'broken candidate');

  const { status, output } = repository.run('inputs.mjs', ['v1.0.0']);

  assert.notEqual(status, 0);
  assert.match(output, /does not validate[^\n]*\n.*Stub rejected the source\./);
});

test('release:check-merge passes when only files outside the inputs changed', t => {
  const repository = releasedSource(t);
  const reviewedHead = repository.git('rev-parse', 'HEAD');
  const mergeCommit = repository.commit({ 'notes.md': 'merged alongside\n' }, 'merge');

  const { status, output } = repository.run('check-merge.mjs', [reviewedHead, mergeCommit]);

  assert.equal(status, 0, output);
  assert.match(output, /carries exactly the reviewed source inputs/);
});

test('release:check-merge fails and names the input that changed after review', t => {
  const repository = releasedSource(t);
  const reviewedHead = repository.git('rev-parse', 'HEAD');
  const mergeCommit = repository.commit({ 'skill/SKILL.md': 'changed after review\n' }, 'merge');

  const { status, output } = repository.run('check-merge.mjs', [reviewedHead, mergeCommit]);

  assert.notEqual(status, 0);
  assert.match(output, /does not carry exactly the reviewed source inputs/);
  assert.match(output, /skill\/SKILL\.md/);
});

test('release:check-merge fails clearly for a commit that is not present', t => {
  const repository = releasedSource(t);
  const reviewedHead = repository.git('rev-parse', 'HEAD');

  const { status, output } = repository.run('check-merge.mjs', [reviewedHead, 'f'.repeat(40)]);

  assert.notEqual(status, 0);
  assert.match(output, /f{40} does not name a commit in this repository; fetch it first/);
});

// The development and authoring documents, each naming the CLI version given.
function developmentDocuments(cliVersion) {
  return {
    'docs/development/README.md': `Install public Repository Standards CLI ${cliVersion}.\n`,
    'docs/development/source-profile.md': `Install \`@lutzseverino/repo-standards@${cliVersion}\` with Git 2.18.0.\n`,
    'authoring-notes.md': `Use installed public CLI ${cliVersion} as the current validation baseline.\n`,
  };
}

// A published v1.0.0 release; `documents` replaces files of its commit.
function publishedRelease(t, documents = {}) {
  const repository = fixture(t);
  const releaseCommit = repository.commit({
    'declarations.json': previousDeclarations,
    'README.md': 'Select the [`v1.0.0` release](https://github.com/lutzseverino/repo-canon/releases/tag/v1.0.0).\n',
    'docs/usage/adopt-repo-canon.md': 'This guide selects `v1.0.0` with public CLI 2.0.0.\n',
    'standards.yaml': 'format: repo-standards/v2\nrequires:\n  repo-standards: ">=2.0.0"\n',
    ...developmentDocuments('2.0.0'),
    ...documents,
  }, 'release');
  repository.git('tag', '--annotate', 'v1.0.0', '--message', 'Repo Canon v1.0.0');
  repository.git('tag', '--annotate', 'v1.0.1', '--message', 'Repo Canon v1.0.1');
  repository.git('tag', 'v1.0.2');
  repository.git('push', '--quiet', 'origin', 'v1.0.0', 'v1.0.1', 'v1.0.2');
  const environment = {
    STUB_RELEASE: JSON.stringify({ isDraft: false, isPrerelease: false }),
    STUB_RESOLVED_COMMIT: releaseCommit,
  };
  return { ...repository, releaseCommit, environment };
}

test('release:verify passes a published release that agrees with its commit', t => {
  const { run, releaseCommit, environment } = publishedRelease(t);

  const { status, output } = run('verify.mjs', ['v1.0.0', releaseCommit], environment);

  assert.equal(status, 0, output);
  assert.match(output, /pass: tag v1\.0\.0 peels to/);
  assert.match(output, /pass: GitHub release v1\.0\.0 is neither a draft nor a prerelease/);
  assert.match(output, /pass: CLI 2\.0\.0 inspected v1\.0\.0 in a disposable repository/);
  assert.match(output, /pass: the documents name v1\.0\.0/);
});

test('release:verify fails a draft or prerelease', t => {
  const { run, releaseCommit, environment } = publishedRelease(t);

  const { status, output } = run('verify.mjs', ['v1.0.0', releaseCommit], {
    ...environment,
    STUB_RELEASE: JSON.stringify({ isDraft: true, isPrerelease: true }),
  });

  assert.notEqual(status, 0);
  assert.match(output, /fail: GitHub release v1\.0\.0 is a draft and a prerelease/);
});

test('release:verify fails when the tag does not peel to the release commit', t => {
  const { run, commit, environment } = publishedRelease(t);
  const later = commit({ 'notes.md': 'later\n' }, 'later');

  const { status, output } = run('verify.mjs', ['v1.0.0', later], { ...environment, STUB_RESOLVED_COMMIT: later });

  assert.notEqual(status, 0);
  assert.match(output, /fail: tag v1\.0\.0 on origin peels to [0-9a-f]{40}, not the release commit/);
});

test('release:verify fails a lightweight tag', t => {
  const { run, releaseCommit, environment } = publishedRelease(t);

  const { status, output } = run('verify.mjs', ['v1.0.2', releaseCommit], environment);

  assert.notEqual(status, 0);
  assert.match(output, /fail: tag v1\.0\.2 on origin is not an annotated tag/);
});

test('release:verify fails when the documents name another version', t => {
  const { run, releaseCommit, environment } = publishedRelease(t);

  const { status, output } = run('verify.mjs', ['v1.0.1', releaseCommit], environment);

  assert.notEqual(status, 0);
  assert.match(output, /fail: README\.md:1 names Repo Canon v1\.0\.0, not v1\.0\.1\./);
});

test('release:verify fails when a development or authoring document names another CLI version', t => {
  const { 'docs/development/source-profile.md': sourceProfile } = developmentDocuments('2.1.0');
  const { run, releaseCommit, environment } = publishedRelease(t, { 'docs/development/source-profile.md': sourceProfile });

  const { status, output } = run('verify.mjs', ['v1.0.0', releaseCommit], environment);

  assert.notEqual(status, 0);
  assert.match(output, /pass: CLI 2\.0\.0 inspected v1\.0\.0/);
  assert.match(output, /fail: docs\/development\/source-profile\.md:1 names CLI 2\.1\.0, not the standards\.yaml floor 2\.0\.0\./);
});

test('release:verify fails an inspection that does not resolve the release commit or uses another CLI', t => {
  const { run, releaseCommit, environment } = publishedRelease(t);

  const { status, output } = run('verify.mjs', ['v1.0.0', releaseCommit], {
    ...environment,
    STUB_RESOLVED_COMMIT: 'e'.repeat(40),
    STUB_CLI_VERSION: '2.1.0',
  });

  assert.notEqual(status, 0);
  assert.match(output, /fail: .*resolved commit e{40}, not the release commit/);
  assert.match(output, /fail: .*used CLI 2\.1\.0, not the required minimum 2\.0\.0/);
});

test('release:verify rejects a version that is not a stable release tag', t => {
  const { run, releaseCommit, environment } = publishedRelease(t);

  const { status, output } = run('verify.mjs', ['v1.0.0-rc.1', releaseCommit], environment);

  assert.notEqual(status, 0);
  assert.match(output, /v1\.0\.0-rc\.1 is not a stable release version such as v1\.2\.3/);
});
