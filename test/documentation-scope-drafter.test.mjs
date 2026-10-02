import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { fixture, invokeCheck, retainedCheck, snapshot } from './helpers/operation.mjs';

const sourceRoot = fileURLToPath(new URL('..', import.meta.url));
const drafterPath = 'discovery/draft-documentation-scope.mjs';
const drafter = join(sourceRoot, drafterPath);
const check = join(sourceRoot, 'operations/check-documentation.mjs');

function draft(root, args = [], script = drafter) {
  const child = spawnSync(process.execPath, [script, '--project', root, ...args], { encoding: 'utf8' });
  return { ...child, proposal: child.status === 0 ? JSON.parse(child.stdout) : null };
}

// Drafts a fixture repository's scope, asserting that drafting changes
// nothing and that the proposal has the scope proposal's shape.
function drafted(t, files, args = [], prepare = () => {}) {
  const project = fixture(files);
  t.after(project.close);
  prepare(project.root);
  const before = snapshot(project.root);
  const outcome = draft(project.root, args);
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.stderr, '');
  assert.deepEqual(snapshot(project.root), before, 'the drafter must not change project content');
  assertScopeProposal(outcome.proposal, project.root);
  return { root: project.root, proposal: outcome.proposal, entry: outcome.proposal.declarations[0] };
}

// A regular file reached through real directories only, as the CLI observes it.
function isObservedFile(root, path) {
  const segments = path.split('/');
  try {
    return segments.slice(0, -1).every((_, index) => lstatSync(join(root, ...segments.slice(0, index + 1))).isDirectory())
      && lstatSync(join(root, path)).isFile();
  } catch {
    return false;
  }
}

function keptFiles(root) {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(path => path && isObservedFile(root, path));
}

// The Repository Standards 4.0.0 scope proposal (`repo-standards/scope/v2`):
// exactly these fields, nonempty text, include or exclude decisions, no
// duplicate entries, and evidence paths that the discovery observation holds
// as eligible files or directories. Every candidate cites evidence, apart from
// an included file that does not exist yet; a missing README cites a file or
// nonempty directory within its directory. Included paths are files.
function assertScopeProposal(proposal, root) {
  const fields = value => Object.keys(value).sort();
  const text = value => assert.ok(typeof value === 'string' && value.trim() !== '' && !value.includes('\0'), `nonempty text: ${value}`);
  const unique = values => assert.equal(new Set(values).size, values.length, `no duplicates: ${values}`);
  assert.deepEqual(fields(proposal), ['declarations', 'format']);
  assert.equal(proposal.format, 'repo-standards/scope/v2');
  assert.equal(proposal.declarations.length, 1);
  const [entry] = proposal.declarations;
  assert.deepEqual(fields(entry), ['candidates', 'coverage', 'id', 'unresolved']);
  assert.equal(entry.id, 'documentation');
  text(entry.coverage);
  entry.unresolved.forEach(text);
  unique(entry.unresolved);
  unique(entry.candidates.map(candidate => candidate.path));

  const files = keptFiles(root);
  const directories = new Set(files.flatMap(path => path.split('/').slice(0, -1)
    .map((_, index, segments) => segments.slice(0, index + 1).join('/'))));
  const eligible = path => files.includes(path) || directories.has(path);
  for (const candidate of entry.candidates) {
    assert.deepEqual(fields(candidate), ['decision', 'evidence', 'path', 'reason']);
    text(candidate.path);
    text(candidate.reason);
    assert.ok(['include', 'exclude'].includes(candidate.decision));
    candidate.evidence.forEach(text);
    unique(candidate.evidence);
    for (const path of candidate.evidence) assert.ok(eligible(path), `${candidate.path} cites eligible evidence: ${path}`);
    const entryState = lstatSync(join(root, candidate.path), { throwIfNoEntry: false });
    if (candidate.decision === 'include') assert.ok(!entryState?.isDirectory(), `${candidate.path} is a file`);
    if (candidate.decision === 'include' && !entryState) {
      if (candidate.path.endsWith('/README.md') && candidate.evidence.length > 0) {
        const parent = dirname(candidate.path);
        assert.ok(candidate.evidence.some(path => path === parent || path.startsWith(`${parent}/`)),
          `${candidate.path} cites evidence within its directory`);
      }
    } else {
      assert.ok(candidate.evidence.length > 0, `${candidate.path} cites evidence`);
    }
  }
}

const included = entry => entry.candidates.filter(candidate => candidate.decision === 'include').map(candidate => candidate.path);

// The declarations the CLI passes to the check, as `standards.yaml` declares
// them: the file declarations own their targets.
function fileDeclarations() {
  return readFileSync(join(sourceRoot, 'standards.yaml'), 'utf8').split('\n').flatMap(line => {
    const target = /^\s+target: (\S+)$/.exec(line);
    return target ? [{ kind: 'file', target: target[1], checks: [], fixes: [] }] : [];
  });
}

function checkDraftedScope(root, entry) {
  return invokeCheck(check, root, {
    operation: { declaration: 'documentation', phase: 'checks', id: 'documentation-navigation' },
    declarations: fileDeclarations(),
    allowedTargets: { paths: included(entry), directories: [] },
  });
}

function index(title, purpose, entries = []) {
  const items = entries.map(([entryTitle, path, description]) => `- [${entryTitle}](${path}): ${description}`);
  return `# ${title}\n\n${purpose}\n${items.length > 0 ? `\n${items.join('\n')}\n` : ''}`;
}

