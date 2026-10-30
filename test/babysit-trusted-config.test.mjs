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

const fixture = new URL("./fixtures/postern-babysit.mjs", import.meta.url);
const policy = { version: 1, author: "factory-app[bot]" };
const otherPolicy = { version: 1, author: "other-app[bot]" };
const reviewer = {
  version: 1,
  account: "trusted-reviewer[bot]",
  request: { comment: "@trusted-reviewer review", onOpen: false },
  unavailable: [],
  bounds: { responseMinutes: 5, reviewMinutes: 30, reviewRequests: 2 },
};
const revision = "b".repeat(40);
const laterRevision = "c".repeat(40);
const head = "a".repeat(40);
const date = "2026-10-11T05:00:00Z";
const passed = {
  __typename: "StatusContext",
  context: "CI",
  state: "SUCCESS",
  targetUrl: "https://ci/1",
};

// The installed entry points and the published adapter run against remote
// snapshots that are independent of the proposed and dirty checkout's files.
function command(t, entry, { trusted = {}, local = {}, remote = {} } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "babysit-trusted-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, ".github"));
  for (const [key, name] of [
    ["policy", "factory-review-policy"],
    ["reviewer", "pull-request-reviewer"],
  ]) {
    if (local[key] != null)
      writeFileSync(
        join(directory, `.github/${name}.json`),
        typeof local[key] === "string"
          ? local[key]
          : JSON.stringify(local[key]),
      );
  }
  const statePath = join(directory, "state.json");
  writeFileSync(
    statePath,
    JSON.stringify({
      head,
      author: policy.author,
      createdAt: date,
      pushedAt: date,
      committedAt: date,
      reviewConfiguration: trusted,
      traceReviewConfiguration: true,
      ...remote,
    }),
  );
  const target = pathToFileURL(
    installedValidator(t, `.agents/skills/babysit/${entry}.mjs`),
  );
  const bundle = new URL("../../../vendor/postern/postern.mjs", target);
  const invoke = (args = []) => {
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { main } from ${JSON.stringify(target.href)}; import { connect } from ${JSON.stringify(bundle.href)}; import { fixtureConnection } from ${JSON.stringify(fixture.href)}; process.exitCode = await main(process.argv.slice(1), fixtureConnection(connect));`,
        "--",
        "12",
        ...(entry === "wait" ? ["--limit", "1", "--interval", "0.01"] : []),
        ...args,
      ],
      {
        cwd: directory,
        env: { ...process.env, FAKE_GH_STATE: statePath },
        encoding: "utf8",
        timeout: 10000,
      },
    );
    assert.ifError(result.error);
    return { ...result, state: JSON.parse(readFileSync(statePath, "utf8")) };
  };
  return { invoke };
}

for (const entry of ["request", "wait"]) {
  test(`${entry}: proposed policy additions, edits and deletions cannot change trusted authority`, (t) => {
    for (const [trustedPolicy, proposedPolicy, skip] of [
      [null, policy, false],
      [otherPolicy, policy, false],
      [policy, null, true],
      [policy, otherPolicy, true],
      [null, "malformed local bytes", false],
    ]) {
      for (const args of entry === "request"
        ? [[], ["--fixes-review"]]
        : [[]]) {
        const result = command(t, entry, {
          trusted: { policy: trustedPolicy, reviewer },
          local: { policy: proposedPolicy, reviewer: null },
          remote: { crossRepository: true, baseBranch: "release/candidate" },
        }).invoke(args);
        assert.equal(
          result.status,
          entry === "request" ? 0 : skip ? 6 : 4,
          result.stderr,
        );
        assert.deepEqual(
          result.state.emitted ?? [],
          entry === "request" && !skip ? [reviewer.request.comment] : [],
        );
        assert.match(
          result.stdout,
          /review configuration: example\/repository default branch main@b{40}/,
        );
        assert.equal(result.state.configurationReads[0].owner, "example");
        assert.equal(result.state.configurationReads[0].name, "repository");
        const files = result.state.configurationReads[1];
        assert.equal(
          files.policy,
          `${revision}:.github/factory-review-policy.json`,
        );
        assert.equal(
          files.reviewer,
          `${revision}:.github/pull-request-reviewer.json`,
        );
      }
    }
  });

  test(`${entry}: reviewer additions, deletion and replacement preserve trusted absence, identity and request settings`, (t) => {
    const proposed = {
      ...reviewer,
      account: "proposed-reviewer[bot]",
      request: { comment: "@proposed-reviewer review", onOpen: true },
    };
    for (const [trustedReviewer, localReviewer] of [
      [reviewer, null],
      [reviewer, proposed],
      [null, proposed],
      [null, "{"],
    ]) {
      const result = command(t, entry, {
        trusted: { reviewer: trustedReviewer },
        local: { reviewer: localReviewer },
        remote: {
          reviews: [
            {
              user: { login: proposed.account },
              commit_id: head,
              state: "APPROVED",
              body: "",
            },
          ],
        },
      }).invoke();
      assert.equal(
        result.status,
        entry === "wait" && trustedReviewer ? 4 : 0,
        result.stderr,
      );
      assert.deepEqual(
        result.state.emitted ?? [],
        entry === "request" && trustedReviewer
          ? [reviewer.request.comment]
          : [],
      );
    }
    const bounded = command(t, entry, {
      trusted: { reviewer },
      local: {
        reviewer: {
          ...reviewer,
          bounds: { ...reviewer.bounds, reviewRequests: 20 },
        },
      },
      remote: {
        pushedAt: "2026-10-11T06:00:00Z",
        comments: [1, 2].map(() => ({
          login: "agent",
          body: reviewer.request.comment,
          createdAt: date,
        })),
      },
    }).invoke(entry === "request" ? ["--fixes-review"] : []);
    assert.equal(bounded.status, entry === "request" ? 0 : 4, bounded.stderr);
    assert.deepEqual(bounded.state.emitted ?? [], []);
    assert.match(bounded.stdout, /request bound reached/);
  });

  test(`${entry}: trusted resolution and read failures are explicit and never emit a review request`, (t) => {
    const commit = { __typename: "Commit", oid: revision };
    const blob = {
      __typename: "Blob",
      isTruncated: false,
      text: JSON.stringify(policy),
    };
    const failures = [
      { failReviewRevision: 404 },
      { failReviewRevision: 403 },
      { failReviewRevision: 502 },
      {
        reviewRevisionResponse: {
          errors: [{ message: "ref read failed" }],
          data: { repository: null },
        },
      },
      { reviewRevisionResponse: { data: { repository: null } } },
      {
        reviewRevisionResponse: {
          data: {
            repository: {
              nameWithOwner: "example/repository",
              defaultBranchRef: null,
            },
          },
        },
      },
      {
        reviewRevisionResponse: {
          data: {
            repository: {
              nameWithOwner: "example/repository",
              defaultBranchRef: {
                name: "main",
                target: { __typename: "Commit", oid: "short" },
              },
            },
          },
        },
      },
      { failReviewFiles: 404 },
      { failReviewFiles: 403 },
      { failReviewFiles: 502 },
      {
        reviewFilesResponse: {
          errors: [{ message: "file read failed" }],
          data: { repository: { commit, policy: null, reviewer: null } },
        },
      },
      ...[null, { __typename: "Commit", oid: laterRevision }].map((commit) => ({
        reviewFilesResponse: {
          data: { repository: { commit, policy: null, reviewer: null } },
        },
      })),
      ...[
        {},
        { __typename: "Tree" },
        { ...blob, isTruncated: true },
        { ...blob, text: null },
      ].map((policy) => ({
        reviewFilesResponse: {
          data: { repository: { commit, policy, reviewer: null } },
        },
      })),
    ];
    for (const remote of failures) {
      const result = command(t, entry, {
        remote,
        local: { policy, reviewer },
        trusted: { policy, reviewer },
      }).invoke();
      assert.equal(result.status, 1, result.stderr);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /review configuration|default-branch commit/);
      assert.deepEqual(result.state.emitted ?? [], []);
    }
  });

  test(`${entry}: invalid trusted declarations require owner correction without a local fallback`, (t) => {
    /** @type {Array<[string, string, unknown, RegExp]>} */
    const invalidDeclarations = [
      ["policy", "factory-review-policy", "{", /JSON/],
      [
        "policy",
        "factory-review-policy",
        { ...policy, version: 2 },
        /version must be 1/,
      ],
      ["reviewer", "pull-request-reviewer", "{", /JSON/],
      [
        "reviewer",
        "pull-request-reviewer",
        { ...reviewer, version: 2 },
        /version must be 1/,
      ],
      [
        "reviewer",
        "pull-request-reviewer",
        {
          ...reviewer,
          finished: {
            commentMarker: "done",
            line: "x)(?<sha>[0-9a-f]+)(?<at>\\S+)(",
          },
        },
        /reviewer\.finished\.line must be a valid regular expression/,
      ],
    ];
    for (const [key, target, invalid, problem] of invalidDeclarations) {
      // A proposed correction, dirty file or untracked declaration has no
      // authority; the installed commands never consult those local bytes.
      for (const local of [
        {},
        { policy, reviewer },
        { policy: "{", reviewer: "{" },
      ]) {
        const result = command(t, entry, {
          trusted: { policy, reviewer, [key]: invalid },
          local,
          remote: { checks: [passed], crossRepository: true },
        }).invoke();
        assert.equal(result.status, 7, result.stderr);
        assert.equal(result.stdout, "");
        assert.match(result.stderr, /Owner handoff required/);
        assert.match(
          result.stderr,
          /example\/repository default branch main@b{40}/,
        );
        assert.ok(result.stderr.includes(`.github/${target}.json`));
        assert.match(result.stderr, problem);
        assert.match(
          result.stderr,
          /Correct .* on the destination default branch/,
        );
        assert.match(result.stderr, /keep the PR open and stop babysitting/);
        assert.deepEqual(result.state.emitted ?? [], []);
      }
    }
  });

  test(`${entry}: validation causes meet recovery guidance with one period`, (t) => {
    for (const [trusted, cause] of [
      [
        {
          reviewer: {
            ...reviewer,
            finished: {
              commentMarker: "done",
              line: "x)(?<sha>[0-9a-f]+)(?<at>\\S+)(",
            },
          },
        },
        "reviewer.finished.line must be a valid regular expression",
      ],
      [
        { policy: { ...policy, "unexpected.field": true } },
        ".github/factory-review-policy.json: unknown field: unexpected.field",
      ],
    ]) {
      const result = command(t, entry, { trusted }).invoke();
      assert.equal(result.status, 7, result.stderr);
      assert.ok(result.stderr.includes(`${cause}. Correct `), result.stderr);
      assert.match(
        result.stderr,
        /example\/repository default branch main@b{40}/,
      );
      assert.match(result.stderr, /keep the PR open and stop babysitting/);
      assert.deepEqual(result.state.emitted ?? [], []);
    }
  });

  test(`${entry}: a fresh invocation uses a correction only after it reaches the trusted default branch`, (t) => {
    for (const key of ["policy", "reviewer"]) {
      const { invoke } = command(t, entry, {
        local: { policy, reviewer },
        remote: {
          checks: [passed],
          moveDefaultTo: laterRevision,
          reviewSnapshots: {
            [revision]: { reviewer, [key]: "{" },
            [laterRevision]: { reviewer },
          },
        },
      });
      const invalid = invoke();
      assert.equal(invalid.status, 7, invalid.stderr);
      assert.match(invalid.stderr, /default branch main@b{40}/);
      assert.deepEqual(invalid.state.emitted ?? [], []);
      const corrected = invoke(entry === "request" ? ["--fixes-review"] : []);
      assert.equal(
        corrected.status,
        entry === "request" ? 0 : 4,
        corrected.stderr,
      );
      assert.equal(corrected.stderr, "");
      assert.match(corrected.stdout, /default branch main@c{40}/);
      assert.doesNotMatch(corrected.stdout, /external review skipped/);
      assert.deepEqual(
        corrected.state.emitted ?? [],
        entry === "request" ? [reviewer.request.comment] : [],
      );
    }
  });

  test(`${entry}: invocation errors retain exit 1 before configuration selection`, (t) => {
    const result = command(t, entry, {
      trusted: { policy: "{" },
    }).invoke(["--unknown"]);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stdout, "");
    assert.doesNotMatch(result.stderr, /Owner handoff required/);
    assert.deepEqual(result.state.configurationReads ?? [], []);
    assert.deepEqual(result.state.emitted ?? [], []);
  });
}

test("wait preserves standalone Unicode completion matching from trusted reviewer data", (t) => {
  const result = command(t, "wait", {
    trusted: {
      reviewer: {
        ...reviewer,
        request: { ...reviewer.request, onOpen: true },
        finished: {
          commentMarker: "<!-- done -->",
          line: "^✓ (?<sha>\\p{ASCII_Hex_Digit}{40}) at (?<at>\\S+)$",
        },
      },
    },
    remote: {
      checks: [passed],
      comments: [
        {
          login: reviewer.account,
          createdAt: date,
          body: `<!-- done -->\n✓ ${head} at ${date}`,
        },
      ],
    },
  }).invoke();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^a{40}: checks passed, reviewer reviewed/);
});

test("wait pins both files across polls and changed heads; a resumed invocation selects the new default tip", (t) => {
  const { invoke } = command(t, "wait", {
    local: { policy },
    remote: {
      defaultBranch: "trunk",
      moveDefaultTo: laterRevision,
      reviewSnapshots: {
        [revision]: {
          policy: otherPolicy,
          reviewer: {
            ...reviewer,
            request: { ...reviewer.request, onOpen: true },
          },
        },
        [laterRevision]: { policy, reviewer: null },
      },
      checks: [{ ...passed, state: "PENDING" }],
      afterChecks: {
        checks: [passed],
        head: "d".repeat(40),
        baseBranch: "retargeted",
        crossRepository: true,
      },
    },
  });
  const first = invoke();
  assert.equal(first.status, 4, first.stderr);
  assert.match(first.stdout, /^d{40}: checks passed, reviewer did not respond/);
  assert.match(first.stdout, /default branch trunk@b{40}/);
  assert.deepEqual(
    first.state.configurationReads.map((read) => read.kind),
    ["revision", "files"],
  );
  const resumed = invoke();
  assert.equal(resumed.status, 6, resumed.stderr);
  assert.match(resumed.stdout, /default branch trunk@c{40}/);
});

test("request pins both files while default moves and resolves again after a fix or resume", (t) => {
  const { invoke } = command(t, "request", {
    remote: {
      moveDefaultTo: laterRevision,
      reviewSnapshots: {
        [revision]: { reviewer },
        [laterRevision]: { policy, reviewer: null },
      },
    },
  });
  const first = invoke();
  assert.equal(first.status, 0, first.stderr);
  assert.deepEqual(first.state.emitted, [reviewer.request.comment]);
  assert.match(first.stdout, /default branch main@b{40}/);
  const resumed = invoke(["--fixes-review"]);
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.deepEqual(resumed.state.emitted, [reviewer.request.comment]);
  assert.match(
    resumed.stdout,
    /external review skipped.*default branch main@c{40}/,
  );
});
