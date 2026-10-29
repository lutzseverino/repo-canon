import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { installedValidator } from "./helpers/installed-validator.mjs";

const head = "a".repeat(40);

/** @param {string | URL} [target] */
function run(
  t,
  state,
  args = ["12", head],
  target = new URL("../.agents/skills/babysit/merge.mjs", import.meta.url),
) {
  const targetURL = typeof target === "string" ? pathToFileURL(target) : target;
  const bundleURL = new URL("../../../vendor/postern/postern.mjs", targetURL);
  const directory = mkdtempSync(join(tmpdir(), "babysit-merge-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const statePath = join(directory, "state.json");
  writeFileSync(statePath, JSON.stringify({ head, ...state }));
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { main } from ${JSON.stringify(targetURL.href)}; import { connect } from ${JSON.stringify(bundleURL.href)}; import { fixtureConnection } from ${JSON.stringify(new URL("./fixtures/postern-babysit.mjs", import.meta.url).href)}; try { await main(process.argv.slice(1), fixtureConnection(connect)); } catch (error) { console.error(error.message); process.exitCode = 1; }`,
      "--",
      ...args,
    ],
    {
      cwd: directory,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        FAKE_GH_STATE: statePath,
      },
    },
  );
  return { ...result, state: JSON.parse(readFileSync(statePath, "utf8")) };
}

test("squash-merges with the current title and verbatim body through the port", (t) => {
  const body =
    "## Summary\r\n\r\nQuotes: \"double\", 'single', `backticks`, $HOME, $(touch unwanted).\r\n\r\n## Evidence\n\nMultiple paragraphs.\n\n";
  const result = run(t, {
    title: "fix: preserve $variables and `quotes`",
    body,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `${"c".repeat(40)}\n`);
  assert.equal(result.stderr, "");
  assert.equal(
    result.state.merge.title,
    "fix: preserve $variables and `quotes` (#12)",
  );
  assert.equal(result.state.merge.expectedHead, head);
  assert.equal(result.state.merge.method, "squash");
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
  assert.equal(result.stdout, "");
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
  assert.equal(result.stdout, "");
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
    assert.match(result.stderr, /GitHub/);
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

test("installed babysit resolves declared bundle, license and provenance and merges without npm", (t) => {
  const target = installedValidator(t, ".agents/skills/babysit/merge.mjs");
  const root = join(dirname(target), "../../..");
  for (const name of ["postern.mjs", "LICENSE", "README.md"])
    assert.deepEqual(
      readFileSync(join(root, "vendor/postern", name)),
      readFileSync(new URL(`../vendor/postern/${name}`, import.meta.url)),
    );
  const result = run(
    t,
    { title: "fix: installed consumer", body: "Verbatim installed body" },
    undefined,
    target,
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `${"c".repeat(40)}\n`);
  assert.equal(result.stderr, "");
  assert.equal(result.state.merge.body, "Verbatim installed body");
});

test("returns stale-base recovery rather than merging old validation", (t) => {
  const result = run(t, { stale: true });
  assert.equal(result.status, 4, result.stderr);
  assert.match(result.stderr, /base.*advanced.*update.*validat.*wait/i);
  assert.equal(result.state.merge, undefined);
});

test("stops unattended merging when strict freshness is unconfirmed", (t) => {
  for (const state of [
    { strict: false },
    { rules: [] },
    { failFreshness: 502 },
  ]) {
    const result = run(t, state);
    assert.notEqual(result.status, 0);
    assert.equal(result.state.merge, undefined);
    assert.match(result.stderr, /freshness|GitHub/);
  }
});

test("two green PRs on one base require new validation after the first merges", (t) => {
  const first = run(t, { mergeChecks: "success" });
  assert.equal(first.status, 0, first.stderr);
  const state = { ...first.state };
  delete state.merge;
  const secondHead = "d".repeat(40);
  const second = { ...state, pullRequestState: "OPEN", head: secondHead };
  const stale = run(t, second, ["13", secondHead]);
  assert.equal(stale.status, 4, stale.stderr);
  assert.equal(stale.state.merge, undefined);
  // A branch update preserves the PR work, but the replacement head must
  // earn its own green checks before the platform will merge it.
  const updatedHead = "e".repeat(40);
  const updated = {
    ...second,
    head: updatedHead,
    testedBase: first.state.defaultRevision,
  };
  for (const mergeChecks of ["pending", "failure"]) {
    const waiting = run(t, { ...updated, mergeChecks }, ["13", updatedHead]);
    assert.equal(waiting.status, 1, waiting.stderr);
    assert.equal(waiting.state.pullRequestState, "OPEN");
  }
  const validated = run(t, { ...updated, mergeChecks: "success" }, [
    "13",
    updatedHead,
  ]);
  assert.equal(validated.status, 0, validated.stderr);
});

test("GitHub refuses a base advance between freshness inspection and merge", (t) => {
  const result = run(t, { advanceBaseOnMerge: "d".repeat(40) });
  assert.equal(result.status, 4, result.stderr);
  assert.equal(result.state.pullRequestState, undefined);
  assert.ok(
    result.state.merge,
    "the platform, rather than preflight alone, refused the stale merge",
  );
  assert.equal(result.stdout, "");
});

test("supports enforced classic freshness and refuses bypassable enforcement", (t) => {
  const protection = {
    required_status_checks: { strict: true, contexts: ["CI"] },
    enforce_admins: { enabled: true },
  };
  const classic = run(t, { rules: [], protection });
  assert.equal(classic.status, 0, classic.stderr);
  for (const state of [
    {
      rules: [],
      protection: { ...protection, enforce_admins: { enabled: false } },
    },
    {
      rules: [],
      protection: {
        ...protection,
        required_status_checks: { strict: true, contexts: [] },
      },
    },
    {
      bypassActors: [
        { actor_type: "Integration", actor_id: 1, bypass_mode: "always" },
      ],
    },
    { baseBranch: "release" },
    {
      rules: [
        {
          type: "required_status_checks",
          parameters: {
            strict_required_status_checks_policy: true,
            required_status_checks: [],
          },
        },
      ],
    },
  ]) {
    const stopped = run(t, state);
    assert.equal(stopped.status, 3, stopped.stderr);
    assert.equal(stopped.state.merge, undefined);
  }
});

test("permission refusal ends merge handling without a retry or further read", (t) => {
  const result = run(t, { mergeStatus: 403, traceRequests: true });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /403/);
  assert.match(result.state.requests.at(-1), /PUT .*\/merge$/);
});
