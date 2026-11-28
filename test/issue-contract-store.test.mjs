import "./helpers/temporary-directory.mjs";
import { main as cutoff } from "../scripts/issue-contract-cutoff.mjs";
import { resolveBoundary } from "./helpers/contract-decision.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PlatformError } from "../vendor/postern/postern.mjs";
import {
  contractSourceConfiguration,
  loadContractSources,
  saveContractSourceRecord,
  sourceEditIdentities,
  sourceContentHistories,
  captureContractCutoff,
  installContractCutoff,
  captureContractIntake,
  recordContractPublication,
  requestContractEvaluation,
} from "../scripts/issue-contract-store.mjs";
import {
  cutoffFormat,
  bodyWithOriginal,
  intakeOriginal,
} from "../scripts/issue-contract-sources.mjs";
import { completeAgentBrief } from "./helpers/issue-contracts.mjs";
const identity = {
  release: "v1",
  sha: "a".repeat(40),
  epoch: "2026-11-09T00:00:00Z",
  publicationFrozen: true,
};
const receipt = {
  format: cutoffFormat,
  repository: "owner/repo",
  ...identity,
  complete: true,
  issues: [],
};
/** @param {any} [checks] */
function store(checks = ["Test"]) {
  const reads = [];
  const files = new Map();
  const writes = [];
  const nodes = {};
  let seq = 0;
  /** @type {any} */
  const connection = {
    repository: { path: "owner/repo" },
    access: {
      async request(input) {
        const [path, query] = input.path.split("?");
        if (path === "/graphql" && input.body.query.includes("PinnedFiles")) {
          reads.push(input);
          const revision = "d".repeat(40);
          return {
            data: {
              data: {
                repository: input.body.query.includes("PinnedFilesRevision")
                  ? {
                      nameWithOwner: connection.repository.path,
                      defaultBranchRef: {
                        name: "main",
                        target: { __typename: "Commit", oid: revision },
                      },
                    }
                  : {
                      commit: { __typename: "Commit", oid: revision },
                      requiredChecks:
                        checks === null
                          ? null
                          : {
                              __typename: "Blob",
                              isTruncated: false,
                              text: JSON.stringify({ version: 1, checks }),
                            },
                    },
              },
            },
          };
        }
        if (
          path === "/graphql" &&
          input.body.query.includes("ContractSourceHistory")
        ) {
          const id = input.body.variables.id;
          const node = nodes[id];
          const issue = await connection.issueTracker.issue(42);
          const comments = await connection.issueTracker.comments(42);
          const source =
            issue.nodeId === id
              ? issue
              : comments.find((comment) => comment.nodeId === id);
          return {
            data: {
              data: {
                node: node && {
                  id,
                  lastEditedAt: node.lastEditedAt,
                  userContentEdits: {
                    totalCount: node.userContentEdits?.nodes?.length ?? 0,
                    nodes: (node.userContentEdits?.nodes ?? []).map((edit) => ({
                      ...edit,
                      diff: edit.diff ?? source?.body ?? "",
                    })),
                    pageInfo: { hasNextPage: false, endCursor: null },
                  },
                },
              },
            },
          };
        }
        if (path === "/graphql")
          return {
            data: {
              data: { nodes: input.body.variables.ids.map((id) => nodes[id]) },
            },
          };
        const name = path.split("/contents/")[1];
        if (name) {
          if (input.method === "PUT") {
            const prior = files.get(name);
            if ((prior?.sha ?? undefined) !== input.body.sha)
              throw new Error("CAS conflict");
            const value = JSON.parse(
              Buffer.from(input.body.content, "base64").toString(),
            );
            const sha = `file-${++seq}`;
            files.set(name, { value, sha });
            writes.push(input);
            return {
              data: { content: { sha }, commit: { sha: "b".repeat(40) } },
            };
          }
          const found = files.get(name);
          if (!found) throw new PlatformError("notFound", "Missing");
          const bytes = Buffer.from(JSON.stringify(found.value));
          return {
            data: {
              type: "file",
              encoding: "base64",
              sha: found.sha,
              content: bytes.toString("base64"),
              size: bytes.length,
              ref: query,
            },
          };
        }
        if (input.method && input.method !== "GET") writes.push(input);
        if (path === "/repos/owner/repo")
          return { data: { default_branch: "main" } };
        if (path.includes("/git/ref/heads/"))
          return { data: { object: { sha: "c".repeat(40) } } };
        if (path.endsWith("/git/refs") || path.endsWith("/dispatches"))
          return { data: {} };
        throw new Error(`Unexpected ${input.path}`);
      },
    },
  };
  return { connection, files, writes, nodes, reads };
}
test("configuration absence is prepared; a downloaded release cannot activate body mode", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "mode-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "mode.json");
  assert.deepEqual(contractSourceConfiguration(path), { mode: "prepared" });
  writeFileSync(path, '{"mode":"body"}');
  assert.throws(() => contractSourceConfiguration(path), /immutable cutoff/);
  const { connection, writes } = store();
  assert.deepEqual(
    await loadContractSources(connection, 42, { mode: "prepared" }),
    { mode: "prepared" },
  );
  assert.equal(writes.length, 0);
});
test("cutoff capture includes held/skipped and unapproved entries without approval and rejects enumeration/race gaps", async () => {
  const { connection } = store();
  const inventory = {
    complete: true,
    issues: [{ number: 42, issue: "I42", legacy: null, intake: null }],
  };
  const captured = await captureContractCutoff(
    connection,
    identity,
    async () => inventory,
  );
  assert.equal(captured.issues.length, 1);
  assert.equal(captured.issues[0].legacy, null);
  await assert.rejects(
    () =>
      captureContractCutoff(
        connection,
        { ...identity, publicationFrozen: false },
        async () => inventory,
      ),
    /freeze/,
  );
  await assert.rejects(
    () =>
      captureContractCutoff(connection, identity, async () => ({
        ...inventory,
        complete: false,
      })),
    /incomplete/,
  );
  let reads = 0;
  await assert.rejects(
    () =>
      captureContractCutoff(connection, identity, async () =>
        ++reads === 1 ? inventory : { complete: true, issues: [] },
      ),
    /changed/,
  );
});
test("activation rechecks before committing receipt and before switching mode", async () => {
  const { connection, files, writes } = store();
  let reads = 0;
  await assert.rejects(
    () =>
      installContractCutoff(connection, receipt, async () => ({
        complete: true,
        issues: ++reads === 1 ? [] : [{ number: 99, issue: "I99" }],
      })),
    /before activation/,
  );
  assert.ok(files.has("cutoff.json"));
  assert.ok(!files.has(".github/issue-contracts.json"));
  assert.ok(writes.some((x) => x.path.endsWith("/git/refs")));
  const fresh = store();
  const cutoff = await installContractCutoff(
    fresh.connection,
    receipt,
    async () => ({ complete: true, issues: [] }),
  );
  assert.deepEqual(fresh.files.get(".github/issue-contracts.json").value, {
    mode: "body",
    cutoff,
  });
});
test("ledger survives fresh readers and uses compare-and-swap; migration and original cannot reset", async () => {
  const { connection, files } = store();
  files.set("cutoff.json", { value: receipt, sha: "cut" });
  const configuration = { mode: "body", cutoff: "b".repeat(40) };
  const first = await loadContractSources(connection, 42, configuration);
  const stale = await loadContractSources(connection, 42, configuration);
  await saveContractSourceRecord(connection, 42, first, {
    issue: "I42",
    cutoff: configuration.cutoff,
    migrated: true,
    retired: true,
    intake: { original: "Reporter" },
  });
  const restored = await loadContractSources(connection, 42, configuration);
  assert.equal(restored.record.migrated, true);
  await assert.rejects(
    () => saveContractSourceRecord(connection, 42, stale, { issue: "I42" }),
    /CAS/,
  );
  await assert.rejects(
    () =>
      saveContractSourceRecord(connection, 42, restored, {
        ...restored.record,
        migrated: false,
      }),
    /reset/,
  );
  await assert.rejects(
    () =>
      saveContractSourceRecord(connection, 42, restored, {
        ...restored.record,
        intake: { original: "changed" },
      }),
    /reset/,
  );
});
test("source edit identity detects restored/same-second edits and unavailable history refuses", async () => {
  const date = "2026-11-09T00:00:00Z";
  let editId = "E1";
  const connection = {
    access: {
      async request() {
        return {
          data: {
            data: {
              nodes: [
                {
                  id: "I42",
                  lastEditedAt: date,
                  userContentEdits: {
                    nodes: [{ id: editId, editedAt: date, deletedAt: null }],
                  },
                },
              ],
            },
          },
        };
      },
    },
  };
  assert.equal((await sourceEditIdentities(connection, ["I42"])).I42.id, "E1");
  editId = "E2";
  assert.equal((await sourceEditIdentities(connection, ["I42"])).I42.id, "E2");
  editId = null;
  await assert.rejects(
    () => sourceEditIdentities(connection, ["I42"]),
    /incomplete/,
  );
});
test("source content history follows every page and refuses incomplete authenticated content", async () => {
  const edits = [
    {
      id: "E2",
      editedAt: "2026-11-09T01:00:00Z",
      deletedAt: null,
      diff: "## What to build\n\nTemporary direct contract.",
    },
    {
      id: "E1",
      editedAt: "2026-11-09T00:00:00Z",
      deletedAt: null,
      diff: "Original intake.",
    },
  ];
  const reads = [];
  const connection = {
    access: {
      async request(input) {
        reads.push(input.body.variables);
        const after = input.body.variables.after;
        return {
          data: {
            data: {
              node: {
                id: "I42",
                lastEditedAt: edits[0].editedAt,
                userContentEdits: {
                  totalCount: edits.length,
                  nodes: [edits[after ? 1 : 0]],
                  pageInfo: {
                    hasNextPage: !after,
                    endCursor: after ? null : "next",
                  },
                },
              },
            },
          },
        };
      },
    },
  };
  assert.deepEqual(await sourceContentHistories(connection, ["I42", "I42"]), {
    I42: { complete: true, edits },
  });
  assert.deepEqual(reads, [
    { id: "I42", after: null },
    { id: "I42", after: "next" },
  ]);
  for (const invalid of [
    { nodes: [null], pageInfo: { hasNextPage: false } },
    { nodes: [{ ...edits[0], diff: null }], pageInfo: { hasNextPage: false } },
    {
      nodes: [{ ...edits[0], deletedAt: edits[0].editedAt }],
      pageInfo: { hasNextPage: false },
    },
    { nodes: [], pageInfo: { hasNextPage: true, endCursor: null } },
  ]) {
    const unavailable = {
      access: {
        async request() {
          return {
            data: {
              data: {
                node: {
                  id: "I42",
                  lastEditedAt: edits[0].editedAt,
                  userContentEdits: { totalCount: 1, ...invalid },
                },
              },
            },
          };
        },
      },
    };
    await assert.rejects(
      () => sourceContentHistories(unavailable, ["I42"]),
      /Complete authenticated source content history is unavailable/,
    );
  }
});
test("capture takes original and author/writer proof from platform before body publication, never reconstructed intake", async () => {
  const { connection } = store();
  const facts = {
    trusted: true,
    receipt,
    cutoff: "b".repeat(40),
    record: null,
    recordSha: null,
  };
  const issue = {
    nodeId: "I42",
    body: 'Reporter\n<!-- factory:run {"run":"writer-1"} -->',
    author: { login: "factory[bot]" },
  };
  const edits = { I42: { id: "E1", editedAt: null } };
  const record = await captureContractIntake(
    connection,
    42,
    { marker: "factory:run", author: "Factory[bot]" },
    facts,
    issue,
    edits,
  );
  assert.equal(record.intake.original, issue.body);
  assert.equal(
    record.intake.writerRun,
    null,
    "a copied body marker is not writer proof",
  );
  const proof = {
    repository: "owner/repo",
    issue: "I42",
    run: "writer-1",
    sourceEdit: edits.I42,
  };
  const verified = await captureContractIntake(
    connection,
    42,
    { marker: "factory:run", author: "Factory[bot]" },
    facts,
    issue,
    edits,
    proof,
  );
  assert.equal(verified.intake.writerRun, "writer-1");
  assert.deepEqual(verified.intake.writerProof, proof);
  assert.equal(verified.intake.author, "factory[bot]");
  for (const author of [
    "other[bot]",
    "factory",
    "factory-bot[bot]",
    "factory[bot]x",
  ]) {
    await assert.rejects(
      () =>
        captureContractIntake(
          connection,
          42,
          { marker: "factory:run", author },
          facts,
          issue,
          edits,
          proof,
        ),
      {
        message:
          "Authenticated intake writer proof does not match the preserved issue/source.",
      },
    );
  }
  const second = store();
  const migrated = {
    ...issue,
    body: bodyWithOriginal(completeAgentBrief, issue.body),
  };
  await assert.rejects(
    () =>
      captureContractIntake(
        second.connection,
        42,
        { marker: "factory:run", author: "factory[bot]" },
        { ...facts, record: null, recordSha: null },
        migrated,
        edits,
      ),
    /unavailable or ambiguous/,
  );
  const reused = await captureContractIntake(
    connection,
    42,
    { marker: "factory:run", author: "factory[bot]" },
    facts,
    migrated,
    edits,
  );
  assert.deepEqual(reused.intake, verified.intake);
  assert.equal(intakeOriginal(completeAgentBrief), null);
});

