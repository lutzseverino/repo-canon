import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { invokeCheck, fixture, snapshot } from './helpers/operation.mjs';

const script = fileURLToPath(new URL('../operations/check-repository-readme.mjs', import.meta.url));

function check(t, files, overrides) {
  const project = fixture(files);
  t.after(project.close);
  const before = snapshot(project.root);
  const outcome = invokeCheck(script, project.root, overrides);
  assert.deepEqual(snapshot(project.root), before, 'the check must not change project content');
  return outcome;
}

const mit = 'MIT License\n\nCopyright (c) 2026 Example\n';

test('passes an applicable Repository README without changing content', t => {
  const outcome = check(t, {
    'README.md': `<h1 align="center">Harbor</h1>

A queue-backed service for reliable message delivery.

![Node.js](https://img.shields.io/badge/Node.js-24-green)

[docs]: docs/README.md#usage
[license]: LICENSE

## Installation

\`npm install harbor\`

## Features

- Durable delivery

## Product details

The inspector is intentionally read-only.

### Usage

\`harbor send example\`

## Configuration

Set \`HARBOR_PORT\`.

## **Documentation**

- Start with:
    [the documentation map][docs].

## _Contributing_

See [the contribution guide](<CONTRIBUTING.md>).

## **License**

[MIT License][license]

<!-- License details are maintained in the linked file. -->
`,
    'LICENSE': mit,
    'CONTRIBUTING.md': '# Contributing\n',
    'docs/README.md': '# Documentation\n',
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.deepEqual(outcome.result, {
    format: 'repo-standards/result/v1',
    status: 'passed',
    message: 'Repository README structure is valid; factual content still requires maintainer or agent review.',
  });
});

test('allows omitted recognized sections and useful interleaved sections', t => {
  const outcome = check(t, {
    'README.md': `<div align="center">

# Harbor

</div>

A small tool for inspecting queues.

\`\`\`text
## License
\`\`\`

## Usage

Run \`harbor inspect\`.

#### Architecture

Harbor reads queues without modifying them.

### Contributing

[Contribution requirements](./CONTRIBUTING.md)

### License

[MIT License](./LICENSE)
`,
    'LICENSE': mit,
    'CONTRIBUTING.md': '# Contributing\n',
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'passed');
});

test('blocks rather than inferring licensing from another filename', t => {
  const outcome = check(t, {
    'README.md': `<h1 align="center">Harbor</h1>

A queue inspector.

## License

[GNU General Public License](COPYING)
`,
    'COPYING': 'GNU General Public License\n\nVersion 3, 29 June 2007\n',
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'blocked');
  assert.match(outcome.result.message, /No root LICENSE file/);
  assert.match(outcome.result.message, /Owner clarification required/);
});

test('reports concrete title and section-order corrections as a policy failure', t => {
  const outcome = check(t, {
    'README.md': `\`<h1 align="center">Example</h1>\`

# Harbor

A queue inspector.

## Features

- Small

## Installation

Install it.

## License

[MIT License](LICENSE)
`,
    'LICENSE': mit,
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'failed');
  assert.match(outcome.result.message, /Center the Repository README title/);
  assert.match(outcome.result.message, /Move Installation before Features/);
});

test('orders recognized sections across Markdown heading forms', t => {
  const outcome = check(t, {
    'README.md': `<h1 align="center">Harbor</h1>

A queue inspector.

Features
--------

- Small

 # Installation

Install it.

## License

[MIT License](LICENSE)
`,
    'LICENSE': mit,
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'failed');
  assert.match(outcome.result.message, /Move Installation before Features/);
});

test('orders and validates sections rendered with HTML headings', t => {
  const outcome = check(t, {
    'README.md': `<h1 align="center">Harbor</h1>

A queue inspector.

<h2>Features</h2>

- Small

<h2>Installation</h2>

Install it.

<h2>License</h2>

[MIT](LICENSE)
`,
    'LICENSE': 'MIT\n',
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'failed');
  assert.match(outcome.result.message, /Move Installation before Features/);
  assert.doesNotMatch(outcome.result.message, /Add a License section/);
});

test('leaves the repository license identity to semantic review', t => {
  const outcome = check(t, {
    'README.md': `<h1 align="center">Harbor</h1>

A queue inspector.

## License

[0BSD](<LICENSE>)
`,
    'LICENSE': 'BSD Zero Clause License\n',
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'passed');
});

test('rejects empty or uncentered rendered titles', async t => {
  for (const example of [
    { title: '# #', centeredBlock: true },
    { title: '# &Tab;', centeredBlock: true },
    { title: '# <script>Draft</script>', centeredBlock: true },
    { title: '<h1 align="center">&#32;</h1>' },
    { title: '<div align=centerpiece><h1>Harbor</h1></div>' },
    { title: '<div data-align="center"><h1>Harbor</h1></div>' },
  ]) await t.test(example.title, st => {
    const readme = !example.centeredBlock ? `${example.title}

A queue inspector.

## License

[MIT License](LICENSE)
` : `<div align="center">

${example.title}

</div>

A queue inspector.

## License

[MIT License](LICENSE)
`;
    const outcome = check(st, { 'README.md': readme, 'LICENSE': mit });

    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, 'failed');
    assert.match(outcome.result.message, /Center the Repository README title/);
  });
});

test('ignores headings hidden in HTML comments and raw-text elements', t => {
  const outcome = check(t, {
    'README.md': `<!-- <h1 align="center">Draft</h1> -->

<script><h1 align="center">Draft</h1></script>

<h1 align="center"><script>Draft</script></h1>

A queue inspector.

<!-- <h2>License</h2> -->

[MIT License](LICENSE)
`,
    'LICENSE': mit,
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'failed');
  assert.match(outcome.result.message, /Center the Repository README title/);
  assert.match(outcome.result.message, /Add a License section/);
});

test('preserves centering through nested HTML blocks', t => {
  const outcome = check(t, {
    'README.md': `<div align="center">

<div>Logo</div>

# Harbor

</div>

A queue inspector.

## License

[MIT License](LICENSE)
`,
    'LICENSE': mit,
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'passed');
});

test('does not accept navigation links hidden in code fences', t => {
  const outcome = check(t, {
    'README.md': `<h1 align="center">Harbor</h1>

A queue inspector.

## Documentation

\`\`\`markdown
[Documentation](docs/README.md)
\`\`\`

\`[Documentation](docs/README.md)\`

    [Documentation](docs/README.md)

\\[Documentation](docs/README.md)

## License

[MIT License](LICENSE)
`,
    'LICENSE': mit,
    'docs/README.md': '# Documentation\n',
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'failed');
  assert.match(outcome.result.message, /Link the Documentation section to docs\/README\.md/);
});

test('finds navigation links rendered in table cells', t => {
  const outcome = check(t, {
    'README.md': `<h1 align="center">Harbor</h1>

A queue inspector.

## Documentation

| Resource | Link |
| --- | --- |
| Manual | [Documentation](docs/README.md#usage) |

## Contributing

| Resource | Link |
| --- | --- |
| Guide | [Contributing](CONTRIBUTING.md) |

## License

[MIT License](LICENSE)
`,
    'LICENSE': mit,
    'CONTRIBUTING.md': '# Contributing\n',
    'docs/README.md': '# Documentation\n',
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'passed');
});

test('validates headings and links from one rendered HTML fragment', t => {
  const outcome = check(t, {
    'README.md': `<div align="center"><a href="/"><h1>Harbor</h1></a></div>
<p>A queue inspector.</p>
<h2>Documentation</h2><p><a href="docs/README.md#usage">Documentation</a></p>
<h2>Contributing</h2><p><a href="CONTRIBUTING.md">Contributing</a></p>
<a href="#license"><h2>License</h2></a><p><a href="LICENSE">MIT License</a></p>
`,
    'LICENSE': mit,
    'CONTRIBUTING.md': '# Contributing\n',
    'docs/README.md': '# Documentation\n',
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'passed');
});

test('reports malformed license sections against the repository license file', async t => {
  for (const example of [
    { name: 'missing section', body: '', diagnostic: 'Add a License section' },
    { name: 'empty label', body: '## License\n\n[](LICENSE)\n', diagnostic: 'Name the License link' },
    { name: 'wrong target', body: '## License\n\n[MIT License](COPYING)\n', diagnostic: 'target LICENSE' },
    { name: 'extra prose', body: '## License\n\nReleased under [MIT License](LICENSE).\n', diagnostic: 'contain only the license link' },
    { name: 'extra image', body: '## License\n\n[MIT License](LICENSE) ![badge](badge.svg)\n', diagnostic: 'contain only the license link' },
  ]) await t.test(example.name, st => {
    const outcome = check(st, {
      'README.md': `<h1 align="center">Harbor</h1>\n\nA queue inspector.\n\n${example.body}`,
      'LICENSE': mit,
    });
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, 'failed');
    assert.match(outcome.result.message, new RegExp(example.diagnostic));
  });
});

test('blocks when licensing is missing or ambiguous instead of selecting a license', async t => {
  for (const example of [
    { name: 'missing', files: {}, diagnostic: 'No root LICENSE file' },
    { name: 'multiple files', files: { LICENSE: mit, 'LICENSE.md': mit }, diagnostic: 'Multiple root LICENSE variants' },
    { name: 'empty license', files: { LICENSE: '\n\n' }, diagnostic: 'is empty' },
  ]) await t.test(example.name, st => {
    const outcome = check(st, {
      'README.md': '# Harbor\n\nA queue inspector.\n\n## Features\n\nFast.\n\n## Installation\n\nInstall it.\n',
      ...example.files,
    });
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, 'blocked');
    assert.match(outcome.result.message, /Owner clarification required/);
    assert.match(outcome.result.message, new RegExp(example.diagnostic));
    assert.match(outcome.result.message, /Center the Repository README title/);
    assert.match(outcome.result.message, /Move Installation before Features/);
  });
});

test('treats invalid public-protocol input as a process error', t => {
  const project = fixture({ README: 'Project\n' });
  t.after(project.close);
  const before = snapshot(project.root);
  const outcome = invokeCheck(script, project.root, {
    format: 'repo-standards/operation/v2',
  });

  assert.notEqual(outcome.status, 0);
  assert.equal(outcome.stdout, '');
  assert.match(outcome.stderr, /Unsupported operation input format/);
  assert.deepEqual(snapshot(project.root), before);
});

test('rejects an unexpected operation target as a process error', t => {
  const project = fixture({ README: 'Project\n' });
  t.after(project.close);
  const before = snapshot(project.root);
  const outcome = invokeCheck(script, project.root, {
    allowedTargets: { paths: ['docs/README.md'], directories: [] },
  });

  assert.notEqual(outcome.status, 0);
  assert.equal(outcome.stdout, '');
  assert.match(outcome.stderr, /exact README.md target/);
  assert.deepEqual(snapshot(project.root), before);
});
