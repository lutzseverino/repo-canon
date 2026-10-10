import assert from "node:assert/strict";
import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  fixture,
  invokeCheck,
  retainedCheck,
  snapshot,
} from "./helpers/operation.mjs";

const script = fileURLToPath(
  new URL("../operations/check-project-readmes.mjs", import.meta.url),
);

function check(t, files, paths) {
  const project = fixture(files);
  t.after(project.close);
  const before = snapshot(project.root);
  const outcome = invokeCheck(script, project.root, {
    operation: {
      declaration: "project-readmes",
      phase: "checks",
      id: "structure",
    },
    allowedTargets: { paths, directories: [] },
  });
  assert.deepEqual(
    snapshot(project.root),
    before,
    "the check must not change project content",
  );
  return outcome;
}

test("passes concrete Project READMEs with plain titles without changing content", (t) => {
  const outcome = check(
    t,
    {
      "components/relay/README.md": `# Relay

Relay delivers queued messages for the workspace.

## Development

From \`components/relay\`, run \`npm test\`.

Configuration is described in [the relay guide](../../docs/development/relay.md).
Shared setup lives in [the development guide](../../docs/development/README.md).
`,
      "docs/development/README.md": "# Development\n",
      "docs/development/relay.md": "# Relay development\n",
    },
    ["components/relay/README.md"],
  );

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.deepEqual(outcome.result, {
    format: "repo-standards/result/v2",
    status: "passed",
    message:
      "Project README structure is valid for 1 concrete target; purpose, commands, configuration, and documentation still require maintainer or agent review.",
  });
});

test("runs from its declared retained source layout", (t) => {
  const retainedScript = retainedCheck(
    t,
    "operations/check-project-readmes.mjs",
  );
  const project = fixture({ "packages/parser/README.md": "# Parser\n" });
  t.after(project.close);
  const outcome = invokeCheck(retainedScript, project.root, {
    operation: {
      declaration: "project-readmes",
      phase: "checks",
      id: "structure",
    },
    allowedTargets: { paths: ["packages/parser/README.md"], directories: [] },
  });
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "passed");
});

test("reports missing Project READMEs and every title that is not one non-centered Markdown level-one first heading", (t) => {
  const readmes = [
    {
      name: "a centered title",
      path: "services/gateway/README.md",
      content: `<div align="center">

# Gateway

</div>

Gateway accepts public requests.
`,
    },
    {
      name: "no title",
      path: "packages/parser/README.md",
      content: "Parser utilities for workspace packages.\n",
    },
    {
      name: "a title after another heading",
      path: "tools/report/README.md",
      content: `## Draft notes

# Report

Report creates maintenance summaries.
`,
    },
    {
      name: "an HTML title",
      path: "libraries/raw-title/README.md",
      content: "<h1>Raw title</h1>\n\nLibrary purpose.\n",
    },
    {
      name: "two titles",
      path: "libraries/two-titles/README.md",
      content: "# Two\n\nLibrary purpose.\n\n# Titles\n",
    },
  ];
  const outcome = check(
    t,
    Object.fromEntries(readmes.map(({ path, content }) => [path, content])),
    [...readmes.map(({ path }) => path), "unusual-layout/worker/README.md"],
  );

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "failed");
  for (const { name, path } of readmes)
    assert.ok(
      outcome.result.message.includes(
        `Give ${path} one non-centered level-one title as its first heading.`,
      ),
      name,
    );
  assert.match(
    outcome.result.message,
    /Create unusual-layout\/worker\/README\.md for the maintained Project/,
  );
});

test("reports broken rendered local links without treating examples as navigation", (t) => {
  const outcome = check(
    t,
    {
      "odd/work-unit/README.md": `# Work unit

The work unit transforms queued input.

[Setup](../../docs/development/README.md#setup)
[Missing guide](guide/missing.md)
[External](https://example.com/manual)
[This section](#development)

\`\`\`markdown
[Example](still-missing.md)
\`\`\`

## Development

Run the checks from this directory.
`,
      "docs/development/README.md": "# Development\n",
    },
    ["odd/work-unit/README.md"],
  );

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "failed");
  assert.match(
    outcome.result.message,
    /odd\/work-unit\/README\.md links to missing guide\/missing\.md/,
  );
  assert.doesNotMatch(outcome.result.message, /still-missing/);
});

