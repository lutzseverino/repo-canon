import assert from 'node:assert/strict';
import { chmodSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
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

// A documentation index that follows the index entry form: a title, a
// one-sentence purpose, then one `[Title](path): description` item per entry.
function index(title, purpose, entries = []) {
  const items = entries.map(([entryTitle, path, description]) => `- [${entryTitle}](${path}): ${description}`);
  return `# ${title}\n\n${purpose}\n${items.length > 0 ? `\n${items.join('\n')}\n` : ''}`;
}

// A development guide in the required order: its purpose, a Setup and
// validation section, then its index.
function developmentGuide(entries = [], setup = 'Install Node.js 24, then run `npm test` from the repository root.') {
  const items = entries.map(([entryTitle, path, description]) => `- [${entryTitle}](${path}): ${description}`);
  return `# Development

This directory explains how to build and validate the project.

## Setup and validation

${setup}
${items.length > 0 ? `\n## Documents\n\n${items.join('\n')}\n` : ''}`;
}

// The two required root documentation files, conforming to every rule.
const rootDocumentation = {
  'docs/README.md': index('Documentation', 'This directory maps the documentation categories.', [
    ['Development', 'development/README.md', 'building and validating the project.'],
  ]),
  'docs/development/README.md': developmentGuide(),
};

test('passes indexed documentation with the mandatory development entry point', t => {
  const outcome = check(t, rootDocumentation);

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.deepEqual(outcome.result, {
    format: 'repo-standards/result/v1',
    status: 'passed',
    message: 'Documentation navigation is valid; content placement and usefulness still require maintainer or agent review.',
  });
});

test('runs from its declared retained source layout', t => {
  const retainedScript = retainedCheck(t, 'operations/check-documentation.mjs');
  const project = fixture(rootDocumentation);
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
    'docs/README.md': rootDocumentation['docs/README.md'],
    'docs/development/README.md': `# Development

This directory explains how to build and validate the project.

## Setup and validation

<a href="missing.html&amp;mode=full">Missing HTML guide</a>
![Architecture](../assets/missing.svg)

\`[Example](example-missing.md)\`

<!-- [Draft](draft-missing.md) -->

## Documents

- [Setup](setup.md?plain=1#node): installing the project.
- [Session records](session-finals/): records of past sessions.
`,
    'docs/development/setup.md': '# Setup\n',
    'docs/development/session-finals/README.md': index('Session records', 'This directory holds session records.'),
    'legacy-notes.md': `# Legacy notes

Move this material to [the intended destination](docs/usage/migrated.md).
`,
  }, [
    'docs/README.md',
    'docs/development/README.md',
    'docs/development/setup.md',
    'docs/development/session-finals/README.md',
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
    'docs/README.md': index('Documentation', 'This directory maps the documentation categories.', [
      ['Development', 'development/README.md', 'building and validating the project.'],
      ['Usage', 'usage/README.md', 'using the project.'],
    ]),
    'docs/development/README.md': developmentGuide(),
    'docs/usage/README.md': index('Usage', 'This directory explains how to use the project.', [
      ['API documentation', 'docs/README.md', 'the API reference.'],
    ]),
    'docs/usage/docs/README.md': index('API documentation', 'This directory documents the API.'),
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'passed');
});

