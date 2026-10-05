import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repositoryRoot = new URL("..", import.meta.url).pathname;

function sharedWorkflows() {
  const profile = readFileSync(join(repositoryRoot, "standards.yaml"), "utf8");
  return [
    ...profile.matchAll(/^\s+exact: (\.github\/workflows\/\S+\.ya?ml)$/gm),
  ].map(([, path]) => path);
}

function workflow(path) {
  return readFileSync(join(repositoryRoot, path), "utf8");
}

function actionPins(workflow, action) {
  return [...workflow.matchAll(new RegExp(`uses: ${action}@(\\S+)`, "g"))].map(
    ([, pin]) => pin,
  );
}

test("every shared workflow pins the same checkout and setup-node versions", () => {
  const paths = sharedWorkflows();
  for (const expected of [
    ".github/workflows/issue-contracts.yml",
    ".github/workflows/pr-metadata.yml",
  ]) {
    assert.ok(paths.includes(expected), `standards.yaml declares ${expected}`);
  }

  for (const action of ["actions/checkout", "actions/setup-node"]) {
    const pins = new Set();
    for (const path of paths) {
      const workflowPins = actionPins(workflow(path), action);
      assert.ok(workflowPins.length > 0, `${path} uses ${action}`);
      for (const pin of workflowPins) {
        assert.match(
          pin,
          /^[0-9a-f]{40}$/,
          `${path} pins ${action} to a full commit`,
        );
        pins.add(pin);
      }
    }
    assert.equal(
      pins.size,
      1,
      `${action} pins differ: ${[...pins].join(", ")}`,
    );
  }
});

test("every shared workflow disables package-manager caching", () => {
  for (const path of sharedWorkflows()) {
    const text = workflow(path);
    assert.match(text, /package-manager-cache: false/, path);
    assert.doesNotMatch(text, /npm (?:ci|install)/, path);
  }
});

test("the pull request metadata workflow runs on every configured pull request update from the trusted base revision", () => {
  const text = workflow(".github/workflows/pr-metadata.yml");
  assert.deepEqual(
    text
      .match(/types:\s*\[([^\]]+)]/)?.[1]
      .split(",")
      .map((type) => type.trim()),
    ["opened", "edited", "synchronize", "reopened", "ready_for_review"],
  );
  assert.match(text, /pull_request_target:/);
  assert.match(text, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
  assert.match(text, /persist-credentials: false/);
  assert.doesNotMatch(text, /pull_request\.head\.(?:sha|ref)/);
  assert.doesNotMatch(text, /(?:issues|pull-requests):\s*write/);
});

// The expressions a workflow interpolates anywhere, with index syntax such as
// `github['event']` rewritten to property syntax. Reading the whole file, not
// only `run:` values, also covers anchors, aliases, and multi-line scalars.
function expressions(text) {
  return [...text.matchAll(/\$\{\{([\s\S]*?)\}\}/g)].map(([, expression]) =>
    expression.replace(/\s*\[\s*(['"])([^'"]*)\1\s*\]/g, ".$2"),
  );
}

test("no shared workflow interpolates a pull request title or body, so neither reaches a run step", () => {
  const untrustedText =
    /github\.event(?:\.pull_request)?(?:\.(?:title|body)\b|\s*(?:[),]|$))/;
  for (const path of sharedWorkflows())
    for (const expression of expressions(workflow(path)))
      assert.doesNotMatch(expression, untrustedText, `${path}: ${expression}`);
});

test("the issue contract workflow covers issue and comment changes using default-branch code", () => {
  const text = workflow(".github/workflows/issue-contracts.yml");
  for (const activity of [
    "opened",
    "edited",
    "reopened",
    "labeled",
    "unlabeled",
    "created",
    "deleted",
  ]) {
    assert.match(text, new RegExp(`\\b${activity}\\b`));
  }
  assert.match(
    text,
    /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/,
  );
  assert.match(text, /issues: write/);
  assert.match(
    text,
    /group: issue-contract-\$\{\{ github\.event\.issue\.number \}\}/,
  );
  assert.match(text, /cancel-in-progress: false/);
  assert.doesNotMatch(text, /github\.event\.issue\.body/);
});