test("host intake capture refuses missing inventoried history and original intake", async () => {
  for (const record of [null, { issue: "I42", intake: null }]) {
    const { connection, writes } = store();
    const facts = {
      trusted: true,
      receipt: {
        ...receipt,
        issues: [{ number: 42, issue: "I42", legacy: null }],
      },
      cutoff: "b".repeat(40),
      record,
      recordSha: null,
    };
    await assert.rejects(
      () =>
        captureContractIntake(
          connection,
          42,
          null,
          facts,
          {
            nodeId: "I42",
            body: "Current text",
            author: { login: "reporter" },
          },
          { I42: { id: "created:I42", editedAt: null } },
        ),
      /recover authenticated history/,
    );
    assert.equal(
      writes.length,
      0,
      "do not recreate retirement or intake facts",
    );
  }
});

test("active adapter initializes new native tickets with incidental Brief headings", async () => {
  const { connection, files, nodes } = store();
  const issue = {
    number: 42,
    nodeId: "I42",
    state: "open",
    labels: [],
    author: { login: "reporter" },
    body: "## What to build\n\nCache results.\n\n## Acceptance criteria\n\nFast results.\n\n## Blocked by\n\nNone.\n\n## Agent Brief\n\nContext only.",
    bodyEditTime: null,
    parent: null,
    blockedBy: [],
  };
  const comments = [];
  nodes.I42 = {
    id: "I42",
    lastEditedAt: null,
    userContentEdits: { nodes: [] },
  };
  files.set("cutoff.json", { value: receipt, sha: "receipt" });
  connection.issueTracker = {
    capabilities: { bodyEditTime: true },
    issue: async () => issue,
    comments: async () => comments,
    labels: async () => [],
    labelChanges: async () => [],
    async addLabels(number, labels) {
      issue.labels.push(...labels);
    },
    async createComment(number, body) {
      const comment = {
        id: 90,
        body,
        author: { login: "github-actions[bot]" },
        updatedAt: "2026-11-09T01:00:00Z",
      };
      comments.push(comment);
      return comment;
    },
  };
  await runIssueContractValidation(
    {
      kind: "opened",
      issue: 42,
      repository: "owner/repo",
      actor: { login: "reporter" },
    },
    connection,
    async () => null,
    undefined,
    () => Date.parse("2026-11-09T01:00:00Z"),
    null,
    { mode: "body", cutoff: "b".repeat(40) },
    async () => {
      throw new Error("native contracts must not resolve Seams");
    },
  );
  const state = issueContractResult(comments).state;
  assert.equal(state.kind, "implementation ticket");
  assert.equal(state.status, "awaiting-review");
  assert.equal(state.selection.state, "native");
  assert.equal(files.get("issues/42.json").value.intake, null);
});

