import assert from "node:assert/strict";
import test from "node:test";
import {
  decideIssueContract,
  issueContractResult,
} from "../scripts/validate-issue-contract.mjs";
import { cutoffFormat } from "../scripts/issue-contract-sources.mjs";
import {
  completeAgentBrief,
  briefRevision,
  bot,
  featureBody,
} from "./helpers/issue-contracts.mjs";
const brief = {
  id: 12,
  node_id: "C12",
  body: completeAgentBrief,
  updated_at: "2026-11-08T00:00:00Z",
  user: { login: "reporter" },
};
const edit = { id: "EDIT12", editedAt: brief.updated_at };
const revision = briefRevision(brief);
function snapshot() {
  return {
    repository: "example/repository",
    event: { kind: "commentCreated", actor: { login: "reporter" } },
    issue: {
      number: 42,
      node_id: "I42",
      state: "open",
      body: featureBody,
      user: { login: "reporter" },
      labels: ["type:enhancement"],
    },
    comments: [brief],
    blockedBy: [],
    parent: null,
    issueEvents: [],
    permissions: {},
    bodyRevision: { id: "I42", lastEditedAt: null },
    sourceEdits: { C12: edit },
    contractSources: {
      trusted: true,
      mode: "body",
      cutoff: "a".repeat(40),
      receipt: {
        format: cutoffFormat,
        repository: "example/repository",
        release: "v1",
        sha: "b".repeat(40),
        epoch: "2026-11-09T00:00:00Z",
        complete: true,
        publicationFrozen: true,
        issues: [
          {
            issue: "I42",
            number: 42,
            legacy: {
              revision,
              source: { type: "comment", id: "12", editedAt: brief.updated_at },
              edit,
            },
          },
        ],
      },
      record: {
        issue: "I42",
        cutoff: "a".repeat(40),
        migrated: false,
        retired: false,
        intake: { original: featureBody, author: "reporter", writerRun: null },
      },
    },
  };
}
test("body mode preserves the exact eligible legacy revision in v2", () => {
  const result = issueContractResult([
    { ...bot, user: bot, body: decideIssueContract(snapshot()).feedback.body },
  ]).state;
  assert.equal(result.format, "repo-canon/issue-contract-state/v2");
  assert.equal(result.revision, revision);
  assert.equal(result.selection.state, "eligible");
});
export {
  snapshot,
  brief,
  edit,
  bodySnapshot,
  bodyProof,
  result,
  ready,
  noticeFor,
};

import {
  bodyWithOriginal,
  digest,
  attestationFormat,
} from "../scripts/issue-contract-sources.mjs";
const result = (decision) =>
  issueContractResult([{ user: bot, body: decision.feedback.body }]).state;
