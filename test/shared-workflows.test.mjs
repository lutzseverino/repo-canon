import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repositoryRoot = new URL("..", import.meta.url).pathname;

function sharedWorkflows() {
  const profile = readFileSync(join(repositoryRoot, "standards.yaml"), "utf8");
  return [...profile.matchAll(/^\s+exact: (\.github\/workflows\/\S+\.ya?ml)$/gm)].map(
    ([, path]) => path,
  );
}

function actionPins(workflow, action) {
  return [...workflow.matchAll(new RegExp(`uses: ${action}@(\\S+)`, "g"))].map(
    ([, pin]) => pin,
  );
}

test("every shared workflow pins the same checkout and setup-node versions", () => {
  const paths = sharedWorkflows();
  for (const expected of [".github/workflows/issue-contracts.yml", ".github/workflows/pr-metadata.yml"]) {
    assert.ok(paths.includes(expected), `standards.yaml declares ${expected}`);
  }

  for (const action of ["actions/checkout", "actions/setup-node"]) {
    const pins = new Set();
    for (const path of paths) {
      const workflowPins = actionPins(readFileSync(join(repositoryRoot, path), "utf8"), action);
      assert.ok(workflowPins.length > 0, `${path} uses ${action}`);
      for (const pin of workflowPins) {
        assert.match(pin, /^[0-9a-f]{40}$/, `${path} pins ${action} to a full commit`);
        pins.add(pin);
      }
    }
    assert.equal(pins.size, 1, `${action} pins differ: ${[...pins].join(", ")}`);
  }
});

test("every shared workflow disables package-manager caching", () => {
  for (const path of sharedWorkflows()) {
    const workflow = readFileSync(join(repositoryRoot, path), "utf8");
    assert.match(workflow, /package-manager-cache: false/, path);
    assert.doesNotMatch(workflow, /npm (?:ci|install)/, path);
  }
});