const developmentGuide = `# Development

This directory explains how to build and validate the project.

## Setup and validation

Install Node.js 24, then run \`npm test\` from the repository root.
`;

const coverage = roots => `Drafted from the repository tree by \`discovery/draft-documentation-scope.mjs\`: every file Git keeps under the documentation ${roots.includes(' and ') ? 'roots' : 'root'} ${roots}, a new index for each of ${roots.includes(' and ') ? 'their' : 'its'} directories without one, the development guide, and the domain glossaries and context maps the rules identify. Paths other declarations own are left out, and so is each README.md outside the documentation roots. Link-repair files and move destinations enter when the work needs them.`;

const underDocs = path => ({ path, decision: 'include', reason: 'A file under the documentation root `docs`.', evidence: [path] });
const owned = (path, id) => ({ path, decision: 'exclude', reason: `Owned by the \`${id}\` declaration.`, evidence: [path] });
const outsideIndex = path => ({
  path,
  decision: 'exclude',
  reason: 'A README.md outside the documentation roots, which the documentation check would read as a documentation root\'s index.',
  evidence: [path],
});
const unsupported = (path, directory) => `Repository Standards accepts the new \`${path}\` only with evidence inside \`${directory}\`, where Git keeps no file yet. Should that directory's first content be committed in a separate reviewed change before drafting again?`;

// A repository that follows every documentation rule, with the installed
// agent configuration, a domain glossary, a Project README, and ignored
// output.
const conforming = {
  '.gitignore': 'build/\n',
  'AGENTS.md': '# Agents\n',
  'CONTRIBUTING.md': '# Contributing\n',
  'README.md': '# Widget\n',
  'CONTEXT.md': '# Widget\n',
  'docs/README.md': index('Documentation', 'This directory maps the documentation categories.', [
    ['Usage', 'usage/README.md', 'using the widget.'],
    ['Development', 'development/README.md', 'building and validating the widget.'],
    ['Architecture decisions', 'adr/README.md', 'consequential decisions.'],
    ['Agent configuration', 'agents/README.md', 'agent workflow configuration.'],
  ]),
  'docs/usage/README.md': index('Usage', 'This directory explains how to use the widget.', [
    ['Install', 'install.md', 'installing the widget.'],
  ]),
  'docs/usage/install.md': '# Install\n\n![Overview](overview.svg)\n',
  'docs/usage/overview.svg': '<svg/>\n',
  'docs/development/README.md': developmentGuide,
  'docs/adr/README.md': index('Architecture decisions', 'This directory records consequential decisions.', [
    ['Use Node.js', '0001-use-node.md', 'the runtime choice.'],
  ]),
  'docs/adr/0001-use-node.md': '# Use Node.js\n',
  'docs/agents/README.md': readFileSync(join(sourceRoot, 'docs/agents/README.md'), 'utf8'),
  'docs/agents/domain.md': '# Domain docs\n',
  'docs/agents/issue-tracker.md': '# Issue tracker\n',
  'docs/agents/triage-labels.md': '# Triage labels\n',
  'docs/agents/project.md': '# Project guidance\n',
  'packages/widget/README.md': '# Widget package\n',
  'packages/widget/index.js': 'export {};\n',
  'build/report.md': '# Report\n',
};

test('drafts the expected scope of a conforming repository', t => {
  const { proposal } = drafted(t, conforming);

  assert.deepEqual(proposal, {
    format: 'repo-standards/scope/v2',
    declarations: [{
      id: 'documentation',
      coverage: coverage('`docs`'),
      candidates: [
        { path: 'CONTEXT.md', decision: 'include', reason: 'The domain glossary at the repository root.', evidence: ['CONTEXT.md'] },
        underDocs('docs/README.md'),
        underDocs('docs/adr/0001-use-node.md'),
        underDocs('docs/adr/README.md'),
        owned('docs/agents/README.md', 'agent-configuration-index'),
        owned('docs/agents/domain.md', 'domain-configuration'),
        owned('docs/agents/issue-tracker.md', 'issue-tracker-configuration'),
        underDocs('docs/agents/project.md'),
        owned('docs/agents/triage-labels.md', 'triage-label-configuration'),
        underDocs('docs/development/README.md'),
        underDocs('docs/usage/README.md'),
        underDocs('docs/usage/install.md'),
        underDocs('docs/usage/overview.svg'),
        outsideIndex('packages/widget/README.md'),
      ],
      unresolved: [],
    }],
  });
});

test('drafts the same scope twice from the same tree', t => {
  const project = fixture(conforming);
  t.after(project.close);
  const first = draft(project.root);
  const second = draft(project.root);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.stdout, first.stdout);
});