test("checks heading links and rejects decoded paths that escape the repository", (t) => {
  const outcome = check(
    t,
    {
      "component/README.md": `# [Component](heading-missing.md)

Component provides shared behavior.

[Escaped path](..%2f..%2f..%2f..%2fetc/passwd)
[Windows escape](..%5c..%5cWindows%5cwin.ini)
`,
    },
    ["component/README.md"],
  );

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "failed");
  assert.match(outcome.result.message, /links to missing heading-missing\.md/);
  assert.match(
    outcome.result.message,
    /links to missing \.\.%2f\.\.%2f\.\.%2f\.\.%2fetc\/passwd/,
  );
  assert.match(
    outcome.result.message,
    /links to missing \.\.%5c\.\.%5cWindows%5cwin\.ini/,
  );
});

test("does not follow external or dangling symlinks when checking local links", (t) => {
  const project = fixture({
    "component/README.md": `# Component

[External host file](jump/etc/passwd)
[Dangling link](dangling.md)
`,
  });
  t.after(project.close);
  mkdirSync(join(project.root, "component"), { recursive: true });
  symlinkSync("/", join(project.root, "component/jump"), "dir");
  symlinkSync("missing.md", join(project.root, "component/dangling.md"));
  const before = snapshot(project.root);
  const outcome = invokeCheck(script, project.root, {
    operation: {
      declaration: "project-readmes",
      phase: "checks",
      id: "structure",
    },
    allowedTargets: { paths: ["component/README.md"], directories: [] },
  });

  assert.deepEqual(
    snapshot(project.root),
    before,
    "the check must not change project content",
  );
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "failed");
  assert.match(outcome.result.message, /links to missing jump\/etc\/passwd/);
  assert.match(outcome.result.message, /links to missing dangling\.md/);
});

test("requires link casing to match the repository entry", (t) => {
  const outcome = check(
    t,
    {
      "component/README.md": "# Component\n\n[Guide](Guide.md)\n",
      "component/guide.md": "# Guide\n",
    },
    ["component/README.md"],
  );

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "failed");
  assert.match(outcome.result.message, /links to missing Guide\.md/);
});

test("requires concrete Project README path casing to match repository entries", (t) => {
  const outcome = check(
    t,
    {
      "component/readme.md": "# Component\n",
      "Service/README.md": "# Service\n",
    },
    ["component/README.md", "service/README.md"],
  );

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "failed");
  assert.match(outcome.result.message, /Create component\/README\.md/);
  assert.match(outcome.result.message, /Create service\/README\.md/);
});

test("resolves sibling links from Project paths containing URL syntax", (t) => {
  const paths = [
    "component#1/README.md",
    "component?1/README.md",
    "component%1/README.md",
  ];
  const outcome = check(
    t,
    {
      "component#1/README.md": "# Hash component\n\n[Guide](guide.md)\n",
      "component#1/guide.md": "# Guide\n",
      "component?1/README.md": "# Query component\n\n[Guide](guide.md)\n",
      "component?1/guide.md": "# Guide\n",
      "component%1/README.md": "# Percent component\n\n[Guide](guide.md)\n",
      "component%1/guide.md": "# Guide\n",
    },
    paths,
  );

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "passed");
});

test("allows empty concrete Project README scope while leaving coverage to review", (t) => {
  const outcome = check(t, {}, []);
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "passed");
  assert.match(outcome.result.message, /0 concrete targets/);
});

test("rejects directory scope and non-README targets as process errors", (t) => {
  const project = fixture({ "component/README.md": "# Component\n" });
  t.after(project.close);
  const before = snapshot(project.root);
  for (const allowedTargets of [
    { paths: ["component/README.md"], directories: ["component"] },
    { paths: ["component/package.json"], directories: [] },
    { paths: ["../README.md"], directories: [] },
  ]) {
    const outcome = invokeCheck(script, project.root, { allowedTargets });
    assert.notEqual(outcome.status, 0);
    assert.equal(outcome.stdout, "");
    assert.match(outcome.stderr, /individual non-root README\.md paths/);
  }
  assert.deepEqual(snapshot(project.root), before);
});
