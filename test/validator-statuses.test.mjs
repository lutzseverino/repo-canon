import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { installedValidator } from "./helpers/installed-validator.mjs";
import { execFixtureGit } from "../scripts/support/fixture-git.mjs";
import { main, validate } from "../vendor/repo-canon/validate.mjs";
import { connect } from "../vendor/postern/postern.mjs";
import { validatePullRequestMetadata } from "../.github/scripts/validate-pr-metadata.mjs";

const head = "a".repeat(40);
const title = "feat: post validation results";
const body =
  "## Summary\n\nPost validation results.\n\n## Evidence\n\nExecutable fixtures pass.\n\n## Merge Danger\n\nA reversible command addition.\n\n## Related issue\n\nCloses #1227";
const repository = "https://github.com/example/project";
const credential = "fixture-status-token";

function fixture(t, entrypoint = main) {
  const directory = mkdtempSync(join(tmpdir(), "validator-status-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, "input.json");
  const statuses = [];
  let metadata = { title, body };
  let statusHead = head;
  /** @type {(payload: { state?: string }) => boolean} */
  let refuse = () => false;
  /** @type {(payload: { state: string }) => void} */
  let observe = () => {};
  const fetch = async (url, options) => {
    assert.equal(options.headers.authorization, `Bearer ${credential}`);
    const payload = JSON.parse(options.body);
    if (refuse(payload))
      return Response.json(
        { message: "Resource not accessible by integration" },
        { status: 403 },
      );
    if (String(url) === "https://api.github.com/graphql") {
      assert.equal(payload.variables.number, 42);
      return Response.json({
        data: {
          repository: {
            pullRequest: {
              number: 42,
              fullDatabaseId: "42",
              id: "PR_fixture",
              url: "https://github.com/example/project/pull/42",
              state: "OPEN",
              ...metadata,
              createdAt: "2026-11-20T00:00:00Z",
              author: { __typename: "User", login: "worker" },
              headRefName: "feature",
              headRefOid: head,
              baseRefName: "main",
              isCrossRepository: false,
              repository: { nameWithOwner: "example/project" },
            },
          },
        },
      });
    }
    assert.equal(
      String(url),
      `https://api.github.com/repos/example/project/statuses/${statusHead}`,
    );
    assert.equal(options.method, "POST");
    observe(payload);
    statuses.push(payload);
    return Response.json({ id: statuses.length }, { status: 201 });
  };
  return {
    directory,
    statuses,
    refuse(callback) {
      refuse = callback;
    },
    observe(callback) {
      observe = callback;
    },
    metadata(value) {
      metadata = value;
    },
    async run(input) {
      statusHead = input.head ?? head;
      writeFileSync(file, JSON.stringify({ repository, ...input }));
      return entrypoint([file], { credential, fetch });
    },
  };
}

test("PR number input posts the existing metadata verdict on the head read from GitHub", async (t) => {
  const f = fixture(t);
  for (const metadata of [
    { title, body },
    { title: "invalid title", body },
  ]) {
    f.metadata(metadata);
    const expected = validatePullRequestMetadata(metadata);
    assert.equal(
      await f.run({ kind: "pr-metadata", pullRequest: 42 }),
      expected,
    );
    assert.deepEqual(f.statuses.at(-1), {
      context: "PR metadata",
      state: expected === 0 ? "success" : "failure",
    });
  }
  assert.equal(f.statuses.length, 2);
});

function checkout(directory) {
  const git = (...args) =>
    execFixtureGit(args, { cwd: directory, timeout: 15_000 });
  git("init", "--quiet");
  git(
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.test",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "--quiet",
    "--allow-empty",
    "-m",
    "fixture",
  );
  return git("rev-parse", "HEAD").trim();
}

test("each role posts pending before executing the command, then its exit verdict on the exact head", async (t) => {
  for (const [role, context, exit] of [
    ["runner", "Runner checks", 0],
    ["review", "Review rerun", 7],
    ["runner", "Runner checks", 7],
    ["review", "Review rerun", 0],
  ]) {
    const f = fixture(t);
    const sha = checkout(f.directory);
    const output = join(f.directory, "ran.txt");
    writeFileSync(
      join(f.directory, "check.mjs"),
      `import { writeFileSync } from "node:fs"; writeFileSync("ran.txt", process.cwd()); process.exit(${exit});`,
    );
    f.observe(({ state }) =>
      assert.equal(existsSync(output), state !== "pending"),
    );
    assert.equal(
      await f.run({
        kind: "check-command",
        head: sha,
        checkout: f.directory,
        command: "node check.mjs",
        role,
      }),
      exit === 0 ? 0 : 1,
    );
    assert.equal(readFileSync(output, "utf8"), f.directory);
    assert.deepEqual(f.statuses, [
      { context, state: "pending" },
      { context, state: exit === 0 ? "success" : "failure" },
    ]);
  }
});

test("the command receives neither POSTERN_TOKEN nor another variable equal to the posting token", async (t) => {
  const f = fixture(t);
  const sha = checkout(f.directory);
  for (const name of [
    "POSTERN_TOKEN",
    "FIXTURE_TOKEN_COPY",
    "FIXTURE_ORDINARY",
  ]) {
    const previous = process.env[name];
    t.after(() => {
      if (previous === undefined) delete process.env[name];
      else process.env[name] = previous;
    });
  }
  process.env.POSTERN_TOKEN = credential;
  process.env.FIXTURE_TOKEN_COPY = credential;
  process.env.FIXTURE_ORDINARY = "preserved";
  writeFileSync(
    join(f.directory, "check.mjs"),
    'import { writeFileSync } from "node:fs"; writeFileSync("environment.json", JSON.stringify(process.env));',
  );
  assert.equal(
    await f.run({
      kind: "check-command",
      head: sha,
      checkout: f.directory,
      command: "node check.mjs",
      role: "runner",
    }),
    0,
  );
  const environment = JSON.parse(
    readFileSync(join(f.directory, "environment.json"), "utf8"),
  );
  assert.equal(environment.POSTERN_TOKEN, undefined);
  assert.equal(environment.FIXTURE_TOKEN_COPY, undefined);
  assert.ok(!Object.values(environment).includes(credential));
  assert.equal(environment.FIXTURE_ORDINARY, "preserved");
});

test("a different checkout HEAD refuses without posting or executing", async (t) => {
  const f = fixture(t);
  checkout(f.directory);
  await assert.rejects(
    f.run({
      kind: "check-command",
      head,
      checkout: f.directory,
      command: "touch ran.txt",
      role: "runner",
    }),
    /Checkout HEAD differs/,
  );
  assert.deepEqual(f.statuses, []);
  assert.equal(existsSync(join(f.directory, "ran.txt")), false);
});

test("an invalid role refuses without posting or executing", async (t) => {
  const f = fixture(t);
  const sha = checkout(f.directory);
  await assert.rejects(
    f.run({
      kind: "check-command",
      head: sha,
      checkout: f.directory,
      command: "touch ran.txt",
      role: "__proto__",
    }),
    /runner or review role/,
  );
  assert.deepEqual(f.statuses, []);
  assert.equal(existsSync(join(f.directory, "ran.txt")), false);
});

test("a refused pending status prevents command execution and is not retried", async (t) => {
  const f = fixture(t);
  const sha = checkout(f.directory);
  let attempts = 0;
  f.refuse(({ state }) => {
    if (state === "pending") attempts++;
    return true;
  });
  await assert.rejects(
    f.run({
      kind: "check-command",
      head: sha,
      checkout: f.directory,
      command: "touch ran.txt",
      role: "runner",
    }),
  );
  assert.equal(attempts, 1);
  assert.deepEqual(f.statuses, []);
  assert.equal(existsSync(join(f.directory, "ran.txt")), false);
});

test("a refused final status fails the invocation instead of reporting command success", async (t) => {
  const f = fixture(t);
  const sha = checkout(f.directory);
  f.refuse(({ state }) => state === "success");
  await assert.rejects(
    f.run({
      kind: "check-command",
      head: sha,
      checkout: f.directory,
      command: "exit 0",
      role: "review",
    }),
  );
  assert.deepEqual(f.statuses, [{ context: "Review rerun", state: "pending" }]);
});

test("unreadable PR metadata posts no status", async (t) => {
  const f = fixture(t);
  f.refuse(() => true);
  await assert.rejects(f.run({ kind: "pr-metadata", pullRequest: 42 }));
  assert.deepEqual(f.statuses, []);
});

test("the declared installed layout posts metadata and command statuses without runtime packages", async (t) => {
  const { main: installedMain } = await import(
    pathToFileURL(installedValidator(t, "vendor/repo-canon/validate.mjs")).href
  );
  const f = fixture(t, installedMain);
  assert.equal(await f.run({ kind: "pr-metadata", pullRequest: 42 }), 0);
  const sha = checkout(f.directory);
  assert.equal(
    await f.run({
      kind: "check-command",
      head: sha,
      checkout: f.directory,
      command: "exit 0",
      role: "review",
    }),
    0,
  );
  assert.deepEqual(f.statuses, [
    { context: "PR metadata", state: "success" },
    { context: "Review rerun", state: "pending" },
    { context: "Review rerun", state: "success" },
  ]);
});

test("direct check-command calls require an explicit posting credential rather than guessing from the environment", async (t) => {
  const previous = process.env.POSTERN_TOKEN;
  t.after(() => {
    if (previous === undefined) delete process.env.POSTERN_TOKEN;
    else process.env.POSTERN_TOKEN = previous;
  });
  process.env.POSTERN_TOKEN = "different-environment-token";
  const f = fixture(t, async (argv, options) =>
    validate(
      JSON.parse(readFileSync(argv[0], "utf8")),
      connect(repository, options),
    ),
  );
  const sha = checkout(f.directory);
  await assert.rejects(
    f.run({
      kind: "check-command",
      head: sha,
      checkout: f.directory,
      command: "touch ran.txt",
      role: "runner",
    }),
    /posting credential/,
  );
  assert.deepEqual(f.statuses, []);
  assert.equal(existsSync(join(f.directory, "ran.txt")), false);
});
