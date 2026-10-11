#!/usr/bin/env node

// A GitHub CLI fake for the babysit wait script. It answers the pull request
// view, the paginated issue comments, the push activity and the head commit
// from the state file, and fails every call with `fail`.
import { readFileSync } from "node:fs";

const state = JSON.parse(readFileSync(process.env.FAKE_GH_STATE, "utf8"));
const args = process.argv.slice(2);
const write = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);

if (state.fail) {
  process.stderr.write("gh: Server Error (HTTP 502)\n");
  process.exit(1);
}

if (args[0] === "pr" && args[1] === "view") {
  write({
    headRefOid: state.head,
    headRefName: state.branch,
    createdAt: state.createdAt,
    statusCheckRollup: state.checks,
  });
} else if (args[0] === "api" && args[1].includes("/comments?")) {
  write([
    state.comments.map(({ login, createdAt, body }) => ({
      user: { login },
      created_at: createdAt,
      body,
    })),
  ]);
} else if (args[0] === "api" && args[1].includes("/activity?")) {
  write(
    state.pushedAt ? [{ after: state.head, timestamp: state.pushedAt }] : [],
  );
} else if (args[0] === "api" && args[1].includes("/commits/")) {
  write({ commit: { committer: { date: state.committedAt } } });
} else {
  process.stderr.write(`unsupported fixture command: ${args.join(" ")}\n`);
  process.exit(2);
}