function noticeFor(state, id = 90) {
  return {
    id,
    node_id: `N${id}`,
    user: bot,
    updated_at: "2026-11-09T01:00:00Z",
    body: `<!-- repo-canon:issue-contract-feedback -->\n<!-- repo-canon:issue-contract-state ${JSON.stringify(state)} -->`,
  };
}
function ready(s, actor = "maintainer", id = 101) {
  s.issue.labels.push("state:ready");
  s.permissions[actor] = { role: actor === "maintainer" ? "admin" : null };
  s.issueEvents.push({
    id,
    event: "labeled",
    label: { name: "state:ready" },
    actor: { login: actor },
    created_at: "2026-11-09T01:00:10Z",
  });
  return s;
}
function bodySnapshot() {
  const s = snapshot();
  s.issue.body = bodyWithOriginal(completeAgentBrief, featureBody);
  s.bodyRevision = {
    id: "I42",
    lastEditedAt: "2026-11-09T00:30:00Z",
    editId: "BODY1",
  };
  return s;
}
function bodyProof(s) {
  const contract = result(decideIssueContract(s));
  const payload = {
    format: attestationFormat,
    repository: s.repository,
    issue: "I42",
    run: "triage-7",
    outcome: "success",
    revision: contract.revision,
    source: contract.source,
    intake: {
      author: s.contractSources.record.intake.author,
      writerRun: s.contractSources.record.intake.writerRun,
    },
  };
  const body = `<!-- factory:run {"run":"triage-7"} -->\n<!-- repo-canon:triage-attestation ${JSON.stringify(payload)} -->`;
  const comment = {
    id: 20,
    node_id: "C20",
    body,
    user: { login: "factory[bot]" },
    updated_at: "2026-11-09T00:40:00Z",
  };
  s.triageResult = { marker: "factory:run", author: "factory[bot]" };
  s.comments.push(comment);
  s.sourceEdits.C20 = { id: "ATTEST1", editedAt: comment.updated_at };
  s.contractSources.record.publication = {
    payload,
    attestation: {
      id: "20",
      revision: digest(body),
      edit: { ...s.sourceEdits.C20 },
    },
  };
  return comment;
}
test("prepared mode retains v1 regardless of body-mode facts and keeps existing legacy approval", () => {
  const s = snapshot();
  s.contractSources.mode = "prepared";
  const state = result(decideIssueContract(s));
  assert.equal(state.format, "repo-canon/issue-contract-state/v1");
  s.comments.push(noticeFor(state));
  ready(s);
  const approved = result(decideIssueContract(s));
  assert.equal(approved.status, "approved");
  delete s.contractSources;
  assert.equal(result(decideIssueContract(s)).status, "approved");
});
test("unchanged approved legacy readiness survives format switch and feedback recreation", () => {
  const s = snapshot();
  s.contractSources.mode = "prepared";
  const initial = result(decideIssueContract(s));
  s.comments.push(noticeFor(initial));
  ready(s);
  const approved = result(decideIssueContract(s));
  s.comments = s.comments.filter((c) => c.id !== 90);
  s.comments.push(noticeFor(approved));
  s.contractSources.mode = "body";
  const decision = decideIssueContract(s);
  assert.equal(result(decision).status, "approved");
  assert.deepEqual(decision.removeLabels, []);
  s.contractSources.record.notice = noticeFor(result(decision));
  s.comments = [brief];
  assert.equal(result(decideIssueContract(s)).status, "approved");
  assert.equal(decideIssueContract(s).feedback.commentId, null);
});
test("unapproved inclusion grants no acceptance; a fresh person review still works", () => {
  const s = snapshot();
  const initial = result(decideIssueContract(s));
  assert.equal(initial.status, "awaiting-review");
  s.comments.push(noticeFor(initial));
  ready(s);
  assert.equal(result(decideIssueContract(s)).status, "approved");
});
test("post-cutoff comment changes and deletion retire eligibility; byte restoration cannot resurrect it", async (t) => {
  for (const change of [
    (s) => s.comments.push({ ...brief, id: 25, node_id: "C25" }),
    (s) => {
      s.comments[0] = { ...brief, body: brief.body + " edited" };
    },
    (s) => {
      s.sourceEdits.C12 = { ...edit, id: "RESTORED_EDIT" };
    },
    (s) => {
      s.comments = [];
    },
  ])
    await t.test(String(change), () => {
      const s = snapshot();
      change(s);
      const decision = decideIssueContract(s);
      assert.equal(result(decision).selection.state, "held");
      assert.equal(decision.sourceRecord.retired, true);
      s.contractSources.record = decision.sourceRecord;
      s.comments = [brief];
      s.sourceEdits.C12 = edit;
      assert.equal(result(decideIssueContract(s)).selection.state, "held");
    });
});
test("missing, partial, wrong-repository and unauthenticated cutoff facts hold", async (t) => {
  for (const change of [
    (s) => (s.contractSources.receipt = null),
    (s) => (s.contractSources.receipt.complete = false),
    (s) => (s.contractSources.trusted = false),
    (s) => (s.contractSources.receipt.repository = "other/repository"),
    (s) => (s.contractSources.record = null),
    (s) => (s.sourceEdits = {}),
  ])
    await t.test(String(change), () => {
      const s = snapshot();
      change(s);
      ready(s);
      const d = decideIssueContract(s);
      assert.equal(result(d).status, "needs-attention");
      assert.ok(d.removeLabels.includes("state:ready"));
    });
});
test("first body migration and later edits publish new revisions and invalidate old readiness", () => {
  const s = snapshot();
  const legacy = result(decideIssueContract(s));
  s.comments.push(noticeFor(legacy));
  ready(s);
  assert.equal(result(decideIssueContract(s)).status, "approved");
  s.issue.body = bodyWithOriginal(completeAgentBrief, featureBody);
  s.bodyRevision.editId = "BODY1";
  const d = decideIssueContract(s),
    state = result(d);
  assert.equal(state.source.type, "issue-body");
  assert.notEqual(state.revision, revision);
  assert.ok(d.removeLabels.includes("state:ready"));
  s.issue.labels = ["type:enhancement"];
  s.comments = [brief, noticeFor(state)];
  ready(s, "maintainer", 102);
  assert.equal(result(decideIssueContract(s)).status, "approved");
  s.bodyRevision.editId = "BODY2";
  assert.equal(result(decideIssueContract(s)).status, "awaiting-review");
});
test("migration persists across comments, body deletion, category removal/re-add and restart", () => {
  const s = bodySnapshot();
  let d = decideIssueContract(s);
  assert.equal(result(d).selection.state, "migrated");
  s.contractSources.record = JSON.parse(JSON.stringify(d.sourceRecord));
  s.comments.push({ ...brief, id: 99, body: brief.body + " obsolete" });
  assert.equal(result(decideIssueContract(s)).source.type, "issue-body");
  s.issue.body = "";
  d = decideIssueContract(s);
  assert.equal(d.sourceRecord.migrated, true);
  assert.equal(result(d).selection.state, "held");
  s.issue.body = bodyWithOriginal(completeAgentBrief, featureBody);
  s.issue.labels = [];
  assert.equal(result(decideIssueContract(s)).selection.state, "held");
  s.issue.labels = ["type:enhancement"];
  assert.equal(result(decideIssueContract(s)).selection.state, "migrated");
});
test("original is verbatim once at the end, including whitespace; missing or nested originals block", () => {
  const original = "Reporter\r\ntext\n\n  ";
  const s = bodySnapshot();
  s.contractSources.record.intake.original = original;
  s.issue.body = bodyWithOriginal(completeAgentBrief, original);
  assert.equal(result(decideIssueContract(s)).status, "awaiting-review");
  for (const bad of [
    s.issue.body + "edited",
    bodyWithOriginal(completeAgentBrief, featureBody),
    completeAgentBrief,
  ]) {
    s.issue.body = bad;
    assert.equal(result(decideIssueContract(s)).status, "needs-attention");
  }
  assert.throws(
    () => bodyWithOriginal(completeAgentBrief, null),
    /unavailable/,
  );
  assert.throws(
    () =>
      bodyWithOriginal(
        completeAgentBrief + "\n## Original request\nold",
        original,
      ),
    /already includes/,
  );
});
test("factory body acceptance binds the exact evaluated attestation and ready event", () => {
  const s = bodySnapshot();
  bodyProof(s);
  const initial = result(decideIssueContract(s));
  assert.equal(initial.factoryTriage.run, "triage-7");
  s.comments.push(noticeFor(initial));
  ready(s, "factory[bot]");
  const d = decideIssueContract(s);
  assert.equal(result(d).status, "approved", d.message);
  assert.equal(result(d).reviewer, "factory[bot]");
  assert.equal(result(d).reviewEventId, "101");
});
test("arbitrary or edited factory evidence cannot grant the exception; independent person review remains", async (t) => {
  const changes = [
    (s) => delete s.contractSources.record.publication,
    (s) => {
      s.comments.find((c) => c.id === 20).body +=
        '\n<!-- factory:run {"run":"second"} -->';
    },
    (s) => {
      s.sourceEdits.C20.id = "ATTEST_EDITED_RESTORED";
    },
    (s) => {
      s.comments.find((c) => c.id === 20).user.login = "person";
    },
    (s) => {
      s.comments = s.comments.filter((c) => c.id !== 20);
    },
    (s) => {
      s.bodyRevision.editId = "BODY2";
    },
    (s) => {
      s.contractSources.record.publication.payload.issue = "I99";
    },
    (s) => {
      s.contractSources.record.intake = {
        original: featureBody,
        author: "factory[bot]",
        writerRun: null,
      };
    },
    (s) => {
      s.contractSources.record.intake = {
        original: featureBody,
        author: "factory[bot]",
        writerRun: "triage-7",
      };
    },
  ];
  for (const change of changes)
    await t.test(String(change), () => {
      const s = bodySnapshot();
      bodyProof(s);
      const noticed = result(decideIssueContract(s));
      s.comments.push(noticeFor(noticed));
      change(s);
      ready(s, "factory[bot]");
      const d = decideIssueContract(s);
      assert.notEqual(result(d).status, "approved");
      assert.ok(d.removeLabels.includes("state:ready"));
      s.issue.labels = ["type:enhancement"];
      s.comments = s.comments.filter((c) => c.id !== 90);
      s.comments.push(noticeFor(result(decideIssueContract(s))));
      ready(s, "maintainer", 202);
      assert.equal(result(decideIssueContract(s)).status, "approved");
    });
});
test("factory proof must appear in a notice before its acceptance, and new proof needs fresh review", () => {
  const s = bodySnapshot();
  const initial = result(decideIssueContract(s));
  s.comments.push(noticeFor(initial));
  bodyProof(s);
  ready(s, "factory[bot]");
  assert.notEqual(result(decideIssueContract(s)).status, "approved");
});