import {
  runIssueContractValidation,
  issueContractResult,
  readIssueContractObservation,
} from "../vendor/repo-canon/validate-issue-contract.mjs";

test("body-only historical approval resolves its boundary and survives category removal", async () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL("./fixtures/issue-contract-v2.json", import.meta.url),
      "utf8",
    ),
  ).cases.find((entry) => entry.name === "body awaits authorized review");
  for (const resolved of [true, false]) {
    const s = structuredClone(fixture.snapshot);
    const { connection, files, writes, nodes } = store();
    connection.repository.path = s.repository;
    for (const entry of s.contractSources.receipt.issues) delete entry.legacy;
    const issue = {
      ...s.issue,
      nodeId: s.issue.node_id,
      author: s.issue.user,
      bodyEditTime: s.bodyRevision.lastEditedAt,
      labels: ["state:ready"],
    };
    const original = {
      ...fixture.state,
      status: "approved",
      label: "state:ready",
      reviewer: "maintainer",
      reviewEventId: "101",
      observedEventId: "101",
      publishedAt: "2026-11-09T01:00:00Z",
      evaluatedAt: "2026-11-09T01:00:20Z",
    };
    const comments = [
      {
        id: 90,
        nodeId: "N90",
        author: { login: "github-actions[bot]" },
        body: `<!-- repo-canon:issue-contract-feedback -->\n<!-- repo-canon:issue-contract-state ${JSON.stringify(original)} -->`,
        updatedAt: original.evaluatedAt,
      },
    ];
    nodes.I42 = {
      id: "I42",
      lastEditedAt: issue.bodyEditTime,
      userContentEdits: {
        nodes: [
          {
            id: s.bodyRevision.editId,
            editedAt: issue.bodyEditTime,
            deletedAt: null,
          },
        ],
      },
    };
    files.set("cutoff.json", {
      value: s.contractSources.receipt,
      sha: "receipt",
    });
    files.set("issues/42.json", {
      value: { ...s.contractSources.record, migrated: true, retired: true },
      sha: "record",
    });
    const roles = [];
    connection.access.role = async (login) => {
      roles.push(login);
      return "admin";
    };
    connection.issueTracker = {
      capabilities: { bodyEditTime: true },
      issue: async () => issue,
      comments: async () => comments,
      labels: async () => [],
      labelChanges: async () => [
        {
          id: "101",
          action: "added",
          label: "state:ready",
          actor: { login: "maintainer" },
          time: "2026-11-09T01:00:10Z",
        },
      ],
      removeLabel: async (_number, label) => {
        writes.push({ label });
        issue.labels = issue.labels.filter((value) => value !== label);
      },
      addLabels: async (_number, labels) => {
        writes.push({ labels });
        issue.labels.push(...labels);
      },
      updateComment: async (id, body) => {
        writes.push({ feedback: true });
        const comment = comments.find((entry) => entry.id === id);
        comment.body = body;
        return comment;
      },
    };
    let resolutions = 0;
    const code = await runIssueContractValidation(
      { kind: "edited", issue: 42, repository: s.repository },
      connection,
      undefined,
      undefined,
      () => Date.parse("2026-11-11T00:00:00Z"),
      null,
      { mode: "body", cutoff: s.contractSources.cutoff },
      async () => {
        resolutions++;
        assert.equal(
          writes.length,
          0,
          "resolve before source or readiness writes",
        );
        if (!resolved) throw new Error("Unresolved Seams release boundary");
        return resolveBoundary();
      },
    );
    assert.equal(resolutions, 1);
    assert.equal(code, resolved ? 0 : 1);
    if (resolved) {
      assert.deepEqual(roles, ["maintainer"]);
      const state = issueContractResult(comments).state;
      assert.equal(state.status, "approved");
      assert.equal(state.seamsExemption.evaluatedAt, original.evaluatedAt);
      assert.ok(issue.labels.includes("state:ready"));
    } else {
      assert.deepEqual(writes, []);
      assert.deepEqual(issue.labels, ["state:ready"]);
      assert.equal(issueContractResult(comments).state.status, "approved");
    }
  }
});

