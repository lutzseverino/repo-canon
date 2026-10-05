import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import {
  approvedTicketFeedback,
  awaitingTicketFeedback,
  bot,
  bugBody,
  createdWithReadiness,
  creationLabel,
  labeledBy,
  readinessReview,
  repository,
  specificationBody,
  ticketBody,
} from "./helpers/issue-contracts.mjs";
import { installedValidator } from "./helpers/installed-validator.mjs";

// The workflow adapter of the issue-contract validator, run as GitHub Actions
// runs it against a local HTTP server that serves issue 42.
const repositoryRoot = new URL("..", import.meta.url).pathname;
const validator = join(repositoryRoot, "scripts/validate-issue-contract.mjs");

async function exercise({
  issue,
  comments = [],
  commentPages,
  blockedBy = [],
  blockedByStatus = 200,
  parent = null,
  event = {},
  relatedIssues = {},
  permissions = {},
  bodyLastEditedAt = null,
  issueEvents,
  issueEventPages,
  issueEventReads,
  validatorPath = validator,
  nodeArguments = [],
}) {
  const requests = [];
  for (const comment of [...comments, ...(commentPages?.flat() ?? [])]) {
    if (
      comment.body?.includes("repo-canon:issue-contract-state") &&
      !comment.updated_at
    ) {
      comment.updated_at = "2026-09-14T16:59:00Z";
    }
  }
  const effectiveIssueEventPages = issueEventPages ?? [issueEvents ?? []];
  // Successive reads of a one-page timeline, the last repeated once reached.
  let issueEventReadCount = 0;
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    requests.push({ method: request.method, url: request.url, body });

    const issuePath = "/repos/example/repository/issues/42";
    if (request.method === "POST" && request.url === "/graphql") {
      return json(response, 200, {
        data: {
          repository: {
            issue: {
              id: issue.node_id ?? "ISSUE_42",
              createdAt: issue.created_at ?? null,
              lastEditedAt: bodyLastEditedAt,
            },
          },
        },
      });
    }
    if (request.method === "GET" && request.url === issuePath) {
      return json(response, 200, issue);
    }
    if (
      request.method === "GET" &&
      request.url === `${issuePath}/comments?per_page=100`
    ) {
      const pages = commentPages ?? [comments];
      const headers =
        pages.length > 1
          ? {
              link: `<http://127.0.0.1:${server.address().port}${issuePath}/comments?per_page=100&page=2>; rel="next"`,
            }
          : {};
      return json(response, 200, pages[0], headers);
    }
    if (
      request.method === "GET" &&
      request.url === `${issuePath}/comments?per_page=100&page=2`
    ) {
      return json(response, 200, commentPages?.[1] ?? []);
    }
    if (
      request.method === "GET" &&
      request.url === `${issuePath}/events?per_page=100`
    ) {
      if (issueEventReads) {
        const read = Math.min(issueEventReadCount, issueEventReads.length - 1);
        issueEventReadCount += 1;
        return json(response, 200, issueEventReads[read]);
      }
      const headers =
        effectiveIssueEventPages.length > 1
          ? {
              link: `<http://127.0.0.1:${server.address().port}${issuePath}/events?per_page=100&page=2>; rel="next"`,
            }
          : {};
      return json(response, 200, effectiveIssueEventPages[0], headers);
    }
    if (
      request.method === "GET" &&
      request.url === `${issuePath}/events?per_page=100&page=2`
    ) {
      return json(response, 200, effectiveIssueEventPages[1] ?? []);
    }
    if (
      request.method === "GET" &&
      request.url === `${issuePath}/dependencies/blocked_by?per_page=100`
    ) {
      const responseBody =
        blockedByStatus === 200
          ? blockedBy
          : { message: "Issue dependencies are unavailable" };
      return json(response, blockedByStatus, responseBody);
    }
    if (request.method === "GET" && request.url === `${issuePath}/parent`) {
      return parent
        ? json(response, 200, parent)
        : json(response, 404, { message: "No parent issue found" });
    }
    if (request.method === "GET" && Object.hasOwn(relatedIssues, request.url)) {
      return json(response, 200, relatedIssues[request.url]);
    }
    const permissionMatch = request.url?.match(
      /^\/repos\/example\/repository\/collaborators\/([^/]+)\/permission$/,
    );
    if (request.method === "GET" && permissionMatch) {
      const login = decodeURIComponent(permissionMatch[1]);
      const permission = permissions[login];
      if (permission?.status)
        return json(
          response,
          permission.status,
          permission.body ?? { message: "Permission unavailable" },
        );
      return permission
        ? json(response, 200, permission)
        : json(response, 404, { message: "Not Found" });
    }
    if (request.method === "POST" && request.url === `${issuePath}/comments`) {
      comments.push({
        id: 99,
        body: JSON.parse(body).body,
        user: { login: "github-actions[bot]" },
      });
      return json(response, 201, comments.at(-1));
    }
    if (
      request.method === "DELETE" &&
      request.url?.startsWith(`${issuePath}/labels/`)
    ) {
      return json(response, 200, {});
    }
    if (request.method === "POST" && request.url === `${issuePath}/labels`) {
      return json(response, 200, {});
    }
    if (
      request.method === "PATCH" &&
      request.url?.startsWith("/repos/example/repository/issues/comments/")
    ) {
      const comment = comments.find(({ id }) => request.url.endsWith(`/${id}`));
      if (comment) comment.body = JSON.parse(body).body;
      return json(response, 200, {});
    }
    return json(response, 404, { message: `${request.method} ${request.url}` });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const directory = await mkdtemp(join(tmpdir(), "repo-canon-issue-contract-"));
  const eventPath = join(directory, "event.json");
  await writeFile(
    eventPath,
    JSON.stringify({ issue: { number: 42 }, ...event }),
  );

  try {
    const result = await runValidator(
      {
        GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
        GITHUB_GRAPHQL_URL: `http://127.0.0.1:${server.address().port}/graphql`,
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_REPOSITORY: repository,
        GITHUB_TOKEN: "fixture-token",
      },
      validatorPath,
      nodeArguments,
    );
    return { ...result, requests };
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
}

function json(response, status, value, headers = {}) {
  response.writeHead(status, {
    "content-type": "application/json",
    ...headers,
  });
  response.end(JSON.stringify(value));
}

function runValidator(
  environment,
  validatorPath = validator,
  nodeArguments = [],
) {
  return runNode([...nodeArguments, validatorPath], {
    cwd: repositoryRoot,
    env: { ...process.env, ...environment },
  });
}

function runNode(nodeArguments, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, nodeArguments, options);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function requested(result, method, url) {
  return result.requests.some(
    (candidate) => candidate.method === method && candidate.url === url,
  );
}

function eventReads(result) {
  return result.requests.filter(
    ({ method, url }) =>
      method === "GET" &&
      url === "/repos/example/repository/issues/42/events?per_page=100",
  ).length;
}

function permissionLookups(result) {
  return result.requests
    .map(
      ({ url }) =>
        url.match(
          /^\/repos\/example\/repository\/collaborators\/([^/]+)\/permission$/,
        )?.[1],
    )
    .filter(Boolean)
    .map(decodeURIComponent)
    .sort();
}

function writes(result) {
  return result.requests
    .filter(({ method, url }) => method !== "GET" && url !== "/graphql")
    .map(({ method, url, body }) => [
      method,
      url,
      body ? JSON.parse(body) : null,
    ]);
}

test("runs from the exact installed workflow layout", async (t) => {
  const result = await exercise({
    validatorPath: installedValidator(t, "scripts/validate-issue-contract.mjs"),
    issue: {
      number: 42,
      body: bugBody,
      labels: [{ name: "bug" }, { name: "needs-triage" }],
      state: "open",
    },
  });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /valid bug report/i);
  assert.ok(result.requests.every(({ method }) => method === "GET"));
});

