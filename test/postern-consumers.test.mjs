import assert from "node:assert/strict";
import {
  readFileSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  connect,
  PlatformError,
  platformErrorReasons,
} from "../vendor/postern/postern.mjs";
import {
  checkRollup,
  workflowRuns,
  reviewComments,
  pushActivity,
  conversationComments,
} from "../.agents/skills/babysit/platform.mjs";
import { main as wait } from "../.agents/skills/babysit/wait.mjs";
import { main as merge } from "../.agents/skills/babysit/merge.mjs";
import { runIssueContractValidation } from "../scripts/validate-issue-contract.mjs";
import {
  awaitingTicketFeedback,
  ticketBody,
} from "./helpers/issue-contracts.mjs";

const head = "a".repeat(40);
const json = (data) =>
  new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
  });
const page = (nodes, more = false, cursor = null) => ({
  nodes,
  pageInfo: { hasNextPage: more, endCursor: cursor },
});
const rollup = (contexts) => ({
  data: { repository: { object: { statusCheckRollup: { contexts } } } },
});
const check = {
  __typename: "CheckRun",
  name: "CI",
  status: "COMPLETED",
  conclusion: "SUCCESS",
  detailsUrl: "https://ci/1",
  startedAt: "2026-10-01T01:00:00Z",
};
const repository = "https://github.com/example/repository";

test("the vendored published bundle matches its recorded immutable checksum", () => {
  const bytes = readFileSync(
    new URL("../vendor/postern/postern.mjs", import.meta.url),
  );
  const metadata = readFileSync(
    new URL("../vendor/postern/README.md", import.meta.url),
    "utf8",
  );
  assert.match(metadata, /1\.2\.0/);
  assert.ok(
    metadata.includes(createHash("sha256").update(bytes).digest("hex")),
  );
  assert.match(
    metadata,
    /28deee18bddd6c1a3018cce890345d5303ea4d8e4ec8c9d8d7908c50a6465af9/,
  );
});

test("check reads paginate by immutable head and retain links and workflow identity", async () => {
  const calls = [];
  const connection = connect(repository, {
    fetch: async (_url, options) => {
      const { query, variables } = JSON.parse(options.body);
      assert.ok(query.includes("object(expression: $head)"));
      calls.push(variables);
      return json(
        rollup(
          variables.after === null
            ? page(
                [
                  {
                    ...check,
                    checkSuite: {
                      workflowRun: { workflow: { name: "CI workflow" } },
                    },
                  },
                ],
                true,
                "next",
              )
            : page([
                {
                  __typename: "StatusContext",
                  context: "external",
                  state: "SUCCESS",
                  targetUrl: "https://ci/2",
                },
              ]),
        ),
      );
    },
  });
  const checks = await checkRollup(connection, head);
  assert.deepEqual(
    calls.map(({ head: commit, after }) => [commit, after]),
    [
      [head, null],
      [head, "next"],
    ],
  );
  assert.equal(checks[0].workflowName, "CI workflow");
  assert.equal(checks[0].detailsUrl, "https://ci/1");
  assert.equal(checks[1].targetUrl, "https://ci/2");
});

test("missing, failed and unknown check facts fail instead of passing", async () => {
  for (const response of [
    {},
    { data: { repository: { object: null } } },
    { errors: [{ message: "denied" }], ...rollup(page([])) },
    rollup({ nodes: [] }),
    rollup(page([null])),
    rollup(page([{ ...check, status: undefined }])),
    rollup(page([{ ...check, status: "UNKNOWN" }])),
    rollup(page([{ ...check, conclusion: null }])),
    rollup(page([{ ...check, startedAt: null }])),
    rollup(page([{ ...check, conclusion: "UNKNOWN" }])),
    rollup(
      page([
        { __typename: "StatusContext", context: "external", state: "UNKNOWN" },
      ]),
    ),
    rollup(page([], true, null)),
    rollup(page([], true, "loop")),
  ]) {
    const connection = connect(repository, {
      fetch: async () => json(response),
    });
    await assert.rejects(checkRollup(connection, head), {
      reason: "invalidResponse",
    });
  }
});