test("active adapter durably records migration before feedback and cannot resurrect it after deletion", async () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL("./fixtures/issue-contract-v2.json", import.meta.url),
      "utf8",
    ),
  ).cases.find((c) => c.name === "body awaits authorized review");
  const s = structuredClone(fixture.snapshot);
  const { connection, files, writes, nodes } = store();
  connection.repository.path = s.repository;
  const issue = {
    ...s.issue,
    nodeId: s.issue.node_id,
    author: s.issue.user,
    createdAt: "2026-11-08T00:00:00Z",
    bodyEditTime: s.bodyRevision.lastEditedAt,
    parent: null,
  };
  const comments = s.comments.map((c) => ({
    ...c,
    nodeId: c.node_id,
    author: c.user,
    updatedAt: c.updated_at,
  }));
  for (const [id, edit] of Object.entries(s.sourceEdits))
    nodes[id] = {
      id,
      lastEditedAt: edit.editedAt,
      userContentEdits: {
        nodes: [{ id: edit.id, editedAt: edit.editedAt, deletedAt: null }],
      },
    };
  nodes.I42 = {
    id: "I42",
    lastEditedAt: issue.bodyEditTime,
    userContentEdits: {
      nodes: [
        {
          id: s.bodyRevision.editId,
          editedAt: issue.bodyEditTime,
          deletedAt: null,
        },
      ],
    },
  };
  files.set("cutoff.json", {
    value: s.contractSources.receipt,
    sha: "receipt",
  });
  files.set("issues/42.json", {
    value: s.contractSources.record,
    sha: "record",
  });
  connection.access.role = async () => "admin";
  connection.issueTracker = {
    capabilities: { bodyEditTime: true },
    issue: async () => issue,
    comments: async () => comments,
    labels: async () => [],
    labelChanges: async () => [],
    async addLabels(number, labels) {
      issue.labels.push(...labels);
    },
    async removeLabel(number, label) {
      issue.labels = issue.labels.filter((name) => name !== label);
    },
    async createComment(number, body) {
      assert.ok(
        files.get("issues/42.json").value.migrated,
        "persist before publishing a notice",
      );
      writes.push({ feedback: true });
      const comment = {
        id: 90,
        nodeId: "N90",
        body,
        author: { login: "github-actions[bot]" },
        updatedAt: "2026-11-09T01:00:00Z",
      };
      comments.push(comment);
      return comment;
    },
    async updateComment(id, body) {
      const comment = comments.find((c) => c.id === id);
      comment.body = body;
      return comment;
    },
  };
  const event = {
    kind: "commentCreated",
    issue: 42,
    repository: s.repository,
    actor: { login: "reporter" },
  };
  await runIssueContractValidation(
    event,
    connection,
    async () => null,
    undefined,
    () => Date.parse("2026-11-09T01:00:00Z"),
    null,
    { mode: "body", cutoff: s.contractSources.cutoff },
    resolveBoundary,
  );
  const state = issueContractResult(comments).state;
  assert.equal(state.status, "awaiting-review");
  assert.equal(
    state.observation,
    await readIssueContractObservation(connection, issue, comments, []),
  );
  const persisted = files.get("issues/42.json").value;
  assert.equal(persisted.migrated, true);
  assert.ok(persisted.notice);
  comments.splice(
    comments.findIndex((c) => c.id === 90),
    1,
  );
  issue.body = "";
  await runIssueContractValidation(
    event,
    connection,
    async () => null,
    undefined,
    () => Date.parse("2026-11-09T01:00:01Z"),
    null,
    { mode: "body", cutoff: s.contractSources.cutoff },
    resolveBoundary,
  );
  assert.equal(issueContractResult(comments).state.selection.state, "held");
  assert.equal(files.get("issues/42.json").value.migrated, true);
});

