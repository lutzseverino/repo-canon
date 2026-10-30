import assert from "node:assert/strict";
import test from "node:test";
import { main } from "../scripts/sweep-closed-issue-labels.mjs";
import { PlatformError } from "../vendor/postern/postern.mjs";

function fixture() {
  const output = [];
  const writes = [];
  const issues = new Map([
    [
      1,
      {
        number: 1,
        state: "closed",
        labels: ["ready-for-agent", "factory:failed", "model:x", "enhancement"],
      },
    ],
    [
      2,
      {
        number: 2,
        state: "closed",
        labels: ["wontfix", "model:x", "bug", "unrelated"],
      },
    ],
    [
      3,
      { number: 3, state: "open", labels: ["needs-info", "factory:running"] },
    ],
  ]);
  const connection = {
    issueTracker: {
      async issues(filter) {
        assert.deepEqual(filter, { state: "closed" });
        // Issue 3 reopened after listing; it must be fetched before mutation.
        return [...issues.values()].map((issue) => ({
          ...issue,
          state: "closed",
        }));
      },
      async issue(number) {
        return issues.get(number);
      },
      async removeLabel(number, label) {
        writes.push([number, label]);
        const issue = issues.get(number);
        issue.labels = issue.labels.filter((name) => name !== label);
      },
    },
  };
  return { output, writes, issues, connection };
}

async function run(state, args) {
  const code = await main(
    args,
    () => state.connection,
    (line) => state.output.push(line),
  );
  return code;
}

test("dry run reports exact per-repository removals without writes", async () => {
  const state = fixture();
  assert.equal(
    await run(state, [
      "--repo",
      "owner/one",
      "--repo",
      "owner/two",
      "--dry-run",
    ]),
    0,
  );
  assert.deepEqual(state.writes, []);
  assert.deepEqual(state.output, [
    'owner/one#1: would remove ["ready-for-agent","factory:failed"]',
    "owner/one: dry run; 3 scanned, 1 needing cleanup, 0 labels removed, 0 failures",
    'owner/two#1: would remove ["ready-for-agent","factory:failed"]',
    "owner/two: dry run; 3 scanned, 1 needing cleanup, 0 labels removed, 0 failures",
  ]);
});

test("execution clears only closed issues and a second sweep writes nothing", async () => {
  const state = fixture();
  assert.equal(await run(state, ["--repo", "owner/one", "--apply"]), 0);
  assert.deepEqual(state.writes, [
    [1, "ready-for-agent"],
    [1, "factory:failed"],
  ]);
  assert.deepEqual(
    [...state.issues.values()].map(({ labels }) => labels),
    [
      ["model:x", "enhancement"],
      ["wontfix", "model:x", "bug", "unrelated"],
      ["needs-info", "factory:running"],
    ],
  );
  assert.equal(
    state.output.at(-1),
    "owner/one: applied; 3 scanned, 1 needing cleanup, 2 labels removed, 0 failures",
  );
  state.writes.length = 0;
  assert.equal(await run(state, ["--repo", "owner/one", "--apply"]), 0);
  assert.deepEqual(state.writes, []);
});

test("failures are reported per repository with partial removals and a failing result", async () => {
  const state = fixture();
  const remove = state.connection.issueTracker.removeLabel;
  state.connection.issueTracker.removeLabel = async (number, label) => {
    if (label === "factory:failed")
      throw new PlatformError("unavailable", "GitHub unavailable");
    await remove(number, label);
  };
  const code = await main(
    ["--repo", "owner/one", "--repo", "owner/two", "--apply"],
    (repository) => {
      if (repository === "owner/two")
        throw new PlatformError("unavailable", "Could not list issues");
      return state.connection;
    },
    (line) => state.output.push(line),
  );
  assert.equal(code, 1);
  assert.deepEqual(state.writes, [[1, "ready-for-agent"]]);
  assert.ok(state.output.includes("owner/one#1: FAILED: GitHub unavailable"));
  assert.ok(
    state.output.includes(
      "owner/one: applied; 3 scanned, 1 needing cleanup, 1 labels removed, 1 failures",
    ),
  );
  assert.deepEqual(state.output.slice(-2), [
    "owner/two: FAILED: Could not list issues",
    "owner/two: applied; 0 scanned, 0 needing cleanup, 0 labels removed, 1 failures",
  ]);
});

test("a permission refusal stops all targets without a second mutation or identity", async () => {
  for (const reason of ["forbidden", "unauthenticated"]) {
    const state = fixture();
    const targets = [];
    state.connection.issueTracker.removeLabel = async (number, label) => {
      state.writes.push([number, label]);
      throw new PlatformError(reason, "Permission refused");
    };
    const code = await main(
      ["--repo", "owner/one", "--repo", "owner/two", "--apply"],
      (repository) => {
        targets.push(repository);
        return state.connection;
      },
      (line) => state.output.push(line),
    );
    assert.equal(code, 1);
    assert.deepEqual(targets, ["owner/one"]);
    assert.deepEqual(state.writes, [[1, "ready-for-agent"]]);
    assert.equal(
      state.output.at(-1),
      "owner/one: applied; 1 scanned, 1 needing cleanup, 0 labels removed, 1 failures",
    );
  }
});

test("explicit repositories and an unambiguous mode are required before connecting", async () => {
  for (const args of [
    [],
    ["--apply"],
    ["--repo", "owner/one"],
    ["--repo"],
    ["--repo", "https://github.com/owner/one", "--dry-run"],
    ["--repo", "owner/one", "--dry-run", "--apply"],
    ["--repo", "owner/one", "--unknown"],
  ]) {
    await assert.rejects(
      main(args, () => {
        assert.fail("No connection for invalid arguments");
      }),
    );
  }
});