test("pull request comments are ignored before any API access", async () => {
  const result = await exercise({
    issue: { number: 42, body: "hostile", labels: [], state: "open" },
    event: {
      issue: {
        number: 42,
        pull_request: { url: "https://api.github.test/pulls/1" },
      },
    },
  });

  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.requests.length, 0);
});

test("the adapter reads every page and the role of each login a decision can consult", async (context) => {
  await context.test(
    "every discussion and timeline page and each readiness-label actor",
    async () => {
      const issue = {
        number: 42,
        body: ticketBody,
        labels: [{ name: "ready-for-agent" }],
        state: "open",
        updated_at: "2026-09-14T17:02:00Z",
      };
      const result = await exercise({
        issue,
        commentPages: [
          [{ id: 1, body: "Earlier discussion", user: { login: "reporter" } }],
          [approvedTicketFeedback(issue)],
        ],
        event: {
          action: "unlabeled",
          issue: {
            number: 42,
            body: issue.body,
            updated_at: "2026-09-14T17:01:00Z",
          },
          label: { name: "ready-for-agent" },
          sender: { login: "maintainer" },
        },
        issueEventPages: [
          [
            readinessReview,
            {
              id: 102,
              event: "unlabeled",
              label: { name: "ready-for-agent" },
              actor: { login: "maintainer" },
              created_at: "2026-09-14T17:01:00Z",
            },
          ],
          [
            {
              id: 103,
              event: "labeled",
              label: { name: "ready-for-agent" },
              actor: { login: "writer" },
              created_at: "2026-09-14T17:02:00Z",
            },
          ],
        ],
        // The decision needs only the reviewer's role. A failed lookup for another
        // actor is recorded without affecting it, and a 404 grants no role.
        permissions: {
          maintainer: {
            status: 403,
            body: { message: "Resource not accessible by integration" },
          },
        },
      });

      assert.equal(result.code, 1);
      assert.match(result.stderr, /@writer is not authorized/);
      assert.ok(
        requested(
          result,
          "GET",
          "/repos/example/repository/issues/42/comments?per_page=100&page=2",
        ),
      );
      assert.ok(
        requested(
          result,
          "GET",
          "/repos/example/repository/issues/42/events?per_page=100&page=2",
        ),
      );
      assert.deepEqual(permissionLookups(result), ["maintainer", "writer"]);
      const update = result.requests.find(
        ({ method, url }) => method === "PATCH" && url.endsWith("/comments/13"),
      );
      assert.match(JSON.parse(update.body).body, /"observedEventId":"103"/);
    },
  );

  await context.test(
    "the recorded reviewer of a creation-snapshot approval",
    async () => {
      const issue = {
        number: 42,
        node_id: "ISSUE_42",
        body: ticketBody,
        labels: [{ name: "ready-for-agent" }],
        state: "open",
        created_at: "2026-09-14T17:00:00Z",
      };
      const result = await exercise({
        issue,
        comments: [
          approvedTicketFeedback(issue, {
            reviewEventId: "opened:ISSUE_42:2026-09-14T17:00:00Z",
          }),
        ],
        issueEvents: [],
        event: { action: "reopened", issue: { number: 42 } },
        permissions: {
          maintainer: { permission: "admin", role_name: "admin" },
        },
      });

      assert.equal(result.code, 0, result.stderr);
      assert.deepEqual(permissionLookups(result), ["maintainer"]);
      assert.deepEqual(writes(result), []);
    },
  );

  await context.test("the sender of an opening event", async () => {
    const issue = {
      number: 42,
      node_id: "ISSUE_42",
      body: specificationBody,
      labels: [{ name: "ready-for-agent" }],
      state: "open",
      created_at: "2026-09-14T17:00:00Z",
      updated_at: "2026-09-14T17:00:00Z",
    };
    const result = await exercise({
      issue,
      issueEvents: [],
      event: {
        action: "opened",
        issue: {
          number: 42,
          body: issue.body,
          labels: issue.labels,
          created_at: issue.created_at,
          updated_at: issue.updated_at,
        },
        sender: { login: "maintainer" },
      },
      permissions: { maintainer: { permission: "admin", role_name: "admin" } },
    });

    assert.equal(result.code, 0, result.stderr);
    assert.match(
      result.stdout,
      /valid specification with ready-for-agent bound/i,
    );
    assert.deepEqual(permissionLookups(result), ["maintainer"]);
  });

  await context.test(
    "the opener of an issue created with readiness when the labeled run arrives first",
    async () => {
      const { issue, event, issueEvents } = createdWithReadiness({
        run: "labeled",
      });
      const result = await exercise({
        issue,
        issueEvents,
        event,
        permissions: {
          maintainer: { permission: "admin", role_name: "admin" },
        },
      });

      assert.equal(result.code, 0, result.stderr);
      assert.match(
        result.stdout,
        /valid implementation ticket with ready-for-agent bound/i,
      );
      assert.deepEqual(permissionLookups(result), ["maintainer"]);
      const [write, ...otherWrites] = writes(result);
      assert.deepEqual(otherWrites, []);
      assert.deepEqual(write.slice(0, 2), [
        "POST",
        "/repos/example/repository/issues/42/comments",
      ]);
      assert.match(write[2].body, /"reviewEventId":"101"/);
    },
  );
});

