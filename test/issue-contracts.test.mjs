import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const repository = "example/repository";

async function exercise({
  issue,
  comments = [],
  commentPages,
  blockedBy = [],
  blockedByStatus = 200,
  parent = null,
  event = {},
  relatedIssues = {},
}) {
  const requests = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    requests.push({ method: request.method, url: request.url, body });

    const issuePath = "/repos/example/repository/issues/42";
    if (request.method === "GET" && request.url === issuePath) {
      return json(response, 200, issue);
    }
    if (request.method === "GET" && request.url === `${issuePath}/comments?per_page=100`) {
      const pages = commentPages ?? [comments];
      const headers = pages.length > 1
        ? { link: `<http://127.0.0.1:${server.address().port}${issuePath}/comments?per_page=100&page=2>; rel="next"` }
        : {};
      return json(response, 200, pages[0], headers);
    }
    if (request.method === "GET" && request.url === `${issuePath}/comments?per_page=100&page=2`) {
      return json(response, 200, commentPages?.[1] ?? []);
    }
    if (request.method === "GET" && request.url === `${issuePath}/dependencies/blocked_by?per_page=100`) {
      const responseBody = blockedByStatus === 200 ? blockedBy : { message: "Issue dependencies are unavailable" };
      return json(response, blockedByStatus, responseBody);
    }
    if (request.method === "GET" && request.url === `${issuePath}/parent`) {
      return parent ? json(response, 200, parent) : json(response, 404, { message: "No parent issue found" });
    }
    if (request.method === "GET" && Object.hasOwn(relatedIssues, request.url)) {
      return json(response, 200, relatedIssues[request.url]);
    }
    if (request.method === "POST" && request.url === `${issuePath}/comments`) {
      comments.push({ id: 99, body: JSON.parse(body).body, user: { login: "github-actions[bot]" } });
      return json(response, 201, comments.at(-1));
    }
    if (request.method === "DELETE" && request.url?.startsWith(`${issuePath}/labels/`)) {
      return json(response, 200, {});
    }
    if (request.method === "POST" && request.url === `${issuePath}/labels`) {
      return json(response, 200, {});
    }
    if (request.method === "PATCH" && request.url?.startsWith("/repos/example/repository/issues/comments/")) {
      const comment = comments.find(({ id }) => request.url.endsWith(`/${id}`));
      if (comment) comment.body = JSON.parse(body).body;
      return json(response, 200, {});
    }
    return json(response, 404, { message: `${request.method} ${request.url}` });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const directory = await mkdtemp(join(tmpdir(), "repo-canon-issue-contract-"));
  const eventPath = join(directory, "event.json");
  await writeFile(eventPath, JSON.stringify({ issue: { number: 42 }, ...event }));

  try {
    const result = await runValidator({
      GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_REPOSITORY: repository,
      GITHUB_TOKEN: "fixture-token",
    });
    return { ...result, requests };
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
}

function json(response, status, value, headers = {}) {
  response.writeHead(status, { "content-type": "application/json", ...headers });
  response.end(JSON.stringify(value));
}

function runValidator(environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/validate-issue-contract.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, ...environment },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("a complete public bug report is accepted without changing the issue", async () => {
  const result = await exercise({
    issue: {
      number: 42,
      body: "## Steps to reproduce\n\nRun the command.\n\n## Expected behavior\n\nIt exits.\n\n## Actual behavior\n\nIt hangs.",
      labels: [{ name: "bug" }, { name: "needs-triage" }],
      state: "open",
    },
  });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /valid bug report/i);
  assert.ok(result.requests.every(({ method }) => method === "GET"));
});

