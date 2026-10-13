#!/usr/bin/env node

// A GitHub CLI fake for the babysit wait script. It answers the pull request
// view, the paginated issue comments, the head's paginated workflow runs, the
// push activity and the head commit from the state file, and fails every call
// with `fail`. `failActivity` fails only the activity read, and
// `failActivityReads` fails its first reads; `recordAfter`
// withholds its push for that many reads, counted in `activityReads`.
// Workflow runs carry their workflow ID, name, status, conclusion,
// latest attempt's `run_started_at` and `html_url`, as GitHub reports them.
import { readFileSync, renameSync, writeFileSync } from "node:fs";

const state = JSON.parse(readFileSync(process.env.FAKE_GH_STATE, "utf8"));
const args = process.argv.slice(2);
const write = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);

if (state.fail) {
  process.stderr.write("gh: Server Error (HTTP 502)\n");
  process.exit(1);
}

if (args[0] === "pr" && args[1] === "view") {
  write({
    title: state.title,
    body: state.body,
    headRefOid: state.head,
    headRefName: state.branch,
    createdAt: state.createdAt,
    statusCheckRollup: state.checks,
  });
} else if (args[0] === "pr" && args[1] === "merge") {
  state.merge = { args, body: readFileSync(0, "utf8") };
  if (state.mergeHead) state.head = state.mergeHead;
  writeFileSync(process.env.FAKE_GH_STATE, JSON.stringify(state));
  if (state.mergeHead || state.mergeFail) {
    process.stderr.write("gh: merge refused\n");
    process.exit(1);
  }
} else if (args[0] === "api" && args[1].includes("/comments?")) {
  write([
    state.comments.map(({ login, createdAt, body }) => ({
      user: { login },
      created_at: createdAt,
      body,
    })),
  ]);
} else if (args[0] === "api" && args[1].includes("/reviews?")) {
  write([state.reviews ?? []]);
} else if (args[0] === "api" && args[1].includes("/actions/runs?")) {
  const runs = state.runs ?? [];
  write([{ total_count: runs.length, workflow_runs: runs }]);
} else if (args[0] === "api" && args[1].includes("/activity?")) {
  const read = state.activityReads ?? 0;
  if (
    state.recordAfter !== undefined ||
    state.failActivityReads !== undefined
  ) {
    state.activityReads = read + 1;
    // Replace the state atomically so concurrent reads see complete JSON.
    const temporary = `${process.env.FAKE_GH_STATE}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(state));
    renameSync(temporary, process.env.FAKE_GH_STATE);
  }
  if (state.failActivity || read < state.failActivityReads) {
    process.stderr.write("gh: Server Error (HTTP 502)\n");
    process.exit(1);
  }
  const recorded = state.pushedAt && read >= (state.recordAfter ?? 0);
  write(recorded ? [{ after: state.head, timestamp: state.pushedAt }] : []);
} else if (args[0] === "api" && args[1].includes("/commits/")) {
  write({ commit: { committer: { date: state.committedAt } } });
} else {
  process.stderr.write(`unsupported fixture command: ${args.join(" ")}\n`);
  process.exit(2);
}
