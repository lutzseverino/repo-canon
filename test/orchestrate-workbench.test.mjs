import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { connect } from "../vendor/postern/postern.mjs";
import { main } from "../.agents/skills/orchestrate/workbench.mjs";

const script = fileURLToPath(
  new URL("../.agents/skills/orchestrate/workbench.mjs", import.meta.url),
);

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
      updated_at: item.updatedAt ?? "2026-11-19T00:00:00Z",
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

// Collects the command's lines; `main` writes to the streams it is given.
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

const unreachable = () => assert.fail("the command reached the tracker");

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

const issue = (number, repository = "example/tracker") =>
  `https://github.com/${repository}/issues/${number}`;
const row = (code, links, state = "filed") =>
  `| ${code} | tracker | ${links} | ${state} |`;
const planText = ({ done = ["The guide is reviewed."], rows = [] } = {}) =>
  `# Review

**Goal:** review the guide.
**Done means:**

${done.map((clause, index) => `${index + 1}. ${clause}`).join("\n")}

**Close reviews:** retro

## Tickets

| Item | Repository | Issue | State |
| ---- | ---------- | ----- | ----- |
${rows.join("\n")}

## Current state

Reviewing.
`;
const emptyInbox = "# Inbox\n\n## Open\n\n## Answered\n";
const indexText = (plans, orchestrator = "thread-a") =>
  `# Workbench\n\nOrchestrator: ${orchestrator}\n\n## Repositories\n\n- example/tracker\n\n## Active\n\n${plans.map((name) => `- \`${name}/\`: a goal`).join("\n")}\n\n## Closed\n`;

// A workbench Git checkout holding the given plans' records.
/**
 * @param {import("node:test").TestContext} t
 * @param {{ plans?: Record<string, string>, root?: string }} [options]
 */
function workbench(t, { plans = { review: planText() }, root } = {}) {
  if (!root) {
    root = mkdtempSync(join(tmpdir(), "orchestrate-workbench-"));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    git(root, "init", "--quiet", "--initial-branch=main");
  }
  const write = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  write("index.md", indexText(Object.keys(plans)));
  write("inbox.md", emptyInbox);
  for (const [name, text] of Object.entries(plans)) {
    write(`${name}/plan.md`, text);
    write(`${name}/log.md`, "# Log\n");
  }
  return { root, write, path: (path) => join(root, path) };
}

// A workbench watching the given issue links on one row.
const watching = (t, links) =>
  workbench(t, {
    plans: { review: planText({ rows: [row("check", links)] }) },
  });

const waitArgs = (root, interval = "0.01", maxDuration = "5") => [
  "wait",
  root,
  "--interval",
  interval,
  "--max-duration",
  maxDuration,
];

