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

## Installation

\`npm install harbor\`

## Features

- Durable delivery

## Usage

\`harbor send example\`

## Configuration

Set \`HARBOR_PORT\`.

## Documentation

See [the documentation map](docs/README.md).

## Contributing

See [the contribution guide](CONTRIBUTING.md).

## License

[MIT License](LICENSE)
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

## Architecture

Harbor reads queues without modifying them.

## Contributing

[Contribution requirements](./CONTRIBUTING.md)

## License

[MIT License](./LICENSE)
`,
    'LICENSE': mit,
    'CONTRIBUTING.md': '# Contributing\n',
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'passed');
});

test('reports concrete title and section-order corrections as a policy failure', t => {
  const outcome = check(t, {
    'README.md': `# Harbor

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

test('reports malformed license sections against the repository license file', async t => {
  for (const example of [
    { name: 'missing section', body: '', diagnostic: 'Add a License section' },
    { name: 'wrong name', body: '## License\n\n[License](LICENSE)\n', diagnostic: 'name the link “MIT License”' },
    { name: 'wrong target', body: '## License\n\n[MIT License](COPYING)\n', diagnostic: 'target LICENSE' },
    { name: 'extra prose', body: '## License\n\nReleased under [MIT License](LICENSE).\n', diagnostic: 'contain only the license link' },
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
    { name: 'missing', files: {}, diagnostic: 'No root license file' },
    { name: 'multiple files', files: { LICENSE: mit, 'LICENSE.md': mit }, diagnostic: 'Multiple root license files' },
    { name: 'unnamed license', files: { LICENSE: '\n\n' }, diagnostic: 'does not identify a license name' },
    {
      name: 'multiple names',
      files: { LICENSE: 'MIT License OR Apache License 2.0\n' },
      diagnostic: 'identifies ambiguous licensing',
    },
  ]) await t.test(example.name, st => {
    const outcome = check(st, {
      'README.md': '<h1 align="center">Harbor</h1>\n\nA queue inspector.\n',
      ...example.files,
    });
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, 'blocked');
    assert.match(outcome.result.message, /Owner clarification required/);
    assert.match(outcome.result.message, new RegExp(example.diagnostic));
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