test('treats a confirmed category index inside a documentation root as an ordinary directory index', t => {
  const usagePurpose = 'This directory explains how to use the project.';
  const files = {
    'docs/README.md': index('Documentation', 'This directory maps the documentation categories.', [
      ['Development', 'development/README.md', 'building and validating the project.'],
      ['Usage', 'usage/README.md', 'using the project.'],
    ]),
    'docs/development/README.md': developmentGuide(),
    'docs/usage/README.md': index('Usage', usagePurpose, [['Guides', 'guides/README.md', 'step-by-step guides.']]),
    'docs/usage/guides/README.md': index('Guides', 'This directory holds step-by-step guides.', [
      ['Introduction', 'intro.md', 'a first look.'],
      ['Decisions', 'adr/README.md', 'the guides\' decisions.'],
    ]),
    'docs/usage/guides/intro.md': '# Intro\n',
    'docs/usage/guides/adr/README.md': index('Decisions', 'This directory records the guides\' decisions.'),
  };
  const outcome = check(t, files);

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'passed', outcome.result.message);

  // Without the guides index, the usage index cannot list it either.
  const { 'docs/usage/guides/README.md': _guidesIndex, ...withoutGuidesIndex } = files;
  withoutGuidesIndex['docs/usage/README.md'] = index('Usage', usagePurpose);
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
    'docs/adr/README.md': '# Decisions\n',
    'docs/adr/first.md': '# First\n',
    'notes/legacy.md': '# Legacy\n',
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
    // An index inside a directory that can be listed but not searched.
    { restricted: 'docs/adr', mode: 0o444, unreadable: 'docs/adr/README.md' },
    // A confirmed document inside a directory that can be listed but not
    // searched.
    { restricted: 'notes', mode: 0o444, unreadable: 'notes/legacy.md' },
  ]) {
    const project = fixture(files);
    t.after(project.close);
    const before = snapshot(project.root);
    const absolute = join(project.root, unreadable);
    chmodSync(join(project.root, restricted), mode);
    try {
      try {
        if (mode === 0o000) readdirSync(absolute);
        else lstatSync(absolute);
        t.skip('this user can inspect a path without permission');
        return;
      } catch {
        // The path exists but cannot be inspected, as intended.
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

function failures(outcome) {
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'failed', outcome.result.message);
  return outcome.result.message;
}

function passes(outcome) {
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'passed', outcome.result.message);
}

const usageIndexed = {
  'docs/README.md': index('Documentation', 'This directory maps the documentation categories.', [
    ['Development', 'development/README.md', 'building and validating the project.'],
    ['Usage', 'usage/README.md', 'using the project.'],
  ]),
  'docs/development/README.md': developmentGuide(),
};

test('the index entry form rule passes a one-sentence purpose and well-formed entries', t => {
  passes(check(t, {
    ...usageIndexed,
    'docs/usage/README.md': `# Usage

This directory explains how to install, configure, and run the project, e.g. on a
server.

- [Install](install.md): prerequisites and installation.
- **[Configure](configure.md)**: settings, with [examples](configure.md#examples).
- [Examples](examples/): worked examples.

Ask a maintainer when something is missing.
`,
    'docs/usage/install.md': '# Install\n',
    'docs/usage/configure.md': '# Configure\n',
    'docs/usage/examples/README.md': index('Examples', 'This directory holds worked examples.'),
  }));
});

test('the index entry form rule accepts any heading level as the title', t => {
  passes(check(t, {
    ...usageIndexed,
    'docs/usage/README.md': `## Usage

This directory explains how to use the project.

- [Install](install.md): prerequisites and installation.
`,
    'docs/usage/install.md': '# Install\n',
  }));
});

test('the index entry form rule fails a missing or multi-sentence purpose and malformed entries', t => {
  const message = failures(check(t, {
    ...usageIndexed,
    'docs/usage/README.md': `# Usage

- [Install](install.md): prerequisites and installation.
`,
    'docs/usage/install.md': '# Install\n',
  }));
  assert.match(message, /docs\/usage\/README\.md breaks the index entry form rule: start it with a one-sentence purpose after its title\./);

  const multiSentence = failures(check(t, {
    ...usageIndexed,
    'docs/usage/README.md': index('Usage', 'This directory explains usage. It also holds examples.', [
      ['Install', 'install.md', 'prerequisites and installation.'],
    ]),
    'docs/usage/install.md': '# Install\n',
  }));
  assert.match(multiSentence, /docs\/usage\/README\.md breaks the index entry form rule: make the purpose after its title one sentence\./);
  const withoutTerminal = failures(check(t, {
    ...usageIndexed,
    'docs/usage/README.md': index('Usage', 'Usage documentation', [
      ['Install', 'install.md', 'prerequisites and installation.'],
    ]),
    'docs/usage/install.md': '# Install\n',
  }));
  assert.match(withoutTerminal, /docs\/usage\/README\.md breaks the index entry form rule: make the purpose after its title one sentence\./);

  const malformed = failures(check(t, {
    ...usageIndexed,
    'docs/usage/README.md': `# Usage

This directory explains how to use the project.

- [Install](install.md)
- See [Configure](configure.md): settings.
- [Website](https://example.com/guide): the hosted guide.
- Plain text
- [Run](run.md):no space before the description.
- [Usage](#usage): this index itself.
`,
    'docs/usage/install.md': '# Install\n',
    'docs/usage/configure.md': '# Configure\n',
    'docs/usage/run.md': '# Run\n',
  }));
  for (const item of ['Install', 'See Configure: settings\\.', 'Website: the hosted guide\\.', 'Plain text', 'Run:no space', 'Usage: this index itself\\.']) {
    assert.match(malformed, new RegExp(`docs/usage/README\\.md breaks the index entry form rule: write each entry as one "\\[Title\\]\\(path\\): description" item; "${item}[^"]*" is not\\.`), item);
  }
  assert.doesNotMatch(malformed, /docs\/usage\/(install|configure|run)\.md breaks the one index per document rule/,
    'a malformed item still lists the path its first link names');
  assert.doesNotMatch(malformed, /docs\/usage\/README\.md breaks the one index per document rule/,
    'a link into the index itself lists nothing');
});

test('the one index per document rule passes each document listed once in its own index', t => {
  passes(check(t, {
    ...usageIndexed,
    'docs/usage/README.md': index('Usage', 'This directory explains how to use the project.', [
      ['Install', 'install.md', 'prerequisites and installation.'],
      ['Guides', 'guides/README.md', 'step-by-step guides.'],
      ['Back to the documentation map', '../README.md', 'every category.'],
    ]),
    'docs/usage/install.md': '# Install\n\nSee the [guides](guides/README.md) and [first run](guides/first-run.md).\n',
    'docs/usage/guides/README.md': index('Guides', 'This directory holds step-by-step guides.', [
      ['First run', 'first-run.md', 'running the project once.'],
    ]),
    'docs/usage/guides/first-run.md': '# First run\n',
  }));
});

test('the one index per document rule fails a document listed in no index, twice, or in another index', t => {
  const message = failures(check(t, {
    ...usageIndexed,
    'docs/usage/README.md': index('Usage', 'This directory explains how to use the project.', [
      ['Install', 'install.md', 'prerequisites and installation.'],
      ['Installation', 'install.md', 'the same document again.'],
      ['First run', 'guides/first-run.md', 'running the project once.'],
    ]),
    'docs/usage/install.md': '# Install\n',
    'docs/usage/configure.md': '# Configure\n',
    'docs/usage/guides/README.md': index('Guides', 'This directory holds step-by-step guides.', [
      ['First run', 'first-run.md', 'running the project once.'],
    ]),
    'docs/usage/guides/first-run.md': '# First run\n',
  }));
  assert.match(message, /docs\/usage\/configure\.md breaks the one index per document rule: list it in docs\/usage\/README\.md\./);
  assert.match(message, /docs\/usage\/install\.md breaks the one index per document rule: list it once in docs\/usage\/README\.md\./);
  assert.match(message, /docs\/usage\/guides\/README\.md breaks the one index per document rule: list it in docs\/usage\/README\.md\./,
    'a directory README is listed in its parent index');
  assert.match(message, /docs\/usage\/guides\/first-run\.md breaks the one index per document rule: list it only in docs\/usage\/guides\/README\.md; remove it from docs\/usage\/README\.md\./);
});

test('the one index per document rule accepts the installed agents index citing the project guidance in context', t => {
  const agentsIndex = readFileSync(new URL('../docs/agents/README.md', import.meta.url), 'utf8');
  const files = {
    'docs/README.md': index('Documentation', 'This directory maps the documentation categories.', [
      ['Development', 'development/README.md', 'building and validating the project.'],
      ['Agent configuration', 'agents/README.md', 'agent workflow configuration.'],
    ]),
    'docs/development/README.md': developmentGuide(),
    'docs/agents/README.md': agentsIndex,
    'docs/agents/issue-tracker.md': '# Issue tracker\n',
    'docs/agents/triage-labels.md': '# Triage labels\n',
    'docs/agents/domain.md': '# Domain docs\n',
    'docs/agents/project.md': '# Project guidance\n',
  };
  passes(check(t, files));

  const listedElsewhere = failures(check(t, {
    ...files,
    'docs/README.md': index('Documentation', 'This directory maps the documentation categories.', [
      ['Development', 'development/README.md', 'building and validating the project.'],
      ['Agent configuration', 'agents/README.md', 'agent workflow configuration.'],
      ['Project guidance', 'agents/project.md', 'repository-specific agent constraints.'],
    ]),
  }));
  assert.equal(listedElsewhere, 'Documentation navigation needs correction: docs/agents/project.md breaks the one index per document rule: leave it to the in-context citation in docs/agents/README.md; remove it from docs/README.md.');

  const withoutCitation = failures(check(t, {
    ...files,
    'docs/agents/README.md': index('Agent configuration', 'This directory holds the agent configuration.', [
      ['Issue tracker', 'issue-tracker.md', 'issue operations.'],
      ['Triage labels', 'triage-labels.md', 'label strings.'],
      ['Domain docs', 'domain.md', 'domain documentation.'],
    ]),
  }));
  assert.equal(withoutCitation, 'Documentation navigation needs correction: docs/agents/project.md breaks the one index per document rule: list it in docs/agents/README.md.',
    'an agents index that neither lists nor cites the project guidance does not cover it');

  passes(check(t, {
    ...files,
    'docs/agents/README.md': `${index('Agent configuration', 'This directory holds the agent configuration.', [
      ['Issue tracker', 'issue-tracker.md', 'issue operations.'],
      ['Triage labels', 'triage-labels.md', 'label strings.'],
      ['Domain docs', 'domain.md', 'domain documentation.'],
    ])}\nRead [the project guidance](project.md) for repository constraints.\n`,
  }), 'a link in context is a citation too');

  const otherAgentsDocument = failures(check(t, { ...files, 'docs/agents/notes.md': '# Notes\n' }));
  assert.equal(otherAgentsDocument, 'Documentation navigation needs correction: docs/agents/notes.md breaks the one index per document rule: list it in docs/agents/README.md.',
    'only the project guidance is cited in context');
});

test('the development guide order rule passes its purpose, then Setup and validation, then its index', t => {
  passes(check(t, {
    ...rootDocumentation,
    'docs/development/README.md': `# Development

This directory explains how to build and validate the project.

## Setup and validation

- Install Node.js 24.
- Run \`npm test\`; see [testing](testing.md) for fixtures.

### Releases

Follow the [release procedure](release.md).

## Documents

- [Testing](testing.md): the test suites.
- [Release procedure](release.md): publishing a release.
`,
    'docs/development/testing.md': '# Testing\n',
    'docs/development/release.md': '# Release\n',
  }));
});

test('the development guide order rule fails a guide without Setup and validation or with its index before it', t => {
  const withoutSection = failures(check(t, {
    ...rootDocumentation,
    'docs/development/README.md': index('Development', 'This directory explains how to build and validate the project.', [
      ['Testing', 'testing.md', 'the test suites.'],
    ]),
    'docs/development/testing.md': '# Testing\n',
  }));
  assert.equal(withoutSection, 'Documentation navigation needs correction: docs/development/README.md breaks the development guide order rule: give its purpose, then a Setup and validation section, then its index.');

  const indexFirst = failures(check(t, {
    ...rootDocumentation,
    'docs/development/README.md': `# Development

This directory explains how to build and validate the project.

- [Testing](testing.md): the test suites.

## Setup and validation

Run \`npm test\`.
`,
    'docs/development/testing.md': '# Testing\n',
  }));
  assert.equal(indexFirst, 'Documentation navigation needs correction: docs/development/README.md breaks the development guide order rule: list its entries after the Setup and validation section.',
    'an entry listed before the index gets only the order correction');

  const indexInside = failures(check(t, {
    ...rootDocumentation,
    'docs/development/README.md': `# Development

This directory explains how to build and validate the project.

## Setup and validation

Run \`npm test\`.

- [Testing](testing.md): the test suites.
`,
    'docs/development/testing.md': '# Testing\n',
  }));
  assert.match(indexInside, /docs\/development\/README\.md breaks the development guide order rule: list its entries after the Setup and validation section\./);

  const sectionLater = failures(check(t, {
    ...rootDocumentation,
    'docs/development/README.md': `# Development

This directory explains how to build and validate the project.

## Architecture

The project has one module.

## Setup and validation

Run \`npm test\`.
`,
  }));
  assert.equal(sectionLater, 'Documentation navigation needs correction: docs/development/README.md breaks the development guide order rule: give its purpose, then a Setup and validation section, then its index.');

  const purposeLater = failures(check(t, {
    ...rootDocumentation,
    'docs/development/README.md': `# Development

## Setup and validation

Run \`npm test\`.
`,
  }));
  assert.equal(purposeLater, 'Documentation navigation needs correction: docs/development/README.md breaks the index entry form rule: start it with a one-sentence purpose after its title.');
});

test('the development guide order rule applies only to the repository development guide', t => {
  passes(check(t, {
    ...rootDocumentation,
    'packages/app/handbook/README.md': index('Handbook', 'This directory maps the app handbook.', [
      ['Development', 'development/README.md', 'building the app.'],
    ]),
    'packages/app/handbook/development/README.md': index('Development', 'This directory explains how to build the app.', [
      ['Testing', 'testing.md', 'the app tests.'],
    ]),
    'packages/app/handbook/development/testing.md': '# Testing\n',
  }));
});

test('the scope coverage rule passes documents in the confirmed scope or owned by another declaration', t => {
  const files = {
    ...rootDocumentation,
    'docs/README.md': index('Documentation', 'This directory maps the documentation categories.', [
      ['Development', 'development/README.md', 'building and validating the project.'],
      ['Agent configuration', 'agents/README.md', 'agent workflow configuration.'],
    ]),
    'docs/agents/README.md': index('Agent configuration', 'This directory holds the agent configuration.', [
      ['Issue tracker', 'issue-tracker.md', 'issue operations.'],
      ['Generated', 'generated/README.md', 'generated configuration.'],
    ]),
    'docs/agents/issue-tracker.md': '# Issue tracker\n',
    'docs/agents/generated/README.md': index('Generated', 'This directory holds generated configuration.'),
  };
  const project = fixture(files);
  t.after(project.close);
  const outcome = invokeCheck(script, project.root, {
    operation: { declaration: 'documentation', phase: 'checks', id: 'navigation' },
    declarations: [
      { id: 'agents-index', kind: 'file', target: 'docs/agents/README.md', exact: 'docs/agents/README.md', checks: [], fixes: [] },
      { id: 'issue-tracker', kind: 'file', target: 'docs/agents/issue-tracker.md', exact: 'x.md', checks: [], fixes: [] },
      { id: 'generated', kind: 'repository', guidance: 'g.md', targets: { paths: [], directories: ['docs/agents/generated'] }, checks: [], fixes: [] },
    ],
    allowedTargets: { paths: ['docs/README.md', 'docs/development/README.md'], directories: [] },
  });
  passes(outcome);
});

test('the scope coverage rule fails a document under a documentation root outside the confirmed scope', t => {
  const files = {
    ...usageIndexed,
    'docs/usage/README.md': index('Usage', 'This directory explains how to use the project.', [
      ['Install', 'install.md', 'prerequisites and installation.'],
    ]),
    'docs/usage/install.md': '# Install\n',
    'docs/usage/diagram.svg': '<svg/>\n',
    'packages/app/handbook/README.md': index('Handbook', 'This directory maps the app handbook.', [
      ['Usage', 'usage/README.md', 'using the app.'],
    ]),
    'packages/app/handbook/usage/README.md': index('Usage', 'This directory explains how to use the app.', [
      ['Notes', 'notes.md', 'operating notes.'],
    ]),
    'packages/app/handbook/usage/notes.md': '# Notes\n',
    'notes/unrelated.md': '# Unrelated\n',
  };
  const outcome = check(t, files, Object.keys(files).filter(path => ![
    'docs/usage/install.md',
    'docs/usage/diagram.svg',
    'packages/app/handbook/usage/notes.md',
    'notes/unrelated.md',
  ].includes(path)));
  assert.equal(failures(outcome), 'Documentation navigation needs correction: docs/usage/install.md breaks the scope coverage rule: include it in the confirmed documentation scope. packages/app/handbook/usage/notes.md breaks the scope coverage rule: include it in the confirmed documentation scope.');
});

test('names the file and the rule in every documentation rule failure', t => {
  const message = failures(check(t, {
    'docs/README.md': '# Documentation\n\n- [Usage](usage/README.md)\n',
    'docs/development/README.md': '# Development\n\nThis directory explains development.\n',
    'docs/usage/README.md': index('Usage', 'This directory explains how to use the project.'),
  }, ['docs/README.md', 'docs/development/README.md']));
  const corrections = message.replace(/^Documentation navigation needs correction: /, '').split(/(?<=\.) (?=docs\/)/);
  assert.deepEqual(corrections, [
    'docs/README.md breaks the index entry form rule: start it with a one-sentence purpose after its title.',
    'docs/README.md breaks the index entry form rule: write each entry as one "[Title](path): description" item; "Usage" is not.',
    'docs/development/README.md breaks the one index per document rule: list it in docs/README.md.',
    'docs/development/README.md breaks the development guide order rule: give its purpose, then a Setup and validation section, then its index.',
    'docs/usage/README.md breaks the scope coverage rule: include it in the confirmed documentation scope.',
  ]);
});
