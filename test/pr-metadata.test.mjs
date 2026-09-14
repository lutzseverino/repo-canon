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
  for (const action of ["opened", "edited", "synchronize", "reopened", "ready_for_review"]) {
    const result = runEvent({ action });
    assert.equal(result.status, 0, `${action}: ${result.stderr}`);
    assert.match(result.stdout, /validation passed/);
    assert.match(result.summary, /validation passed/);
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

test("accepts every allowed lowercase Conventional Commit type", () => {
  for (const type of ["feat", "fix", "docs", "refactor", "perf", "test", "build", "ci", "style", "chore", "revert"]) {
    const result = runEvent({ title: `${type}(metadata): validate pull requests` });
    assert.equal(result.status, 0, `${type}: ${result.stderr}`);
  }
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
});