test('drafts new indexes, the development guide, and context glossaries the rules decide', t => {
  const { proposal } = drafted(t, {
    'docs/README.md': '# Documentation\n',
    'docs/usage/install.md': '# Install\n',
    'docs/usage/guides/first-run.md': '# First run\n',
    'CONTEXT-MAP.md': '# Contexts\n\n- [Ordering](src/ordering/CONTEXT.md): orders.\n- [Billing](src/billing/): invoices.\n',
    'src/ordering/CONTEXT.md': '# Ordering\n',
    'src/billing/CONTEXT.md': '# Billing\n',
  });

  const contextGlossary = path => ({
    path,
    decision: 'include',
    reason: 'A context glossary that `CONTEXT-MAP.md` lists.',
    evidence: [path, 'CONTEXT-MAP.md'],
  });
  assert.deepEqual(proposal.declarations[0].candidates, [
    { path: 'CONTEXT-MAP.md', decision: 'include', reason: 'The context map at the repository root.', evidence: ['CONTEXT-MAP.md'] },
    underDocs('docs/README.md'),
    {
      path: 'docs/development/README.md',
      decision: 'include',
      reason: 'The development guide, which the contribution guide requires, to create.',
      evidence: [],
    },
    { path: 'docs/usage/README.md', decision: 'include', reason: 'The index of the documentation directory `docs/usage`, to create.', evidence: ['docs/usage'] },
    {
      path: 'docs/usage/guides/README.md',
      decision: 'include',
      reason: 'The index of the documentation directory `docs/usage/guides`, to create.',
      evidence: ['docs/usage/guides'],
    },
    underDocs('docs/usage/guides/first-run.md'),
    underDocs('docs/usage/install.md'),
    contextGlossary('src/billing/CONTEXT.md'),
    contextGlossary('src/ordering/CONTEXT.md'),
  ]);
  assert.deepEqual(proposal.declarations[0].unresolved, [
    unsupported('docs/development/README.md', 'docs/development'),
  ]);
});

test('drafts the root indexes of a repository without documentation and asks for their evidence', t => {
  const { entry } = drafted(t, { 'README.md': '# Widget\n' });

  assert.deepEqual(entry.candidates, [
    { path: 'docs/README.md', decision: 'include', reason: 'The index of the documentation root `docs`, to create.', evidence: [] },
    {
      path: 'docs/development/README.md',
      decision: 'include',
      reason: 'The development guide, which the contribution guide requires, to create.',
      evidence: [],
    },
  ]);
  assert.deepEqual(entry.unresolved, [
    unsupported('docs/README.md', 'docs'),
    unsupported('docs/development/README.md', 'docs/development'),
  ]);
});

test('leaves the cases no rule decides as unresolved questions', t => {
  const { entry } = drafted(t, {
    '.gitignore': 'docs/usage/draft.md\ndocs/cache/\n',
    'docs/README.md': '# Documentation\n',
    'docs/overview.md': '# Overview\n',
    'docs/usage/install.md': '# Install\n',
    'docs/usage/draft.md': '# Draft\n',
    'docs/cache/index.md': '# Cache\n',
    'notes.md': '# Notes\n',
    'guides/setup.md': '# Setup\n',
    'packages/app/README.md': '# App\n',
    'packages/app/docs/usage/guide.md': '# Guide\n',
    'packages/app/docs/adr/0001-start.md': '# Start\n',
    'src/legacy/CONTEXT.md': '# Legacy\n',
  });

  assert.deepEqual(entry.candidates, [
    underDocs('docs/README.md'),
    {
      path: 'docs/development/README.md',
      decision: 'include',
      reason: 'The development guide, which the contribution guide requires, to create.',
      evidence: [],
    },
    underDocs('docs/overview.md'),
    { path: 'docs/usage/README.md', decision: 'include', reason: 'The index of the documentation directory `docs/usage`, to create.', evidence: ['docs/usage'] },
    underDocs('docs/usage/install.md'),
    outsideIndex('packages/app/README.md'),
  ]);
  assert.deepEqual(entry.unresolved, [
    'Git ignores `docs/usage/draft.md`, which lies under the documentation root `docs`. Should it be removed, moved outside the root, or kept by Git and drafted again?',
    'Is `packages/app/docs` a documentation root? Its `packages/app/docs/adr` and `packages/app/docs/usage` directories hold Markdown documents. If it is, draft again with `--root packages/app/docs`.',
    'Is `src/legacy/CONTEXT.md` a domain glossary or context map of this repository? Include it if it is.',
    unsupported('docs/development/README.md', 'docs/development'),
    'Which of these Markdown files at the repository root are documentation this scope must cover, such as a document to move into a documentation category: `notes.md`? Include each one, with its destination when it moves.',
    'Which of these Markdown files under `guides` are documentation this scope must cover, such as a document to move into a documentation category: `guides/setup.md`? Include each one, with its destination when it moves.',
    'Which of these Markdown files under `packages` are documentation this scope must cover, such as a document to move into a documentation category: `packages/app/docs/adr/0001-start.md` and `packages/app/docs/usage/guide.md`? Include each one, with its destination when it moves.',
    '`docs/cache` under the documentation root `docs` holds no file that Git keeps, but the documentation check reads it. Should it be removed, or kept by Git and drafted again?',
    '`docs/overview.md` lies directly under the documentation root `docs`, outside the usage, development, adr, and agents categories. Which category does it move to? Include each destination path and any new directory\'s index; the files Git keeps in it are already included.',
  ]);
});

test('asks about a stray directory and a symbolic link under a root without drafting their indexes', t => {
  const { entry } = drafted(t, {
    'docs/README.md': '# Documentation\n',
    'docs/development/README.md': developmentGuide,
    'docs/api/endpoints.md': '# Endpoints\n',
    'docs/usage/README.md': '# Usage\n',
  }, [], root => symlinkSync('README.md', join(root, 'docs/usage/alias.md')));

  assert.deepEqual(included(entry), [
    'docs/README.md',
    'docs/api/endpoints.md',
    'docs/development/README.md',
    'docs/usage/README.md',
  ]);
  assert.deepEqual(entry.unresolved, [
    '`docs/api` lies directly under the documentation root `docs`, outside the usage, development, adr, and agents categories. Which category does it move to? Include each destination path and any new directory\'s index; the files Git keeps in it are already included.',
    '`docs/usage/alias.md` under the documentation root `docs` is a symbolic link or special file, which the scope cannot hold. Should it be replaced with a regular file or removed?',
  ]);
});

