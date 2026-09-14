import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const validator = join(repositoryRoot, ".github/scripts/validate-pr-metadata.mjs");

function validBody(extra = "") {
  return `## Summary

Validate the pull request metadata before merge.

## Validation

\`npm test\` passed with all event fixtures.

## Related issue

Closes #6
${extra}`;
}

function runEvent({ action = "opened", title = "feat(metadata): validate pull requests", body = validBody(), pullRequest = {} } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "repo-canon-pr-metadata-"));
  const eventPath = join(directory, "event.json");
  const summaryPath = join(directory, "summary.md");
  writeFileSync(
    eventPath,
    JSON.stringify({ action, pull_request: { title, body, ...pullRequest } }),
  );
  const result = spawnSync(process.execPath, [validator, eventPath], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, GITHUB_STEP_SUMMARY: summaryPath },
  });
  const summary = existsSync(summaryPath) ? readFileSync(summaryPath, "utf8") : "";
  rmSync(directory, { recursive: true, force: true });
  return { ...result, summary };
}

test("accepts valid metadata for every configured pull request update", () => {
  const workflow = readFileSync(
    join(repositoryRoot, ".github/workflows/pr-metadata.yml"),
    "utf8",
  );
  const configuredTypes = workflow.match(/types:\s*\[([^\]]+)]/)?.[1]
    .split(",")
    .map((type) => type.trim());
  assert.deepEqual(configuredTypes, [
    "opened",
    "edited",
    "synchronize",
    "reopened",
    "ready_for_review",
  ]);

  for (const action of configuredTypes) {
    const valid = runEvent({ action });
    assert.equal(valid.status, 0, `${action}: ${valid.stderr}`);
    assert.match(valid.stdout, /validation passed/);
    assert.match(valid.summary, /validation passed/);

    const invalid = runEvent({ action, body: "Unstructured description" });
    assert.equal(invalid.status, 1, action);
    assert.match(invalid.stderr, /Add a Summary section/);
  }
});

test("accepts harmless heading casing and formatting variations", () => {
  const body = `### **sUMMary:**

Fix a typo in the contributor instructions.

# VALIDATION

Manual link inspection completed successfully.

#### Related Issue

Small correction: fix a typo in contributor-facing text.
`;
  const result = runEvent({ title: "docs: fix contributor typo", body });
  assert.equal(result.status, 0, result.stderr);
});

test("limits the small-correction exception to eligible categories", () => {
  for (const reason of [
    "fix a typo in contributor-facing text",
    "repair a broken Markdown link in the guide",
    "correct formatting in the example table",
  ]) {
    const eligible = runEvent({
      title: "docs: fix contributor guidance",
      body: validBody().replace("Closes #6", `Small correction: ${reason}.`),
    });
    assert.equal(eligible.status, 0, `${reason}: ${eligible.stderr}`);
  }

  const substantive = runEvent({
    title: "feat: add authorization system",
    body: validBody().replace(
      "Closes #6",
      "Small correction: add a new authorization system.",
    ),
  });
  assert.equal(substantive.status, 1);
  assert.match(substantive.stderr, /Link a related GitHub issue/);
});

test("accepts every allowed lowercase Conventional Commit type", () => {
  for (const type of ["feat", "fix", "docs", "refactor", "perf", "test", "build", "ci", "style", "chore", "revert"]) {
    const result = runEvent({ title: `${type}(metadata): validate pull requests` });
    assert.equal(result.status, 0, `${type}: ${result.stderr}`);
  }
});

test("accepts a concise one-word title description", () => {
  const result = runEvent({ title: "style: reformat" });
  assert.equal(result.status, 0, result.stderr);
});

test("reports missing and placeholder PR sections together", () => {
  const body = `## Summary

TODO

## Validation

<!-- List checks here. -->

## Related issue

Later
`;
  const result = runEvent({ body });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Replace the Summary placeholder/);
  assert.match(result.stderr, /Replace the Validation placeholder/);
  assert.match(result.stderr, /Link a related GitHub issue/);
  assert.match(result.summary, /PR metadata validation failed/);
});

test("rejects empty sections and headings hidden in comments", () => {
  const body = `## Summary

<!--
## Validation
Hidden validation text passed.
## Related issue
Closes #6
-->
`;
  const result = runEvent({ body });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Replace the Summary placeholder/);
  assert.match(result.stderr, /Add a Validation section/);
  assert.match(result.stderr, /Add a Related issue section/);
});

