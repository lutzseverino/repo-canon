import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { connect } from "../vendor/postern/postern.mjs";
import { main } from "../.agents/skills/orchestrate/wait.mjs";
import { readRecords } from "../.agents/skills/orchestrate/records.mjs";

const script = fileURLToPath(
  new URL("../.agents/skills/orchestrate/wait.mjs", import.meta.url),
);
const durations = ["--interval", "0.01", "--max-duration", "5"];

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const comment = (id) => ({
  id,
  node_id: `IC_${id}`,
  html_url: `https://github.com/example/tracker/issues/7#issuecomment-${id}`,
  user: { login: "owner", type: "User" },
  body: "An answer.",
  created_at: "2026-10-30T10:00:00Z",
  updated_at: "2026-10-30T10:00:00Z",
});

const pull = (number, state) => ({
  number,
  fullDatabaseId: String(9000 + number),
  id: `PR_${number}`,
  url: `https://github.com/example/tracker/pull/${number}`,
  state,
  title: "A fix",
  body: "",
  createdAt: "2026-10-30T10:00:00Z",
  author: { __typename: "User", login: "worker" },
  headRefName: `issue-${number}`,
  headRefOid: "a".repeat(40),
  baseRefName: "main",
  isCrossRepository: false,
  repository: { nameWithOwner: "example/tracker" },
});