test('drafts a documentation root the agent decided on', t => {
  const files = {
    'docs/README.md': '# Documentation\n',
    'docs/development/README.md': developmentGuide,
    'packages/app/README.md': '# App\n',
    'packages/app/docs/usage/guide.md': '# Guide\n',
    'packages/app/docs/adr/README.md': '# Decisions\n',
  };
  const { entry } = drafted(t, files, ['--root', 'packages/app/docs/']);

  assert.equal(entry.coverage, coverage('`docs` and `packages/app/docs`'));
  assert.deepEqual(entry.candidates.filter(candidate => candidate.path.startsWith('packages/')), [
    outsideIndex('packages/app/README.md'),
    {
      path: 'packages/app/docs/README.md',
      decision: 'include',
      reason: 'The index of the documentation root `packages/app/docs`, to create.',
      evidence: ['packages/app/docs'],
    },
    {
      path: 'packages/app/docs/adr/README.md',
      decision: 'include',
      reason: 'A file under the documentation root `packages/app/docs`.',
      evidence: ['packages/app/docs/adr/README.md'],
    },
    {
      path: 'packages/app/docs/usage/README.md',
      decision: 'include',
      reason: 'The index of the documentation directory `packages/app/docs/usage`, to create.',
      evidence: ['packages/app/docs/usage'],
    },
    {
      path: 'packages/app/docs/usage/guide.md',
      decision: 'include',
      reason: 'A file under the documentation root `packages/app/docs`.',
      evidence: ['packages/app/docs/usage/guide.md'],
    },
  ]);
  assert.deepEqual(entry.unresolved, []);
});

test('asks for a category when a decided root has none', t => {
  const { entry } = drafted(t, {
    'docs/README.md': '# Documentation\n',
    'docs/development/README.md': developmentGuide,
    'packages/app/handbook/notes.md': '# Notes\n',
    'packages/app/handbook/guides/first-run.md': '# First run\n',
    'packages/app/handbook/guides/usage/tips.md': '# Tips\n',
  }, ['--root', 'packages/app/handbook']);

  assert.deepEqual(included(entry), [
    'docs/README.md',
    'docs/development/README.md',
    'packages/app/handbook/README.md',
    'packages/app/handbook/guides/README.md',
    'packages/app/handbook/guides/first-run.md',
    'packages/app/handbook/guides/usage/README.md',
    'packages/app/handbook/guides/usage/tips.md',
    'packages/app/handbook/notes.md',
  ]);
  assert.deepEqual(entry.unresolved, [
    'The documentation check cannot tell that `packages/app/handbook` is a documentation root without a usage, development, adr, or agents directory index. Which category will hold its documents? Include that category\'s `README.md`.',
  ]);
});

test('leaves out the paths that other declarations and Repository Standards own', t => {
  const { entry } = drafted(t, {
    'docs/README.md': '# Documentation\n',
    'docs/development/README.md': developmentGuide,
    'AGENTS.md': '# Agents\n',
    'CONTRIBUTING.md': '# Contributing\n',
    'THIRD_PARTY_NOTICES.md': '# Notices\n',
    '.github/PULL_REQUEST_TEMPLATE.md': '## Summary\n',
    '.agents/skills/tdd/SKILL.md': '# TDD\n',
    '.agents/skills/adopt-standards/SKILL.md': '# Adopt\n',
    '.repo-standards/inputs/source/docs/usage/guide.md': '# Guide\n',
    'vendor/marked/README.md': '# Marked\n',
    'vendor/marked/usage/README.md': '# Usage\n',
  });

  assert.deepEqual(included(entry), ['docs/README.md', 'docs/development/README.md']);
  assert.deepEqual(entry.candidates.filter(candidate => candidate.decision === 'exclude'), [
    outsideIndex('vendor/marked/usage/README.md'),
  ]);
  assert.deepEqual(entry.unresolved, [
    'Which of these Markdown files at the repository root are documentation this scope must cover, such as a document to move into a documentation category: `THIRD_PARTY_NOTICES.md`? Include each one, with its destination when it moves.',
  ]);
});