test("the adapter applies the decision's writes in order and exits with its status", async (context) => {
  await context.test("an invalid contract", async () => {
    const result = await exercise({
      issue: {
        number: 42,
        body: "## Steps to reproduce\n\n_No response_\n\n## Expected behavior\n\nWorks.\n\n## Actual behavior\n\nBroken.",
        labels: [{ name: "bug" }, { name: "ready-for-agent" }],
        state: "open",
      },
    });

    assert.equal(result.code, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /Steps to reproduce/);
    const applied = writes(result);
    assert.deepEqual(
      applied.map(([method, url]) => [method, url]),
      [
        [
          "DELETE",
          "/repos/example/repository/issues/42/labels/ready-for-agent",
        ],
        ["POST", "/repos/example/repository/issues/42/labels"],
        ["POST", "/repos/example/repository/issues/42/comments"],
      ],
    );
    assert.deepEqual(applied[1][2], { labels: ["needs-triage"] });
    assert.match(
      applied[2][2].body,
      /Replace the placeholder under `Steps to reproduce`/,
    );
  });

  await context.test("a valid contract", async () => {
    const issue = { number: 42, body: ticketBody, labels: [], state: "open" };
    const result = await exercise({
      issue,
      comments: [approvedTicketFeedback(issue)],
      issueEvents: [
        readinessReview,
        {
          ...readinessReview,
          id: 102,
          event: "unlabeled",
          created_at: "2026-09-14T17:01:00Z",
        },
      ],
      event: {
        action: "unlabeled",
        issue: { number: 42, body: issue.body },
        label: { name: "ready-for-agent" },
        sender: { login: "maintainer" },
      },
    });

    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.match(
      result.stdout,
      /valid implementation ticket; awaiting authorized review/i,
    );
    assert.ok(
      requested(result, "POST", "/graphql"),
      "a direct-body contract reads its edit revision",
    );
    const applied = writes(result);
    assert.deepEqual(
      applied.map(([method, url]) => [method, url]),
      [
        ["POST", "/repos/example/repository/issues/42/labels"],
        ["PATCH", "/repos/example/repository/issues/comments/13"],
      ],
    );
    assert.deepEqual(applied[0][2], { labels: ["needs-triage"] });
    assert.match(applied[1][2].body, /awaiting review/i);
  });
});