test("an incomplete ready bug report loses readiness and receives actionable feedback", async () => {
  const result = await exercise({
    issue: {
      number: 42,
      body: "## Steps to reproduce\n\n_No response_\n\n## Expected behavior\n\nWorks.\n\n## Actual behavior\n\nBroken.",
      labels: [{ name: "bug" }, { name: "ready-for-agent" }],
      state: "open",
    },
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /Steps to reproduce/);
  assert.ok(result.requests.some(({ method, url }) => method === "DELETE" && url.endsWith("/labels/ready-for-agent")));
  const feedback = result.requests.find(({ method, url }) => method === "POST" && url.endsWith("/comments"));
  assert.match(JSON.parse(feedback.body).body, /Replace the placeholder under `Steps to reproduce`/);
});

test("all public forms accept harmless heading variations and absent optional answers", async (context) => {
  const examples = [
    {
      name: "feature request",
      body: "### PROBLEM\n\nSearch is slow.\n\n### Desired Outcome\n\nSearch finishes quickly.",
      labels: [{ name: "enhancement" }, { name: "needs-triage" }],
    },
    {
      name: "implementation ticket",
      body: "#### What To Build\n\nAdd caching.\n\n#### ACCEPTANCE CRITERIA\n\n- [ ] Search is fast.\n\n#### Blocked By\n\nNone.",
      labels: [{ name: "ready-for-agent" }],
    },
    {
      name: "specification",
      body: "# Problem Statement\n\nSearch is slow.\n\n## Solution\n\nAdd caching.\n\n### User Stories\n\n1. As a user, I want fast search.\n\n#### Implementation Decisions\n\n_No response_\n\n##### Testing Decisions\n\n_No response_\n\n###### Out Of Scope\n\nNone.\n\n## Further Notes\n\n_No response_",
      labels: [{ name: "ready-for-agent" }],
    },
  ];

  for (const example of examples) {
    await context.test(example.name, async () => {
      const result = await exercise({ issue: { number: 42, body: example.body, labels: example.labels, state: "open" } });
      assert.equal(result.code, 0, result.stderr);
    });
  }
});

test("headings inside form answers do not change the recognized contract", async () => {
  const result = await exercise({
    issue: {
      number: 42,
      body: "### Problem\n\nSearch is slow.\n\n## What to build\n\nThis heading is supporting detail, not a ticket.\n\n### Desired outcome\n\nSearch finishes quickly.",
      labels: [{ name: "enhancement" }, { name: "needs-triage" }],
      state: "open",
    },
  });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /valid feature request/i);
});

test("a nested heading can begin a required form answer", async () => {
  const result = await exercise({
    issue: {
      number: 42,
      body: "### Problem\n\n#### Context\n\nSearch is slow.\n\n### Desired outcome\n\nSearch finishes quickly.",
      labels: [{ name: "enhancement" }, { name: "needs-triage" }],
      state: "open",
    },
  });

  assert.equal(result.code, 0, result.stderr);
});

test("contract-like headings inside fenced examples remain answer content", async () => {
  const result = await exercise({
    issue: {
      number: 42,
      body: "### Problem\n\nSearch is slow.\n\n```md\n### Problem\n\n_No response_\n\n### Desired outcome\n\n_No response_\n```\n\n### Desired outcome\n\nSearch finishes quickly.",
      labels: [{ name: "enhancement" }, { name: "needs-triage" }],
      state: "open",
    },
  });

  assert.equal(result.code, 0, result.stderr);
});

