import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { installedValidator } from "./helpers/installed-validator.mjs";
import { renderedAdoptionRecord } from "./fixtures/adoption-record.mjs";

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

test("preserves adoption record bytes and the trailing closing reference in the squash message", (t) => {
  for (const newline of ["\n", "\r\n"]) {
    const record = renderedAdoptionRecord.replace(/\n/g, newline);
    for (const breaking of [false, true]) {
      const additions = breaking
        ? "\n## Impact\n\nClaim labels change.\n\n## Migration\n\nRelabel open claims.\n"
        : "";
      const body =
        record +
        `${additions}\n## Related issue\n\nCloses #123\n`.replace(
          /\n/g,
          newline,
        );
      const title = `chore${breaking ? "!" : ""}: adopt repo-canon v0.16.0 with CLI 8.0.0`;
      const result = run(t, { title, body });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.state.merge.title, `${title} (#12)`);
      assert.equal(result.state.merge.body, body);
      assert.equal(result.state.merge.body.slice(0, record.length), record);
      assert.match(result.state.merge.body, /Closes #123\r?\n$/);
    }
  }
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