test("the adapter treats unavailable endpoints as absent and records a failed permission lookup", async (context) => {
  await context.test("relationships", async () => {
    const result = await exercise({
      issue: {
        number: 42,
        body: "## What to build\n\nAdd caching.\n\n## Acceptance criteria\n\n- [ ] Search is fast.\n\n## Blocked by\n\n#41",
        labels: [],
        state: "open",
      },
      blockedByStatus: 404,
      relatedIssues: {
        "/repos/example/repository/issues/41": {
          number: 41,
          state: "open",
          labels: [],
        },
      },
    });

    assert.equal(result.code, 0, result.stderr);
    assert.ok(
      requested(result, "GET", "/repos/example/repository/issues/42/parent"),
    );
    assert.ok(
      requested(
        result,
        "GET",
        "/repos/example/repository/issues/42/dependencies/blocked_by?per_page=100",
      ),
    );
    assert.ok(requested(result, "GET", "/repos/example/repository/issues/41"));
  });

  await context.test("permission lookup", async () => {
    const issue = {
      number: 42,
      body: ticketBody,
      labels: [{ name: "ready-for-agent" }],
      state: "open",
      updated_at: "2026-09-14T17:00:00Z",
    };
    const result = await exercise({
      issue,
      comments: [awaitingTicketFeedback(issue)],
      issueEvents: [readinessReview],
      event: labeledBy("maintainer", "ready-for-agent", issue),
      permissions: {
        maintainer: {
          status: 403,
          body: { message: "Resource not accessible by integration" },
        },
      },
    });

    assert.equal(result.code, 1);
    assert.match(
      result.stderr,
      /could not verify @maintainer's review authority: GitHub API GET .*\/permission returned 403/i,
    );
    assert.ok(
      requested(
        result,
        "DELETE",
        "/repos/example/repository/issues/42/labels/ready-for-agent",
      ),
    );
  });
});