test("both wait durations and the status stale threshold are required, with no built-in default", async (t) => {
  const { root } = workbench(t);
  const output = capture();
  for (const { flag, args } of [
    { flag: "--interval", args: ["wait", root, "--max-duration", "60"] },
    { flag: "--max-duration", args: ["wait", root, "--interval", "60"] },
    { flag: "--stale-after", args: ["status", root] },
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
    await main(["wait", root], { connect: unreachable, ...output.streams }),
    1,
  );
  assert.match(output.stderr, /--interval is required/);
  assert.match(output.stderr, /--max-duration is required/);
  for (const args of [
    [],
    ["next", root],
    ["wait", "--interval", "1", "--max-duration", "1"],
  ]) {
    output.stderr = "";
    assert.equal(
      await main(args, { connect: unreachable, ...output.streams }),
      1,
    );
    assert.match(output.stderr, /usage: workbench\.mjs/);
  }
  assert.equal(output.stdout, "");
});

test("invalid durations and options fail before reading any record", async () => {
  const output = capture();
  const missing = join(tmpdir(), "no-such-workbench");
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
        await main(["wait", missing, flag, value, other, "60"], {
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
      await main(["wait", missing, other, "60", flag], {
        connect: unreachable,
        ...output.streams,
      }),
      1,
    );
    assert.match(output.stderr, new RegExp(`${flag} needs a value`));
    output.stderr = "";
    assert.equal(
      await main(["wait", missing, flag, "1", flag, "2", other, "60"], {
        connect: unreachable,
        ...output.streams,
      }),
      1,
    );
    assert.match(output.stderr, new RegExp(`${flag} is given more than once`));
  }
  for (const args of [
    ["wait", missing, "--interval", "1", "--max-duration", "1", "--budget"],
    ["status", missing, "--stale-after", "1", "--interval", "1"],
    ["status", missing, "other", "--stale-after", "1"],
  ]) {
    output.stderr = "";
    assert.equal(
      await main(args, { connect: unreachable, ...output.streams }),
      1,
    );
    assert.match(output.stderr, /unrecognized option|unexpected argument/);
  }
  assert.equal(output.stdout, "");
});

test("a row issue's state, labels, comments and linked pull requests each wake the wait", async (t) => {
  const output = capture();
  for (const { name, change, line } of [
    {
      name: "state",
      change: (item) => (item.state = "closed"),
      line: "state changed from open to closed",
    },
    {
      name: "labels",
      change: (item) => (item.labels = ["state:ready", "factory:running"]),
      line: "labels added factory:running; removed state:triage",
    },
    {
      name: "comments",
      change: (item) => item.comments.push(comment(2)),
      line: "new comment https://github.com/example/tracker/issues/7#issuecomment-2",
    },
    {
      name: "linked pull request",
      change: (item) => item.linked.push(pull(12, "OPEN")),
      line: "linked pull request https://github.com/example/tracker/pull/12 (open)",
    },
    {
      name: "linked pull request state",
      change: (item) => (item.linked[0].state = "MERGED"),
      line: "linked pull request https://github.com/example/tracker/pull/11 changed from open to merged",
    },
  ]) {
    output.stdout = "";
    const { root } = watching(t, `[#7](${issue(7)})`);
    const items = {
      "example/tracker#7": {
        labels: ["state:ready", "state:triage"],
        comments: [comment(1)],
        linked: [pull(11, "OPEN")],
      },
    };
    let pauses = 0;
    const code = await main(waitArgs(root), {
      ...output.streams,
      connect: tracker(items).connect,
      pause: async () => {
        pauses += 1;
        if (pauses === 2) change(items["example/tracker#7"]);
      },
    });
    assert.equal(code, 0, name + output.stderr);
    assert.equal(output.stdout, `${issue(7)}: ${line}\n`, name);
    assert.equal(pauses, 2, name);
  }
});

test("a poll reports every removed link alongside additions and state changes", async (t) => {
  for (const { name, after, lines } of [
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
    await t.test(name, async (t) => {
      const output = capture();
      const { root } = watching(t, `example/tracker#7`);
      const item = {
        linked: [pull(11, "OPEN"), pull(12, "OPEN"), pull(13, "OPEN")],
      };
      let elapsed = 0;
      let pauses = 0;
      assert.equal(
        await main(waitArgs(root, "1", "3"), {
          ...output.streams,
          connect: tracker({ "example/tracker#7": item }).connect,
          now: () => elapsed,
          pause: async (ms) => {
            elapsed += ms;
            pauses++;
            item.linked = after;
          },
        }),
        0,
        output.stderr,
      );
      assert.equal(
        output.stdout,
        lines.map((line) => `${issue(7)}: ${line}\n`).join(""),
      );
      assert.equal(pauses, 1);
    });
  }
});

test("unchanged links and order-only changes stay quiet until the deadline", async (t) => {
  const output = capture();
  const { root } = watching(t, `[#7](${issue(7)})`);
  const item = { linked: [pull(11, "OPEN"), pull(12, "MERGED")] };
  let elapsed = 0;
  let pauses = 0;
  assert.equal(
    await main(waitArgs(root, "1", "3"), {
      ...output.streams,
      connect: tracker({ "example/tracker#7": item }).connect,
      now: () => elapsed,
      pause: async (ms) => {
        elapsed += ms;
        pauses++;
        if (pauses === 2) item.linked.reverse();
      },
    }),
    0,
    output.stderr,
  );
  assert.equal(pauses, 3);
  assert.equal(
    output.stdout,
    "no item changed within the maximum duration of 3 seconds; arm the wait again\n",
  );
});

test("a pull request on a row reports merging, labels and comments, and reads no linked pull requests", async (t) => {
  const output = capture();
  const { root } = watching(t, "https://github.com/example/tracker/pull/12");
  const items = {
    "example/tracker#12": { pull: true, labels: [], comments: [] },
  };
  const { connect, requests } = tracker(items);
  const code = await main(waitArgs(root), {
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
  });
  assert.equal(code, 0, output.stderr);
  assert.deepEqual(output.stdout.trimEnd().split("\n"), [
    "https://github.com/example/tracker/pull/12: state changed from open to merged",
    "https://github.com/example/tracker/pull/12: labels added released",
    "https://github.com/example/tracker/pull/12: new comment https://github.com/example/tracker/issues/7#issuecomment-3",
  ]);
  assert.ok(!requests.includes("/graphql"));
});

test("pull request head and raw check and status sets wake without success policy", async (t) => {
  const head = "a".repeat(40);
  const run = (id, status = "in_progress", conclusion = null) => ({
    id,
    name: "Test",
    status,
    conclusion,
  });
  for (const change of [
    (item) => (item.head = "b".repeat(40)),
    (item) => item.runs.pop(),
    (item) => (item.runs[0] = run(2, "completed", "failure")),
    (item) => (item.statuses = []),
    (item) => (item.statuses[0].state = "success"),
  ]) {
    const output = capture();
    const { root } = watching(t, "example/tracker#12");
    const item = {
      pull: true,
      head,
      runs: [run(2), run(1)],
      statuses: [{ id: 3, context: "deploy", state: "pending" }],
    };
    let pauses = 0;
    assert.equal(
      await main(waitArgs(root), {
        ...output.streams,
        connect: tracker({ "example/tracker#12": item }).connect,
        pause: async () => {
          pauses++;
          if (pauses === 1) item.runs.reverse();
          if (pauses === 2) change(item);
        },
      }),
      0,
      output.stderr,
    );
    assert.equal(pauses, 2);
    assert.match(output.stdout, /: (?:head|checks) changed from/);
  }
});

test("only the changed item is reported among several rows and plans", async (t) => {
  const output = capture();
  const { root } = workbench(t, {
    plans: {
      review: planText({ rows: [row("one", "example/tracker#7")] }),
      audit: planText({
        rows: [row("two", `[other#3](${issue(3, "example/other")})`)],
      }),
    },
  });
  const items = {
    "example/tracker#7": { comments: [] },
    "example/other#3": { comments: [] },
  };
  const code = await main(waitArgs(root), {
    ...output.streams,
    connect: tracker(items).connect,
    pause: async () => (items["example/other#3"].labels = ["state:reporter"]),
  });
  assert.equal(code, 0, output.stderr);
  assert.equal(
    output.stdout,
    `${issue(3, "example/other")}: labels added state:reporter\n`,
  );
});

test("record edits and incoming messages wake the wait; ended rows are not watched", async (t) => {
  const output = capture();
  for (const { name, change, line } of [
    {
      name: "plan",
      change: (bench) =>
        bench.write("review/plan.md", planText({ done: ["Edited."] })),
      line: "review/plan.md: changed",
    },
    {
      name: "log",
      change: (bench) => bench.write("review/log.md", "# Log\n\n- entry\n"),
      line: "review/log.md: changed",
    },
    {
      name: "inbox",
      change: (bench) =>
        bench.write("inbox.md", `${emptyInbox}\n### An answer\n`),
      line: "inbox.md: changed",
    },
    {
      name: "index",
      change: (bench) =>
        bench.write(
          "index.md",
          indexText(["review"]).replace("thread-a", "thread-b"),
        ),
      line: "index.md: changed",
    },
    {
      name: "incoming created with its directory",
      change: (bench) =>
        bench.write("incoming/20261103T100000Z-alice.md", "A message.\n"),
      line: "incoming/: file 20261103T100000Z-alice.md created",
    },
  ]) {
    output.stdout = "";
    const bench = workbench(t, {
      plans: {
        review: planText({
          rows: [row("ended", "example/tracker#7", "closed 2026-11-01")],
        }),
      },
    });
    const code = await main(waitArgs(bench.root), {
      ...output.streams,
      connect: unreachable,
      pause: async () => change(bench),
    });
    assert.equal(code, 0, name + output.stderr);
    assert.equal(output.stdout, `${line}\n`, name);
  }
  const bench = workbench(t);
  const message = "incoming/20261103T100000Z-alice.md";
  bench.write(message, "A message.\n");
  for (const { change, how } of [
    {
      change: () => bench.write(message, "A longer message.\n"),
      how: "changed",
    },
    { change: () => unlinkSync(bench.path(message)), how: "removed" },
  ]) {
    output.stdout = "";
    assert.equal(
      await main(waitArgs(bench.root), {
        ...output.streams,
        connect: unreachable,
        pause: async () => change(),
      }),
      0,
      output.stderr,
    );
    assert.equal(
      output.stdout,
      `incoming/: file 20261103T100000Z-alice.md ${how}\n`,
    );
  }
});

const brief = (report) =>
  `# Review launch\n\nLaunch report: \`${report}\`\n\n## Context\n\nCheck the guide.\n\nstatus: done\n`;

test("launch reports wake only at their exact final line until the plan's log names them", async (t) => {
  for (const ending of ["status: done", "status: done\n", "status: done\r\n"]) {
    const bench = workbench(t);
    bench.write("review/brief-01.md", brief("report-01.md"));
    const report = bench.path("review/report-01.md");
    const output = capture();
    let pauses = 0;
    assert.equal(
      await main(waitArgs(bench.root), {
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
    assert.equal(output.stdout, "finished: read review/report-01.md\n");
    // A finished report wakes at once until the log names it.
    output.stdout = "";
    assert.equal(
      await main(waitArgs(bench.root), {
        ...output.streams,
        connect: unreachable,
        pause: unreachable,
      }),
      0,
    );
    assert.equal(output.stdout, "finished: read review/report-01.md\n");
    bench.write("review/log.md", "# Log\n\n- Consumed report-01.md.\n");
    output.stdout = "";
    assert.equal(
      await main(waitArgs(bench.root), {
        ...output.streams,
        connect: unreachable,
        pause: unreachable,
      }),
      0,
    );
    assert.equal(output.stdout, "review/log.md: changed\n");
  }
});

test("reloading records watches new launches without restarting the deadline", async (t) => {
  const output = capture();
  const bench = watching(t, "example/tracker#7");
  const { connect } = tracker({ "example/tracker#7": { comments: [] } });
  let pauses = 0;
  assert.equal(
    await main(waitArgs(bench.root), {
      ...output.streams,
      connect,
      pause: async () => {
        pauses++;
        if (pauses === 1)
          bench.write("review/brief-02.md", brief("report-02.md"));
        if (pauses === 2) bench.write("review/report-02.md", "status: done\n");
      },
    }),
    0,
    output.stderr,
  );
  assert.equal(pauses, 2);
  assert.equal(output.stdout, "finished: read review/report-02.md\n");
  // An added launch that already finished wakes at once.
  output.stdout = "";
  bench.write("review/brief-03.md", brief("report-03.md"));
  bench.write("review/report-03.md", "status: done\n");
  bench.write("review/log.md", "# Log\n\n- report-02.md consumed.\n");
  assert.equal(
    await main(waitArgs(bench.root), {
      ...output.streams,
      connect,
      pause: unreachable,
    }),
    0,
  );
  assert.equal(
    output.stdout,
    "review/log.md: changed\nfinished: read review/report-03.md\n",
  );
  // Reloads keep the overall deadline.
  bench.write("review/log.md", "# Log\n\n- report-02.md and report-03.md.\n");
  await main(["status", bench.root, "--stale-after", "60"], { connect });
  let elapsed = 0;
  pauses = 0;
  output.stdout = "";
  assert.equal(
    await main(waitArgs(bench.root, "1", "3"), {
      ...output.streams,
      connect,
      now: () => elapsed,
      pause: async (ms) => {
        elapsed += ms;
        pauses++;
        bench.write(
          `review/brief-1${pauses}.md`,
          brief(`report-1${pauses}.md`),
        );
      },
    }),
    0,
    output.stderr,
  );
  assert.equal(pauses, 3);
  assert.match(output.stdout, /maximum duration of 3 seconds/);
});

test("invalid records fail the wait by name and show as unavailable in status", async (t) => {
  for (const { name, change, pattern } of [
    {
      name: "no index",
      change: (bench) => unlinkSync(bench.path("index.md")),
      pattern: /index\.md: missing/,
    },
    {
      name: "no Active section",
      change: (bench) => bench.write("index.md", "# Workbench\n"),
      pattern: /index\.md: no Active section/,
    },
    {
      name: "no plan",
      change: (bench) => unlinkSync(bench.path("review/plan.md")),
      pattern: /review\/plan\.md: missing/,
    },
    {
      name: "no Tickets table",
      change: (bench) =>
        bench.write("review/plan.md", "**Done means:**\n\n1. Done.\n"),
      pattern: /review\/plan\.md: no Tickets table/,
    },
    {
      name: "no numbered Done means",
      change: (bench) =>
        bench.write(
          "review/plan.md",
          planText().replace(/\*\*Done means:\*\*\n\n1\./, "**Done means:** a"),
        ),
      pattern: /review\/plan\.md: no numbered Done means/,
    },
    {
      name: "no Open inbox section",
      change: (bench) => bench.write("inbox.md", "# Inbox\n"),
      pattern: /inbox\.md: no Open section/,
    },
  ]) {
    const bench = workbench(t);
    change(bench);
    const output = capture();
    assert.equal(
      await main(waitArgs(bench.root), {
        ...output.streams,
        connect: unreachable,
        pause: unreachable,
      }),
      1,
      name,
    );
    assert.match(output.stderr, /^workbench\.mjs: /, name);
    assert.match(output.stderr, pattern, name);
    assert.equal(output.stdout, "", name);
    assert.equal(
      await main(["status", bench.root, "--stale-after", "60"], {
        ...output.streams,
        connect: unreachable,
      }),
      0,
      name,
    );
    assert.match(output.stdout, /^Orchestrator: /, name);
    assert.match(
      output.stdout,
      new RegExp(`- unavailable: ${pattern.source.replace(": ", " \\(")}`),
      name,
    );
  }
  // A record broken while waiting is an error, never stale coverage.
  const bench = workbench(t);
  const output = capture();
  assert.equal(
    await main(waitArgs(bench.root), {
      ...output.streams,
      connect: unreachable,
      pause: async () => bench.write("index.md", "# broken\n"),
    }),
    1,
  );
  assert.match(output.stderr, /index\.md: no Active section/);
  assert.equal(output.stdout, "");
});

// A bare upstream, the orchestrator's workbench clone and a sender's clone.
function workbenches(t) {
  const root = mkdtempSync(join(tmpdir(), "orchestrate-workbench-git-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const upstream = join(root, "upstream.git");
  const bench = join(root, "workbench");
  const sender = join(root, "sender");
  git(root, "init", "--quiet", "--bare", "--initial-branch=main", upstream);
  git(root, "clone", "--quiet", upstream, bench);
  workbench(t, { root: bench });
  git(bench, "add", "--all");
  git(bench, "commit", "--quiet", "--message", "Seed the workbench");
  git(bench, "push", "--quiet", "--set-upstream", "origin", "main");
  git(root, "clone", "--quiet", upstream, sender);
  return { upstream, workbench: bench, sender };
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

test("an upstream commit touching a watched record wakes the wait, and other commits do not", async (t) => {
  for (const path of ["incoming/20261103T100000Z-bob.md", "review/log.md"]) {
    const output = capture();
    const { workbench, sender } = workbenches(t);
    let pauses = 0;
    let message;
    const code = await main(waitArgs(workbench), {
      ...output.streams,
      connect: unreachable,
      pause: async () => {
        pauses += 1;
        if (pauses === 1) push(sender, "wishes.md", "- A wish.\n");
        if (pauses === 2) message = push(sender, path, "Hi.\n");
      },
    });
    assert.equal(code, 0, output.stderr);
    assert.equal(pauses, 2);
    assert.equal(output.stdout, `upstream commit ${message} not yet pulled\n`);
    // The wait fetches but never merges into the workbench checkout.
    assert.notEqual(
      readFileSync(join(workbench, "review/log.md"), "utf8"),
      "Hi.\n",
    );
    assert.equal(existsSync(join(workbench, "incoming")), false);
  }
});

test("an upstream message fetched but not pulled before arming wakes the wait, and pulling it shows the message", async (t) => {
  const output = capture();
  const { workbench, sender } = workbenches(t);
  const earlier = push(sender, "incoming/20261103T090000Z-bob.md", "Hi.\n");
  git(workbench, "fetch", "--quiet", "origin");
  const code = await main(waitArgs(workbench), {
    ...output.streams,
    connect: unreachable,
    pause: unreachable,
  });
  assert.equal(code, 0, output.stderr);
  assert.equal(output.stdout, `upstream commit ${earlier} not yet pulled\n`);

  output.stdout = "";
  git(workbench, "pull", "--quiet", "--ff-only");
  const pulled = await main(waitArgs(workbench), {
    ...output.streams,
    connect: unreachable,
    pause: unreachable,
  });
  assert.equal(pulled, 0, output.stderr);
  assert.equal(
    output.stdout,
    "incoming/: file 20261103T090000Z-bob.md created\n",
  );
});

test("an upstream commit only below incoming's own files does not wake the wait", async (t) => {
  const output = capture();
  const { workbench, sender } = workbenches(t);
  let pauses = 0;
  const code = await main(waitArgs(workbench, "0.02", "0.3"), {
    ...output.streams,
    connect: unreachable,
    pause: async (milliseconds) => {
      pauses += 1;
      if (pauses === 1)
        push(sender, "incoming/archive/20261103T090000Z-bob.md", "Old.\n");
      await new Promise((resolve) => setTimeout(resolve, milliseconds));
    },
  });
  assert.equal(code, 0, output.stdout + output.stderr);
  assert.match(output.stdout, /^no item changed/);
});

test("a failed upstream fetch while polling is an error", async (t) => {
  const output = capture();
  const { upstream, workbench } = workbenches(t);
  const code = await main(waitArgs(workbench), {
    ...output.streams,
    connect: unreachable,
    pause: async () => rmSync(upstream, { recursive: true, force: true }),
  });
  assert.equal(code, 1);
  assert.match(output.stderr, /^workbench\.mjs: git fetch origin failed/);
  assert.equal(output.stdout, "");
});

test("the maximum duration ends an unchanged wait with exit zero", async (t) => {
  const output = capture();
  const { root } = watching(t, "example/tracker#7");
  const { connect } = tracker({ "example/tracker#7": { comments: [] } });
  const startedAt = Date.now();
  const code = await main(waitArgs(root, "0.02", "0.1"), {
    connect,
    ...output.streams,
  });
  assert.equal(code, 0, output.stderr);
  assert.ok(Date.now() - startedAt >= 100);
  assert.equal(
    output.stdout,
    "no item changed within the maximum duration of 0.1 seconds; arm the wait again\n",
  );
});

test("a platform failure at arming or while polling is an error", async (t) => {
  const output = capture();
  for (const failAt of [1, 2]) {
    output.stderr = "";
    const { root } = watching(t, "example/tracker#7");
    const items = { "example/tracker#7": { comments: [] } };
    if (failAt === 1) items.fail = true;
    const code = await main(waitArgs(root), {
      ...output.streams,
      connect: tracker(items).connect,
      pause: async () => (items.fail = true),
    });
    assert.equal(code, 1, `read ${failAt}`);
    assert.match(output.stderr, /^workbench\.mjs: /, `read ${failAt}`);
  }
  output.stderr = "";
  const { root } = watching(t, "example/missing#1");
  assert.equal(
    await main(waitArgs(root), {
      connect: tracker({}).connect,
      ...output.streams,
    }),
    1,
  );
  assert.match(output.stderr, /^workbench\.mjs: /);
  assert.equal(output.stdout, "");
});

test("the installed script runs with plain node and reports each exit", (t) => {
  const { root } = workbench(t);
  const run = (...args) =>
    spawnSync(process.execPath, [script, ...args], {
      cwd: root,
      encoding: "utf8",
      timeout: 30_000,
    });
  const usage = run();
  assert.equal(usage.status, 1);
  assert.match(usage.stderr, /^usage: workbench\.mjs/);
  const status = run("status", ".", "--stale-after", "86400");
  assert.equal(status.status, 0, status.stderr);
  assert.match(status.stdout, /^Orchestrator: thread-a\n/);
  const timeout = run(
    "wait",
    ".",
    "--interval",
    "0.05",
    "--max-duration",
    "0.2",
  );
  assert.equal(timeout.status, 0, timeout.stderr);
  assert.match(timeout.stdout, /^no item changed within the maximum duration/);
});

test("status groups every item by who moves next, with its link and plan/row", async (t) => {
  const done = [
    `The guide is reviewed. met [#10](${issue(10)})`,
    "The glossary is audited.",
    "The owner confirms the example. met <https://example.com/answer>",
  ];
  const bench = workbench(t, {
    plans: {
      review: planText({
        done,
        rows: [
          row("intake", `[#1](${issue(1)})`),
          row("grill", "example/tracker#2"),
          row("owner", issue(3)),
          row("pickup", issue(4)),
          row("delivery", `${issue(5)}, ${issue(6).replace("issues", "pull")}`),
          row("reporter", issue(8)),
          row("carried", issue(9)),
          row("finished", `${issue(10)} and ${issue(1)}#issuecomment-1`),
          row("ended", issue(11), "closed by PR 12"),
          row("unlabeled", issue(13)),
          row("broken", issue(14)),
          row("local", "[01](../issues/01.md)"),
        ],
      }),
      audit: planText({ done: ["Audited."] }),
    },
  });
  bench.write(
    "inbox.md",
    "# Inbox\n\n## Open\n\n### Approve staging access?\n\nPlan: review/pickup\nRecommendation: approve.\n\n### Pick a caption\n\n## Answered\n\n### Old question\n",
  );
  bench.write("incoming/20261120T100000Z-alice.md", "A message.\n");
  for (const name of ["a", "b", "c"])
    bench.write(`review/brief-${name}.md`, brief(`report-${name}.md`));
  bench.write("review/report-a.md", "Done.\nstatus: done\n");
  bench.write("review/report-b.md", "Working.\n");
  bench.write("review/report-c.md", "status: done\n");
  bench.write("review/log.md", "# Log\n\n- Consumed report-c.md.\n");
  const items = {
    "example/tracker#1": { labels: ["state:triage"] },
    "example/tracker#2": { labels: ["state:grill"] },
    "example/tracker#3": { labels: ["state:owner"] },
    "example/tracker#4": {
      labels: ["state:ready"],
      updatedAt: "2026-11-01T00:00:00Z",
    },
    "example/tracker#5": {
      labels: ["state:ready"],
      linked: [pull(15, "OPEN")],
    },
    "example/tracker#6": { pull: true },
    "example/tracker#8": { labels: ["state:reporter"] },
    "example/tracker#9": { labels: ["state:carried"] },
    "example/tracker#10": { state: "closed" },
    "example/tracker#13": {},
  };
  const output = capture();
  assert.equal(
    await main(["status", bench.root, "--stale-after", "172800"], {
      ...output.streams,
      connect: tracker(items).connect,
      now: () => Date.parse("2026-11-20T00:00:00Z"),
    }),
    0,
    output.stderr,
  );
  assert.equal(
    output.stdout,
    `Orchestrator: thread-a
review/plan.md · Done means ●○●
audit/plan.md · Done means ○

My move
- ${issue(1)} state:triage · review/intake, review/finished
- ${issue(2)} state:grill · review/grill
- ${issue(13)} no state the rules place · review/unlabeled
- unavailable: ${issue(14)} (GitHub answered GET /repos/example/tracker/issues/14 with 404: Not Found) · review/broken
- review/report-a.md finished; read the report · review/brief-a.md
- incoming/20261120T100000Z-alice.md message · —
Owner's move
- ${issue(3)} state:owner · review/owner
- inbox.md#approve-staging-access Approve staging access? · review/pickup
- inbox.md#pick-a-caption Pick a caption · —
Running
- review/report-b.md report pending · review/brief-b.md
Waiting quietly: 1 state:ready (pickup), 2 open pull request (delivery), 2 state:reporter or state:carried (third party)
Stale (unchanged for over 172800 seconds)
- ${issue(4)} unchanged since 2026-11-01T00:00:00Z · review/pickup
`,
  );
  // Once every linked issue on a row closes, the row is the orchestrator's.
  items["example/tracker#1"].state = "closed";
  output.stdout = "";
  await main(["status", bench.root, "--stale-after", "172800"], {
    ...output.streams,
    connect: tracker(items).connect,
    now: () => Date.parse("2026-11-20T00:00:00Z"),
  });
  for (const code of ["intake", "finished"])
    assert.match(
      output.stdout,
      new RegExp(
        `^- review/plan\\.md every linked issue closed; end the row · review/${code}$`,
        "m",
      ),
    );
  assert.doesNotMatch(output.stdout, /state:triage/);
});

test("status reads no tracker for local rows and names a missing orchestrator", async (t) => {
  const bench = workbench(t, {
    plans: { review: planText({ rows: [row("local", "[01](01.md)")] }) },
  });
  bench.write(
    "index.md",
    indexText(["review"]).replace(/^Orchestrator:.*\n/m, ""),
  );
  const output = capture();
  assert.equal(
    await main(["status", bench.root, "--stale-after", "60"], {
      ...output.streams,
      connect: unreachable,
    }),
    0,
    output.stderr,
  );
  assert.equal(
    output.stdout,
    `Orchestrator: unavailable: index.md (no Orchestrator: line)
review/plan.md · Done means ○

My move
- none
Owner's move
- none
Running
- none
Waiting quietly: 0 state:ready (pickup), 0 open pull request (delivery), 0 state:reporter or state:carried (third party)
Stale (unchanged for over 60 seconds)
- none
`,
  );
});

test("status saves its observation, so the wait wakes at once for a change before arming", async (t) => {
  const bench = watching(t, "example/tracker#7");
  const items = { "example/tracker#7": { labels: ["state:ready"] } };
  const output = capture();
  const status = () =>
    main(["status", bench.root, "--stale-after", "60"], {
      ...output.streams,
      connect: tracker(items).connect,
    });
  assert.equal(await status(), 0, output.stderr);
  assert.ok(existsSync(join(bench.root, ".git/workbench-observation.json")));
  assert.doesNotMatch(
    git(bench.root, "status", "--porcelain", "--untracked-files=all"),
    /observation/,
    "the observation file is never part of the checkout",
  );
  items["example/tracker#7"].labels = ["state:owner"];
  bench.write("incoming/20261120T100000Z-bob.md", "Hi.\n");
  output.stdout = "";
  assert.equal(
    await main(waitArgs(bench.root), {
      ...output.streams,
      connect: tracker(items).connect,
      pause: unreachable,
    }),
    0,
    output.stderr,
  );
  assert.deepEqual(output.stdout.trimEnd().split("\n"), [
    "incoming/: file 20261120T100000Z-bob.md created",
    `${issue(7)}: labels added state:owner; removed state:ready`,
  ]);
  // The wait saved what it saw: re-arming stays quiet.
  output.stdout = "";
  assert.equal(
    await main(waitArgs(bench.root, "0.01", "0.03"), {
      ...output.streams,
      connect: tracker(items).connect,
    }),
    0,
  );
  assert.match(output.stdout, /^no item changed/);
  // Without a saved observation, the wait takes first-read baselines.
  rmSync(join(bench.root, ".git/workbench-observation.json"));
  bench.write("incoming/20261120T110000Z-bob.md", "Again.\n");
  items["example/tracker#7"].labels = [];
  output.stdout = "";
  assert.equal(
    await main(waitArgs(bench.root, "0.01", "0.03"), {
      ...output.streams,
      connect: tracker(items).connect,
    }),
    0,
  );
  assert.match(output.stdout, /^no item changed/);
});

// Real file-system events wake the wait long before its 60-second poll.
test("file events wake the wait within a bound well below its interval", async (t) => {
  for (const { name, change, line } of [
    {
      name: "finished launch report",
      change: (bench) =>
        bench.write("review/report-01.md", "Done.\nstatus: done\n"),
      line: "finished: read review/report-01.md",
    },
    {
      name: "new incoming message",
      change: (bench) =>
        bench.write("incoming/20261120T100000Z-carol.md", "Hi.\n"),
      line: "incoming/: file 20261120T100000Z-carol.md created",
    },
    {
      name: "record edit",
      change: (bench) =>
        bench.write("review/plan.md", planText({ done: ["Edited."] })),
      line: "review/plan.md: changed",
    },
  ]) {
    const bench = workbench(t);
    bench.write("review/brief-01.md", brief("report-01.md"));
    const output = capture();
    const startedAt = Date.now();
    setTimeout(() => change(bench), 200);
    assert.equal(
      await main(waitArgs(bench.root, "60", "120"), {
        ...output.streams,
        connect: unreachable,
      }),
      0,
      name + output.stderr,
    );
    assert.equal(output.stdout, `${line}\n`, name);
    assert.ok(Date.now() - startedAt < 10_000, name);
  }
});