test("fenced Brief/Original request examples stay intake rather than becoming provenance", () => {
  const intake =
    "Reporter example:\n\n```markdown\n## Agent Brief\n## Original request\n```\n";
  assert.equal(intakeOriginal(intake), intake);
  assert.equal(
    intakeOriginal(bodyWithOriginal(completeAgentBrief, intake)),
    null,
  );
});

async function publicationFixture(checks = ["Test"]) {
  const fixture = JSON.parse(
    readFileSync(
      new URL("./fixtures/issue-contract-v2.json", import.meta.url),
      "utf8",
    ),
  ).cases.find((c) => c.name === "exact body factory approval");
  const s = structuredClone(fixture.snapshot);
  const { connection, writes, nodes, files } = store(checks);
  connection.repository.path = s.repository;
  const issue = {
    ...s.issue,
    nodeId: s.issue.node_id,
    author: s.issue.user,
    bodyEditTime: s.bodyRevision.lastEditedAt,
  };
  const comments = s.comments.map((c) => ({
    ...c,
    nodeId: c.node_id,
    author: c.user,
    updatedAt: c.updated_at,
  }));
  for (const [id, edit] of Object.entries(s.sourceEdits))
    nodes[id] = {
      id,
      lastEditedAt: edit.editedAt,
      userContentEdits: {
        nodes: [{ id: edit.id, editedAt: edit.editedAt, deletedAt: null }],
      },
    };
  nodes.I42 = {
    id: "I42",
    lastEditedAt: issue.bodyEditTime,
    userContentEdits: {
      nodes: [
        {
          id: s.bodyRevision.editId,
          editedAt: issue.bodyEditTime,
          deletedAt: null,
        },
      ],
    },
  };
  connection.issueTracker = {
    issue: async () => issue,
    comments: async () => comments,
  };
  return { s, connection, comments, writes, files };
}

