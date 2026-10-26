import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { readReviewPolicy } from "../.agents/skills/babysit/review-policy.mjs";
import {
  fixture,
  invokeCheck,
  retainedCheck,
  snapshot,
} from "./helpers/operation.mjs";

const script = new URL(
  "../operations/check-factory-review-policy.mjs",
  import.meta.url,
).pathname;
const target = ".github/factory-review-policy.json";
const request = {
  operation: {
    declaration: "github-repository-configuration",
    phase: "checks",
    id: "factory-review-policy",
  },
  allowedTargets: { paths: [], directories: [] },
};

const check = (t, files, executable = script, profile = "standard") => {
  const project = fixture(files);
  t.after(project.close);
  const before = snapshot(project.root);
  const outcome = invokeCheck(executable, project.root, {
    ...request,
    profile,
  });
  assert.deepEqual(snapshot(project.root), before);
  assert.equal(outcome.status, 0, outcome.stderr);
  return outcome.result;
};

test("adoption rejects a human-login policy with an actionable correction", (t) => {
  const outcome = check(t, {
    [target]: JSON.stringify({ version: 1, author: "human" }),
  });
  assert.equal(outcome.status, "failed");
  assert.ok(outcome.message.includes(target), outcome.message);
  assert.match(outcome.message, /github-repository-configuration rules/);
  assert.match(outcome.message, /author must be an app identity/);
});

for (const profile of ["standard", "factory"]) {
  test(`${profile} validates optional policies using only retained resources`, (t) => {
    const retained = retainedCheck(
      t,
      "operations/check-factory-review-policy.mjs",
    );
    assert.equal(check(t, {}, retained, profile).status, "passed");
    for (const author of ["factory[bot]", "app/factory", "APP/Factory"]) {
      const outcome = check(
        t,
        { [target]: JSON.stringify({ version: 1, author }, null, 2) + "\n" },
        retained,
        profile,
      );
      assert.equal(outcome.status, "passed", outcome.message);
      assert.ok(outcome.message.includes(target), outcome.message);
    }
    const outcome = check(t, { [target]: "{" }, retained, profile);
    assert.equal(outcome.status, "failed");
    assert.ok(outcome.message.includes(target), outcome.message);
  });
}

test("adoption and runtime reject the same invalid declarations regardless of reviewer presence", (t) => {
  const reviewer = readFileSync(
    new URL("./fixtures/reviewers/github-review.json", import.meta.url),
    "utf8",
  );
  /** @type {[string, unknown][]} */
  const invalid = [
    ["malformed JSON", "{"],
    ["null", "null"],
    ["array", "[]"],
    ["string", '"factory[bot]"'],
    ["boolean", "true"],
    ["number", "1"],
    ["missing version", { author: "factory[bot]" }],
    ["unsupported version", { version: 2, author: "factory[bot]" }],
    ["string version", { version: "1", author: "factory[bot]" }],
    ["unknown field", { version: 1, author: "factory[bot]", enabled: true }],
    ["missing author", { version: 1 }],
    ["non-string author", { version: 1, author: 123 }],
    ["null author", { version: 1, author: null }],
    ["empty author", { version: 1, author: "" }],
    ["whitespace author", { version: 1, author: " " }],
    ["untrimmed author", { version: 1, author: " factory[bot] " }],
    ["human login", { version: 1, author: "factory" }],
    ["empty CLI slug", { version: 1, author: "app/" }],
    ["empty REST slug", { version: 1, author: "[bot]" }],
  ];
  for (const [name, value] of invalid) {
    const content = typeof value === "string" ? value : JSON.stringify(value);
    for (const configured of [false, true]) {
      const files = { [target]: content };
      if (configured) files[".github/pull-request-reviewer.json"] = reviewer;
      const project = fixture(files);
      t.after(project.close);
      let runtimeError;
      assert.throws(
        () => readReviewPolicy(project.root),
        (error) => {
          assert.ok(error instanceof Error);
          runtimeError = error.message;
          return true;
        },
      );
      const outcome = check(t, files);
      assert.equal(outcome.status, "failed", name);
      assert.equal(
        outcome.message,
        `Correct ${target} to match the github-repository-configuration rules: ${runtimeError}`,
        name,
      );
    }
  }
});

test("policy file-read failures are explicit failed checks", (t) => {
  const project = fixture({});
  t.after(project.close);
  mkdirSync(join(project.root, target), { recursive: true });
  const before = snapshot(project.root);
  const outcome = invokeCheck(script, project.root, request);
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "failed");
  assert.ok(outcome.result.message.includes(target), outcome.result.message);
  assert.match(outcome.result.message, /EISDIR/);
  assert.deepEqual(snapshot(project.root), before);
});
