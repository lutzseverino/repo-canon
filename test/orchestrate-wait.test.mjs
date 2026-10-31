import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
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

test("items are required and must be issue, pull request or file references", async () => {
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
      change: (item) => (item.labels = ["ready-for-agent", "factory:running"]),
      line: "example/tracker#7: labels added factory:running; removed needs-triage",
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
        labels: ["ready-for-agent", "needs-triage"],
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
      pause: async () => (items["example/other#3"].labels = ["needs-info"]),
    },
  );
  assert.equal(code, 0);
  assert.equal(output.stdout, "example/other#3: labels added needs-info\n");
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

test("the maximum duration ends an unchanged wait with its own exit code", async () => {
  const output = capture();
  const { connect } = tracker({ "example/tracker#7": { comments: [] } });
  const startedAt = Date.now();
  const code = await main(
    ["--interval", "0.02", "--max-duration", "0.1", "example/tracker#7"],
    { connect, ...output.streams },
  );
  assert.equal(code, 2);
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
    assert.equal(timeout.status, 2, timeout.stderr);
    assert.match(
      timeout.stdout,
      /^no item changed within the maximum duration/,
    );
  } finally {
    rmSync(workbench, { recursive: true, force: true });
  }
});
