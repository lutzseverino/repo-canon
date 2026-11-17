import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { installedValidator } from "./helpers/installed-validator.mjs";
import {
  fixtureGitEnvironment,
  spawnFixtureGit,
} from "../scripts/support/fixture-git.mjs";

function repository(t) {
  const root = mkdtempSync(join(tmpdir(), "canon-branch-update-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => {
    const result = spawnFixtureGit(args, { cwd: root });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git("init", "-b", "main");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.com");
  const commit = (path, content) => {
    writeFileSync(join(root, path), content);
    git("add", "--", path);
    git("commit", "-m", "fixture change");
    return git("rev-parse", "HEAD");
  };
  const base = commit("feature.txt", "one\ntwo\nthree\nfour\nfive\n");
  git("checkout", "-b", "feature");
  const head = commit("feature.txt", "changed\ntwo\nthree\nfour\nfive\n");
  git("checkout", "main");
  const script = installedValidator(
    t,
    ".agents/skills/babysit/branch-update.mjs",
  );
  const assess = (
    newBase,
    updates = 1,
    replacement,
    previousHead = head,
    previousBase = base,
  ) => {
    const result = spawnSync(
      process.execPath,
      [
        script,
        previousBase,
        previousHead,
        newBase,
        String(updates),
        ...(replacement ? [replacement] : []),
      ],
      { cwd: root, encoding: "utf8", env: fixtureGitEnvironment() },
    );
    return {
      ...result,
      value: result.stdout ? JSON.parse(result.stdout) : null,
    };
  };
  return { root, git, commit, base, head, assess };
}

test("installed recovery permits a disjoint clean advance, twice more then hands off", (t) => {
  const repo = repository(t);
  const next = repo.commit("unrelated.txt", "base work\n");
  for (const updates of [0, 1, 2]) {
    const result = repo.assess(next, updates);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.value.action, "update");
    assert.equal(result.value.nonOverlapping, true);
  }
  const capped = repo.assess(next, 3);
  assert.equal(capped.status, 3, capped.stderr);
  assert.equal(capped.value.reason, "base did not settle");
});

test("successive base advances retain the attempt's update count and unchanged full patch", (t) => {
  const repo = repository(t);
  let previousBase = repo.base;
  let previousHead = repo.head;
  for (let updates = 0; updates < 4; updates++) {
    const next = repo.commit(`base-${updates}.txt`, `base work ${updates}\n`);
    const decision = repo.assess(
      next,
      updates,
      undefined,
      previousHead,
      previousBase,
    );
    assert.equal(decision.status, updates === 3 ? 3 : 0, decision.stderr);
    if (updates === 3) {
      assert.equal(decision.value.reason, "base did not settle");
      break;
    }
    repo.git("checkout", "feature");
    repo.git("rebase", next);
    const replacement = repo.git("rev-parse", "HEAD");
    const verified = repo.assess(
      next,
      updates,
      replacement,
      previousHead,
      previousBase,
    );
    assert.equal(verified.status, 0, verified.stderr);
    assert.equal(verified.value.patchUnchanged, true);
    previousBase = next;
    previousHead = replacement;
    repo.git("checkout", "main");
  }
});

test("a touching but clean advance hands off after the unconditional first update", (t) => {
  const repo = repository(t);
  const next = repo.commit(
    "feature.txt",
    "one\ntwo\nthree\nfour\nbase change\n",
  );
  const first = repo.assess(next, 0);
  assert.equal(first.status, 0, first.stderr);
  const result = repo.assess(next);
  assert.equal(result.status, 3, result.stderr);
  assert.equal(result.value.reason, "overlapping advance");
  assert.equal(result.value.clean, true);
  assert.deepEqual(result.value.overlapPaths, ["feature.txt"]);
});

test("a conflicting advance is overlapping", (t) => {
  const repo = repository(t);
  const next = repo.commit(
    "feature.txt",
    "conflicting\ntwo\nthree\nfour\nfive\n",
  );
  const result = repo.assess(next);
  assert.equal(repo.assess(next, 0).status, 0);
  assert.equal(result.status, 3, result.stderr);
  assert.equal(result.value.nonOverlapping, false);
  assert.equal(result.value.clean, false);
});

test("disjoint path sets still overlap when merge-tree detects a directory/file conflict", (t) => {
  const repo = repository(t);
  repo.git("checkout", "feature");
  repo.commit("directory", "PR file\n");
  const head = repo.git("rev-parse", "HEAD");
  repo.git("checkout", "main");
  mkdirSync(join(repo.root, "directory"));
  const next = repo.commit("directory/child", "base file\n");
  const result = repo.assess(next, 1, undefined, head);
  assert.equal(result.status, 3, result.stderr);
  assert.equal(result.value.clean, false);
  assert.deepEqual(result.value.overlapPaths, []);
});

test("base commits that touch a PR path and then revert still overlap", (t) => {
  const repo = repository(t);
  repo.commit("feature.txt", "temporary\n");
  repo.git("revert", "--no-edit", "HEAD");
  const result = repo.assess(repo.git("rev-parse", "HEAD"));
  assert.equal(result.status, 3, result.stderr);
  assert.equal(result.value.clean, true);
  assert.deepEqual(result.value.overlapPaths, ["feature.txt"]);
});

test("stable full-diff patch identity survives replay but detects changed work", (t) => {
  const repo = repository(t);
  const next = repo.commit("unrelated.txt", "base work\n");
  repo.git("checkout", "-b", "replacement");
  repo.git("cherry-pick", repo.head);
  const replacement = repo.git("rev-parse", "HEAD");
  const unchanged = repo.assess(next, 1, replacement);
  assert.equal(unchanged.status, 0, unchanged.stderr);
  assert.equal(unchanged.value.patchUnchanged, true);
  const changed = repo.commit("another.txt", "extra PR work\n");
  const result = repo.assess(next, 1, changed);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.value.patchUnchanged, false);
});