test("Access supplements reject missing workflow, review-thread and push facts", () => {
  for (const pages of [
    [{}],
    [{ workflow_runs: [null] }],
    [{ workflow_runs: [{ workflow_id: 1, name: "CI", status: "unknown" }] }],
    [
      {
        workflow_runs: [
          { workflow_id: 1, name: "CI", status: "completed", conclusion: null },
        ],
      },
    ],
  ])
    assert.throws(() => workflowRuns(pages), { reason: "invalidResponse" });
  for (const pages of [
    [{}],
    [[{}]],
    [[{ pull_request_review_id: 1, in_reply_to_id: "invalid" }]],
  ])
    assert.throws(() => reviewComments(pages), { reason: "invalidResponse" });
  for (const pages of [
    [{}],
    [[{}]],
    [[{ after: head, timestamp: "unreadable" }]],
  ])
    assert.throws(() => pushActivity(pages), { reason: "invalidResponse" });
  for (const pages of [
    [{}],
    [[{}]],
    [[{ body: "text", created_at: "unreadable", user: null }]],
  ])
    assert.throws(() => conversationComments(pages), {
      reason: "invalidResponse",
    });
  assert.deepEqual(reviewComments([[{ pull_request_review_id: 1 }]]), [
    { pull_request_review_id: 1 },
  ]);
});

test("unavailable issue reads abort before mutation; missing roles follow authorization", async (t) => {
  for (const reason of platformErrorReasons)
    for (const stage of ["issue", "comments", "labelChanges", "role"]) {
      let mutations = 0;
      const issue = {
        number: 42,
        id: 42,
        nodeId: "ISSUE_42",
        body: ticketBody,
        state: "open",
        labels: ["ready-for-agent"],
        createdAt: "2026-09-14T16:00:00Z",
        bodyEditTime: null,
        parent: null,
        blockedBy: [],
        author: { login: "reporter", bot: false },
      };
      const notice = awaitingTicketFeedback(issue);
      const connection = {
        issueTracker: {
          capabilities: { bodyEditTime: true },
          issue: async () => issue,
          comments: async () => [
            {
              ...notice,
              nodeId: notice.node_id,
              author: { login: "github-actions[bot]", bot: true },
              updatedAt: "2026-09-14T16:59:00Z",
            },
          ],
          labelChanges: async () => [
            {
              id: 101,
              action: "added",
              label: "ready-for-agent",
              actor: { login: "maintainer", bot: false },
              time: "2026-09-14T17:00:00Z",
            },
          ],
          removeLabel: async () => mutations++,
          addLabels: async () => mutations++,
          createComment: async () => mutations++,
          updateComment: async () => mutations++,
        },
        access: { role: async () => "admin" },
      };
      (stage === "role" ? connection.access : connection.issueTracker)[stage] =
        async () => {
          throw new PlatformError(reason, "Fixture read failed.");
        };
      const run = () =>
        runIssueContractValidation(
          {
            repository: "example/repository",
            issue: 42,
            kind: "edited",
            actor: { login: "reporter", bot: false },
            label: null,
          },
          connection,
        );
      if (stage === "role" && reason === "notFound") {
        const messages = [];
        const error = t.mock.method(console, "error", (message) =>
          messages.push(message),
        );
        try {
          assert.equal(await run(), 1);
          assert.deepEqual(messages, [
            "@maintainer is not authorized to grant readiness. Use a repository admin, maintainer, or collaborator with the triage role.",
          ]);
          assert.equal(mutations, 3); // Remove readiness, add triage, update feedback.
        } finally {
          error.mock.restore();
        }
      } else {
        await assert.rejects(run, { reason });
        assert.equal(mutations, 0, `${reason} at ${stage}`);
      }
    }
});

test("wait failures never report readiness and merge queue reads fail before merging", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "postern-reviewer-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, ".github"));
  writeFileSync(
    join(directory, ".github/pull-request-reviewer.json"),
    readFileSync(
      new URL("./fixtures/reviewers/github-review.json", import.meta.url),
    ),
  );
  const previousDirectory = process.cwd();
  process.chdir(directory);
  const original = process.stderr.write;
  let output = "";
  process.stderr.write = (chunk) => {
    output += chunk;
    return true;
  };
  try {
    for (const reason of platformErrorReasons) {
      const failure = async () => {
        throw new PlatformError(reason, `Fixture ${reason}`);
      };
      const code = await wait(["12"], {
        repository: { path: "example/repository" },
        pullRequests: {
          capabilities: { reviewCommits: true },
          pullRequest: failure,
        },
      });
      assert.equal(code, 1, reason);
      let mutations = 0;
      await assert.rejects(
        merge(["12", head], {
          pullRequests: {
            pullRequest: async () => ({ headCommit: head }),
            mergesThroughQueue: failure,
            squashMerge: async () => mutations++,
          },
        }),
        { reason },
      );
      assert.equal(mutations, 0, reason);
    }
    const code = await wait(["12"], {
      repository: { path: "example/repository" },
      pullRequests: { capabilities: {} },
    });
    assert.equal(code, 1);
    assert.match(output, /Review commits are unavailable/);
  } finally {
    process.stderr.write = original;
    process.chdir(previousDirectory);
  }
});