test("proof-persistence retries request evaluation even when evidence is already recorded", async () => {
  const { s, connection, comments, writes } = await publicationFixture();
  s.triageResult.author = "Factory[bot]";
  for (const author of [
    "other[bot]",
    "factory",
    "factory-bot[bot]",
    "factory[bot]x",
  ]) {
    await assert.rejects(
      () =>
        recordContractPublication(
          connection,
          42,
          s.contractSources,
          { ...s.triageResult, author },
          { attestationId: "20" },
        ),
      { message: "Configured-author attestation is missing." },
    );
  }
  const attested = comments.find((comment) => comment.id === 20);
  const { body } = attested;
  attested.body = body.replace(/ \{"format".*\} -->$/, ' {"format": -->');
  await assert.rejects(
    () =>
      recordContractPublication(
        connection,
        42,
        s.contractSources,
        s.triageResult,
        { attestationId: "20" },
      ),
    {
      message:
        "Attestation does not match the observed exact body publication and preserved intake.",
    },
  );
  attested.body = body;
  s.contractSources.record.publication.noticedAt = "2026-11-09T01:00:00Z";
  const original = connection.access.request;
  let fail = true;
  connection.access.request = async (input) => {
    if (fail && input.path.endsWith("/dispatches"))
      throw new Error("Wake unavailable");
    return original(input);
  };
  await assert.rejects(
    () =>
      recordContractPublication(
        connection,
        42,
        s.contractSources,
        s.triageResult,
        { attestationId: "20" },
      ),
    /Wake unavailable/,
  );
  fail = false;
  await recordContractPublication(
    connection,
    42,
    s.contractSources,
    s.triageResult,
    { attestationId: 20 },
  );
  assert.equal(
    comments.find((comment) => comment.id === 20).author.login,
    "factory[bot]",
  );
  assert.deepEqual(writes.at(-1).body, {
    event_type: "repo-canon-issue-contract",
    client_payload: { issue: 42 },
  });
  assert.ok(!writes.some((write) => write.method === "PUT"));
  await assert.rejects(
    () => requestContractEvaluation(connection, -1),
    /positive/,
  );
});

