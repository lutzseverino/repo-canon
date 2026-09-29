import assert from 'node:assert/strict';
import { chmodSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { fixture, invokeCheck, retainedCheck, snapshot } from './helpers/operation.mjs';

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

test('runs from its declared retained source layout', t => {
  const retainedScript = retainedCheck(t, 'operations/check-documentation.mjs');
  const project = fixture({
    'docs/README.md': '# Documentation\n',
    'docs/development/README.md': '# Development\n',
  });
  t.after(project.close);
  const outcome = invokeCheck(retainedScript, project.root, {
    operation: { declaration: 'documentation', phase: 'checks', id: 'navigation' },
    allowedTargets: { paths: ['docs/README.md', 'docs/development/README.md'], directories: [] },
  });
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'passed');
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
[Session records](session-finals/)
<a href="missing.html&amp;mode=full">Missing HTML guide</a>
![Architecture](../assets/missing.svg)

\`[Example](example-missing.md)\`

<!-- [Draft](draft-missing.md) -->
`,
    'docs/development/setup.md': '# Setup\n',
    'docs/development/session-finals/README.md': '# Session records\n',
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
  assert.doesNotMatch(outcome.result.message, /session-finals|example-missing|draft-missing/);
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
  const files = {
    'docs/README.md': '# Documentation\n',
    'docs/development/README.md': '# Development\n',
    'packages/app/handbook/notes.md': '# Notes\n',
  };
  const outcome = check(t, files, [
    ...Object.keys(files),
    'packages/app/handbook/README.md',
    'packages/app/handbook/usage/README.md',
  ]);

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'failed');
  assert.match(outcome.result.message, /Create packages\/app\/handbook\/README\.md/);
  assert.match(outcome.result.message, /Create packages\/app\/handbook\/usage\/README\.md/);
  assert.match(outcome.result.message, /Move packages\/app\/handbook\/notes\.md into usage, development, adr, or agents/);
});