// A stubbed tracker: the published Postern adapter reads the mutable `items`
// through an injected fetch transport, keyed by `owner/name#number`.
function tracker(items) {
  const requests = [];
  const fetch = async (input, options = {}) => {
    const path = new URL(input).pathname;
    requests.push(path);
    if (items.fail) return json({ message: "Server Error" }, 502);
    if (path === "/graphql") {
      const { variables } = JSON.parse(options.body);
      const item =
        items[`${variables.owner}/${variables.name}#${variables.number}`];
      return json({
        data: {
          repository: {
            issue: {
              closedByPullRequestsReferences: {
                nodes: item.linked ?? [],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        },
      });
    }
    const pr = /^\/repos\/([^/]+)\/([^/]+)\/pulls\/(\d+)$/.exec(path);
    if (pr) {
      const item = items[`${pr[1]}/${pr[2]}#${pr[3]}`];
      return json({ head: { sha: item.head ?? "a".repeat(40) } });
    }
    const checks =
      /^\/repos\/([^/]+)\/([^/]+)\/commits\/([^/]+)\/(check-runs|status)$/.exec(
        path,
      );
    if (checks) {
      const item = Object.entries(items).find(
        ([key, value]) =>
          key.startsWith(`${checks[1]}/${checks[2]}#`) && value.pull,
      )?.[1];
      return json(
        checks[4] === "check-runs"
          ? { check_runs: item.runs ?? [] }
          : { statuses: item.statuses ?? [] },
      );
    }
    const match =
      /^\/repos\/([^/]+)\/([^/]+)\/issues\/(\d+)(\/comments)?$/.exec(path);
    const item = match && items[`${match[1]}/${match[2]}#${match[3]}`];
    if (!item) return json({ message: "Not Found" }, 404);
    if (match[4]) return json(item.comments ?? []);
    return json({
      number: Number(match[3]),
      state: item.state ?? "open",
      labels: (item.labels ?? []).map((name) => ({ name })),
      ...(item.pull
        ? { pull_request: { merged_at: item.mergedAt ?? null } }
        : {}),
    });
  };
  return {
    requests,
    connect: (repository) =>
      connect(`https://github.com/${repository}`, { fetch }),
  };
}

// Collects the wait's lines; `main` writes to the streams it is given.
function capture() {
  const output = { stdout: "", stderr: "" };
  const stream = (name) => ({
    write: (chunk) => {
      output[name] += chunk;
      return true;
    },
  });
  output.streams = { stdout: stream("stdout"), stderr: stream("stderr") };
  return output;
}

const unreachable = () => assert.fail("the wait reached the tracker");

test("both durations are required, with no built-in default", async () => {
  const output = capture();
  for (const { flag, args } of [
    { flag: "--interval", args: ["--max-duration", "60", "example/tracker#7"] },
    { flag: "--max-duration", args: ["--interval", "60", "example/tracker#7"] },
  ]) {
    output.stderr = "";
    assert.equal(
      await main(args, { connect: unreachable, ...output.streams }),
      1,
    );
    assert.match(output.stderr, new RegExp(`${flag} is required`));
  }
  output.stderr = "";
  assert.equal(
    await main(["example/tracker#7"], {
      connect: unreachable,
      ...output.streams,
    }),
    1,
  );
  assert.match(output.stderr, /--interval is required/);
  assert.match(output.stderr, /--max-duration is required/);
  assert.equal(output.stdout, "");
});

test("invalid duration values fail before reading any item", async () => {
  const output = capture();
  for (const flag of ["--interval", "--max-duration"]) {
    const other = flag === "--interval" ? "--max-duration" : "--interval";
    for (const value of [
      "0",
      "-1",
      "",
      "abc",
      "NaN",
      "Infinity",
      "-Infinity",
      "1e308",
      "--max-duration",
    ]) {
      output.stderr = "";
      assert.equal(
        await main([flag, value, other, "60", "example/tracker#7"], {
          connect: unreachable,
          ...output.streams,
        }),
        1,
        `${flag} ${value}`,
      );
      assert.match(
        output.stderr,
        new RegExp(`${flag} must be a finite positive number of seconds`),
        `${flag} ${value}`,
      );
    }
    output.stderr = "";
    assert.equal(
      await main([other, "60", "example/tracker#7", flag], {
        connect: unreachable,
        ...output.streams,
      }),
      1,
    );
    assert.match(output.stderr, new RegExp(`${flag} needs a value`));
    output.stderr = "";
    assert.equal(
      await main([flag, "1", flag, "2", other, "60", "example/tracker#7"], {
        connect: unreachable,
        ...output.streams,
      }),
      1,
    );
    assert.match(output.stderr, new RegExp(`${flag} is given more than once`));
  }
});

test("items are required and must be issue, pull request, file or directory references", async () => {
  const output = capture();
  assert.equal(
    await main(durations, { connect: unreachable, ...output.streams }),
    1,
  );
  assert.match(output.stderr, /usage: wait\.mjs/);
  for (const item of [
    "tracker#7",
    "example/tracker#0",
    "example/tracker",
    "https://gitlab.com/example/tracker/issues/7",
    "https://github.com/example/tracker/commit/7",
    "file:",
    "dir:",
    "--repo",
    "--interval-seconds",
  ]) {
    output.stderr = "";
    assert.equal(
      await main([...durations, item], {
        connect: unreachable,
        ...output.streams,
      }),
      1,
      item,
    );
    assert.match(
      output.stderr,
      /unrecognized (?:item|option)|usage: wait\.mjs/,
      item,
    );
  }
});

test("an issue's state, labels, comments and linked pull requests each wake the wait", async () => {
  const output = capture();
  for (const { name, change, line } of [
    {
      name: "state",
      change: (item) => (item.state = "closed"),
      line: "example/tracker#7: state changed from open to closed",
    },
    {
      name: "labels",
      change: (item) => (item.labels = ["state:ready", "factory:running"]),
      line: "example/tracker#7: labels added factory:running; removed state:triage",
    },
    {
      name: "comments",
      change: (item) => item.comments.push(comment(2)),
      line: "example/tracker#7: new comment https://github.com/example/tracker/issues/7#issuecomment-2",
    },
    {
      name: "linked pull request",
      change: (item) => item.linked.push(pull(12, "OPEN")),
      line: "example/tracker#7: linked pull request https://github.com/example/tracker/pull/12 (open)",
    },
    {
      name: "linked pull request state",
      change: (item) => (item.linked[0].state = "MERGED"),
      line: "example/tracker#7: linked pull request https://github.com/example/tracker/pull/11 changed from open to merged",
    },
  ]) {
    output.stdout = "";
    const items = {
      "example/tracker#7": {
        labels: ["state:ready", "state:triage"],
        comments: [comment(1)],
        linked: [pull(11, "OPEN")],
      },
    };
    const { connect } = tracker(items);
    let pauses = 0;
    const code = await main([...durations, "example/tracker#7"], {
      ...output.streams,
      connect,
      pause: async () => {
        pauses += 1;
        if (pauses === 2) change(items["example/tracker#7"]);
      },
    });
    assert.equal(code, 0, name);
    assert.equal(output.stdout, `${line}\n`, name);
    assert.equal(pauses, 2, name);
  }
});

test("removing an issue's only linked pull request wakes the next poll", async () => {
  const output = capture();
  const item = { linked: [pull(11, "OPEN")] };
  let elapsed = 0;
  let pauses = 0;
  const code = await main(
    ["--interval", "1", "--max-duration", "3", "example/tracker#7"],
    {
      ...output.streams,
      connect: tracker({ "example/tracker#7": item }).connect,
      now: () => elapsed,
      pause: async (ms) => {
        elapsed += ms;
        pauses++;
        item.linked = [];
      },
    },
  );
  assert.equal(code, 0, output.stderr);
  assert.equal(
    output.stdout,
    "example/tracker#7: linked pull request https://github.com/example/tracker/pull/11 removed\n",
  );
  assert.equal(pauses, 1);
  assert.equal(output.stderr, "");
});

test("a poll reports every removed link alongside additions and state changes", async (t) => {
  for (const { name, after, lines } of [
    {
      name: "some links removed",
      after: [pull(12, "OPEN")],
      lines: [
        "linked pull request https://github.com/example/tracker/pull/11 removed",
        "linked pull request https://github.com/example/tracker/pull/13 removed",
      ],
    },
    {
      name: "all links removed",
      after: [],
      lines: [
        "linked pull request https://github.com/example/tracker/pull/11 removed",
        "linked pull request https://github.com/example/tracker/pull/12 removed",
        "linked pull request https://github.com/example/tracker/pull/13 removed",
      ],
    },
    {
      name: "removal, addition and state change",
      after: [pull(12, "MERGED"), pull(13, "OPEN"), pull(14, "OPEN")],
      lines: [
        "linked pull request https://github.com/example/tracker/pull/12 changed from open to merged",
        "linked pull request https://github.com/example/tracker/pull/14 (open)",
        "linked pull request https://github.com/example/tracker/pull/11 removed",
      ],
    },
  ]) {
    await t.test(name, async () => {
      const output = capture();
      const item = {
        linked: [pull(11, "OPEN"), pull(12, "OPEN"), pull(13, "OPEN")],
      };
      let elapsed = 0;
      let pauses = 0;
      assert.equal(
        await main(
          ["--interval", "1", "--max-duration", "3", "example/tracker#7"],
          {
            ...output.streams,
            connect: tracker({ "example/tracker#7": item }).connect,
            now: () => elapsed,
            pause: async (ms) => {
              elapsed += ms;
              pauses++;
              item.linked = after;
            },
          },
        ),
        0,
        output.stderr,
      );
      assert.equal(
        output.stdout,
        lines.map((line) => `example/tracker#7: ${line}\n`).join(""),
      );
      assert.equal(pauses, 1);
      assert.equal(output.stderr, "");
    });
  }
});

test("unchanged links and order-only changes stay quiet until the deadline", async () => {
  const output = capture();
  const item = { linked: [pull(11, "OPEN"), pull(12, "MERGED")] };
  let elapsed = 0;
  let pauses = 0;
  assert.equal(
    await main(
      ["--interval", "1", "--max-duration", "3", "example/tracker#7"],
      {
        ...output.streams,
        connect: tracker({ "example/tracker#7": item }).connect,
        now: () => elapsed,
        pause: async (ms) => {
          elapsed += ms;
          pauses++;
          if (pauses === 2) item.linked.reverse();
        },
      },
    ),
    0,
    output.stderr,
  );
  assert.equal(pauses, 3);
  assert.equal(
    output.stdout,
    "no item changed within the maximum duration of 3 seconds; arm the wait again\n",
  );
  assert.equal(output.stderr, "");
});

test("a pull request item reports merging, labels and comments, and reads no linked pull requests", async () => {
  const output = capture();
  const items = {
    "example/tracker#12": { pull: true, labels: [], comments: [] },
  };
  const { connect, requests } = tracker(items);
  const code = await main(
    [...durations, "https://github.com/example/tracker/pull/12"],
    {
      ...output.streams,
      connect,
      pause: async () => {
        Object.assign(items["example/tracker#12"], {
          state: "closed",
          mergedAt: "2026-10-30T11:00:00Z",
          labels: ["released"],
          comments: [comment(3)],
        });
      },
    },
  );
  assert.equal(code, 0);
  assert.deepEqual(output.stdout.trimEnd().split("\n"), [
    "https://github.com/example/tracker/pull/12: state changed from open to merged",
    "https://github.com/example/tracker/pull/12: labels added released",
    "https://github.com/example/tracker/pull/12: new comment https://github.com/example/tracker/issues/7#issuecomment-3",
  ]);
  assert.ok(!requests.includes("/graphql"));
});

test("only the changed item is reported among several", async () => {
  const output = capture();
  const items = {
    "example/tracker#7": { comments: [] },
    "example/other#3": { comments: [] },
  };
  const { connect } = tracker(items);
  const code = await main(
    [...durations, "example/tracker#7", "example/other#3"],
    {
      ...output.streams,
      connect,
      pause: async () => (items["example/other#3"].labels = ["state:reporter"]),
    },
  );
  assert.equal(code, 0);
  assert.equal(output.stdout, "example/other#3: labels added state:reporter\n");
});

test("a report-back file and a done mark wake the wait", async (t) => {
  const output = capture();
  const workbench = mkdtempSync(join(tmpdir(), "orchestrate-wait-"));
  t.after(() => rmSync(workbench, { recursive: true, force: true }));
  const result = join(workbench, "triage-01.md");
  const plan = join(workbench, "plan.md");
  writeFileSync(plan, "| 01 | repo | #7 | triage s1 |\n");
  for (const { name, change, item, how } of [
    {
      name: "created",
      change: () => writeFileSync(result, "# Result\n"),
      item: result,
      how: "created",
    },
    {
      name: "done mark",
      change: () =>
        writeFileSync(plan, "| 01 | repo | #7 | triaged triage-01.md |\n"),
      item: plan,
      how: "changed",
    },
    {
      name: "removed",
      change: () => unlinkSync(result),
      item: result,
      how: "removed",
    },
  ]) {
    output.stdout = "";
    const code = await main([...durations, `file:${item}`], {
      ...output.streams,
      connect: unreachable,
      pause: async () => change(),
    });
    assert.equal(code, 0, name);
    assert.equal(output.stdout, `file:${item}: ${how}\n`, name);
  }
  assert.match(readFileSync(plan, "utf8"), /triaged/);
});

test("a file appearing, changing or going in a directory item wakes the wait", async (t) => {
  const output = capture();
  const workbench = mkdtempSync(join(tmpdir(), "orchestrate-wait-"));
  t.after(() => rmSync(workbench, { recursive: true, force: true }));
  const incoming = join(workbench, "incoming");
  const message = join(incoming, "20261103T100000Z-alice.md");
  for (const { name, change, how } of [
    {
      name: "created with its directory",
      change: () => {
        mkdirSync(incoming);
        writeFileSync(message, "A message.\n");
      },
      how: "created",
    },
    {
      name: "edited",
      change: () => writeFileSync(message, "A longer message.\n"),
      how: "changed",
    },
    {
      name: "removed",
      change: () => unlinkSync(message),
      how: "removed",
    },
  ]) {
    output.stdout = "";
    const code = await main([...durations, `dir:${incoming}`], {
      ...output.streams,
      connect: unreachable,
      pause: async () => change(),
    });
    assert.equal(code, 0, name);
    assert.equal(
      output.stdout,
      `dir:${incoming}: file 20261103T100000Z-alice.md ${how}\n`,
      name,
    );
  }
});

// Runs git with a fixed identity and no user or system configuration.
const git = (cwd, ...args) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Sender",
      GIT_AUTHOR_EMAIL: "sender@example.com",
      GIT_COMMITTER_NAME: "Sender",
      GIT_COMMITTER_EMAIL: "sender@example.com",
    },
  }).trim();