test("a missing inventoried record cannot reset migration history or restore legacy readiness", async () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL("./fixtures/issue-contract-v2.json", import.meta.url),
      "utf8",
    ),
  ).cases.find((c) => c.name === "eligible unchanged approved legacy");
  const s = structuredClone(fixture.snapshot);
  const { connection, files, nodes } = store();
  connection.repository.path = s.repository;
  const issue = {
    ...s.issue,
    body: "",
    nodeId: s.issue.node_id,
    author: s.issue.user,
    bodyEditTime: null,
    parent: null,
  };
  const comments = s.comments.map((c) => ({
    ...c,
    nodeId: c.node_id,
    author: c.user,
    updatedAt: c.updated_at,
  }));
  for (const [id, edit] of Object.entries(s.sourceEdits))
    nodes[id] = {
      id,
      lastEditedAt: edit.editedAt,
      userContentEdits: {
        nodes: [{ id: edit.id, editedAt: edit.editedAt, deletedAt: null }],
      },
    };
  nodes.I42 = {
    id: "I42",
    lastEditedAt: null,
    userContentEdits: { nodes: [] },
  };
  files.set("cutoff.json", {
    value: s.contractSources.receipt,
    sha: "receipt",
  });
  connection.access.role = async () => "admin";
  connection.issueTracker = {
    capabilities: { bodyEditTime: true },
    issue: async () => issue,
    comments: async () => comments,
    labels: async () => [],
    labelChanges: async () =>
      s.issueEvents.map((e) => ({
        id: e.id,
        action: "added",
        label: e.label.name,
        actor: e.actor,
        time: e.created_at,
      })),
    async addLabels(number, labels) {
      issue.labels.push(...labels);
    },
    async removeLabel(number, label) {
      issue.labels = issue.labels.filter((name) => name !== label);
    },
    async createComment(number, body) {
      const comment = {
        id: 91,
        nodeId: "N91",
        body,
        author: { login: "github-actions[bot]" },
        updatedAt: "2026-11-09T01:01:00Z",
      };
      comments.push(comment);
      return comment;
    },
    async updateComment(id, body) {
      const comment = comments.find((c) => c.id === id);
      comment.body = body;
      return comment;
    },
  };
  await runIssueContractValidation(
    {
      kind: "commentDeleted",
      issue: 42,
      repository: s.repository,
      actor: { login: "reporter" },
    },
    connection,
    async () => null,
    undefined,
    () => Date.parse("2026-11-09T01:01:00Z"),
    null,
    { mode: "body", cutoff: s.contractSources.cutoff },
    resolveBoundary,
  );
  const result = issueContractResult(comments).state;
  assert.equal(result.selection.state, "held");
  assert.ok(!issue.labels.includes("state:ready"));
  assert.equal(
    files.has("issues/42.json"),
    false,
    "recover history; never initialize an inventoried issue as unmigrated",
  );
});

test("runner evaluation refuses undelivered dispatch with the runnable recovery path", async () => {
  const { connection, writes, reads } = store(["PR metadata", "Runner checks"]);
  await assert.rejects(
    () => requestContractEvaluation(connection, 42),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /runner/i);
      assert.match(error.message, /dispatch.*no.*receiver/i);
      assert.match(
        error.message,
        /node vendor\/repo-canon\/validate\.mjs <neutral-input\.json>/,
      );
      assert.match(error.message, /POSTERN_TOKEN/);
      assert.match(error.message, /REPO_CANON_RUNNER_ACCOUNT/);
      assert.match(
        error.message,
        /issue-contract-validation\.md#runner-evaluation/,
      );
      return true;
    },
  );
  assert.equal(writes.length, 0);
  assert.equal(reads.length, 2);
  assert.equal(
    reads[1].body.variables.requiredChecks,
    `${"d".repeat(40)}:.github/required-checks.json`,
  );
});

test("runner activation refuses before any ledger or mode write for empty and nonempty inventories", async () => {
  for (const issues of [
    [],
    [{ number: 42, issue: "I42", intake: null, legacy: null }],
  ]) {
    const { connection, writes, files } = store(["Runner checks"]);
    await assert.rejects(
      () =>
        installContractCutoff(connection, { ...receipt, issues }, async () => ({
          complete: true,
          issues,
        })),
      /activation did not occur/i,
    );
    assert.equal(writes.length, 0);
    assert.equal(files.size, 0);
  }
});

test("runner publication saves proof before refusing and identical retries preserve authenticated evidence", async () => {
  const { s, connection, writes, files } = await publicationFixture([
    "Runner checks",
  ]);
  delete s.contractSources.record.publication;
  s.contractSources.recordSha = null;
  const publish = () =>
    recordContractPublication(
      connection,
      42,
      s.contractSources,
      s.triageResult,
      { attestationId: 20 },
    );
  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(publish, (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /proof remains saved/i);
      assert.match(error.message, /needs evaluation, not republication/i);
      assert.match(error.message, /no runner receiver/i);
      return true;
    });
    assert.equal(writes.length, 1);
    assert.equal(writes[0].method, "PUT");
    const loaded = await loadContractSources(connection, 42, {
      mode: "body",
      cutoff: s.contractSources.cutoff,
    });
    assert.deepEqual(
      loaded.record.publication,
      s.contractSources.record.publication,
    );
    assert.equal(files.size, 1);
  }
});