// Hides `import.meta.main` from the validator, as on Node.js releases before
// 24.2, so the adapter must fall back to comparing the resolved script paths.
// It reports on stderr that it applied, so a test cannot pass through the real
// `import.meta.main` unnoticed.
const hiddenImportMetaMain = "import.meta.main hidden from the validator";
const withoutImportMetaMain = `import { registerHooks } from "node:module";
registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (!url.endsWith("/scripts/validate-issue-contract.mjs")) return result;
    const source = String(result.source);
    if (!source.includes("import.meta.main")) throw new Error("The validator no longer reads import.meta.main.");
    process.stderr.write("${hiddenImportMetaMain}\\n");
    return { ...result, source: source.replaceAll("import.meta.main", "undefined") };
  },
});
`;

// Imports the validator and prints its exports and every file-system or
// network call made from repository code (the validator, the shared runtime,
// or the vendored parsers) while it loads, excluding the module loader's reads.
const importProbe = `import fs from "node:fs";
import fsp from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
const [validatorUrl, repositoryUrl] = process.argv.slice(2);
const calls = [];
const record = (label) => {
  if ((new Error().stack ?? "").includes(repositoryUrl)) calls.push(label);
};
const wrap = (object, name, label) => {
  const original = object[name];
  const descriptor = Object.getOwnPropertyDescriptor(object, name);
  if (typeof original !== "function" || (!descriptor?.writable && !descriptor?.set)) return;
  object[name] = function (...args) {
    record(label + "." + name);
    return original.apply(this, args);
  };
};
for (const name of Object.keys(fs)) wrap(fs, name, "fs");
for (const name of Object.keys(fsp)) wrap(fsp, name, "fs.promises");
syncBuiltinESMExports();
const originalFetch = globalThis.fetch;
globalThis.fetch = (...args) => {
  record("fetch");
  return originalFetch(...args);
};
const validatorModule = await import(validatorUrl);
console.log(JSON.stringify({ exports: Object.keys(validatorModule), calls }));
`;

