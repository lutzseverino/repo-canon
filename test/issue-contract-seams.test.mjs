import assert from "node:assert/strict";
import {
  readFileSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import test from "node:test";
import {
  decideIssueContract,
  issueContractResult,
  resolveSeamsBoundary,
  seamsResultFormat,
  runIssueContractValidation,
} from "../vendor/repo-canon/validate-issue-contract.mjs";
import {
  prepareRelease,
  releaseSeamsTag,
  seamsValidatorPath,
} from "../scripts/release/prepare.mjs";
import { checkSeamsRelease } from "../scripts/release/verify.mjs";
import {
  bot,
  completeAgentBrief,
  revision,
} from "./helpers/issue-contracts.mjs";
import { seamsBoundary } from "./helpers/contract-decision.mjs";

const fixtures = JSON.parse(
  readFileSync(
    new URL("./fixtures/issue-contract-v2.json", import.meta.url),
    "utf8",
  ),
).cases;
const notice = (state) => ({
  id: 90,
  user: bot,
  updated_at: "2026-11-11T00:00:00Z",
  body: `<!-- repo-canon:issue-contract-feedback -->\n<!-- repo-canon:issue-contract-state ${JSON.stringify(state)} -->`,
});
const stateOf = (decision) => issueContractResult([noticeFrom(decision)]).state;
const noticeFrom = (decision) => ({
  ...notice(null),
  body: decision.feedback.body,
});
const decide = (s) => decideIssueContract({ seamsBoundary, ...s });

// Authenticated platform snapshots at the same selector/revision seam as v2.
// The feedback is an actual old-format approval, not mere structural success.
function historical(mode = "comment") {
  const s = structuredClone(fixtures[mode === "body" ? 1 : 0].snapshot);
  const publishedSource =
    mode === "body"
      ? {
          type: "issue-body",
          editedAt: s.bodyRevision.lastEditedAt,
          editId: s.bodyRevision.editId,
        }
      : { type: "comment", id: "12", editedAt: s.comments[0].updated_at };
  const source =
    mode === "body"
      ? {
          type: "issue-body",
          id: s.bodyRevision.id,
          editedAt: s.bodyRevision.lastEditedAt,
          editId: s.bodyRevision.editId,
        }
      : { ...publishedSource, id: s.comments[0].node_id };
  const withoutSeams = (body) => body.replace("\n\n**Seams:** No trigger", "");
  let body;
  if (mode === "body") s.issue.body = body = withoutSeams(s.issue.body);
  else s.comments[0].body = body = withoutSeams(s.comments[0].body);
  const current = revision({ kind: "triaged Agent Brief", source, body });
  if (mode !== "body")
    s.contractSources.receipt.issues[0].legacy.revision = current;
  const state = {
    ...fixtures[mode === "body" ? 1 : 0].state,
    status: "approved",
    revision: current,
    source: publishedSource,
    label: "state:ready",
    reviewer: "maintainer",
    reviewEventId: "101",
    evaluatedAt: "2026-11-09T01:00:20Z",
    publishedAt: "2026-11-09T01:00:00Z",
    observedEventId: "101",
    factoryTriage: null,
  };
  s.comments = s.comments.filter(
    (c) => !c.body.includes("issue-contract-feedback"),
  );
  s.comments.push(notice(state));
  s.issue.labels = ["type:enhancement", "state:ready"];
  s.issueEvents = [
    {
      id: 101,
      event: "labeled",
      actor: { login: "maintainer" },
      label: { name: "state:ready" },
      created_at: "2026-11-09T01:00:10Z",
    },
  ];
  s.permissions = { maintainer: { role: "admin" } };
  s.evaluatedAt = "2026-11-11T00:00:00Z";
  if (mode === "prepared") {
    delete s.contractSources;
    state.format = "repo-canon/issue-contract-state/v1";
    s.comments[s.comments.length - 1] = notice(state);
  }
  return s;
}
function rewrite(s, decision) {
  s.comments = s.comments.filter(
    (c) => !c.body.includes("issue-contract-feedback"),
  );
  s.comments.push(noticeFrom(decision));
  s.issue.labels = s.issue.labels.filter(
    (l) => !decision.removeLabels.includes(l),
  );
  s.issue.labels.push(...decision.addLabels);
}
const previous = (s) => issueContractResult(s.comments).state;
function setPrevious(s, state) {
  s.comments[s.comments.length - 1] = notice(state);
}

for (const mode of ["prepared", "comment", "body"]) {
  test(`${mode}: exact pre-release approval survives repeated evaluations without renewal`, () => {
    const s = historical(mode);
    const first = decide(s);
    assert.equal(first.exitCode, 0, first.message);
    assert.deepEqual(first.removeLabels, []);
    const state = stateOf(first);
    assert.equal(state.status, "approved");
    assert.equal(state.format, seamsResultFormat);
    assert.equal(
      state.baseFormat,
      `repo-canon/issue-contract-state/${mode === "prepared" ? "v1" : "v2"}`,
    );
    assert.equal(state.seamsExemption.evaluatedAt, "2026-11-09T01:00:20Z");
    assert.deepEqual(state.seamsExemption.boundary, seamsBoundary);
    rewrite(s, first);
    s.evaluatedAt = "2036-11-11T00:00:00Z";
    const repeated = decide(s);
    assert.deepEqual(stateOf(repeated).seamsExemption, state.seamsExemption);
    assert.equal(stateOf(repeated).status, "approved");
    assert.deepEqual(
      repeated,
      decide(structuredClone(s)),
      "same offline snapshot has the same result",
    );
  });
}

test("new briefs reject every empty or placeholder Seams form and accept No trigger", () => {
  for (const value of [
    null,
    "",
    "   ",
    "<!-- template -->",
    "_No response_",
    "TBD",
    "TODO",
    "[describe the seam]",
    "- [ ]",
  ]) {
    const s = historical("prepared");
    s.comments = [s.comments[0]];
    s.comments[0].body += value === null ? "" : `\n\n**Seams:** ${value}`;
    const d = decide(s);
    assert.equal(d.exitCode, 1);
    assert.match(d.message, /Seams/);
  }
  for (const value of [
    "No trigger",
    "The issue owns the decisions; cost now S, carrying cost S.",
  ]) {
    const s = historical("prepared");
    s.comments = [s.comments[0]];
    s.comments[0].body += `\n\n**Seams:** ${value}`;
    assert.doesNotMatch(decide(s).message, /Seams/);
  }
});

test("old age, unrelated/structural/unreadable evidence and boundary equality grant no exemption", () => {
  for (const alter of [
    (s) => {
      s.comments.pop();
    },
    (s) => {
      setPrevious(s, { ...previous(s), status: "awaiting-review" });
    },
    (s) => {
      setPrevious(s, { ...previous(s), revision: "sha256:" + "0".repeat(64) });
    },
    (s) => {
      setPrevious(s, {
        ...previous(s),
        source: { ...previous(s).source, id: "999" },
      });
    },
    (s) => {
      setPrevious(s, { ...previous(s), evaluatedAt: null });
    },
    (s) => {
      setPrevious(s, { ...previous(s), publishedAt: null });
    },
    (s) => {
      setPrevious(s, {
        ...previous(s),
        evaluatedAt: seamsBoundary.publishedAt,
      });
    },
    (s) => {
      s.issueEvents[0].created_at = seamsBoundary.publishedAt;
    },
    (s) => {
      setPrevious(s, {
        ...previous(s),
        publishedAt: seamsBoundary.publishedAt,
      });
    },
    (s) => {
      s.permissions.maintainer = { role: "write" };
    },
    (s) => {
      s.permissions.maintainer = { error: "unavailable" };
    },
    (s) => {
      s.comments.at(-1).body =
        "<!-- repo-canon:issue-contract-feedback --> unreadable";
    },
  ]) {
    const s = historical("prepared");
    s.issue.created_at = "2000-01-01T00:00:00Z";
    alter(s);
    assert.match(decide(s).message, /Seams/);
  }
});

test("new body/edit identity, replacement comment and edit-and-restore need Seams", () => {
  for (const alter of [
    (s) => {
      s.issue.body += "\nNew decision.";
    },
    (s) => {
      s.bodyRevision.editId = "BODY_RESTORED";
    },
    (s) => {
      s.bodyRevision.lastEditedAt = "2026-11-11T00:00:00Z";
    },
  ]) {
    const s = historical("body");
    rewrite(s, decide(s));
    alter(s);
    assert.match(decide(s).message, /Seams/);
  }
  const s = historical("prepared");
  rewrite(s, decide(s));
  s.comments.unshift({ ...s.comments[0], id: 13, node_id: "C13" });
  assert.match(decide(s).message, /Seams/);
  const legacy = historical("comment");
  rewrite(legacy, decide(legacy));
  legacy.sourceEdits.C12.id = "RESTORED";
  const held = decide(legacy);
  assert.equal(
    held.selection.state,
    "held",
    "the existing body selector retires restored legacy sources",
  );
  assert.notEqual(stateOf(held).status, "approved");
});

test("exemption survives readiness removal, but never restores authorization", () => {
  const s = historical("prepared");
  const first = decide(s);
  rewrite(s, first);
  const evidence = previous(s).seamsExemption;
  s.issue.labels = ["type:enhancement"];
  s.issueEvents.push({
    id: 102,
    event: "unlabeled",
    actor: { login: "maintainer" },
    label: { name: "state:ready" },
    created_at: "2026-11-11T00:00:10Z",
  });
  const removed = decide(s);
  assert.equal(stateOf(removed).status, "awaiting-review");
  assert.deepEqual(stateOf(removed).seamsExemption, evidence);
  assert.ok(!removed.addLabels.includes("state:ready"));
  rewrite(s, removed);
  s.issueEvents.push({
    id: 103,
    event: "labeled",
    actor: bot,
    label: { name: "state:triage" },
    created_at: "2026-11-11T00:00:11Z",
  });
  for (const [login, at] of [
    ["outsider", "2026-11-11T00:00:20Z"],
    ["maintainer", "2026-11-09T00:59:00Z"],
  ]) {
    const attempt = structuredClone(s);
    attempt.issue.labels.push("state:ready");
    attempt.issueEvents.push({
      id: 104,
      event: "labeled",
      actor: { login },
      label: { name: "state:ready" },
      created_at: at,
    });
    const d = decide(attempt);
    assert.notEqual(stateOf(d).status, "approved");
    assert.deepEqual(stateOf(d).seamsExemption, evidence);
  }
  s.issue.labels.push("state:ready");
  s.issueEvents.push({
    id: 105,
    event: "labeled",
    actor: { login: "maintainer" },
    label: { name: "state:ready" },
    created_at: "2026-11-11T00:00:20Z",
  });
  const reviewed = decide(s);
  assert.equal(stateOf(reviewed).status, "approved", reviewed.message);
  assert.equal(stateOf(reviewed).reviewEventId, "105");
  assert.deepEqual(stateOf(reviewed).seamsExemption, evidence);
});

test("body-mode durable notices retain the exemption when feedback is deleted", () => {
  const s = historical("body");
  const first = decide(s);
  s.contractSources.record = {
    ...first.sourceRecord,
    notice: noticeFrom(first),
  };
  s.comments = s.comments.filter(
    (c) => !c.body.includes("issue-contract-feedback"),
  );
  const restored = decide(s);
  assert.equal(restored.feedback.commentId, null);
  assert.equal(stateOf(restored).status, "approved");
  assert.deepEqual(
    stateOf(restored).seamsExemption,
    stateOf(first).seamsExemption,
  );
});

test("body-mode category repair retains historical proof without reviving readiness", () => {
  const s = historical("body");
  const approved = decide(s);
  rewrite(s, approved);
  s.issue.labels = ["state:ready"];
  const held = decide(s);
  assert.equal(stateOf(held).status, "needs-attention");
  assert.equal(stateOf(held).revision, null);
  assert.deepEqual(
    stateOf(held).seamsExemption,
    stateOf(approved).seamsExemption,
  );
  rewrite(s, held);
  s.issue.labels = ["type:enhancement"];
  const repaired = decide(s);
  assert.equal(stateOf(repaired).status, "awaiting-review");
  assert.deepEqual(
    stateOf(repaired).seamsExemption,
    stateOf(approved).seamsExemption,
  );
});

for (const mode of ["comment", "body"]) {
  test(`${mode}: first-cutover category repair retains the original approval evidence`, () => {
    const s = historical(mode);
    s.issue.labels = ["state:ready"];
    const held = decide(s);
    assert.equal(stateOf(held).status, "needs-attention");
    assert.equal(
      stateOf(held).seamsExemption?.evaluatedAt,
      "2026-11-09T01:00:20Z",
    );
    rewrite(s, held);
    s.issue.labels = ["type:enhancement"];
    const repaired = decide(s);
    assert.equal(stateOf(repaired).status, "awaiting-review");
    assert.equal(
      stateOf(repaired).seamsExemption?.evaluatedAt,
      "2026-11-09T01:00:20Z",
    );
    assert.ok(!repaired.addLabels.includes("state:ready"));
  });
}

test("the adapter loads historical authority before a first-cutover category repair", async () => {
  for (const category of [null, "type:bug"]) {
    const s = historical("prepared");
    s.issue.labels = ["state:ready", ...(category ? [category] : [])];
    const roles = [];
    const connection = {
      access: {
        role: async (login) => {
          roles.push(login);
          return "admin";
        },
      },
      issueTracker: {
        capabilities: { bodyEditTime: true },
        issue: async () => ({
          ...s.issue,
          nodeId: s.issue.node_id,
          author: s.issue.user,
        }),
        comments: async () =>
          s.comments.map((comment) => ({
            ...comment,
            nodeId: comment.node_id,
            author: comment.user,
            createdAt: comment.created_at,
            updatedAt: comment.updated_at,
          })),
        labelChanges: async () =>
          s.issueEvents.map((event) => ({
            id: String(event.id),
            action: event.event === "labeled" ? "added" : "removed",
            label: event.label.name,
            actor: event.actor,
            time: event.created_at,
          })),
        removeLabel: async (_number, label) => {
          s.issue.labels = s.issue.labels.filter((name) => name !== label);
        },
        addLabels: async (_number, labels) => {
          s.issue.labels.push(...labels);
        },
        updateComment: async (id, body) => {
          s.comments.find((comment) => comment.id === id).body = body;
        },
      },
    };
    const evaluate = () =>
      runIssueContractValidation(
        {
          issue: s.issue.number,
          kind: "edited",
          actor: { login: "maintainer" },
        },
        connection,
        undefined,
        undefined,
        () => Date.parse(s.evaluatedAt),
        null,
        { mode: "prepared" },
        async () => seamsBoundary,
      );
    assert.equal(await evaluate(), 1);
    assert.deepEqual(roles, ["maintainer"]);
    assert.equal(
      previous(s).seamsExemption?.evaluatedAt,
      "2026-11-09T01:00:20Z",
    );
    s.issue.labels = ["type:enhancement"];
    assert.equal(await evaluate(), 0);
    assert.equal(previous(s).status, "awaiting-review");
    assert.equal(
      previous(s).seamsExemption?.evaluatedAt,
      "2026-11-09T01:00:20Z",
    );
    assert.ok(!s.issue.labels.includes("state:ready"));
  }
});

test("a held legacy selector authenticates historical factory approval without selecting it", () => {
  const s = historical("comment");
  const brief = s.comments[0];
  brief.body += '\n\n<!-- factory:run {"run":"triage-7"} -->';
  brief.user = { login: "factory[bot]" };
  s.triageResult = { author: "factory[bot]", marker: "factory:run" };
  const original = previous(s);
  original.reviewer = "factory[bot]";
  original.revision = revision({
    kind: "triaged Agent Brief",
    source: { ...original.source, id: brief.node_id },
    body: brief.body,
  });
  s.contractSources.receipt.issues[0].legacy.revision = original.revision;
  s.issueEvents[0].actor = { login: "factory[bot]" };
  setPrevious(s, original);
  s.issue.labels = ["state:ready"];
  const held = decide(s);
  assert.equal(stateOf(held).revision, null);
  assert.equal(stateOf(held).status, "needs-attention");
  assert.equal(stateOf(held).seamsExemption?.reviewer, "factory[bot]");
  rewrite(s, held);
  s.issue.labels = ["type:enhancement"];
  const repaired = decide(s);
  assert.equal(stateOf(repaired).status, "awaiting-review");
  assert.equal(stateOf(repaired).seamsExemption?.revision, original.revision);
  assert.ok(!repaired.addLabels.includes("state:ready"));
});

test("superseding states keep exemption evidence without preserving readiness", () => {
  const s = historical("prepared");
  rewrite(s, decide(s));
  const evidence = previous(s).seamsExemption;
  s.issue.labels.push("state:owner");
  s.issueEvents.push({
    id: 102,
    event: "labeled",
    label: { name: "state:owner" },
    actor: { login: "maintainer" },
    created_at: "2026-11-11T00:00:10Z",
  });
  const d = decide(s);
  assert.equal(stateOf(d).status, "awaiting-review");
  assert.ok(d.removeLabels.includes("state:ready"));
  assert.deepEqual(stateOf(d).seamsExemption, evidence);
});

test("missing or changed release identity holds without modifying approval or labels", () => {
  const s = historical("prepared");
  for (const seamsBoundary of [null, undefined, { tag: "v99.0.0" }]) {
    const d = decideIssueContract({ ...s, seamsBoundary });
    assert.equal(d.exitCode, 1);
    assert.match(d.message, /Unresolved Seams/);
    assert.deepEqual([d.removeLabels, d.addLabels, d.feedback], [[], [], null]);
  }
  rewrite(s, decide(s));
  const changed = decide({
    ...s,
    seamsBoundary: { ...seamsBoundary, commit: "b".repeat(40) },
  });
  assert.match(changed.message, /Seams/);
});

test("v3 readers reject tampered, malformed and mismatched exemption records", () => {
  const state = stateOf(decide(historical("body")));
  for (const alter of [
    (s) => {
      s.seamsExemption.reviewedAt = seamsBoundary.publishedAt;
    },
    (s) => {
      s.seamsExemption.revision = "sha256:" + "0".repeat(64);
    },
    (s) => {
      s.seamsExemption.source.editId = "OTHER";
    },
    (s) => {
      s.seamsExemption.boundary.commit = "main";
    },
    (s) => {
      delete s.observation;
    },
    (s) => {
      s.baseFormat = "unknown";
    },
  ]) {
    const invalid = structuredClone(state);
    alter(invalid);
    assert.equal(issueContractResult([notice(invalid)]).state, null);
  }
});

const tagObject = "a".repeat(40);
function releaseTransport(alter = (_responses) => {}) {
  const responses = {
    [`/releases/tags/${seamsBoundary.tag}`]: {
      tag_name: seamsBoundary.tag,
      draft: false,
      prerelease: false,
      published_at: seamsBoundary.publishedAt,
    },
    [`/git/ref/tags/${seamsBoundary.tag}`]: {
      ref: `refs/tags/${seamsBoundary.tag}`,
      object: { type: "tag", sha: tagObject },
    },
    [`/git/tags/${tagObject}`]: {
      tag: seamsBoundary.tag,
      sha: tagObject,
      object: { type: "commit", sha: seamsBoundary.commit },
    },
  };
  alter(responses);
  return {
    access: {
      request: async ({ path }) => {
        assert.ok(path.startsWith("/repos/lutzseverino/repo-canon/"));
        const data =
          responses[path.slice("/repos/lutzseverino/repo-canon".length)];
        if (!data) throw Error("not found");
        return { data };
      },
    },
  };
}
test("the fixed annotated tag resolves to the same public identity offline", async () => {
  assert.deepEqual(
    await resolveSeamsBoundary(releaseTransport(), seamsBoundary.tag),
    seamsBoundary,
  );
  const read = () => `export const seamsReleaseTag = "${seamsBoundary.tag}";`;
  const checked = await checkSeamsRelease(
    seamsBoundary.tag,
    seamsBoundary.commit,
    read,
    releaseTransport().access.request,
  );
  assert.match(
    checked.pass,
    new RegExp(`${seamsBoundary.commit}.*${seamsBoundary.publishedAt}`),
  );
  const wrongCommit = await checkSeamsRelease(
    seamsBoundary.tag,
    "f".repeat(40),
    read,
    releaseTransport().access.request,
  );
  assert.ok(wrongCommit.failures);
});
test("missing, lightweight, draft, prerelease and mismatched boundaries refuse activation", async () => {
  for (const alter of [
    (r) => {
      delete r[`/releases/tags/${seamsBoundary.tag}`];
    },
    (r) => {
      delete r[`/git/ref/tags/${seamsBoundary.tag}`];
    },
    (r) => {
      r[`/git/ref/tags/${seamsBoundary.tag}`].object.type = "commit";
    },
    (r) => {
      r[`/releases/tags/${seamsBoundary.tag}`].draft = true;
    },
    (r) => {
      r[`/releases/tags/${seamsBoundary.tag}`].prerelease = true;
    },
    (r) => {
      r[`/releases/tags/${seamsBoundary.tag}`].published_at = null;
    },
    (r) => {
      r[`/git/tags/${tagObject}`].tag = "moving";
    },
  ])
    await assert.rejects(
      resolveSeamsBoundary(releaseTransport(alter), seamsBoundary.tag),
      /Unresolved Seams release boundary v99.0.0/,
    );
  await assert.rejects(
    resolveSeamsBoundary(releaseTransport(), null),
    /not prepared/,
  );
});

test("the adapter leaves labels and feedback untouched when release resolution fails", async () => {
  const writes = [];
  const connection = {
    issueTracker: {
      capabilities: { bodyEditTime: true },
      issue: async () => ({
        number: 42,
        state: "open",
        body: "Intake",
        labels: ["type:enhancement", "state:ready"],
      }),
      comments: async () => [{ id: 12, body: completeAgentBrief }],
      removeLabel: async () => writes.push("remove"),
      addLabels: async () => writes.push("add"),
      updateComment: async () => writes.push("update"),
      createComment: async () => writes.push("create"),
    },
  };
  const code = await runIssueContractValidation(
    { issue: 42 },
    connection,
    undefined,
    undefined,
    undefined,
    null,
    { mode: "prepared" },
    async () => {
      throw Error("Unresolved Seams release boundary v99.0.0");
    },
  );
  assert.equal(code, 1);
  assert.deepEqual(writes, []);
});

test("release preparation pins once and later releases retain the first shipping tag", (t) => {
  const root = mkdtempSync(join(tmpdir(), "rc-seams-release-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = join(root, seamsValidatorPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "export const seamsReleaseTag = null;\n");
  assert.equal(prepareRelease(seamsBoundary.tag, root), seamsBoundary.tag);
  assert.equal(prepareRelease("v100.0.0", root), seamsBoundary.tag);
  assert.equal(
    releaseSeamsTag(() => readFileSync(path, "utf8")),
    seamsBoundary.tag,
  );
  assert.throws(() => prepareRelease("latest", root), /stable release/);
});