test("an empty checklist is rejected as a required-field placeholder", async () => {
  const result = await exercise({
    issue: {
      number: 42,
      body: "## What to build\n\nAdd caching.\n\n## Acceptance criteria\n\n- [ ]\n\n## Blocked by\n\nNone.",
      labels: [{ name: "ready-for-agent" }],
      state: "open",
    },
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /Acceptance criteria/);
});

test("a native ticket can use relationships and remain valid with an open blocker", async () => {
  const result = await exercise({
    issue: {
      number: 42,
      body: "## What to build\n\nAdd caching.\n\n## Acceptance criteria\n\n- [ ] Search is fast.\n\n## Blocked by\n\n_No response_",
      labels: [{ name: "ready-for-agent" }],
      state: "open",
    },
    blockedBy: [{ number: 41, state: "open", html_url: "https://github.com/example/repository/issues/41" }],
    parent: { number: 7, state: "open", labels: [] },
  });

  assert.equal(result.code, 0, result.stderr);
  assert.ok(result.requests.some(({ method, url }) => method === "GET" && url.endsWith("/issues/42/parent")));
});

test("a Wayfinder map accepts empty initial decisions and a child reads its parent", async (context) => {
  await context.test("map", async () => {
    const result = await exercise({
      issue: {
        number: 42,
        body: "## Destination\n\nChoose a cache.\n\n## Notes\n\nUse the domain model.\n\n## Decisions so far\n\n<!-- none yet -->\n\n## Not yet specified\n\nEviction policy.\n\n## Out of scope\n\n",
        labels: [{ name: "wayfinder:map" }],
        state: "open",
      },
    });
    assert.equal(result.code, 0, result.stderr);
  });

  await context.test("child", async () => {
    const result = await exercise({
      issue: {
        number: 42,
        body: "## Question\n\nWhich cache meets the latency target?",
        labels: [{ name: "wayfinder:research" }],
        state: "open",
      },
      blockedBy: [{ number: 41, state: "open" }],
      parent: { number: 7, state: "open", labels: [{ name: "wayfinder:map" }] },
    });
    assert.equal(result.code, 0, result.stderr);
    assert.ok(result.requests.some(({ url }) => url?.endsWith("/issues/42/parent")));
  });
});

test("a Wayfinder child rejects an empty parent fallback", async () => {
  const result = await exercise({
    issue: {
      number: 42,
      body: "## Parent\n\n_No response_\n\n## Question\n\nWhich cache meets the latency target?",
      labels: [{ name: "wayfinder:research" }],
      state: "open",
    },
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /parent map/i);
});

test("all seven native specification sections are recognized", async () => {
  const result = await exercise({
    issue: {
      number: 42,
      body: "## Problem Statement\n\nA problem.\n\n## Solution\n\nA solution.\n\n## User Stories\n\n1. As a user, I want a result.\n\n## Implementation Decisions\n\n_No response_\n\n## Testing Decisions\n\n_No response_\n\n## Out of Scope\n\nNone.\n\n## Further Notes\n\n_No response_",
      labels: [{ name: "ready-for-agent" }],
      state: "open",
    },
  });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /valid specification/i);
});

test("a native specification missing one of its seven headings is incomplete", async () => {
  const result = await exercise({
    issue: {
      number: 42,
      body: "## Problem Statement\n\nA problem.\n\n## Solution\n\nA solution.\n\n## User Stories\n\n1. As a user, I want a result.\n\n## Implementation Decisions\n\nNone.\n\n## Testing Decisions\n\nNone.\n\n## Out of Scope\n\nNone.",
      labels: [{ name: "ready-for-agent" }],
      state: "open",
    },
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /Further Notes/);
});

test("a ready triaged request requires a complete latest Agent Brief and exact preamble position", async () => {
  const result = await exercise({
    issue: {
      number: 42,
      body: "## Problem\n\nSearch is slow.\n\n## Desired outcome\n\nSearch finishes quickly.",
      labels: [{ name: "enhancement" }, { name: "ready-for-agent" }],
      state: "open",
    },
    comments: [{
      id: 12,
      user: { login: "maintainer" },
      body: "Unrelated text must not precede the preamble.\n\n> *This was generated by AI during triage.*\n\n## Agent Brief\n\n**Category:** enhancement\n**Summary:** Make search fast\n\n**Current behavior:**\nSearch is slow.\n\n**Desired behavior:**\nSearch finishes quickly.\n\n**Key interfaces:**\n- Search requests\n\n**Acceptance criteria:**\n- [ ] Search meets the target.\n\n**Out of scope:**\n- Changing storage",
    }],
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /Start the Agent Brief comment/);
});

test("the latest Agent Brief is found across the complete discussion", async () => {
  const brief = "> *This was generated by AI during triage.*\n\n## Agent Brief\n\n**Category:** enhancement\n**Summary:** Make search fast\n\n**Current behavior:**\nSearch is slow.\n\n**Desired behavior:**\nSearch finishes quickly.\n\n**Key interfaces:**\n- Search requests\n\n**Acceptance criteria:**\n- [ ] Search meets the target.\n\n**Out of scope:**\n- Changing storage";
  const result = await exercise({
    issue: {
      number: 42,
      body: "## Problem\n\nSearch is slow.\n\n## Desired outcome\n\nSearch finishes quickly.",
      labels: [{ name: "enhancement" }, { name: "ready-for-agent" }],
      state: "open",
    },
    commentPages: [
      [{ id: 1, body: "Earlier discussion", user: { login: "reporter" } }],
      [{ id: 2, body: brief, user: { login: "maintainer" } }],
    ],
  });

  assert.equal(result.code, 0, result.stderr);
  assert.ok(result.requests.some(({ url }) => url?.includes("page=2")));
});

test("a triaged Agent Brief remains authoritative over intake body headings", async () => {
  const brief = "> *This was generated by AI during triage.*\n\n## Agent Brief\n\n**Category:** enhancement\n**Summary:** Make search fast\n\n**Current behavior:**\nSearch is slow.\n\n**Desired behavior:**\nSearch finishes quickly.\n\n**Key interfaces:**\n- Search requests\n\n**Acceptance criteria:**\n- [ ] Search meets the target.\n\n**Out of scope:**\n- Changing storage";
  const result = await exercise({
    issue: {
      number: 42,
      body: "Free-form intake context.\n\n## Acceptance criteria\n\nThe result should be fast.",
      labels: [{ name: "enhancement" }, { name: "ready-for-agent" }],
      state: "open",
    },
    comments: [{ id: 1, body: brief, user: { login: "maintainer" } }],
  });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /valid triaged Agent Brief/i);
});

test("an Agent Brief heading inside a fenced discussion example is ignored", async () => {
  const brief = "> *This was generated by AI during triage.*\n\n## Agent Brief\n\n**Category:** enhancement\n**Summary:** Make search fast\n\n**Current behavior:**\nSearch is slow.\n\n**Desired behavior:**\nSearch finishes quickly.\n\n**Key interfaces:**\n- Search requests\n\n**Acceptance criteria:**\n- [ ] Search meets the target.\n\n**Out of scope:**\n- Changing storage";
  const result = await exercise({
    issue: {
      number: 42,
      body: "## Problem\n\nSearch is slow.\n\n## Desired outcome\n\nSearch finishes quickly.",
      labels: [{ name: "enhancement" }, { name: "ready-for-agent" }],
      state: "open",
    },
    comments: [
      { id: 1, body: brief, user: { login: "maintainer" } },
      { id: 2, body: "Example only:\n\n```md\n## Agent Brief\n\n**Summary:** Do not select this.\n```", user: { login: "reporter" } },
    ],
  });

  assert.equal(result.code, 0, result.stderr);
});

test("explicit parent and blocker links are read when native relationships are absent", async () => {
  const result = await exercise({
    issue: {
      number: 42,
      body: "## Parent\n\n#7\n\n## What to build\n\nAdd caching.\n\n## Acceptance criteria\n\n- [ ] Search is fast.\n\n## Blocked by\n\nhttps://github.com/example/repository/issues/41",
      labels: [{ name: "ready-for-agent" }],
      state: "open",
    },
    relatedIssues: {
      "/repos/example/repository/issues/7": { number: 7, state: "open", labels: [] },
      "/repos/example/repository/issues/41": { number: 41, state: "open", labels: [] },
    },
  });

  assert.equal(result.code, 0, result.stderr);
  assert.ok(result.requests.some(({ url }) => url === "/repos/example/repository/issues/7"));
  assert.ok(result.requests.some(({ url }) => url === "/repos/example/repository/issues/41"));
});

test("explicit blocker links are used when the native dependency endpoint is unavailable", async () => {
  const result = await exercise({
    issue: {
      number: 42,
      body: "## What to build\n\nAdd caching.\n\n## Acceptance criteria\n\n- [ ] Search is fast.\n\n## Blocked by\n\n```md\n#999\n```\n\nhttps://github.com/example/repository/issues/41",
      labels: [{ name: "ready-for-agent" }],
      state: "open",
    },
    blockedByStatus: 404,
    relatedIssues: {
      "/repos/example/repository/issues/41": { number: 41, state: "open", labels: [] },
    },
  });

  assert.equal(result.code, 0, result.stderr);
  assert.ok(result.requests.some(({ url }) => url === "/repos/example/repository/issues/41"));
  assert.ok(!result.requests.some(({ url }) => url === "/repos/example/repository/issues/999"));
});

test("an unresolvable blocker link removes readiness with actionable feedback", async () => {
  const result = await exercise({
    issue: {
      number: 42,
      body: "## What to build\n\nAdd caching.\n\n## Acceptance criteria\n\n- [ ] Search is fast.\n\n## Blocked by\n\nhttps://github.com/example/repository/issues/999",
      labels: [{ name: "ready-for-agent" }],
      state: "open",
    },
  });

  assert.equal(result.code, 1);
  assert.ok(result.requests.some(({ method, url }) => method === "DELETE" && url.endsWith("/ready-for-agent")));
  const feedback = result.requests.find(({ method, url }) => method === "POST" && url.endsWith("/comments"));
  assert.match(JSON.parse(feedback.body).body, /could not resolve.*Blocked by/i);
});

test("repeated invalid events maintain one feedback comment", async () => {
  const feedback = "<!-- repo-canon:issue-contract-feedback -->\n## Issue contract needs attention\n\n- Replace the placeholder under `Problem` with the required information.\n\nFix the items above. Structural validation will re-run, but only an authorized reviewer can grant readiness.";
  const result = await exercise({
    issue: {
      number: 42,
      body: "## Problem\n\n_No response_\n\n## Desired outcome\n\nFast search.",
      labels: [{ name: "enhancement" }, { name: "needs-triage" }],
      state: "open",
    },
    comments: [{ id: 9, body: feedback, user: { login: "github-actions[bot]" } }],
  });

  assert.equal(result.code, 1);
  assert.equal(result.requests.filter(({ method }) => method === "POST" || method === "PATCH").length, 0);
});

test("a correction updates existing feedback without restoring readiness", async () => {
  const result = await exercise({
    issue: {
      number: 42,
      body: "## What to build\n\nAdd caching.\n\n## Acceptance criteria\n\n- [ ] Search is fast.\n\n## Blocked by\n\nNone.",
      labels: [],
      state: "open",
    },
    comments: [{
      id: 9,
      body: "<!-- repo-canon:issue-contract-feedback -->\n## Issue contract needs attention\n\n- Fix it.",
      user: { login: "github-actions[bot]" },
    }],
  });

  assert.equal(result.code, 0, result.stderr);
  assert.ok(result.requests.some(({ method, url, body }) => method === "PATCH" && url.endsWith("/comments/9") && /fresh authorized review/i.test(body)));
  assert.ok(!result.requests.some(({ url }) => url.includes("/labels")));
});

test("an invalid direct contract loses readiness without acquiring intake labels", async () => {
  const result = await exercise({
    issue: {
      number: 42,
      body: "## Problem Statement\n\nA problem.\n\n## Solution\n\nA solution.\n\n## User Stories\n\n_No response_\n\n## Out of Scope\n\nNone.",
      labels: [{ name: "ready-for-agent" }],
      state: "open",
    },
  });

  assert.equal(result.code, 1);
  assert.ok(result.requests.some(({ method, url }) => method === "DELETE" && url.endsWith("/ready-for-agent")));
  assert.ok(!result.requests.some(({ method, url }) => method === "POST" && url.endsWith("/labels")));
});

test("event payload content cannot override re-fetched authoritative state", async () => {
  const result = await exercise({
    issue: {
      number: 42,
      body: "## Steps to reproduce\n\n_No response_\n\n## Expected behavior\n\nWorks.\n\n## Actual behavior\n\nBroken.",
      labels: [{ name: "bug" }, { name: "needs-triage" }],
      state: "open",
    },
    event: {
      action: "edited",
      issue: {
        number: 42,
        body: "## Steps to reproduce\n\nComplete stale payload.\n\n## Expected behavior\n\nWorks.\n\n## Actual behavior\n\nBroken.",
      },
    },
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /Steps to reproduce/);
});

test("pull request comments are ignored before any API access", async () => {
  const result = await exercise({
    issue: { number: 42, body: "hostile", labels: [], state: "open" },
    event: { issue: { number: 42, pull_request: { url: "https://api.github.test/pulls/1" } } },
  });

  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.requests.length, 0);
});

test("contract text is treated only as data", async () => {
  const directory = await mkdtemp(join(tmpdir(), "repo-canon-hostile-"));
  const sentinel = join(directory, "executed");
  try {
    const result = await exercise({
      issue: {
        number: 42,
        body: `## What to build\n\n$(touch ${sentinel})\n\n## Acceptance criteria\n\n- [ ] Never execute this text.\n\n## Blocked by\n\nNone.`,
        labels: [{ name: "ready-for-agent" }],
        state: "open",
      },
    });
    assert.equal(result.code, 0, result.stderr);
    await assert.rejects(() => access(sentinel), { code: "ENOENT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the workflow covers issue and comment changes using default-branch code", async () => {
  const workflow = await readFile(".github/workflows/issue-contracts.yml", "utf8");
  for (const activity of ["opened", "edited", "reopened", "labeled", "unlabeled", "created", "deleted"]) {
    assert.match(workflow, new RegExp(`\\b${activity}\\b`));
  }
  assert.match(workflow, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/);
  assert.match(workflow, /issues: write/);
  assert.doesNotMatch(workflow, /github\.event\.issue\.body/);
});
