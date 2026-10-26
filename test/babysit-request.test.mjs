import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { installedValidator } from "./helpers/installed-validator.mjs";

const script = new URL(
  "../.agents/skills/babysit/request.mjs",
  import.meta.url,
);
const fixture = new URL("./fixtures/postern-babysit.mjs", import.meta.url);
const reviewer = JSON.parse(
  readFileSync(
    new URL("./fixtures/reviewers/codex.json", import.meta.url),
    "utf8",
  ),
);
const policy = { version: 1, author: "Factory-App[bot]" };
const head = "a".repeat(40);
const openedAt = "2026-10-11T05:00:00Z";
const pushedAt = "2026-10-11T05:10:00Z";

// Exercise the command with the published adapter and a local GitHub transport.
/** @param {import("node:test").TestContext} t
 * @param {Record<string, any>} [options] */
const run = (
  t,
  {
    author = "owner",
    declaration = policy,
    config = reviewer,
    comments = [],
    args = [],
    target = script,
    push = openedAt,
  } = {},
) => {
  const directory = mkdtempSync(join(tmpdir(), "babysit-request-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, ".github"));
  if (declaration !== null)
    writeFileSync(
      join(directory, ".github/factory-review-policy.json"),
      typeof declaration === "string"
        ? declaration
        : JSON.stringify(declaration),
    );
  if (config !== null)
    writeFileSync(
      join(directory, ".github/pull-request-reviewer.json"),
      JSON.stringify(config),
    );
  const state = join(directory, "state.json");
  writeFileSync(
    state,
    JSON.stringify({
      author,
      head,
      createdAt: openedAt,
      pushedAt: push,
      comments,
    }),
  );
  const bundle = new URL("../../../vendor/postern/postern.mjs", target);
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { main } from ${JSON.stringify(target.href)}; import { connect } from ${JSON.stringify(bundle.href)}; import { fixtureConnection } from ${JSON.stringify(fixture.href)}; process.exitCode = await main(process.argv.slice(1), fixtureConnection(connect));`,
      "--",
      "12",
      ...args,
    ],
    {
      cwd: directory,
      env: { ...process.env, FAKE_GH_STATE: state },
      encoding: "utf8",
      timeout: 15000,
    },
  );
  assert.ifError(child.error);
  return {
    code: child.status,
    stdout: child.stdout,
    stderr: child.stderr,
    emitted: JSON.parse(readFileSync(state, "utf8")).emitted ?? [],
  };
};

test("a declared app emits no request initially or after fixes and resumed runs", (t) => {
  for (const author of ["factory-app[bot]", "app/FACTORY-APP"]) {
    for (const onOpen of [true, false]) {
      for (const args of [[], ["--fixes-review"]]) {
        const result = run(t, {
          author,
          config: { ...reviewer, request: { ...reviewer.request, onOpen } },
          args,
          push: pushedAt,
        });
        assert.equal(result.code, 0, result.stderr);
        assert.deepEqual(result.emitted, []);
        assert.match(
          result.stdout,
          /external review skipped by app-author policy/,
        );
      }
    }
  }
});

test("nonmatching, missing and absent-policy authors retain the initial request rule", (t) => {
  for (const context of [
    { author: "owner" },
    { author: null },
    { author: "factory-app[bot]", declaration: null },
  ]) {
    for (const onOpen of [true, false]) {
      const result = run(t, {
        ...context,
        config: { ...reviewer, request: { ...reviewer.request, onOpen } },
      });
      assert.equal(result.code, 0, result.stderr);
      assert.deepEqual(
        result.emitted,
        onOpen ? [] : [reviewer.request.comment],
      );
    }
  }
});

test("only required review fixes request again, with count bounds and resumed-head deduplication", (t) => {
  const request = {
    login: "anyone",
    createdAt: pushedAt,
    body: reviewer.request.comment,
  };
  for (const onOpen of [true, false]) {
    const config = {
      ...reviewer,
      request: { ...reviewer.request, onOpen },
      bounds: { ...reviewer.bounds, reviewRequests: 2 },
    };
    for (const [comments, args, expected] of [
      [[], [], onOpen ? 0 : 1],
      [[], ["--fixes-review"], 1],
      [[request], ["--fixes-review"], 0],
      [[request, request], ["--fixes-review"], 0],
    ]) {
      const result = run(t, { config, comments, args, push: pushedAt });
      assert.equal(result.code, 0, result.stderr);
      assert.equal(result.emitted.length, expected);
    }
    const earlierRequest = { ...request, createdAt: openedAt };
    assert.equal(
      run(t, {
        config,
        comments: [earlierRequest],
        args: ["--fixes-review"],
        push: pushedAt,
      }).emitted.length,
      onOpen ? 0 : 1,
    );
    assert.equal(
      run(t, {
        config: {
          ...config,
          bounds: { responseMinutes: 5, reviewMinutes: 30 },
        },
        comments: [earlierRequest, earlierRequest],
        args: ["--fixes-review"],
        push: pushedAt,
      }).emitted.length,
      1,
    );
  }
});

test("no configured reviewer remains checks-only", (t) => {
  const result = run(t, { config: null });
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(result.emitted, []);
  assert.match(result.stdout, /no reviewer configured/);
});

test("invalid declarations fail explicitly before any request", (t) => {
  for (const declaration of [
    "{",
    "null",
    "[]",
    {},
    { ...policy, version: 2 },
    { ...policy, extra: true },
    { ...policy, author: "" },
    { ...policy, author: " factory-app[bot]" },
    { ...policy, author: "factory-app[bot] " },
    { ...policy, author: 12 },
  ]) {
    const result = run(t, { author: "factory-app[bot]", declaration });
    assert.equal(result.code, 1);
    assert.deepEqual(result.emitted, []);
    assert.match(result.stderr, /\.github\/factory-review-policy\.json:/);
  }
});

test("the installed request command includes its policy reader and platform resources", (t) => {
  const target = pathToFileURL(
    installedValidator(t, ".agents/skills/babysit/request.mjs"),
  );
  const skipped = run(t, { target, author: "app/FACTORY-APP" });
  assert.equal(skipped.code, 0, skipped.stderr);
  assert.match(skipped.stdout, /external review skipped/);
  assert.deepEqual(skipped.emitted, []);
  const requested = run(t, {
    target,
    config: { ...reviewer, request: { ...reviewer.request, onOpen: false } },
  });
  assert.equal(requested.code, 0, requested.stderr);
  assert.deepEqual(requested.emitted, [reviewer.request.comment]);
});