// A bare upstream, the orchestrator's workbench clone and a sender's clone.
function workbenches(t) {
  const root = mkdtempSync(join(tmpdir(), "orchestrate-wait-git-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const upstream = join(root, "upstream.git");
  const workbench = join(root, "workbench");
  const sender = join(root, "sender");
  git(root, "init", "--quiet", "--bare", "--initial-branch=main", upstream);
  git(root, "clone", "--quiet", upstream, workbench);
  writeFileSync(join(workbench, "now.md"), "# Now\n");
  git(workbench, "add", "now.md");
  git(workbench, "commit", "--quiet", "--message", "Seed the workbench");
  git(workbench, "push", "--quiet", "--set-upstream", "origin", "main");
  git(root, "clone", "--quiet", upstream, sender);
  return { upstream, workbench, sender };
}

// Commits a sender's file and pushes it, returning the commit.
function push(sender, path, text) {
  mkdirSync(join(sender, path, ".."), { recursive: true });
  writeFileSync(join(sender, path), text);
  git(sender, "add", path);
  git(sender, "commit", "--quiet", "--message", `Write ${path}`);
  git(sender, "push", "--quiet", "origin", "main");
  return git(sender, "rev-parse", "HEAD");
}

test("an upstream commit under a directory item wakes the wait, and other commits do not", async (t) => {
  const output = capture();
  const { workbench, sender } = workbenches(t);
  const incoming = join(workbench, "incoming");
  let pauses = 0;
  let message;
  const code = await main([...durations, `dir:${incoming}`], {
    ...output.streams,
    connect: unreachable,
    pause: async () => {
      pauses += 1;
      if (pauses === 1) push(sender, "wishes.md", "- A wish.\n");
      if (pauses === 2)
        message = push(sender, "incoming/20261103T100000Z-bob.md", "Hi.\n");
    },
  });
  assert.equal(code, 0, output.stderr);
  assert.equal(pauses, 2);
  assert.equal(
    output.stdout,
    `dir:${incoming}: upstream commit ${message} not yet pulled\n`,
  );
  // The wait fetches but never merges into the workbench checkout.
  assert.throws(() => readFileSync(join(incoming, "20261103T100000Z-bob.md")));
});

test("an upstream message fetched but not pulled before arming wakes the wait, and pulling it is the only change", async (t) => {
  const output = capture();
  const { workbench, sender } = workbenches(t);
  const incoming = join(workbench, "incoming");
  const earlier = push(sender, "incoming/20261103T090000Z-bob.md", "Hi.\n");
  git(workbench, "fetch", "--quiet", "origin");
  const code = await main([...durations, `dir:${incoming}`], {
    ...output.streams,
    connect: unreachable,
  });
  assert.equal(code, 0, output.stderr);
  assert.equal(
    output.stdout,
    `dir:${incoming}: upstream commit ${earlier} not yet pulled\n`,
  );

  // Pulling brings the messages' files into the checkout, the only change.
  output.stdout = "";
  push(sender, "incoming/20261103T093000Z-bob.md", "Later.\n");
  const pulled = await main([...durations, `dir:${incoming}`], {
    ...output.streams,
    connect: unreachable,
    pause: async () => git(workbench, "pull", "--quiet", "--ff-only"),
  });
  assert.equal(pulled, 0, output.stderr);
  assert.deepEqual(output.stdout.trimEnd().split("\n"), [
    `dir:${incoming}: file 20261103T090000Z-bob.md created`,
    `dir:${incoming}: file 20261103T093000Z-bob.md created`,
  ]);
});

test("an upstream commit only below a directory item's own files does not wake the wait", async (t) => {
  const output = capture();
  const { workbench, sender } = workbenches(t);
  let pauses = 0;
  const code = await main(
    [
      "--interval",
      "0.02",
      "--max-duration",
      "0.3",
      `dir:${join(workbench, "incoming")}`,
    ],
    {
      ...output.streams,
      connect: unreachable,
      pause: async (milliseconds) => {
        pauses += 1;
        if (pauses === 1)
          push(sender, "incoming/archive/20261103T090000Z-bob.md", "Old.\n");
        await new Promise((resolve) => setTimeout(resolve, milliseconds));
      },
    },
  );
  assert.equal(code, 0, output.stdout + output.stderr);
});

test("a workbench without a remote watches only its own directory", async (t) => {
  const output = capture();
  const workbench = mkdtempSync(join(tmpdir(), "orchestrate-wait-local-"));
  t.after(() => rmSync(workbench, { recursive: true, force: true }));
  git(workbench, "init", "--quiet", "--initial-branch=main");
  writeFileSync(join(workbench, "now.md"), "# Now\n");
  git(workbench, "add", "now.md");
  git(workbench, "commit", "--quiet", "--message", "Seed the workbench");
  const incoming = join(workbench, "incoming");
  let pauses = 0;
  const code = await main([...durations, `dir:${incoming}`], {
    ...output.streams,
    connect: unreachable,
    pause: async () => {
      pauses += 1;
      if (pauses === 2) {
        mkdirSync(incoming);
        writeFileSync(join(incoming, "20261103T100000Z-carol.md"), "Hi.\n");
      }
    },
  });
  assert.equal(code, 0, output.stderr);
  assert.equal(pauses, 2);
  assert.equal(
    output.stdout,
    `dir:${incoming}: file 20261103T100000Z-carol.md created\n`,
  );
});

test("a failed upstream fetch while polling is an error", async (t) => {
  const output = capture();
  const { upstream, workbench } = workbenches(t);
  const code = await main(
    [...durations, `dir:${join(workbench, "incoming")}`],
    {
      ...output.streams,
      connect: unreachable,
      pause: async () => rmSync(upstream, { recursive: true, force: true }),
    },
  );
  assert.equal(code, 1);
  assert.match(output.stderr, /^wait\.mjs: git fetch origin failed/);
  assert.equal(output.stdout, "");
});

test("the maximum duration ends an unchanged wait with exit zero", async () => {
  const output = capture();
  const { connect } = tracker({ "example/tracker#7": { comments: [] } });
  const startedAt = Date.now();
  const code = await main(
    ["--interval", "0.02", "--max-duration", "0.1", "example/tracker#7"],
    { connect, ...output.streams },
  );
  assert.equal(code, 0);
  assert.ok(Date.now() - startedAt >= 100);
  assert.equal(
    output.stdout,
    "no item changed within the maximum duration of 0.1 seconds; arm the wait again\n",
  );
});

test("a platform failure at arming or while polling is an error", async () => {
  const output = capture();
  for (const failAt of [1, 2]) {
    output.stderr = "";
    const items = { "example/tracker#7": { comments: [] } };
    if (failAt === 1) items.fail = true;
    const { connect } = tracker(items);
    const code = await main([...durations, "example/tracker#7"], {
      ...output.streams,
      connect,
      pause: async () => (items.fail = true),
    });
    assert.equal(code, 1, `read ${failAt}`);
    assert.match(output.stderr, /^wait\.mjs: /, `read ${failAt}`);
  }
  output.stderr = "";
  const code = await main([...durations, "example/missing#1"], {
    connect: tracker({}).connect,
    ...output.streams,
  });
  assert.equal(code, 1);
  assert.match(output.stderr, /^wait\.mjs: /);
  assert.equal(output.stdout, "");
});

test("the installed script runs with plain node and reports each exit", () => {
  const workbench = mkdtempSync(join(tmpdir(), "orchestrate-wait-cli-"));
  try {
    const run = (...args) =>
      spawnSync(process.execPath, [script, ...args], {
        cwd: workbench,
        encoding: "utf8",
        timeout: 30_000,
      });
    const usage = run("file:now.md");
    assert.equal(usage.status, 1);
    assert.match(usage.stderr, /--interval is required/);

    const timeout = run(
      "--interval",
      "0.05",
      "--max-duration",
      "0.2",
      "file:now.md",
    );
    writeFileSync(join(workbench, "now.md"), recordText());
    const status = run("--status", "--from", "now.md");
    assert.equal(status.status, 0, status.stderr);
    assert.equal(status.stdout.trimEnd().split("\n").length, 2);
    assert.equal(timeout.status, 0, timeout.stderr);
    assert.match(
      timeout.stdout,
      /^no item changed within the maximum duration/,
    );
  } finally {
    rmSync(workbench, { recursive: true, force: true });
  }
});

const expectedItem = (item, expected) => JSON.stringify({ item, expected });
const runCheck = (id = 1, status = "in_progress", conclusion = null) => ({
  id,
  name: "Test",
  status,
  conclusion,
});

test("caller observations compare labels before the first pause, independent of order", async () => {
  for (const { labels, expected, pattern } of [
    {
      labels: ["new"],
      expected: ["old"],
      pattern: /labels added new; removed old/,
    },
    { labels: ["b", "a"], expected: ["a", "b"], pattern: /no item changed/ },
  ]) {
    const output = capture();
    let paused = false;
    let elapsed = 0;
    const code = await main(
      [
        "--interval",
        "0.01",
        "--max-duration",
        "0.03",
        expectedItem("example/tracker#7", { labels: expected }),
      ],
      {
        ...output.streams,
        connect: tracker({ "example/tracker#7": { labels } }).connect,
        now: () => elapsed,
        pause: async (ms) => {
          paused = true;
          elapsed += ms;
        },
      },
    );
    assert.equal(code, 0, output.stderr);
    assert.match(output.stdout, pattern);
    assert.equal(paused, labels.includes("a"));
  }
});

test("PR pre-arm head and raw check/status sets compare without success policy", async () => {
  const head = "a".repeat(40);
  const checks = {
    runs: [runCheck()],
    statuses: [{ id: 2, context: "deploy", state: "pending" }],
  };
  const cases = [
    { expected: { labels: ["old"] }, pattern: /labels removed old/ },
    { expected: { head: "b".repeat(40) }, pattern: /head changed/ },
    {
      expected: { head, checks: { ...checks, runs: [] } },
      pattern: /checks changed/,
    },
    {
      expected: {
        head,
        checks: { ...checks, runs: [runCheck(1, "completed", "failure")] },
      },
      pattern: /checks changed/,
    },
    {
      expected: { head, checks: { ...checks, statuses: [] } },
      pattern: /checks changed/,
    },
    {
      expected: {
        head,
        checks: {
          ...checks,
          statuses: [{ id: 2, context: "deploy", state: "success" }],
        },
      },
      pattern: /checks changed/,
    },
  ];
  for (const { expected, pattern } of cases) {
    const output = capture();
    assert.equal(
      await main([...durations, expectedItem("example/tracker#12", expected)], {
        ...output.streams,
        connect: tracker({
          "example/tracker#12": { pull: true, head, ...checks },
        }).connect,
        pause: unreachable,
      }),
      0,
      output.stderr,
    );
    assert.match(output.stdout, pattern);
  }
  const output = capture();
  let pauses = 0;
  const item = {
    pull: true,
    head,
    runs: [runCheck(2), runCheck(1)],
    statuses: [],
  };
  assert.equal(
    await main(
      [
        ...durations,
        expectedItem("example/tracker#12", {
          head,
          checks: { runs: [...item.runs].reverse(), statuses: [] },
        }),
      ],
      {
        ...output.streams,
        connect: tracker({ "example/tracker#12": item }).connect,
        pause: async () => {
          if (++pauses === 2) item.runs.pop();
        },
      },
    ),
    0,
    output.stderr,
  );
  assert.equal(pauses, 2);
  assert.match(output.stdout, /checks changed/);
});

test("launch watches ignore progress, creation and removal until the exact final line", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "orchestrate-launch-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const report = join(root, "report.md");
  for (const ending of ["status: done", "status: done\n", "status: done\r\n"]) {
    rmSync(report, { force: true });
    const output = capture();
    let pauses = 0;
    assert.equal(
      await main([...durations, `launch:${report}`], {
        ...output.streams,
        connect: unreachable,
        pause: async () => {
          pauses++;
          if (pauses === 1) writeFileSync(report, "progress\n");
          if (pauses === 2)
            writeFileSync(report, "status: done\nlater content\n");
          if (pauses === 3) unlinkSync(report);
          if (pauses === 4) writeFileSync(report, "status: done\n\n");
          if (pauses === 5)
            writeFileSync(report, `Owner steps remain.\n${ending}`);
        },
      }),
      0,
      output.stderr,
    );
    assert.equal(pauses, 5);
    assert.equal(output.stdout, `finished: read ${report}\n`);
    output.stdout = "";
    assert.equal(
      await main([...durations, `launch:${report}`], {
        ...output.streams,
        connect: unreachable,
        pause: unreachable,
      }),
      0,
    );
    assert.equal(output.stdout, `finished: read ${report}\n`);
  }
});

const recordText = ({ flight = [], launches = [], owner = [] } = {}) => `# Now

## Waiting on you

${owner.length} open decisions in inbox.

| Item | Decision/owner action | Since (UTC) | Next check |
| ---- | --------------------- | ----------- | ---------- |
${owner.join("\n")}

## In flight

| Item | Waiting on | Since (UTC) | Next check | Evidence | Watches |
| ---- | ---------- | ----------- | ---------- | -------- | ------- |
${flight.join("\n")}

## Running launches

| Host | Kind | Session | Started (UTC) | Item | Report | Next check |
| ---- | ---- | ------- | ------------- | ---- | ------ | ---------- |
${launches.join("\n")}
`;
const flightRow = (code, watches, waiting = "factory: CI") =>
  `| [${code}](plan.md#${code.toLowerCase()}) | ${waiting} | 2026-11-08T18:00Z | check event | evidence | \`${JSON.stringify(watches)}\` |`;
const launchRow = (code, report, kind = "worker") =>
  `| host | ${kind} | opaque/session | 2026-11-08T18:${code === "D" ? "15" : "05"}Z | [${code}](plan.md#${code.toLowerCase()}) | \`${report}\` | launch marker |`;
const ownerRow = (
  code,
  action = "approve access",
  time = "10",
  next = "owner reply",
) =>
  `| [${code}](plan.md#${code.toLowerCase()}) | [${action}](inbox.md#${code.toLowerCase()}) | 2026-11-08T18:${time}Z | ${next} |`;
function records(t, text = recordText()) {
  const root = mkdtempSync(join(tmpdir(), "orchestrate-records-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = join(root, "now.md");
  writeFileSync(path, text);
  return {
    root,
    path,
    write: (value) => writeFileSync(path, recordText(value)),
  };
}

test("status includes the supplied Scriptorium budget without platform reads or invented availability", async (t) => {
  const { root, path } = records(t);
  const observation = {
    state: "last-observed",
    source: "status.json",
    at: "2026-11-10T10:00:00Z",
  };
  const budget = {
    version: 1,
    observedAt: "2026-11-10T10:01:00Z",
    models: {
      effort: "high",
      defaults: {
        default: { provider: "codex", model: "model-a", effort: "high" },
      },
      catalog: [
        {
          identity: "codex/model-a",
          guidance: "Policy edits",
          effectiveEffort: "high",
        },
      ],
    },
    capacity: {
      counting: "non-ended-runs",
      observation,
      host: {
        runKinds: { implement: 1, triage: 0, review: 0 },
        implement: { limit: 2, running: 1, free: 1 },
      },
      repositories: [],
    },
    providers: [
      {
        provider: "codex",
        cap: 3,
        running: 1,
        free: 2,
        claimsHeld: true,
        ownerHold: { at: "2026-11-10T09:00:00Z" },
        usageHold: null,
        launchPermission: "not-established",
        observations: {
          work: observation,
          owner: observation,
          usage: {
            state: "unavailable",
            source: "usage.json",
            at: null,
            problem: "missing record",
          },
        },
      },
    ],
    futureField: { retained: true },
  };
  const budgetPath = join(root, "budget.json");
  const input = JSON.stringify(budget);
  writeFileSync(budgetPath, input);
  const output = capture();
  assert.equal(
    await main(["--status", "--from", path, "--budget", budgetPath], {
      ...output.streams,
      connect: unreachable,
      pause: unreachable,
    }),
    0,
    output.stderr,
  );
  assert.ok(
    output.stdout.startsWith(
      "| Item | Running | Waiting on owner | Since (UTC) | Next check |\n",
    ),
  );
  const rendered = /```json\n([\s\S]+?)\n```/.exec(output.stdout);
  assert.ok(rendered, output.stdout);
  assert.deepEqual(JSON.parse(rendered[1]), budget);
  assert.match(output.stdout, /not a launch grant or reservation/);
  assert.equal(readFileSync(budgetPath, "utf8"), input);
  const cli = spawnSync(
    process.execPath,
    [script, "--status", "--from", "now.md", "--budget", "budget.json"],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 30_000,
    },
  );
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(cli.stdout, output.stdout);
});

test("budget input errors name the file and never print a partial status or change wait modes", async (t) => {
  const { root, path } = records(t);
  const budgetPath = join(root, "budget.json");
  for (const input of [
    null,
    "{",
    "null",
    '{"version":2}',
    '{"version":1,"observedAt":"bad"}',
  ]) {
    if (input !== null) writeFileSync(budgetPath, input);
    const output = capture();
    assert.equal(
      await main(["--status", "--from", path, "--budget", budgetPath], {
        ...output.streams,
        connect: unreachable,
        pause: unreachable,
      }),
      1,
    );
    assert.ok(output.stderr.includes(budgetPath), output.stderr);
    assert.equal(output.stdout, "");
  }
  for (const args of [
    [...durations, "--from", path, "--budget", budgetPath],
    ["--status", "--from", path, "--budget"],
    [
      "--status",
      "--from",
      path,
      "--budget",
      budgetPath,
      "--budget",
      budgetPath,
    ],
  ]) {
    const output = capture();
    assert.equal(
      await main(args, {
        ...output.streams,
        connect: unreachable,
        pause: unreachable,
      }),
      1,
    );
    assert.match(output.stderr, /--budget/);
    assert.equal(output.stdout, "");
  }
});

test("arrivals leave watches unchanged while queued and open grills show distinct waits", async (t) => {
  const { path } = records(
    t,
    recordText({
      flight: [
        flightRow(
          "queued",
          [{ event: "open grill completion" }],
          "orchestrator: grill queue",
        ),
      ],
      launches: [launchRow("open", "grill.md", "grill")],
      owner: [
        ownerRow(
          "open",
          "answer grill",
          "10",
          "owner answers, at your pace",
        ).replace("inbox.md#open", "grill.md#questions"),
      ],
    }) +
      "\n## Arrived since last update\n\n- [request](https://github.com/example/tracker/issues/7) — reporter — waiting for the owner's word\n",
  );
  const watches = readRecords(path).watches;
  assert.equal(watches.length, 2); // open grill report and incoming
  const output = capture();
  assert.equal(
    await main(["--status", "--from", path], {
      ...output.streams,
      connect: unreachable,
      pause: unreachable,
    }),
    0,
    output.stderr,
  );
  assert.ok(
    output.stdout.includes(
      "| [queued](plan.md#queued) | your move: grill queue | — |",
    ),
  );
  assert.ok(
    output.stdout.includes(
      "| [open](plan.md#open) | — | [answer grill](grill.md#questions) | 2026-11-08T18:10Z | owner answers, at your pace |",
    ),
  );
});

test("status renders the fixed records-only table, pending reports and consumed owner outcome", async (t) => {
  const { root, path, write } = records(t);
  const rows = {
    flight: [
      flightRow("R", [
        {
          item: "example/tracker#12",
          expected: {
            labels: [],
            head: "a".repeat(40),
            checks: { runs: [], statuses: [] },
          },
        },
      ]),
      flightRow("Y", [{ event: "next action" }], "orchestrator: dispatch"),
      flightRow("O", [{ owner: true }], "orchestrator"),
      flightRow("D", [{ event: "read report" }], "orchestrator: reconcile"),
      flightRow("Z", [{ event: "next action" }], "orchestrator"),
    ],
    launches: [
      launchRow("L", "reports/l.md"),
      launchRow("D", "reports/d.md", "grill"),
    ],
    owner: [ownerRow("O")],
  };
  mkdirSync(join(root, "reports"));
  writeFileSync(join(root, "reports/d.md"), "Owner steps.\nstatus: done\n");
  write(rows);
  const output = capture();
  assert.equal(
    await main(["--status", "--from", path], {
      ...output.streams,
      connect: unreachable,
      pause: unreachable,
    }),
    0,
    output.stderr,
  );
  const lines = output.stdout.trimEnd().split("\n");
  assert.equal(
    lines[0],
    "| Item | Running | Waiting on owner | Since (UTC) | Next check |",
  );
  assert.deepEqual(lines.slice(2), [
    "| [Y](plan.md#y) | your move: dispatch | — | 2026-11-08T18:00Z | check event |",
    "| [O](plan.md#o) | — | [approve access](inbox.md#o) | 2026-11-08T18:10Z | owner reply |",
    "| [D](plan.md#d) | turn ended; read report | — | 2026-11-08T18:15Z | read [reports/d.md](reports/d.md) |",
    "| [Z](plan.md#z) | your move | — | 2026-11-08T18:00Z | check event |",
    "| [R](plan.md#r) | factory: CI | — | 2026-11-08T18:00Z | check event |",
    "| [L](plan.md#l) | worker | — | 2026-11-08T18:05Z | launch marker |",
  ]);
  rows.launches.pop();
  rows.owner.push(ownerRow("D", "run step", "20", "owner output"));
  write(rows);
  output.stdout = "";
  await main(["--status", "--from", path], {
    ...output.streams,
    connect: unreachable,
  });
  assert.match(
    output.stdout,
    /\| \[D\]\(plan.md#d\) \| — \| \[run step\]\(inbox.md#d\) \| 2026-11-08T18:20Z \| owner output \|/,
  );
  write({});
  output.stdout = "";
  await main(["--status", "--from", path], {
    ...output.streams,
    connect: unreachable,
  });
  assert.equal(output.stdout.trimEnd().split("\n").length, 2);
});

test("live reload removes watches, preserves unrelated baselines and inspects completed additions", async (t) => {
  const { root, path, write } = records(t);
  write({
    flight: [
      flightRow("R", [{ item: "file:keep.md" }, { item: "file:remove.md" }]),
    ],
  });
  const output = capture();
  let pauses = 0;
  assert.equal(
    await main([...durations, "--from", path], {
      ...output.streams,
      connect: unreachable,
      pause: async () => {
        pauses++;
        if (pauses === 1) {
          write({
            flight: [
              flightRow("R", [{ item: "file:keep.md" }], "third party: CI"),
            ],
          });
          writeFileSync(
            join(root, "remove.md"),
            "removed watch must stay quiet",
          );
        }
        if (pauses === 2) {
          writeFileSync(join(root, "done.md"), "status: done\n");
          write({
            flight: [flightRow("R", [{ item: "file:keep.md" }], "launch")],
            launches: [launchRow("L", "done.md")],
          });
        }
      },
    }),
    0,
    output.stderr,
  );
  assert.equal(pauses, 2);
  assert.equal(output.stdout, "finished: read done.md\n");
  output.stdout = "";
  write({ flight: [flightRow("R", [{ item: "file:keep.md" }])] });
  assert.equal(
    await main([...durations, "--from", path], {
      ...output.streams,
      connect: unreachable,
      pause: async () => {
        write({
          flight: [
            flightRow("R", [{ item: "file:keep.md" }], "date: 2026-11-12"),
          ],
        });
        writeFileSync(
          join(root, "keep.md"),
          "must retain baseline across rewrite",
        );
      },
    }),
    0,
    output.stderr,
  );
  assert.match(output.stdout, /file:keep.md: created/);
});

test("records without expected links still observe subsequent link removal", async (t) => {
  const { path, write } = records(t);
  write({
    flight: [
      flightRow("R", [
        { item: "example/tracker#7", expected: { labels: ["ready"] } },
      ]),
    ],
  });
  const output = capture();
  const item = { labels: ["ready"], linked: [pull(11, "OPEN")] };
  let elapsed = 0;
  let pauses = 0;
  assert.equal(
    await main(["--interval", "1", "--max-duration", "3", "--from", path], {
      ...output.streams,
      connect: tracker({ "example/tracker#7": item }).connect,
      now: () => elapsed,
      pause: async (ms) => {
        elapsed += ms;
        pauses++;
        item.linked = [];
      },
    }),
    0,
    output.stderr,
  );
  assert.equal(pauses, 1);
  assert.equal(
    output.stdout,
    "example/tracker#7: linked pull request https://github.com/example/tracker/pull/11 removed\n",
  );
  assert.equal(output.stderr, "");
});

test("reload compares changed expectations without resetting unchanged trackers", async (t) => {
  const { path, write } = records(t);
  const watch = (labels) => ({
    item: "example/tracker#7",
    expected: { labels },
  });
  write({ flight: [flightRow("R", [watch(["ready"])])] });
  const output = capture();
  let pauses = 0;
  assert.equal(
    await main([...durations, "--from", path], {
      ...output.streams,
      connect: tracker({ "example/tracker#7": { labels: ["ready"] } }).connect,
      pause: async () => {
        pauses++;
        write({ flight: [flightRow("R", [watch(["old"])])] });
      },
    }),
    0,
    output.stderr,
  );
  assert.equal(pauses, 1);
  assert.match(output.stdout, /labels added ready; removed old/);
});

test("invalid records fail by name; empty records still watch incoming", async (t) => {
  const { root, path, write } = records(t);
  const output = capture();
  for (const text of [
    "# no tables\n",
    ...[
      "CI",
      "orchestrating agent: queue",
      "orchestratorish",
      "owner:",
      "third party",
      "date: ",
    ].map((waiting) =>
      recordText({
        flight: [flightRow("invalid-wait", [{ event: "wake" }], waiting)],
      }),
    ),
    recordText({ flight: [flightRow("R", [])] }),
    recordText({ flight: [flightRow("R", [{ item: "example/tracker#7" }])] }),
    recordText({
      flight: [
        flightRow("R", [
          { item: "example/tracker#7", expected: { labels: [] } },
          {
            item: "https://github.com/example/tracker/issues/7",
            expected: { labels: ["conflict"] },
          },
        ]),
      ],
    }),
    recordText({ launches: [launchRow("L", "")] }),
    recordText({
      launches: [launchRow("L", "report.md").replace("2026-11-08T18:05Z", "")],
    }),
    recordText({ owner: [ownerRow("O").replace("[O](plan.md#o)", "O")] }),
  ]) {
    writeFileSync(path, text);
    output.stderr = "";
    assert.equal(
      await main(["--status", "--from", path], {
        ...output.streams,
        connect: unreachable,
      }),
      1,
      text,
    );
    assert.match(output.stderr, /now\.md/);
    if (text.includes("invalid-wait"))
      assert.match(output.stderr, /In flight.*invalid-wait.*Waiting on/);
  }
  unlinkSync(path);
  assert.equal(
    await main(["--status", "--from", path], {
      ...output.streams,
      connect: unreachable,
    }),
    1,
  );
  write({});
  output.stdout = "";
  assert.equal(
    await main([...durations, "--from", path], {
      ...output.streams,
      connect: unreachable,
      pause: async () => {
        mkdirSync(join(root, "incoming"));
        writeFileSync(join(root, "incoming/message.md"), "hello");
      },
    }),
    0,
    output.stderr,
  );
  assert.match(output.stdout, /message.md created/);
});

test("joined identities keep all canonical watches while status retains launch timing", async (t) => {
  const { root, path, write } = records(t);
  const watch = { item: "Example/Tracker#7", expected: { labels: ["b", "a"] } };
  write({
    flight: [
      flightRow("L", [
        watch,
        {
          item: "https://github.com/example/tracker/issues/7",
          expected: { labels: ["a", "b"] },
        },
        { item: "file:note.md" },
        { item: "file:./note.md" },
        { event: "session stopped" },
      ]),
    ],
    launches: [launchRow("L", "report.md")],
  });
  const parsed = readRecords(path);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.watches.length, 4); // tracker, file, launch and incoming
  const output = capture();
  assert.equal(
    await main(["--status", "--from", path], {
      ...output.streams,
      connect: unreachable,
    }),
    0,
    output.stderr,
  );
  assert.equal(
    output.stdout.trimEnd().split("\n").at(-1),
    "| [L](plan.md#l) | factory: CI | — | 2026-11-08T18:05Z | launch marker |",
  );
  write({
    flight: [flightRow("L", [{ owner: true }], "owner")],
    launches: [launchRow("L", "report.md")],
    owner: [ownerRow("L")],
  });
  writeFileSync(join(root, "report.md"), "status: done\n");
  output.stdout = "";
  await main(["--status", "--from", path], {
    ...output.streams,
    connect: unreachable,
  });
  assert.match(
    output.stdout,
    /turn ended; read report \| — \| 2026-11-08T18:05Z/,
  );
});

test("unrelated reload and changed expectations preserve other tracker observations", async (t) => {
  const { path, write } = records(t);
  const watch = (number, labels) => ({
    item: `example/tracker#${number}`,
    expected: { labels },
  });
  write({
    flight: [flightRow("R", [watch(7, ["ready"]), watch(8, ["ready"])])],
  });
  const item = { labels: ["ready"], comments: [] };
  const output = capture();
  assert.equal(
    await main([...durations, "--from", path], {
      ...output.streams,
      connect: tracker({
        "example/tracker#7": { labels: ["ready"] },
        "example/tracker#8": item,
      }).connect,
      pause: async () => {
        write({
          flight: [flightRow("R", [watch(7, []), watch(8, ["ready"])])],
        });
        item.comments.push(comment(4));
      },
    }),
    0,
    output.stderr,
  );
  assert.match(output.stdout, /labels added ready/);
  // Both simultaneous events must survive the reload/recomparison.
  assert.match(output.stdout, /new comment/);
});

test("reloads do not restart the overall deadline and invalid reloads never retain stale coverage", async (t) => {
  const { path, write } = records(t);
  write({ flight: [flightRow("R", [{ event: "worker stopped" }])] });
  let elapsed = 0;
  let pauses = 0;
  const output = capture();
  assert.equal(
    await main(["--interval", "1", "--max-duration", "3", "--from", path], {
      ...output.streams,
      connect: unreachable,
      now: () => elapsed,
      pause: async (ms) => {
        elapsed += ms;
        pauses++;
        write({
          flight: [flightRow("R", [{ event: `worker stopped ${pauses}` }])],
        });
      },
    }),
    0,
    output.stderr,
  );
  assert.equal(pauses, 3);
  assert.match(output.stdout, /maximum duration of 3 seconds/);
  output.stdout = "";
  assert.equal(
    await main([...durations, "--from", path], {
      ...output.streams,
      connect: unreachable,
      pause: async () => writeFileSync(path, "# broken records\n"),
    }),
    1,
  );
  assert.match(output.stderr, /now.md.*table/);
  assert.equal(output.stdout, "");
});

test("expected observations reject checks without their head and malformed raw states", async () => {
  for (const expected of [
    { checks: { runs: [], statuses: [] } },
    { labels: "ready" },
    { head: "short" },
    {
      head: "a".repeat(40),
      checks: {
        runs: [{ name: "Test", status: "queued", conclusion: null }],
        statuses: [],
      },
    },
    {
      head: "a".repeat(40),
      checks: { runs: [], statuses: [{ id: 1, context: "deploy" }] },
    },
  ]) {
    const output = capture();
    assert.equal(
      await main([...durations, expectedItem("example/tracker#7", expected)], {
        ...output.streams,
        connect: unreachable,
      }),
      1,
    );
    assert.notEqual(output.stderr, "");
  }
});
