import assert from 'node:assert/strict';
import { mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { documentationModel } from '../operations/lib/documentation-model.mjs';
import { fixture } from './helpers/operation.mjs';

function model(t, files, paths = Object.keys(files)) {
  const project = fixture(files);
  t.after(project.close);
  return documentationModel(project.root, paths);
}

const rootPaths = built => built.roots.map(root => root.path);

test('infers documentation roots from confirmed category indexes', t => {
  assert.deepEqual(rootPaths(model(t, {})), ['docs'], 'docs is always a documentation root');

  const contextRoots = model(t, {}, [
    'packages/app/handbook/README.md',
    'packages/app/handbook/usage/README.md',
    'services/api/adr/README.md',
    'contexts/docs/app/handbook/development/README.md',
  ]);
  assert.deepEqual(rootPaths(contextRoots), [
    'contexts/docs/app/handbook',
    'docs',
    'packages/app/handbook',
    'services/api',
  ]);
  assert.deepEqual(contextRoots.ambiguousRoots, []);

  const repositoryLevelIndexes = model(t, {}, ['README.md', 'usage/README.md', 'docs/README.md']);
  assert.deepEqual(rootPaths(repositoryLevelIndexes), ['docs']);
  assert.deepEqual(repositoryLevelIndexes.ambiguousRoots, []);
});

test('a confirmed category index inside a documentation root does not start a nested root', t => {
  const built = model(t, {
    'docs/README.md': '# Documentation\n',
    'docs/usage/README.md': '# Usage\n',
    'docs/usage/guides/README.md': '# Guides\n',
    'docs/usage/guides/intro.md': '# Intro\n',
    'docs/usage/guides/adr/README.md': '# Decisions\n',
  });

  assert.deepEqual(rootPaths(built), ['docs']);
  assert.deepEqual(built.ambiguousRoots, []);
  const [root] = built.roots;
  assert.deepEqual(root.strayEntries, []);
  assert.deepEqual(root.directories, [
    { path: 'docs/usage', index: { path: 'docs/usage/README.md', state: 'present', confirmed: true } },
    { path: 'docs/usage/guides', index: { path: 'docs/usage/guides/README.md', state: 'present', confirmed: true } },
    { path: 'docs/usage/guides/adr', index: { path: 'docs/usage/guides/adr/README.md', state: 'present', confirmed: true } },
  ], 'the nested candidate and its category are ordinary directories of the root');
  assert.deepEqual(root.confirmedIndexes.map(index => index.path), [
    'docs/usage/README.md',
    'docs/usage/guides/README.md',
    'docs/usage/guides/adr/README.md',
  ]);
});

test('the outermost of nested candidate roots is the documentation root', t => {
  const built = model(t, {}, [
    'packages/app/handbook/README.md',
    'packages/app/handbook/usage/README.md',
    'packages/app/handbook/usage/guides/README.md',
    'packages/app/handbook/usage/guides/adr/README.md',
    'packages/app/handbook/usage/guides/adr/tools/development/README.md',
    'packages/app/handbook/api/agents/README.md',
    'docs/api/development/README.md',
    'services/api/usage/README.md',
    'services/other/README.md',
  ]);

  assert.deepEqual(rootPaths(built), ['docs', 'packages/app/handbook', 'services/api']);
  assert.deepEqual(built.ambiguousRoots, ['services/other'], 'a candidate outside every root stays ambiguous');
  const handbook = built.roots.find(root => root.path === 'packages/app/handbook');
  assert.deepEqual(handbook.index, { path: 'packages/app/handbook/README.md', state: 'missing', confirmed: true });
  assert.deepEqual(handbook.confirmedIndexes.map(index => index.path), [
    'packages/app/handbook/usage/README.md',
    'packages/app/handbook/usage/guides/README.md',
    'packages/app/handbook/usage/guides/adr/README.md',
    'packages/app/handbook/usage/guides/adr/tools/development/README.md',
    'packages/app/handbook/api/agents/README.md',
  ], 'a confirmed category index of a nested candidate stays a confirmed index of the root');
  const [docs] = built.roots;
  assert.deepEqual(docs.index, { path: 'docs/README.md', state: 'missing', confirmed: false });
  assert.deepEqual(docs.confirmedIndexes.map(index => index.path), ['docs/api/development/README.md']);
});

test('reports candidate roots that the confirmed paths cannot resolve as ambiguous', t => {
  const built = model(t, {}, [
    'docs/README.md',
    'docs/usage/examples/README.md',
    'docs/usage/docs/README.md',
    'packages/app/handbook/README.md',
    'packages/app/handbook/usage/deep/README.md',
    'tools/cli/guide/README.md',
  ]);

  assert.deepEqual(rootPaths(built), ['docs']);
  assert.deepEqual(built.ambiguousRoots, [
    'packages/app/handbook',
    'packages/app/handbook/usage/deep',
    'tools/cli/guide',
  ]);
});

test('records each documentation index path, state and confirmation', t => {
  const built = model(t, {
    'docs/README.md': '# Documentation\n',
    'docs/development/README.md': '<!-- Nothing rendered yet. -->\n',
    'docs/usage/install.md': '# Install\n',
    'docs/usage/examples/README.md': '<p hidden>Hidden</p>\n',
    'docs/usage/examples/first/README.md': '# First\n',
  }, [
    'docs/README.md',
    'docs/usage/README.md',
    'docs/usage/examples/README.md',
    'docs/adr/README.md',
    'docs/adr/README.md',
    'docs/api/README.md',
  ]);

  assert.deepEqual(built.developmentGuide, { path: 'docs/development/README.md', state: 'empty', confirmed: false });
  const [root] = built.roots;
  assert.deepEqual(root.index, { path: 'docs/README.md', state: 'present', confirmed: true });
  assert.deepEqual(root.directories, [
    { path: 'docs/development', index: { path: 'docs/development/README.md', state: 'empty', confirmed: false } },
    { path: 'docs/usage', index: { path: 'docs/usage/README.md', state: 'missing', confirmed: true } },
    { path: 'docs/usage/examples', index: { path: 'docs/usage/examples/README.md', state: 'empty', confirmed: true } },
    { path: 'docs/usage/examples/first', index: { path: 'docs/usage/examples/first/README.md', state: 'present', confirmed: false } },
  ]);
  assert.deepEqual(root.confirmedIndexes, [
    { path: 'docs/usage/README.md', state: 'missing', confirmed: true },
    { path: 'docs/usage/examples/README.md', state: 'empty', confirmed: true },
    { path: 'docs/adr/README.md', state: 'missing', confirmed: true },
  ]);
});

test('reports a root without a directory as having a missing index and no directories', t => {
  const built = model(t, {}, ['docs/README.md', 'docs/development/README.md']);

  assert.deepEqual(built.developmentGuide, { path: 'docs/development/README.md', state: 'missing', confirmed: true });
  assert.deepEqual(built.roots, [{
    path: 'docs',
    index: { path: 'docs/README.md', state: 'missing', confirmed: true },
    strayEntries: [],
    directories: [],
    confirmedIndexes: [{ path: 'docs/development/README.md', state: 'missing', confirmed: true }],
  }]);
  assert.deepEqual(built.documents, []);
  assert.deepEqual(built.links, []);
});

test('treats a root that is a file or a symbolic link as having no directory', t => {
  const project = fixture({ docs: '# Not a directory\n', 'handbook/usage/README.md': '# Usage\n' });
  t.after(project.close);
  mkdirSync(join(project.root, 'packages/app'), { recursive: true });
  symlinkSync(join(project.root, 'handbook'), join(project.root, 'packages/app/handbook'));
  const built = documentationModel(project.root, ['docs/README.md', 'packages/app/handbook/usage/README.md']);

  assert.deepEqual(built.roots.map(({ path, index, strayEntries, directories }) => (
    { path, index: index.state, strayEntries, directories }
  )), [
    { path: 'docs', index: 'missing', strayEntries: [], directories: [] },
    { path: 'packages/app/handbook', index: 'missing', strayEntries: [], directories: [] },
  ]);
});

test('lists stray top-level entries outside the documentation categories', t => {
  const project = fixture({
    'docs/README.md': '# Documentation\n',
    'docs/adr/README.md': '# Decisions\n',
    'docs/api/README.md': '# API\n',
    'docs/overview.md': '# Overview\n',
    'docs/notes.txt': 'Notes\n',
    'docs/usage/README.md': '# Usage\n',
    'shared/usage/README.md': '# Shared usage\n',
  });
  t.after(project.close);
  symlinkSync('../shared/usage', join(project.root, 'docs/agents'));
  mkdirSync(join(project.root, 'docs/development'));

  const [root] = documentationModel(project.root, ['docs/README.md']).roots;
  assert.deepEqual(root.strayEntries, ['docs/agents', 'docs/api', 'docs/notes.txt', 'docs/overview.md']);
  assert.deepEqual(root.directories.map(directory => directory.path), [
    'docs/adr',
    'docs/api',
    'docs/development',
    'docs/usage',
  ], 'the walk does not follow a symlinked directory');
});

test('collects Markdown documents under each root and confirmed Markdown files elsewhere', t => {
  const project = fixture({
    'docs/README.md': '# Documentation\n',
    'docs/usage/GUIDE.MD': '# Guide\n',
    'docs/usage/diagram.svg': '<svg/>\n',
    'packages/app/handbook/usage/README.md': '# Usage\n',
    'legacy-notes.md': '# Legacy\n',
    'unconfirmed.md': '# Unconfirmed\n',
    'CONTEXT.md': '# Context\n',
    'LICENSE': 'MIT\n',
  });
  t.after(project.close);
  symlinkSync('../legacy-notes.md', join(project.root, 'docs/linked.md'));

  const built = documentationModel(project.root, [
    'legacy-notes.md',
    'CONTEXT.md',
    'LICENSE',
    'docs/usage/planned.md',
    'packages/app/handbook/usage/README.md',
  ]);
  assert.deepEqual(built.documents, [
    'CONTEXT.md',
    'docs/README.md',
    'docs/usage/GUIDE.MD',
    'legacy-notes.md',
    'packages/app/handbook/usage/README.md',
  ]);
});

test('resolves each rendered local link and marks it broken or intact', t => {
  const built = model(t, {
    'docs/README.md': `# [Documentation](README.md)

[Usage](usage/README.md?plain=1#top)
[Guides](usage/guides/)
[Missing](usage/missing.md)
<a href="missing.html&amp;mode=full">Missing HTML</a>
![Diagram](../assets/diagram.svg)
[Outside](../../outside.md)
[Website](https://example.com/guide.md)
[Mail](mailto:docs@example.com)
[Absolute](/docs/README.md)
[Section](#usage)

\`[Code](code-missing.md)\`

<!-- [Draft](draft-missing.md) -->
`,
    'docs/usage/README.md': '# Usage\n\n[Back](../README.md)\n',
    'docs/usage/guides/README.md': '# Guides\n',
  }, ['docs/README.md']);

  assert.deepEqual(built.links, [
    { source: 'docs/README.md', target: 'README.md', path: 'docs/README.md', broken: false },
    { source: 'docs/README.md', target: 'usage/README.md?plain=1#top', path: 'docs/usage/README.md', broken: false },
    { source: 'docs/README.md', target: 'usage/guides/', path: 'docs/usage/guides/', broken: false },
    { source: 'docs/README.md', target: 'usage/missing.md', path: 'docs/usage/missing.md', broken: true },
    { source: 'docs/README.md', target: 'missing.html&mode=full', path: 'docs/missing.html&mode=full', broken: true },
    { source: 'docs/README.md', target: '../assets/diagram.svg', path: 'assets/diagram.svg', broken: true },
    { source: 'docs/README.md', target: '../../outside.md', path: null, broken: true },
    { source: 'docs/README.md', target: '#usage', path: 'docs/README.md', broken: false },
    { source: 'docs/usage/README.md', target: '../README.md', path: 'docs/README.md', broken: false },
  ]);
});