test("invalid trusted declarations refuse evaluation and activation without writes", async () => {
  for (const checks of [
    null,
    [],
    ["Runner checks", "Review rerun"],
    [""],
    42,
  ]) {
    const { connection, writes } = store(checks);
    await assert.rejects(
      () => requestContractEvaluation(connection, 42),
      /required-checks\.json/,
    );
    await assert.rejects(
      () =>
        installContractCutoff(connection, receipt, async () => ({
          complete: true,
          issues: [],
        })),
      /Activation did not occur/,
    );
    assert.equal(writes.length, 0);
  }
  for (const failure of ["unreadable", "malformed", "truncated"]) {
    const { connection, writes } = store();
    const original = connection.access.request;
    connection.access.request = async (input) => {
      if (input.body?.query?.includes("query PinnedFiles(")) {
        if (failure === "unreadable")
          throw new Error("Declaration unavailable");
        const result = await original(input);
        const blob = result.data.data.repository.requiredChecks;
        if (failure === "malformed") blob.text = "{";
        else blob.isTruncated = true;
        return result;
      }
      return original(input);
    };
    await assert.rejects(() => requestContractEvaluation(connection, 42));
    await assert.rejects(
      () =>
        installContractCutoff(connection, receipt, async () => ({
          complete: true,
          issues: [],
        })),
      /Activation did not occur/,
    );
    assert.equal(writes.length, 0);
  }
});

test("github and self-reported evaluation preserve the dispatch payload and reject nonpositive issue numbers", async () => {
  for (const checks of [["Test"], ["Review rerun"]]) {
    const { connection, writes } = store(checks);
    await requestContractEvaluation(connection, 42);
    assert.deepEqual(
      writes.map(({ method, body }) => ({ method, body })),
      [
        {
          method: "POST",
          body: {
            event_type: "repo-canon-issue-contract",
            client_payload: { issue: 42 },
          },
        },
      ],
    );
    for (const number of [0, -1, 1.5, NaN])
      await assert.rejects(
        () => requestContractEvaluation(connection, number),
        /positive issue number/,
      );
    assert.equal(writes.length, 1);
  }
});

test("operator runner evaluation and activation refuse without printing success", async (t) => {
  const { connection, writes } = store(["Runner checks"]);
  const output = [];
  t.mock.method(console, "log", (...args) => output.push(args));
  await assert.rejects(
    () =>
      cutoff(
        ["evaluate", "--repo", "owner/repo", "--issue", "42"],
        () => connection,
      ),
    /no runner receiver/,
  );
  connection.issueTracker = { issues: async () => [] };
  await assert.rejects(
    () =>
      cutoff(
        [
          "activate",
          "--repo",
          "owner/repo",
          "--release",
          identity.release,
          "--sha",
          identity.sha,
          "--epoch",
          identity.epoch,
          "--publication-frozen",
        ],
        () => connection,
      ),
    /Activation did not occur/,
  );
  assert.deepEqual(output, []);
  assert.equal(writes.length, 0);
});

test("destination declarations govern dispatch independently of a conflicting checkout", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "contract-location-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, ".github"));
  const previous = process.cwd();
  try {
    process.chdir(directory);
    writeFileSync(
      join(directory, ".github/required-checks.json"),
      JSON.stringify({ version: 1, checks: ["Runner checks"] }),
    );
    const remote = store(["Review rerun"]);
    await requestContractEvaluation(remote.connection, 42);
    assert.equal(remote.writes.length, 1);
    writeFileSync(
      join(directory, ".github/required-checks.json"),
      JSON.stringify({ version: 1, checks: ["Test"] }),
    );
    const runner = store(["Runner checks"]);
    await assert.rejects(
      () => requestContractEvaluation(runner.connection, 42),
      /no runner receiver/,
    );
    assert.equal(runner.writes.length, 0);
  } finally {
    process.chdir(previous);
  }
});

test("inspection remains read-only at every check location", async (t) => {
  const output = [];
  t.mock.method(console, "log", (text) => output.push(JSON.parse(text)));
  for (const checks of [["Test"], ["Runner checks"], ["Review rerun"]]) {
    const { connection, writes } = store(checks);
    await cutoff(["inspect", "--repo", "owner/repo"], () => connection);
    assert.equal(output.at(-1).mode, "prepared");
    assert.equal(writes.length, 0);
  }
});

test("non-runner activation dispatches every inventoried issue using one pinned declaration", async () => {
  for (const checks of [["Test"], ["Review rerun"]]) {
    const { connection, writes, reads } = store(checks);
    const issues = [{ number: 42, issue: "I42", intake: null, legacy: null }];
    await installContractCutoff(
      connection,
      { ...receipt, issues },
      async () => ({ complete: true, issues }),
    );
    assert.deepEqual(writes.at(-1).body, {
      event_type: "repo-canon-issue-contract",
      client_payload: { issue: 42 },
    });
    assert.equal(reads.length, 2);
  }
});