import { readFileSync } from "node:fs";
test("public v2 platform snapshots reproduce the literal wire decisions", () => {
  const fixtures = JSON.parse(
    readFileSync(
      new URL("./fixtures/issue-contract-v2.json", import.meta.url),
      "utf8",
    ),
  );
  for (const fixture of fixtures.cases) {
    const state = result(decideIssueContract(fixture.snapshot));
    assert.deepEqual(state, fixture.state, fixture.name);
    assert.equal(state.status, fixture.expectedStatus, fixture.name);
    assert.equal(
      state.factoryTriage?.run ?? null,
      fixture.expectedFactoryRun,
      fixture.name,
    );
  }
});

test("active native contracts keep their shape even beside an incidental body Brief heading", () => {
  const s = snapshot();
  s.issue.labels = [];
  s.contractSources.receipt.issues[0].legacy = null;
  s.issue.body =
    "## What to build\n\nCache results.\n\n## Acceptance criteria\n\nFast results.\n\n## Blocked by\n\nNone.\n\n## Agent Brief\n\nContext only.";
  const state = result(decideIssueContract(s));
  assert.equal(state.kind, "implementation ticket");
  assert.equal(state.selection.state, "native");
});

test("ordinary intake-context edits do not retire an unchanged eligible comment", () => {
  const s = snapshot();
  s.issue.body += "\nReporter clarification.";
  s.bodyRevision.editId = "CONTEXT_EDIT";
  s.contractSources.record.cutoffBodyEdit = {
    id: "INTAKE_ORIGINAL",
    editedAt: null,
  };
  const state = result(decideIssueContract(s));
  assert.equal(state.selection.state, "eligible");
  assert.equal(state.revision, revision);
});