async function scratchFiles(t, files) {
  const root = await mkdtemp(join(tmpdir(), "repo-canon-issue-adapter-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files))
    await writeFile(join(root, name), content);
  return root;
}

async function probeImport(root, nodeArguments = []) {
  const env = { ...process.env };
  for (const name of Object.keys(env))
    if (name.startsWith("GITHUB_")) delete env[name];
  const result = await runNode(
    [
      ...nodeArguments,
      join(root, "probe.mjs"),
      pathToFileURL(validator).href,
      pathToFileURL(repositoryRoot).href,
    ],
    { cwd: root, env },
  );
  assert.equal(result.code, 0, result.stderr);
  return { ...JSON.parse(result.stdout), stderr: result.stderr };
}

test("the adapter runs only when the validator is executed directly", async (context) => {
  await context.test(
    "an import on a release with import.meta.main makes no I/O",
    async (t) => {
      const root = await scratchFiles(t, { "probe.mjs": importProbe });
      const { stderr, ...probe } = await probeImport(root);
      assert.deepEqual(probe, {
        exports: ["decideIssueContract", "readinessTriggerUnrecorded"],
        calls: [],
      });
      assert.equal(stderr, "");
    },
  );

  await context.test(
    "an import on a release without import.meta.main only resolves the compared paths",
    async (t) => {
      const root = await scratchFiles(t, {
        "probe.mjs": importProbe,
        "hook.mjs": withoutImportMetaMain,
      });
      const { stderr, ...probe } = await probeImport(root, [
        "--import",
        join(root, "hook.mjs"),
      ]);
      assert.match(stderr, new RegExp(hiddenImportMetaMain));
      assert.deepEqual(probe, {
        exports: ["decideIssueContract", "readinessTriggerUnrecorded"],
        calls: ["fs.realpathSync", "fs.realpathSync"],
      });
    },
  );

  await context.test(
    "execution through a symlink on a release without import.meta.main",
    async (t) => {
      const root = await scratchFiles(t, { "hook.mjs": withoutImportMetaMain });
      const linked = join(root, "validate-issue-contract.mjs");
      await symlink(validator, linked);
      const result = await exercise({
        validatorPath: linked,
        nodeArguments: ["--import", join(root, "hook.mjs")],
        issue: {
          number: 42,
          body: bugBody,
          labels: [{ name: "bug" }, { name: "needs-triage" }],
          state: "open",
        },
      });

      assert.equal(result.code, 0, result.stderr);
      assert.match(result.stderr, new RegExp(hiddenImportMetaMain));
      assert.match(result.stdout, /valid bug report/i);
      assert.ok(
        requested(result, "GET", "/repos/example/repository/issues/42"),
      );
    },
  );
});

// Replaces the validator's wait for the timeline with an immediate one that
// reports each requested delay on stderr, so a test uses no real time.
const instantWait = `import timers from "node:timers/promises";
import { syncBuiltinESMExports } from "node:module";
timers.setTimeout = async (delay, value) => {
  process.stderr.write("waited " + delay + "\\n");
  return value;
};
syncBuiltinESMExports();
`;

function waits(result) {
  return [...result.stderr.matchAll(/^waited (\d+)$/gm)].map(([, delay]) =>
    Number(delay),
  );
}

// A maintainer's fresh readiness label after the bot removed the opener's
// rejected creation label, with each timeline the run can read: the opener's
// creation label alone, the bot's cleanup, and the maintainer's label.
function freshGrant() {
  const { issue, event } = createdWithReadiness({
    run: "labeled",
    opener: "reporter",
    labeler: "maintainer",
    currentLabels: ["needs-triage", "ready-for-agent"],
  });
  issue.updated_at = "2026-09-14T17:01:00Z";
  event.issue.updated_at = issue.updated_at;
  const creation = creationLabel({ actor: { login: "reporter" } });
  const cleanup = [
    creation,
    { ...creation, id: 102, event: "unlabeled", actor: bot },
    {
      ...creation,
      id: 103,
      label: { name: "needs-triage" },
      actor: bot,
    },
  ];
  const feedback = awaitingTicketFeedback(issue, { observedEventId: "101" });
  feedback.updated_at = "2026-09-14T17:00:05Z";
  return {
    issue,
    event,
    comments: [feedback],
    permissions: {
      reporter: { permission: "write", role_name: "write" },
      maintainer: { permission: "admin", role_name: "admin" },
    },
    timelines: {
      creation: [creation],
      cleanup,
      recorded: [
        ...cleanup,
        {
          ...creation,
          id: 104,
          actor: { login: "maintainer" },
          created_at: "2026-09-14T17:01:00Z",
        },
      ],
    },
  };
}

test("the adapter waits, within its bound, for the timeline to record a human readiness trigger", async (context) => {
  async function exerciseWaiting(t, options) {
    const root = await scratchFiles(t, { "wait.mjs": instantWait });
    return exercise({
      ...options,
      nodeArguments: ["--import", join(root, "wait.mjs")],
    });
  }

  await context.test(
    "a trigger recorded by a later read is decided from that read",
    async (t) => {
      const { timelines, ...grant } = freshGrant();
      const result = await exerciseWaiting(t, {
        ...grant,
        issueEventReads: [
          timelines.creation,
          timelines.cleanup,
          timelines.recorded,
        ],
      });

      assert.equal(result.code, 0, result.stderr);
      assert.match(
        result.stdout,
        /valid implementation ticket with ready-for-agent bound/i,
      );
      assert.equal(eventReads(result), 3);
      assert.deepEqual(waits(result), [2000, 2000]);
      const applied = writes(result);
      assert.deepEqual(
        applied.map(([method, url]) => [method, url]),
        [
          ["DELETE", "/repos/example/repository/issues/42/labels/needs-triage"],
          ["PATCH", "/repos/example/repository/issues/comments/13"],
        ],
      );
      assert.match(applied[1][2].body, /reviewed by @maintainer/);
      assert.match(applied[1][2].body, /"reviewEventId":"104"/);
    },
  );

  await context.test(
    "a trigger never recorded is decided once from the last read after the bound and fails closed",
    async (t) => {
      const { timelines, ...grant } = freshGrant();
      const result = await exerciseWaiting(t, {
        ...grant,
        issueEventReads: [timelines.creation],
      });

      assert.equal(result.code, 1);
      assert.match(
        result.stderr,
        /timeline does not contain the current readiness label event/,
      );
      assert.doesNotMatch(result.stderr, /not authorized/);
      assert.equal(eventReads(result), 16);
      assert.deepEqual(waits(result), Array(15).fill(2000));
      assert.deepEqual(
        writes(result).map(([method, url]) => [method, url]),
        [
          [
            "DELETE",
            "/repos/example/repository/issues/42/labels/ready-for-agent",
          ],
          ["PATCH", "/repos/example/repository/issues/comments/13"],
        ],
      );
    },
  );

  await context.test(
    "a creation labeled run that first reads an empty timeline records the opener's rejection",
    async (t) => {
      const { issue, event } = createdWithReadiness({
        run: "labeled",
        opener: "reporter",
      });
      const result = await exerciseWaiting(t, {
        issue,
        event,
        issueEventReads: [
          [],
          [creationLabel({ actor: { login: "reporter" } })],
        ],
        permissions: { reporter: { permission: "write", role_name: "write" } },
      });

      assert.equal(result.code, 1);
      assert.match(result.stderr, /@reporter is not authorized/);
      assert.equal(eventReads(result), 2);
      assert.deepEqual(waits(result), [2000]);
      const comment = writes(result).find(
        ([method, url]) =>
          method === "POST" &&
          url === "/repos/example/repository/issues/42/comments",
      );
      assert.match(
        comment[2].body,
        /"rejectedCreationLabel":"ready-for-agent"/,
      );
    },
  );

  for (const [name, variant] of [
    [
      "an opened run",
      () => {
        const { issue, event } = createdWithReadiness({ run: "opened" });
        return {
          issue,
          event,
          permissions: {
            maintainer: { permission: "admin", role_name: "admin" },
          },
        };
      },
    ],
    [
      "a trigger by github-actions[bot]",
      () => {
        const { timelines: _, ...grant } = freshGrant();
        return { ...grant, event: labeledBy(bot.login, "ready-for-agent") };
      },
    ],
    [
      "a non-readiness label",
      () => {
        const { timelines: _, ...grant } = freshGrant();
        return { ...grant, event: labeledBy("maintainer", "needs-triage") };
      },
    ],
    [
      "a readiness trigger whose label is gone from the re-fetched issue",
      () => {
        const { timelines: _, ...grant } = freshGrant();
        grant.issue.labels = [{ name: "needs-triage" }];
        return grant;
      },
    ],
  ]) {
    await context.test(`${name} reads the events once`, async (t) => {
      const result = await exerciseWaiting(t, {
        ...variant(),
        issueEventReads: [
          [],
          [creationLabel({ actor: { login: "maintainer" }, id: 104 })],
        ],
      });

      assert.equal(eventReads(result), 1, result.stderr);
      assert.deepEqual(waits(result), []);
    });
  }
});