test("rejects common placeholder variants and rendered-empty HTML", () => {
  for (const placeholder of ["Not applicable", "Not applicable.", "No tests", "Same as title", "<br><br>", "&nbsp;&nbsp;"]) {
    const result = runEvent({
      body: `## Summary

${placeholder}

## Validation

${placeholder}

## Related issue

Closes #6
`,
    });
    assert.equal(result.status, 1, placeholder);
    assert.match(result.stderr, /Replace the Summary placeholder/, placeholder);
    assert.match(result.stderr, /Replace the Validation placeholder/, placeholder);
  }
});

test("ignores headings inside fenced Markdown examples", () => {
  const onlyExample = runEvent({
    body: `\`\`\`markdown
## Summary
Example summary text.
## Validation
Example validation passed.
## Related issue
Closes #6
\`\`\`
`,
  });
  assert.equal(onlyExample.status, 1);
  assert.match(onlyExample.stderr, /Add a Summary section/);

  const realSectionsWithExample = runEvent({
    body: `${validBody()}

\`\`\`markdown
## Summary
Example summary text.
\`\`\`
`,
  });
  assert.equal(realSectionsWithExample.status, 0, realSectionsWithExample.stderr);
});

test("treats HTML comment syntax inside fenced code as inert", () => {
  const result = runEvent({
    body: `\`\`\`html
<!-- an intentionally unterminated example
\`\`\`

${validBody()}
`,
  });
  assert.equal(result.status, 0, result.stderr);
});