test('does not confuse a context ancestor named docs with its documentation root', t => {
  const outcome = check(t, {
    'docs/README.md': '# Documentation\n',
    'docs/development/README.md': '# Development\n',
    'contexts/docs/app/handbook/README.md': '# Handbook\n',
    'contexts/docs/app/handbook/usage/README.md': '# Usage\n',
    'contexts/docs/app/handbook/notes.md': '# Notes\n',
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'failed');
  assert.match(outcome.result.message, /Move contexts\/docs\/app\/handbook\/notes\.md into usage, development, adr, or agents/);
  assert.doesNotMatch(outcome.result.message, /Move contexts\/docs\/app into/);
});

test('does not confuse a nested folder named docs with a documentation root', t => {
  const outcome = check(t, {
    'docs/README.md': '# Documentation\n',
    'docs/development/README.md': '# Development\n',
    'docs/usage/README.md': '# Usage\n',
    'docs/usage/docs/README.md': '# API documentation\n',
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'passed');
});

test('treats a confirmed category index inside a documentation root as an ordinary directory index', t => {
  const files = {
    'docs/README.md': '# Documentation\n',
    'docs/development/README.md': '# Development\n',
    'docs/usage/README.md': '# Usage\n',
    'docs/usage/guides/README.md': '# Guides\n',
    'docs/usage/guides/intro.md': '# Intro\n',
    'docs/usage/guides/adr/README.md': '# Decisions\n',
  };
  const outcome = check(t, files);

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'passed', outcome.result.message);

  const { 'docs/usage/guides/README.md': _guidesIndex, ...withoutGuidesIndex } = files;
  const missingIndex = check(t, withoutGuidesIndex);
  assert.equal(missingIndex.status, 0, missingIndex.stderr);
  assert.equal(missingIndex.result.status, 'failed');
  assert.equal(
    missingIndex.result.message,
    'Documentation navigation needs correction: Create docs/usage/guides/README.md to explain this documentation directory and link its useful contents.',
  );
});

test('blocks when confirmed paths cannot identify whether an index starts a documentation root', t => {
  const outcome = check(t, {
    'docs/README.md': '# Documentation\n',
    'docs/development/README.md': '# Development\n',
    'packages/app/handbook/README.md': '# Handbook\n',
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'blocked');
  assert.match(outcome.result.message, /Cannot determine whether packages\/app\/handbook is a documentation root/);
  assert.match(outcome.result.message, /confirmed category README under usage, development, adr, or agents/);
});

test('does not infer a documentation root from a nested category descendant', t => {
  const outcome = check(t, {
    'docs/README.md': '# Documentation\n',
    'docs/development/README.md': '# Development\n',
    'packages/app/handbook/README.md': '# Handbook\n',
    'packages/app/handbook/usage/deep/README.md': '# Deep usage\n',
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'blocked');
  assert.match(outcome.result.message, /Cannot determine whether packages\/app\/handbook is a documentation root/);
  assert.match(outcome.result.message, /confirmed category README/);
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

test('fails the run with the read error for a document that exists but cannot be read', t => {
  const files = {
    'docs/README.md': '# Documentation\n\n[Usage](usage/README.md)\n',
    'docs/development/README.md': '# Development\n',
    'docs/usage/README.md': '# Usage\n\n[Guide](guide.md)\n',
    'docs/usage/guide.md': '# Guide\n',
    'legacy-notes.md': '# Legacy notes\n',
  };
  for (const unreadable of ['docs/usage/guide.md', 'docs/usage/README.md', 'legacy-notes.md']) {
    const project = fixture(files);
    t.after(project.close);
    const before = snapshot(project.root);
    const absolute = join(project.root, unreadable);
    chmodSync(absolute, 0o000);
    try {
      try {
        readFileSync(absolute);
        t.skip('this user can read a file without read permission');
        return;
      } catch {
        // The document exists but cannot be read, as intended.
      }
      const outcome = invokeCheck(script, project.root, {
        operation: { declaration: 'documentation', phase: 'checks', id: 'navigation' },
        allowedTargets: { paths: Object.keys(files), directories: [] },
      });
      assert.equal(outcome.status, 1, unreadable);
      assert.equal(outcome.stdout, '', unreadable);
      assert.equal(outcome.result, null, unreadable);
      assert.ok(outcome.stderr.includes(absolute), `${unreadable}: ${outcome.stderr}`);
    } finally {
      chmodSync(absolute, 0o644);
    }
    assert.deepEqual(snapshot(project.root), before, 'the check must not change project content');
  }
});

test('fails the run with the read error for a directory that exists but cannot be listed', t => {
  const files = {
    'docs/README.md': '# Documentation\n\n[Usage](usage/README.md)\n',
    'docs/development/README.md': '# Development\n',
    'docs/usage/README.md': '# Usage\n\n[Guide](guide.md)\n',
    'docs/usage/guide.md': '# Guide\n',
    'docs/usage/examples/README.md': '# Examples\n',
    'packages/app/handbook/README.md': '# Handbook\n\n[Usage](usage/README.md)\n',
    'packages/app/handbook/usage/README.md': '# Usage\n',
  };
  for (const { restricted, mode, unreadable } of [
    // A directory under a documentation root.
    { restricted: 'docs/usage', mode: 0o000, unreadable: 'docs/usage' },
    // A documentation root.
    { restricted: 'docs', mode: 0o000, unreadable: 'docs' },
    // A directory inside one that can be listed but not searched.
    { restricted: 'docs/usage', mode: 0o444, unreadable: 'docs/usage/examples' },
    // A documentation root inside a directory that cannot be searched.
    { restricted: 'packages', mode: 0o000, unreadable: 'packages/app/handbook' },
  ]) {
    const project = fixture(files);
    t.after(project.close);
    const before = snapshot(project.root);
    const absolute = join(project.root, unreadable);
    chmodSync(join(project.root, restricted), mode);
    try {
      try {
        readdirSync(absolute);
        t.skip('this user can list a directory without permission');
        return;
      } catch {
        // The directory exists but cannot be listed, as intended.
      }
      const outcome = invokeCheck(script, project.root, {
        operation: { declaration: 'documentation', phase: 'checks', id: 'navigation' },
        allowedTargets: { paths: Object.keys(files), directories: [] },
      });
      assert.equal(outcome.status, 1, unreadable);
      assert.equal(outcome.stdout, '', unreadable);
      assert.equal(outcome.result, null, unreadable);
      assert.ok(outcome.stderr.includes(absolute), `${unreadable}: ${outcome.stderr}`);
    } finally {
      chmodSync(join(project.root, restricted), 0o755);
    }
    assert.deepEqual(snapshot(project.root), before, 'the check must not change project content');
  }
});