test('excludes each file of an owned directory under a decided root', t => {
  const { entry } = drafted(t, {
    'docs/README.md': '# Documentation\n',
    'docs/development/README.md': developmentGuide,
    '.agents/usage/README.md': '# Usage\n',
    '.agents/skills/tdd/SKILL.md': '# TDD\n',
    '.agents/skills/tdd/tests.md': '# Tests\n',
    '.agents/skills/adopt-standards/SKILL.md': '# Adopt\n',
  }, ['--root', '.agents']);

  assert.deepEqual(entry.candidates.filter(candidate => candidate.path.startsWith('.agents/')), [
    {
      path: '.agents/README.md',
      decision: 'include',
      reason: 'The index of the documentation root `.agents`, to create.',
      evidence: ['.agents'],
    },
    owned('.agents/skills/tdd/SKILL.md', 'skill-tdd'),
    owned('.agents/skills/tdd/tests.md', 'skill-tdd'),
    {
      path: '.agents/usage/README.md',
      decision: 'include',
      reason: 'A file under the documentation root `.agents`.',
      evidence: ['.agents/usage/README.md'],
    },
  ]);
  const ownedOnly = '`.agents/skills` lies directly under the documentation root `.agents`, outside the usage, development, adr, and agents categories, but its files belong to other declarations or to Repository Standards, so this scope cannot move it. Is `.agents` a documentation root after all?';
  assert.deepEqual(entry.unresolved, [ownedOnly]);

  const reservedOnly = drafted(t, {
    'docs/README.md': '# Documentation\n',
    'docs/development/README.md': developmentGuide,
    '.agents/usage/README.md': '# Usage\n',
    '.agents/skills/adopt-standards/SKILL.md': '# Adopt\n',
  }, ['--root', '.agents']);
  assert.deepEqual(reservedOnly.entry.unresolved, [ownedOnly], 'a directory of reserved paths is not asked to be removed');

  const ignoredOnly = drafted(t, {
    '.gitignore': '.agents/skills/mine/\n',
    'docs/README.md': '# Documentation\n',
    'docs/development/README.md': developmentGuide,
    '.agents/usage/README.md': '# Usage\n',
    '.agents/skills/mine/notes.md': '# Notes\n',
  }, ['--root', '.agents'], root => mkdirSync(join(root, '.agents/empty')));
  assert.deepEqual(ignoredOnly.entry.unresolved, [
    '`.agents/empty` under the documentation root `.agents` holds no file that Git keeps, but the documentation check reads it. Should it be removed, or kept by Git and drafted again?',
    '`.agents/skills` under the documentation root `.agents` holds no file that Git keeps, but the documentation check reads it. Should it be removed, or kept by Git and drafted again?',
  ], 'a directory without reserved or owned files is asked about as any other');
});

