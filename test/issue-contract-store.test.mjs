import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PlatformError } from "../vendor/postern/postern.mjs";
import {
  contractSourceConfiguration,
  loadContractSources,
  saveContractSourceRecord,
  sourceEditIdentities,
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
function store() {
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
        writes.push(input);
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
  return { connection, files, writes, nodes };
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
    { marker: "factory:run", author: "factory[bot]" },
    facts,
    issue,
    edits,
  );
  assert.equal(record.intake.original, issue.body);
  assert.equal(record.intake.writerRun, "writer-1");
  const second = store();
  const migrated = {
    ...issue,
    body: bodyWithOriginal(completeAgentBrief, issue.body),
  };
  const captured = await captureContractIntake(
    second.connection,
    42,
    { marker: "factory:run", author: "factory[bot]" },
    { ...facts, record: null, recordSha: null },
    migrated,
    edits,
  );
  assert.equal(captured.intake.original, issue.body);
  assert.equal(captured.intake.writerRun, null);
  assert.equal(intakeOriginal(completeAgentBrief), null);
});

import {
  runIssueContractValidation,
  issueContractResult,
  readIssueContractObservation,
} from "../scripts/validate-issue-contract.mjs";
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
    intake,
  );
});

test("proof-persistence retries request evaluation even when evidence is already recorded", async () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL("./fixtures/issue-contract-v2.json", import.meta.url),
      "utf8",
    ),
  ).cases.find((c) => c.name === "exact body factory approval");
  const s = structuredClone(fixture.snapshot);
  const { connection, writes, nodes } = store();
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
