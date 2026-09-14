import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { fixture, invokeCheck, snapshot } from './helpers/operation.mjs';

const script = fileURLToPath(new URL('../operations/check-documentation.mjs', import.meta.url));

function check(t, files, paths = Object.keys(files)) {
  const project = fixture(files);
  t.after(project.close);
  const before = snapshot(project.root);
  const outcome = invokeCheck(script, project.root, {
    operation: { declaration: 'documentation', phase: 'checks', id: 'navigation' },
    allowedTargets: { paths, directories: [] },
  });
  assert.deepEqual(snapshot(project.root), before, 'the check must not change project content');
  return outcome;
}

test('passes indexed documentation with the mandatory development entry point', t => {
  const outcome = check(t, {
    'docs/README.md': `# Documentation

Use [development documentation](development/README.md) to build and validate the project.
`,
    'docs/development/README.md': `# Development

Install Node.js 24, then run \`npm test\` from the repository root.
`,
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.deepEqual(outcome.result, {
    format: 'repo-standards/result/v1',
    status: 'passed',
    message: 'Documentation navigation is valid; content placement and usefulness still require maintainer or agent review.',
  });
});

test('reports the missing mandatory guide and indexes for populated documentation directories', t => {
  const outcome = check(t, {
    'docs/development/setup.md': '# Setup\n',
    'docs/usage/install.md': '# Install\n',
    'docs/usage/examples/first-run.md': '# First run\n',
  }, [
    'docs/README.md',
    'docs/development/README.md',
    'docs/development/setup.md',
    'docs/usage/README.md',
    'docs/usage/install.md',
    'docs/usage/examples/README.md',
    'docs/usage/examples/first-run.md',
  ]);

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'failed');
  assert.match(outcome.result.message, /Create docs\/development\/README\.md with the project's prerequisites/);
  assert.match(outcome.result.message, /Create docs\/README\.md to map the documentation categories/);
  assert.match(outcome.result.message, /Create docs\/usage\/README\.md/);
  assert.match(outcome.result.message, /Create docs\/usage\/examples\/README\.md/);
});

test('reports both required root documentation files before the docs tree exists', t => {
  const outcome = check(t, {}, [
    'docs/README.md',
    'docs/development/README.md',
  ]);

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'failed');
  assert.match(outcome.result.message, /Create docs\/README\.md to map the documentation categories/);
  assert.match(outcome.result.message, /Create docs\/development\/README\.md with the project's prerequisites/);
});

test('reports broken rendered file links across documentation and migration sources', t => {
  const outcome = check(t, {
    'docs/README.md': `# Documentation

[Development](development/README.md)
`,
    'docs/development/README.md': `# Development

[Setup](setup.md?plain=1#node)
<a href="missing.html&amp;mode=full">Missing HTML guide</a>
![Architecture](../assets/missing.svg)

\`[Example](example-missing.md)\`

<!-- [Draft](draft-missing.md) -->
`,
    'docs/development/setup.md': '# Setup\n',
    'legacy-notes.md': `# Legacy notes

Move this material to [the intended destination](docs/usage/migrated.md).
`,
  }, [
    'docs/README.md',
    'docs/development/README.md',
    'docs/development/setup.md',
    'docs/usage/migrated.md',
    'legacy-notes.md',
  ]);

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'failed');
  assert.match(outcome.result.message, /docs\/development\/README\.md links to missing missing\.html&mode=full/);
  assert.match(outcome.result.message, /docs\/development\/README\.md links to missing \.\.\/assets\/missing\.svg/);
  assert.match(outcome.result.message, /legacy-notes\.md links to missing docs\/usage\/migrated\.md/);
  assert.doesNotMatch(outcome.result.message, /example-missing|draft-missing/);
});

test('checks links nested in rendered headings', t => {
  const outcome = check(t, {
    'docs/README.md': '# [Documentation](missing-map.md)\n',
    'docs/development/README.md': '# Development\n',
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'failed');
  assert.match(outcome.result.message, /docs\/README\.md links to missing missing-map\.md/);
});

test('rejects populated top-level documentation outside the recognized categories', t => {
  const outcome = check(t, {
    'docs/README.md': '# Documentation\n',
    'docs/development/README.md': '# Development\n',
    'docs/api/README.md': '# API\n',
    'docs/overview.md': '# Overview\n',
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'failed');
  assert.match(outcome.result.message, /Move docs\/api into usage, development, adr, or agents/);
  assert.match(outcome.result.message, /Move docs\/overview\.md into usage, development, adr, or agents/);
});

test('validates every context-local documentation root selected by discovery', t => {
  const outcome = check(t, {
    'docs/README.md': '# Documentation\n',
    'docs/development/README.md': '# Development\n',
    'packages/app/docs/notes.md': '# Notes\n',
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'failed');
  assert.match(outcome.result.message, /Create packages\/app\/docs\/README\.md/);
  assert.match(outcome.result.message, /Move packages\/app\/docs\/notes\.md into usage, development, adr, or agents/);
});

test('requires the development guide in concrete scope even when the file exists', t => {
  const outcome = check(t, {
    'docs/README.md': '# Documentation\n',
    'docs/development/README.md': '# Development\n',
  }, ['docs/README.md']);

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'failed');
  assert.match(outcome.result.message, /Include docs\/development\/README\.md in the confirmed documentation scope/);
});

test('treats malformed public-protocol input as a process error', t => {
  const outcome = check(t, {
    'docs/README.md': '# Documentation\n',
    'docs/development/README.md': '# Development\n',
  }, ['docs/development/README.md']);
  assert.equal(outcome.status, 0, outcome.stderr);

  const project = fixture({ 'docs/development/README.md': '# Development\n' });
  t.after(project.close);
  const before = snapshot(project.root);
  const malformed = invokeCheck(script, project.root, {
    allowedTargets: { paths: ['docs/development/README.md'], directories: ['docs'] },
  });
  assert.notEqual(malformed.status, 0);
  assert.equal(malformed.stdout, '');
  assert.match(malformed.stderr, /individual repository-relative file paths and no directory targets/);
  assert.deepEqual(snapshot(project.root), before);

  for (const path of ['.', 'docs', 'docs/']) {
    const directoryAsPath = invokeCheck(script, project.root, {
      allowedTargets: { paths: [path], directories: [] },
    });
    assert.notEqual(directoryAsPath.status, 0, path);
    assert.equal(directoryAsPath.stdout, '');
    assert.match(directoryAsPath.stderr, /individual repository-relative file paths/);
  }
});