test('asks about entries that block a root or an index, and survives a dirty working tree', t => {
  const fileGuide = drafted(t, { 'docs/README.md': '# Documentation\n', 'docs/development': 'Not a directory.\n' });
  assert.deepEqual(included(fileGuide.entry), ['docs/README.md', 'docs/development']);
  assert.deepEqual(fileGuide.entry.unresolved, [
    '`docs/development` must be a directory to hold its documentation index, but it is not. Should it be removed or renamed?',
  ]);

  const fileDocs = drafted(t, { 'docs': 'Not a directory.\n' });
  assert.deepEqual(fileDocs.entry.candidates, []);
  assert.deepEqual(fileDocs.entry.unresolved, [
    '`docs` must be a directory to hold its documentation index, but it is not. Should it be removed or renamed?',
  ]);

  const directoryIndex = drafted(t, {
    'docs/README.md': '# Documentation\n',
    'docs/development/README.md': developmentGuide,
    'docs/usage/README.md/notes.md': '# Notes\n',
  });
  assert.deepEqual(included(directoryIndex.entry), ['docs/README.md', 'docs/development/README.md']);
  assert.deepEqual(directoryIndex.entry.unresolved, [
    '`docs/usage/README.md` must be a file, the documentation index of its directory, but it is a directory. Should it be removed or renamed?',
  ]);

  const outside = mkdtempSync(join(tmpdir(), 'repo-canon-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  mkdirSync(join(outside, 'usage'));
  writeFileSync(join(outside, 'usage/guide.md'), '# Guide\n');
  const dirty = fixture({
    'docs/README.md': '# Documentation\n',
    'docs/development/README.md': developmentGuide,
    'docs/usage/guide.md': '# Guide\n',
    'handbook/usage/guide.md': '# Guide\n',
  });
  t.after(dirty.close);
  execFileSync('git', ['add', '--all'], { cwd: dirty.root });
  rmSync(join(dirty.root, 'docs/usage'), { recursive: true });
  writeFileSync(join(dirty.root, 'docs/usage'), 'Now a file.\n');
  rmSync(join(dirty.root, 'handbook'), { recursive: true });
  symlinkSync(outside, join(dirty.root, 'handbook'));

  const outcome = draft(dirty.root);
  assert.equal(outcome.status, 0, outcome.stderr);
  assertScopeProposal(outcome.proposal, dirty.root);
  const [entry] = outcome.proposal.declarations;
  assert.deepEqual(included(entry), ['docs/README.md', 'docs/development/README.md', 'docs/usage']);
  assert.deepEqual(entry.unresolved, [
    '`docs/usage` lies directly under the documentation root `docs`, outside the usage, development, adr, and agents categories. Which category does it move to? Include each destination path and any new directory\'s index; the files Git keeps in it are already included.',
  ]);
  const throughLink = draft(dirty.root, ['--root', 'handbook']);
  assert.equal(throughLink.status, 1);
  assert.match(throughLink.stderr, /--root handbook is not a directory that holds a file Git keeps/);
});

test('over conforming repositories the drafted scope passes the documentation check', t => {
  const single = drafted(t, conforming);
  assert.equal(checkDraftedScope(single.root, single.entry).result.status, 'passed');

  const contexts = {
    'docs/README.md': index('Documentation', 'This directory maps the documentation categories.', [
      ['Development', 'development/README.md', 'building and validating the project.'],
    ]),
    'docs/development/README.md': developmentGuide,
    'CONTEXT-MAP.md': '# Contexts\n\n- [Ordering](src/ordering/CONTEXT.md): orders.\n',
    'src/ordering/CONTEXT.md': '# Ordering\n',
    'src/ordering/docs/README.md': index('Ordering documentation', 'This directory maps the ordering documentation.', [
      ['Architecture decisions', 'adr/README.md', 'ordering decisions.'],
    ]),
    'src/ordering/docs/adr/README.md': index('Architecture decisions', 'This directory records ordering decisions.', [
      ['Event sourcing', '0001-event-sourcing.md', 'how orders are stored.'],
    ]),
    'src/ordering/docs/adr/0001-event-sourcing.md': '# Event sourcing\n',
  };
  const decided = drafted(t, contexts, ['--root', 'src/ordering/docs']);
  assert.deepEqual(decided.entry.unresolved, []);
  const outcome = checkDraftedScope(decided.root, decided.entry);
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'passed', outcome.result.message);
});

test('asks about every ignored file under a root and qualifies nested candidate roots', t => {
  const { entry } = drafted(t, {
    '.gitignore': '*.png\n',
    'docs/README.md': '# Documentation\n',
    'docs/development/README.md': developmentGuide,
    'docs/usage/README.md': '# Usage\n',
    'docs/usage/diagram.png': 'png\n',
    'pkg/a/docs/usage/guide.md': '# Guide\n',
    'pkg/a/docs/usage/agents/notes.md': '# Notes\n',
  });

  assert.deepEqual(entry.unresolved.filter(question => !question.startsWith('Which of these')), [
    'Git ignores `docs/usage/diagram.png`, which lies under the documentation root `docs`. Should it be removed, moved outside the root, or kept by Git and drafted again?',
    'Is `pkg/a/docs/usage` a documentation root, if `pkg/a/docs` is not? Its `pkg/a/docs/usage/agents` directory holds Markdown documents. If it is, draft again with `--root pkg/a/docs/usage`.',
    'Is `pkg/a/docs` a documentation root? Its `pkg/a/docs/usage` directory holds Markdown documents. If it is, draft again with `--root pkg/a/docs`.',
  ]);
});

test('drafts the Git working tree that holds the project, as Repository Standards inspects it', t => {
  const project = fixture(conforming);
  t.after(project.close);
  const fromRoot = draft(project.root);
  const fromSubdirectory = draft(join(project.root, 'packages/widget'));
  assert.equal(fromSubdirectory.status, 0, fromSubdirectory.stderr);
  assert.equal(fromSubdirectory.stdout, fromRoot.stdout);
});

test('rejects invalid arguments, roots, and projects with a process error', t => {
  const project = fixture({
    '.gitignore': 'vendor/lib/\n',
    'docs/README.md': '# Documentation\n',
    'packages/app/docs/usage/guide.md': '# Guide\n',
    'packages/app/docs/usage/more/notes.md': '# Notes\n',
    'vendor/lib/docs/usage/guide.md': '# Guide\n',
    'vendor/marked/README.md': '# Marked\n',
    'vendor/marked/notes.md': '# Notes\n',
  });
  t.after(project.close);
  const outside = mkdtempSync(join(tmpdir(), 'repo-canon-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  mkdirSync(join(outside, 'handbook'));
  writeFileSync(join(outside, 'handbook/notes.md'), '# Notes\n');
  symlinkSync(outside, join(project.root, 'link'));
  for (const [args, message] of [
    [['--root', 'docs'], /--root docs cannot be used: docs is always a documentation root/],
    [['--root', 'docs/usage'], /--root docs\/usage cannot be used/],
    [['--root', '../outside'], /--root \.\.\/outside must be a repository-relative directory path/],
    [['--root', '/absolute'], /must be a repository-relative directory path/],
    [['--root', 'packages/missing'], /--root packages\/missing is not a directory that holds a file Git keeps/],
    [['--root', 'link/handbook'], /--root link\/handbook is not a directory that holds a file Git keeps/],
    [['--root', '.git'], /--root \.git is not a directory that holds a file Git keeps/],
    [['--root', 'vendor/lib/docs'], /--root vendor\/lib\/docs is not a directory that holds a file Git keeps/],
    [['--root', 'packages/app/docs', '--root', 'packages/app/docs/usage'], /--root packages\/app\/docs\/usage lies inside --root packages\/app\/docs/],
    [['--root', '.repo-standards'], /reserves/],
    [['--root', 'vendor/marked'], /--root vendor\/marked cannot be used: the marked-provenance declaration owns it or its README\.md/],
    [['--root'], /--root needs a path/],
    [['--scope', 'x'], /Unknown argument --scope/],
  ]) {
    const outcome = draft(project.root, args);
    assert.equal(outcome.status, 1, args.join(' '));
    assert.equal(outcome.stdout, '');
    assert.match(outcome.stderr, message);
  }

  const notGit = mkdtempSync(join(tmpdir(), 'repo-canon-not-git-'));
  t.after(() => rmSync(notGit, { recursive: true, force: true }));
  const outcome = draft(notGit);
  assert.equal(outcome.status, 1);
  assert.match(outcome.stderr, /Cannot find the Git working tree/);
});

// A copy of the drafter with the documentation check's resources, outside any
// retained inputs, where it reads the `standards.yaml` beside it.
function copiedDrafter(t) {
  return join(dirname(dirname(retainedCheck(t, 'operations/check-documentation.mjs'))), drafterPath);
}

// The documentation check's resources, which hold the drafter, as Repository
// Standards 4.0.0 retains them in an adopting repository: under
// `.repo-standards/inputs/source`, beside the manifest it resolved to the
// selected profile, `.repo-standards/inputs/standards.yaml`.
function retainInputs(t, root, manifest) {
  const inputs = join(root, '.repo-standards/inputs');
  cpSync(dirname(dirname(copiedDrafter(t))), join(inputs, 'source'), { recursive: true });
  if (manifest !== undefined) writeFileSync(join(inputs, 'standards.yaml'), manifest);
  return join(inputs, 'source', drafterPath);
}

// The manifest Repository Standards 4.0.0 retains for this source's `complete`
// profile: the source's metadata, empty defaults, and the profile's resolved
// declarations under the profile. The profile selects every default
// declaration unchanged, so they resolve to the defaults.
function resolvedManifest() {
  const manifest = readFileSync(join(sourceRoot, 'standards.yaml'), 'utf8');
  const parts = /^(?<head>[\s\S]*?)^defaults:\n {2}declarations:\n(?<declarations>[\s\S]*?)^profiles:\n {2}complete:\n {4}description: (?<description>.*)\n {4}declarations: \{\}\n$/m.exec(manifest);
  assert.ok(parts, 'the source\'s one profile selects every default declaration unchanged');
  const { head, declarations, description } = parts.groups;
  const nested = declarations.trimEnd().replace(/^(?=.)/gm, '  ');
  return `${head}defaults:\n  declarations: {}\nprofiles:\n  complete:\n    description: ${description}\n    declarations:\n${nested}\n`;
}

test('runs from the retained inputs of an adopting repository as from the source', t => {
  const project = fixture(conforming);
  t.after(project.close);
  const retainedDrafter = retainInputs(t, project.root, resolvedManifest());

  const outcome = draft(project.root, [], retainedDrafter);
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.stderr, '');
  assert.equal(outcome.stdout, draft(project.root).stdout);
  assert.ok(outcome.proposal.declarations[0].candidates.some(candidate => candidate.reason.startsWith('Owned by')));
});

// The documentation declaration, with its check, in the form Repository
// Standards 4.0.0 writes a resolved declaration.
const documentationDeclaration = indent => [
  'documentation:',
  '  checks:',
  '    - id: documentation-navigation',
  '      run:',
  '        executable: node',
  '        script: operations/check-documentation.mjs',
  '        resources:',
  '          - operations/lib/documentation-model.mjs',
  '        arguments: []',
  '      prerequisite:',
  '        version-arguments:',
  '          - --version',
  '        version: ">=24.0.0 <25.0.0"',
  '      timeout-seconds: 30',
  '  fixes: []',
  '  kind: repository',
  '  guidance: guidance/documentation.md',
  '  discovery: discovery/documentation.md',
].map(line => `${' '.repeat(indent)}${line}`).join('\n');

const header = `format: repo-standards/v2
name: widget-standards
description: Widget repository standards, with a description long enough to
  fold onto a second line
requires:
  repo-standards: ">=4.0.0"
`;

test('reads the declarations that the selected profile resolves to', t => {
  const files = {
    'docs/README.md': '# Documentation\n',
    'docs/development/README.md': developmentGuide,
    'docs/usage/README.md': '# Usage\n',
    "docs/usage/added's.md": '# Added\n',
    'docs/usage/dropped.md': '# Dropped\n',
    'docs/usage/kept.md': '# Kept\n',
    'docs/usage/replaced.md': '# Replaced\n',
  };
  const expected = [
    underDocs('docs/README.md'),
    underDocs('docs/development/README.md'),
    underDocs('docs/usage/README.md'),
    owned("docs/usage/added's.md", 'added-guide'),
    underDocs('docs/usage/dropped.md'),
    underDocs('docs/usage/kept.md'),
    owned('docs/usage/replaced.md', 'usage-guide'),
  ];

  // A source whose profile replaces, excludes, and adds to its defaults.
  const project = fixture(files);
  t.after(project.close);
  const sourceDrafter = copiedDrafter(t);
  writeFileSync(join(dirname(dirname(sourceDrafter)), 'standards.yaml'), `${header}
defaults:
  declarations:
    documentation:
      kind: repository
      discovery: discovery/documentation.md
      checks:
      - id: documentation-navigation
        run:
          executable: node
          script: operations/check-documentation.mjs
          resources:
          - operations/lib/documentation-model.mjs

    usage-guide:
      kind: file
      target: docs/usage/kept.md # the usage guide
      exact: kept.md

    dropped-guide:
      kind: file
      target: 'docs/usage/dropped.md'
      exact: dropped.md

profiles:
  complete:
    description: The complete widget standards profile
    declarations:
      usage-guide:
        kind: file
        target: "docs/usage/replaced.md" # replaces the usage guide
        exact: replaced.md
      dropped-guide: {exclude: true} # no longer installed
      added-guide:
        kind: file
        target: 'docs/usage/added''s.md' # added
        exact: added.md
`);
  const fromSource = draft(project.root, [], sourceDrafter);
  assert.equal(fromSource.status, 0, fromSource.stderr);
  assert.deepEqual(fromSource.proposal.declarations[0].candidates, expected);

  // The retained manifest of the same selection.
  const retainedDrafter = retainInputs(t, project.root, `${header}defaults:
  declarations: {}
profiles:
  complete:
    description: The complete widget standards profile
    declarations:
      added-guide:
        checks: []
        fixes: []
        kind: file
        target: docs/usage/added's.md
        exact: added.md
${documentationDeclaration(6)}
      usage-guide:
        checks: []
        fixes: []
        kind: file
        target: docs/usage/replaced.md
        exact: replaced.md
`);
  const fromRetained = draft(project.root, [], retainedDrafter);
  assert.equal(fromRetained.status, 0, fromRetained.stderr);
  assert.equal(fromRetained.stdout, fromSource.stdout);
});

test('fails without a manifest it can read, naming the manifests it tried', t => {
  const project = fixture(conforming);
  t.after(project.close);

  const retainedDrafter = retainInputs(t, project.root);
  const sourceManifest = join(project.root, '.repo-standards/inputs/source/standards.yaml');
  const retainedManifest = join(project.root, '.repo-standards/inputs/standards.yaml');
  const withoutManifest = draft(project.root, [], retainedDrafter);
  assert.equal(withoutManifest.status, 1);
  assert.equal(withoutManifest.stdout, '');
  assert.ok(withoutManifest.stderr.includes(`Cannot read a standards manifest at ${sourceManifest} or ${retainedManifest}`), withoutManifest.stderr);

  const sourceDrafter = copiedDrafter(t);
  const besideSource = join(dirname(dirname(sourceDrafter)), 'standards.yaml');
  const outsideInputs = draft(project.root, [], sourceDrafter);
  assert.equal(outsideInputs.status, 1);
  assert.ok(outsideInputs.stderr.includes(`Cannot read a standards manifest at ${besideSource};`), outsideInputs.stderr);

  const withDefaults = declarations => `${header}defaults:\n  declarations:\n${documentationDeclaration(4)}\n${declarations}profiles:\n  complete:\n    description: Complete\n    declarations: {}\n`;
  const unreadable = 'declares guide in a form the drafter cannot read';
  for (const [manifest, message] of [
    [`${header}defaults:\n  declarations:\n${documentationDeclaration(4)}\nprofiles:\n  complete:\n    description: Complete\n    declarations: {}\n  minimal:\n    description: Minimal\n    declarations: {}\n`,
      'declares 2 profiles'],
    [`${header}defaults:\n  declarations:\n${documentationDeclaration(4)}\nprofiles:\n  complete:\n    description: Complete\n    declarations: []\n`,
      'lists its declarations in a form the drafter cannot read'],
    [`${header}defaults:\n  declarations: {}\nprofiles:\n  complete:\n    description: Complete\n    declarations: {}\n`,
      'declares no documentation repository declaration'],
    // Forms of a declaration, or of a field that decides its targets, that
    // the drafter does not read.
    [withDefaults('    guide: {kind: file, target: docs/usage/guide.md}\n'), unreadable],
    [withDefaults('    guide: &guide\n      kind: file\n      target: docs/usage/guide.md\n'), unreadable],
    [withDefaults('    guide:\n      kind: file\n      target: "docs/usage/guide\\x2emd"\n'), unreadable],
    [withDefaults("    guide:\n      kind: file\n      target: 'docs/usage/guide.md'#unspaced\n"), unreadable],
    [withDefaults('    guide:\n      kind: file\n      target: "docs/usage/guide.md\n'), unreadable],
    [withDefaults('    guide:\n      kind: file\n      target: >-\n        docs/usage/guide.md\n'), unreadable],
    [withDefaults('    guide:\n      kind: file\n      target:\n        docs/usage/guide.md\n'), unreadable],
    [withDefaults('    guide:\n      kind: file\n      target: docs/usage/\n        guide.md\n'), unreadable],
    [withDefaults('    guide:\n      kind: file\n      target: *guide\n'), unreadable],
    [withDefaults('    guide:\n      kind: file\n      "target": docs/usage/guide.md\n'), 'has a line under defaults.declarations.guide that the drafter cannot read'],
    [withDefaults('    guide:\n      kind: file\n      target : docs/usage/guide.md\n'), 'has a line under defaults.declarations.guide that the drafter cannot read'],
    [withDefaults('    guide:\n      kind: file\n      ? target\n      : docs/usage/guide.md\n'), 'has a line under defaults.declarations.guide that the drafter cannot read'],
    [`${header}defaults:\n  declarations:\n${documentationDeclaration(4)}\nprofiles:\n  complete:\n    description: Complete\n    "declarations":\n      guide:\n        kind: file\n        target: docs/usage/guide.md\n`,
      'has a line under profiles.complete that the drafter cannot read'],
  ]) {
    writeFileSync(besideSource, manifest);
    const outcome = draft(project.root, [], sourceDrafter);
    assert.equal(outcome.status, 1, manifest);
    assert.equal(outcome.stdout, '');
    assert.ok(outcome.stderr.includes(`${besideSource} ${message}`), `${manifest}\n${outcome.stderr}`);
  }
});

test('drafts this repository\'s own documentation scope', () => {
  const outcome = draft(sourceRoot);
  assert.equal(outcome.status, 0, outcome.stderr);
  assertScopeProposal(outcome.proposal, sourceRoot);
  const [entry] = outcome.proposal.declarations;
  const documentation = keptFiles(sourceRoot)
    .filter(path => path.startsWith('docs/'))
    .filter(path => !['docs/agents/README.md', 'docs/agents/domain.md', 'docs/agents/issue-tracker.md', 'docs/agents/triage-labels.md'].includes(path));
  assert.deepEqual(included(entry), ['CONTEXT.md', ...documentation].sort());
  assert.ok(entry.unresolved.every(question => question.startsWith('Which of these Markdown files')), entry.unresolved.join('\n'));
  assert.ok(entry.unresolved.some(question => question.includes('`authoring-notes.md`')));
  const outcomeOfCheck = checkDraftedScope(sourceRoot, entry);
  assert.equal(outcomeOfCheck.result.status, 'passed', outcomeOfCheck.result.message);
});