test("unknown ancestry and replacement heads that omit the new base grant no evidence", (t) => {
  const repo = repository(t);
  const next = repo.commit("unrelated.txt", "base work\n");
  for (const result of [
    repo.assess(next, 1, repo.head),
    repo.assess("f".repeat(40)),
  ]) {
    assert.equal(result.status, 1);
    assert.equal(result.value, null);
  }
});

function command(t, repo, name, state, flags = []) {
  const target = pathToFileURL(
    installedValidator(t, `.agents/skills/babysit/${name}.mjs`),
  );
  const bundle = new URL("../../../vendor/postern/postern.mjs", target);
  const fixture = new URL("./fixtures/postern-babysit.mjs", import.meta.url);
  const statePath = join(repo.root, "platform.json");
  writeFileSync(
    statePath,
    JSON.stringify({
      createdAt: "2026-10-11T05:00:00Z",
      pushedAt: "2026-10-11T05:10:00Z",
      ...state,
    }),
  );
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { main } from ${JSON.stringify(target.href)}; import { connect } from ${JSON.stringify(bundle.href)}; import { fixtureConnection } from ${JSON.stringify(fixture.href)}; process.exitCode = await main(process.argv.slice(1), fixtureConnection(connect));`,
      "--",
      "12",
      ...flags,
    ],
    {
      cwd: repo.root,
      encoding: "utf8",
      timeout: 15000,
      env: fixtureGitEnvironment({ FAKE_GH_STATE: statePath }),
    },
  );
  assert.ifError(result.error);
  return { ...result, state: JSON.parse(readFileSync(statePath, "utf8")) };
}

test("installed wait carries an unchanged non-overlapping head's external review, with fresh checks", (t) => {
  const repo = repository(t);
  const next = repo.commit("unrelated.txt", "base work\n");
  repo.git("checkout", "-b", "replacement");
  repo.git("cherry-pick", repo.head);
  const replacement = repo.git("rev-parse", "HEAD");
  const reviewer = JSON.parse(
    readFileSync(
      new URL("./fixtures/reviewers/codex.json", import.meta.url),
      "utf8",
    ),
  );
  const state = {
    head: replacement,
    reviewConfiguration: { reviewer },
    checks: [{ __typename: "StatusContext", context: "CI", state: "SUCCESS" }],
    reviews: [
      {
        user: { login: reviewer.account },
        commit_id: repo.head,
        state: "APPROVED",
        body: "Reviewed",
      },
    ],
  };
  const flags = [
    "--updated-from",
    `${repo.base}:${repo.head}:${next}`,
    "--limit",
    "0.001",
  ];
  const result = command(t, repo, "wait", state, flags);
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    new RegExp(`^${replacement}: checks passed, reviewer reviewed`),
  );
  const unreviewed = command(t, repo, "wait", { ...state, reviews: [] }, flags);
  assert.equal(unreviewed.status, 4, unreviewed.stderr);
  for (const checkState of ["PENDING", "FAILURE"]) {
    const checked = command(
      t,
      repo,
      "wait",
      {
        ...state,
        checks: [
          { __typename: "StatusContext", context: "CI", state: checkState },
        ],
      },
      flags,
    );
    assert.equal(
      checked.status,
      checkState === "PENDING" ? 5 : 2,
      checked.stderr,
    );
  }
  const changed = repo.commit("new-work.txt", "new work\n");
  const refused = command(t, repo, "wait", { ...state, head: changed }, flags);
  assert.equal(refused.status, 1, refused.stderr);
  assert.match(refused.stderr, /repeat internal and external review/);
});

test("installed request verifies patch identity before suppressing a new external request", (t) => {
  const repo = repository(t);
  const next = repo.commit("unrelated.txt", "base work\n");
  repo.git("checkout", "-b", "replacement");
  repo.git("cherry-pick", repo.head);
  const replacement = repo.git("rev-parse", "HEAD");
  const reviewer = JSON.parse(
    readFileSync(
      new URL("./fixtures/reviewers/codex.json", import.meta.url),
      "utf8",
    ),
  );
  const state = {
    head: replacement,
    reviewConfiguration: { reviewer },
    reviews: [
      {
        user: { login: reviewer.account },
        commit_id: repo.head,
        state: "APPROVED",
        body: "Reviewed",
      },
    ],
  };
  const flags = [
    "--updated-from",
    `${repo.base}:${repo.head}:${next}`,
    "--fixes-review",
  ];
  const result = command(t, repo, "request", state, flags);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.state.emitted ?? [], []);
  assert.match(result.stdout, /unchanged non-overlapping update/);
  const unreviewed = command(
    t,
    repo,
    "request",
    { ...state, reviews: [] },
    flags,
  );
  assert.equal(unreviewed.status, 0, unreviewed.stderr);
  assert.equal(unreviewed.state.emitted.length, 1);
  const changed = repo.commit("extra.txt", "changed patch\n");
  const refused = command(
    t,
    repo,
    "request",
    { ...state, head: changed },
    flags,
  );
  assert.equal(refused.status, 1, refused.stderr);
  assert.deepEqual(refused.state.emitted ?? [], []);
});