test("rejects code fences whose only content is an info string", () => {
  const result = runEvent({
    body: `## Summary

\`\`\`text
\`\`\`

## Validation

\`\`\`shell session
\`\`\`

## Related issue

Closes #6
`,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Replace the Summary placeholder/);
  assert.match(result.stderr, /Replace the Validation placeholder/);

  const codeEvidence = runEvent({
    body: validBody().replace(
      "`npm test` passed with all event fixtures.",
      "<pre>npm test\npassed all fixtures</pre>",
    ),
  });
  assert.equal(codeEvidence.status, 0, codeEvidence.stderr);
});

test("keeps nested subsections attached to required sections", () => {
  const result = runEvent({
    body: `## Summary

### Problem and change

Pull requests need consistent metadata, so this adds validation.

## Validation

### Automated checks

The complete Node test suite passed.

## Related issue

### Tracking issue

Closes #6
`,
  });
  assert.equal(result.status, 0, result.stderr);
});

test("does not accept issue references or exceptions inside code examples", () => {
  for (const relatedIssue of [
    "Use `#123` as the example format.",
    "Use `Small correction: explain the typo here` as the exception format.",
    "<code>#123</code>",
    "<pre>#123</pre>",
    "<code>Small correction: explain the typo here</code>",
  ]) {
    const result = runEvent({
      body: `## Summary

Validate pull request metadata before merge.

## Validation

The complete Node test suite passed.

## Related issue

${relatedIssue}
`,
    });
    assert.equal(result.status, 1, relatedIssue);
    assert.match(result.stderr, /Link a related GitHub issue/, relatedIssue);
  }
});

test("uses rendered issue text and actual link destinations", () => {
  const inertAttribute = runEvent({
    body: `## Summary

Validate pull request metadata before merge.

## Validation

The complete Node test suite passed.

## Related issue

<span data-example="#123"></span>
`,
  });
  assert.equal(inertAttribute.status, 1);
  assert.match(inertAttribute.stderr, /Link a related GitHub issue/);

  for (const reference of [
    "[Tracking issue](https://github.com/lutzseverino/repo-canon/issues/6)",
    '<a href="https://github.com/lutzseverino/repo-canon/issues/6">Tracking issue</a>',
  ]) {
    const linked = runEvent({
      body: `## Summary

Validate pull request metadata before merge.

## Validation

The complete Node test suite passed.

## Related issue

${reference}
`,
    });
    assert.equal(linked.status, 0, `${reference}: ${linked.stderr}`);
  }
});

test("requires each PR section exactly once without requiring Limits", () => {
  const result = runEvent({
    body: `${validBody()}\n## Summary\n\nA duplicate summary is ambiguous.\n`,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /exactly one Summary section/);
  assert.doesNotMatch(result.stderr, /Limits/);
});

test("rejects invalid Conventional Commit title structure", () => {
  const cases = [
    ["Feature(metadata): validate pull requests", /allowed lowercase type/],
    ["feature(metadata): validate pull requests", /allowed lowercase type/],
    ["feat(metadata) validate pull requests", /form type\(scope\): description/],
    ["feat(): validate pull requests", /form type\(scope\): description/],
    ["feat: ---", /letter or number/],
    ["feat(metadata): validate pull requests.", /trailing period/],
  ];

  for (const [title, expected] of cases) {
    const result = runEvent({ title });
    assert.equal(result.status, 1, title);
    assert.match(result.stderr, expected, title);
  }
});

test("requires impact and migration explanations for marked breaking changes", () => {
  const missing = runEvent({ title: "feat(api)!: remove legacy response" });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /under an Impact/);
  assert.match(missing.stderr, /under a Migration/);

  const body = `${validBody()}
## Impact

Clients using the legacy response will stop receiving that field.

Migration: read the replacement response field before upgrading.
`;
  const valid = runEvent({ title: "feat(api)!: remove legacy response", body });
  assert.equal(valid.status, 0, valid.stderr);

  const hidden = runEvent({
    title: "feat(api)!: remove legacy response",
    body: `${validBody()}
<!--
Impact: old clients stop working after this change.
Migration: clients must use the replacement response field.
-->
`,
  });
  assert.equal(hidden.status, 1);
  assert.match(hidden.stderr, /under an Impact/);
  assert.match(hidden.stderr, /under a Migration/);

  const fenced = runEvent({
    title: "feat(api)!: remove legacy response",
    body: `${validBody()}
\`\`\`text
Impact: old clients stop working after this change.
Migration: clients must use the replacement response field.
\`\`\`
`,
  });
  assert.equal(fenced.status, 1);
  assert.match(fenced.stderr, /under an Impact/);
  assert.match(fenced.stderr, /under a Migration/);

  const htmlCode = runEvent({
    title: "feat(api)!: remove legacy response",
    body: `${validBody()}
<pre>Impact: old clients stop working after this change.
Migration: clients must use the replacement response field.</pre>
`,
  });
  assert.equal(htmlCode.status, 1);
  assert.match(htmlCode.stderr, /under an Impact/);
  assert.match(htmlCode.stderr, /under a Migration/);
});

test("requires the title marker for an explicit breaking-change footer", () => {
  const result = runEvent({
    title: "feat(api): remove legacy response",
    body: `${validBody()}
BREAKING CHANGE: legacy clients must migrate to the replacement field.
`,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Add ! before the title colon/);

  const fenced = runEvent({
    title: "feat(api): document a migration example",
    body: `${validBody()}
\`\`\`text
BREAKING CHANGE: example footer text stays inert.
\`\`\`
`,
  });
  assert.equal(fenced.status, 0, fenced.stderr);

  const htmlCode = runEvent({
    title: "feat(api): document a migration example",
    body: `${validBody()}
<code>BREAKING CHANGE: example footer text stays inert.</code>
`,
  });
  assert.equal(htmlCode.status, 0, htmlCode.stderr);
});

test("treats hostile fork metadata as inert workflow input", () => {
  const directory = mkdtempSync(join(tmpdir(), "repo-canon-hostile-"));
  const sentinel = join(directory, "executed");
  const fixture = readFileSync(
    join(repositoryRoot, "test/fixtures/hostile-pull-request.json"),
    "utf8",
  ).replaceAll("__SENTINEL__", sentinel);
  const event = JSON.parse(fixture);
  const result = runEvent({
    action: event.action,
    title: event.pull_request.title,
    body: event.pull_request.body,
    pullRequest: {
      head: event.pull_request.head,
      base: event.pull_request.base,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(sentinel), false, "hostile metadata executed unexpectedly");
  rmSync(directory, { recursive: true, force: true });
});

test("trusted workflow checks out the base revision and never names the head revision", () => {
  const workflow = readFileSync(
    join(repositoryRoot, ".github/workflows/pr-metadata.yml"),
    "utf8",
  );
  assert.match(workflow, /pull_request_target:/);
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
  assert.match(workflow, /persist-credentials: false/);
  assert.doesNotMatch(workflow, /pull_request\.head\.(?:sha|ref)/);
  assert.doesNotMatch(workflow, /(?:issues|pull-requests):\s*write/);
});