test("a known different factory intake writer qualifies, while null-run evidence never does", () => {
  const s = bodySnapshot();
  s.issue.user.login = "factory[bot]";
  s.contractSources.record.intake.author = "factory[bot]";
  s.contractSources.record.intake.writerRun = "writer-1";
  s.contractSources.record.intake.sourceEdit = { id: "INTAKE", editedAt: null };
  s.contractSources.record.intake.writerProof = {
    repository: s.repository,
    issue: "I42",
    run: "writer-1",
    sourceEdit: s.contractSources.record.intake.sourceEdit,
  };
  bodyProof(s);
  s.comments.push(noticeFor(result(decideIssueContract(s))));
  ready(s, "factory[bot]");
  assert.equal(result(decideIssueContract(s)).status, "approved");
  const bad = bodySnapshot();
  bodyProof(bad);
  const proof = bad.contractSources.record.publication;
  proof.payload.run = null;
  const comment = bad.comments.find((c) => c.id === 20);
  comment.body = `<!-- factory:run {"run":null} -->\n<!-- repo-canon:triage-attestation ${JSON.stringify(proof.payload)} -->`;
  proof.attestation.revision = digest(comment.body);
  const notice = result(decideIssueContract(bad));
  assert.equal(notice.factoryTriage, null);
  bad.comments.push(noticeFor(notice));
  ready(bad, "factory[bot]");
  assert.notEqual(result(decideIssueContract(bad)).status, "approved");
});

test("an observed deletion of a newer Brief retires legacy even if its creation was not evaluated", () => {
  const s = snapshot();
  s.event = {
    kind: "commentDeleted",
    actor: { login: "reporter" },
    comment: { id: 99, body: completeAgentBrief },
  };
  const decision = decideIssueContract(s);
  assert.equal(decision.sourceRecord.retired, true);
  assert.equal(result(decision).selection.state, "held");
  s.contractSources.record = decision.sourceRecord;
  s.event = { kind: "commentCreated", actor: { login: "reporter" } };
  assert.equal(result(decideIssueContract(s)).selection.state, "held");
});

test("factory acceptance follows the first matching proof notice, independently of the earlier body notice", () => {
  const s = bodySnapshot();
  const bodyNotice = result(decideIssueContract(s));
  bodyNotice.publishedAt = "2026-11-09T00:59:00Z";
  s.comments.push(noticeFor(bodyNotice));
  bodyProof(s);
  const proofNotice = result(decideIssueContract(s));
  s.comments = s.comments.filter((c) => c.id !== 90);
  s.comments.push({
    ...noticeFor(proofNotice),
    updated_at: "2026-11-09T01:00:20Z",
  });
  ready(s, "factory[bot]");
  const refused = decideIssueContract(s);
  assert.notEqual(
    result(refused).status,
    "approved",
    "a label before its proof notice cannot be accepted",
  );
  s.contractSources.record = refused.sourceRecord;
  s.comments = s.comments.filter((c) => c.id !== 90);
  s.comments.push({
    ...noticeFor(result(refused)),
    updated_at: "2026-11-09T01:00:30Z",
  });
  s.issue.labels = ["type:enhancement"];
  ready(s, "factory[bot]", 102);
  s.issueEvents.at(-1).created_at = "2026-11-09T01:00:25Z";
  assert.equal(
    result(decideIssueContract(s)).status,
    "approved",
    "a rewrite never moves the first proof notice past a valid later acceptance",
  );
});
