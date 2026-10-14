import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(
  new URL("../.agents/skills/babysit/merge.mjs", import.meta.url),
);
const fakeGh = fileURLToPath(
  new URL("./fixtures/fake-gh-babysit-wait.mjs", import.meta.url),
);
const head = "a".repeat(40);

function run(t, state, args = ["12", head]) {
  const directory = mkdtempSync(join(tmpdir(), "babysit-merge-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const statePath = join(directory, "state.json");
  writeFileSync(statePath, JSON.stringify({ head, ...state }));
  writeFileSync(
    join(directory, "gh"),
    `#!/bin/sh\nexec node '${fakeGh}' "$@"\n`,
    { mode: 0o755 },
  );
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: directory,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH}`,
      FAKE_GH_STATE: statePath,
    },
  });
  return { ...result, state: JSON.parse(readFileSync(statePath, "utf8")) };
}

test("squash-merges with the current title and verbatim body through stdin", (t) => {
  const body =
    "## Summary\r\n\r\nQuotes: \"double\", 'single', `backticks`, $HOME, $(touch unwanted).\r\n\r\n## Evidence\n\nMultiple paragraphs.\n\n";
  const result = run(t, {
    title: "fix: preserve $variables and `quotes`",
    body,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.state.merge.args, [
    "pr",
    "merge",
    "12",
    "--squash",
    "--match-head-commit",
    head,
    "--subject",
    "fix: preserve $variables and `quotes` (#12)",
    "--body-file",
    "-",
  ]);
  assert.equal(result.state.merge.body, body);
});

test("returns a distinct retry result if the head changes during merge", (t) => {
  const result = run(t, {
    title: "fix: current title",
    body: "Current body",
    mergeHead: "b".repeat(40),
  });
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /head changed.*wait again/i);
});

test("returns retry without merging if the head changed after the wait", (t) => {
  const result = run(t, {
    head: "b".repeat(40),
    title: "fix: updated title",
    body: "Updated body",
  });
  assert.equal(result.status, 2, result.stderr);
  assert.equal(result.state.merge, undefined);
});

test("refuses a merge queue without attempting a merge", (t) => {
  const result = run(t, {
    title: "fix: current title",
    body: "Current body",
    isMergeQueueEnabled: true,
  });
  assert.equal(result.status, 3, result.stderr);
  assert.match(result.stderr, /merge queue.*explicit squash message/i);
  assert.equal(result.state.merge, undefined);
});

test("needs the owner when a successful merge call leaves the PR open", (t) => {
  const result = run(t, {
    title: "fix: current title",
    body: "Current body",
    mergeState: "OPEN",
  });
  assert.equal(result.status, 3, result.stderr);
  assert.match(result.stderr, /pull request did not merge.*owner/i);
  assert.ok(result.state.merge);
});

test("reports access and merge failures without requesting a retry", (t) => {
  for (const state of [
    { fail: true },
    { title: "fix: current title", body: "Current body", mergeFail: true },
  ]) {
    const result = run(t, state);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /gh:/);
  }
});

test("preserves an empty body and rejects invalid invocations", (t) => {
  const empty = run(t, { title: "docs: current title", body: null });
  assert.equal(empty.status, 0, empty.stderr);
  assert.equal(empty.state.merge.body, "");
  for (const args of [
    [],
    ["12"],
    ["--help", head],
    ["12", "abc"],
    ["12", head, "extra"],
  ]) {
    const invalid = run(t, {}, args);
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /Usage:/);
    assert.equal(invalid.state.merge, undefined);
  }
});
