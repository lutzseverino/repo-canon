import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { decideIssueContract } from "./helpers/contract-decision.mjs";
import { bot } from "./helpers/issue-contracts.mjs";
import {
  issueContractResult,
  issueContractObservation,
} from "../vendor/repo-canon/validate-issue-contract.mjs";

const read = (file) =>
  JSON.parse(
    readFileSync(new URL(`./fixtures/${file}`, import.meta.url), "utf8"),
  );
const schema = read("issue-contract-v5.schema.json");
const fixtures = read("issue-contract-v5.json");
const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
const stateOf = (line) => {
  const match = /^<!-- repo-canon:issue-contract-state (.+) -->$/.exec(line);
  assert.ok(match, "one complete state line");
  return JSON.parse(match[1]);
};

test("the standalone v5 schema accepts each literal published example", () => {
  for (const example of fixtures.examples) {
    assert.equal(
      validate(stateOf(example.line)),
      true,
      `${example.name}: ${JSON.stringify(validate.errors)}`,
    );
  }
});

// Factual comparisons only: authority was judged by the posted grant, never
// rederived from actor roles, Markdown or factory configuration here.
function readyFromFacts(state, live) {
  const digest = `sha256:${createHash("sha256").update(JSON.stringify(live.facts)).digest("hex")}`;
  const stops = [
    "state:triage",
    "state:owner",
    "state:grill",
    "state:reporter",
    "state:carried",
    "wontfix",
  ];
  return (
    state.grant.status === "current" &&
    live.facts.labels.includes("state:ready") &&
    !live.facts.labels.some((label) => stops.includes(label)) &&
    state.grant.application.id === live.latestReadyApplication &&
    state.grant.revision === state.contract.revision &&
    JSON.stringify(state.grant.source) === JSON.stringify(live.source) &&
    state.observation.digest === digest
  );
}

test("examples distinguish grant lifetime from live stops, applications and freshness", () => {
  for (const example of fixtures.examples) {
    assert.equal(
      readyFromFacts(stateOf(example.line), example.live),
      example.live.expectedReady,
      example.name,
    );
  }
  const get = (name) =>
    stateOf(fixtures.examples.find((e) => e.name === name).line);
  const first = get("person grant").grant;
  for (const name of [
    "kept grant beside state:owner",
    "answered stop keeps grant",
    "republication keeps grant",
  ]) {
    assert.deepEqual(get(name).grant, first, name);
  }
  assert.notEqual(
    get("new application after withdrawal").grant.application.id,
    first.application.id,
  );
  assert.equal(
    get("selected source restored without revival").grant.endedBy.id,
    "EDIT_BODY_2",
  );
});

test("live labels exclude readiness even when the last evaluation saw no stop", () => {
  const example = fixtures.examples[0];
  for (const stop of schema.properties.observedStops.items.enum) {
    const live = structuredClone(example.live);
    live.facts.labels.push(stop);
    assert.equal(readyFromFacts(stateOf(example.line), live), false, stop);
  }
  const live = structuredClone(example.live);
  live.facts.labels = [];
  assert.equal(readyFromFacts(stateOf(example.line), live), false);
});

test("schema rejects malformed and incomplete grants, proofs and protocol variants", () => {
  const example = stateOf(fixtures.examples[0].line);
  const malformed = [
    (s) => {
      delete s.grant;
    },
    (s) => {
      s.contract.status = "invalid";
    },
    (s) => {
      s.baseFormat = "repo-canon/issue-contract-state/v1";
    },
    (s) => {
      s.format = "repo-canon/issue-contract-state/v6";
    },
    (s) => {
      s.grant.application = null;
    },
    (s) => {
      s.grant.grantor = null;
    },
    (s) => {
      s.grant.source.edit.id = "";
    },
    (s) => {
      s.grant.revision = "sha256:bad";
    },
    (s) => {
      s.grant.endedBy = {
        kind: "source-changed",
        id: "EDIT_2",
        at: "2026-11-26T20:00:00Z",
      };
    },
    (s) => {
      s.grant.status = "stale";
    },
    (s) => {
      s.grant.status = "withdrawn";
    },
    (s) => {
      s.grant.status = "refused";
    },
    (s) => {
      s.observation.digest = "unknown";
    },
    (s) => {
      s.observedStops = ["state:ready"];
    },
    (s) => {
      s.selection = {
        mode: "body",
        cutoff: null,
        state: "guess",
        reason: null,
      };
    },
    (s) => {
      s.factoryReview = { run: "same-run" };
    },
    (s) => {
      s.seamsExemption = { revision: s.contract.revision };
    },
    (s) => {
      s.grant.source.edit.id = "created:ISSUE_42";
    },
    (s) => {
      s.grant.source.edit.editedAt = null;
    },
    (s) => {
      s.grant.source = { ...s.grant.source, type: "comment", id: "COMMENT_12" };
    },
    (s) => {
      s.grant.attestation = {
        id: "200",
        revision: s.grant.revision,
        edit: null,
      };
    },
    (s) => {
      s.grant.status = "refused";
      s.grant.reason = "The application actor has no grant authority.";
      s.grant.endedBy = {
        kind: "ready-removed",
        id: "102",
        at: "2026-11-26T20:00:00Z",
      };
    },
  ];
  for (const mutate of malformed) {
    const state = structuredClone(example);
    mutate(state);
    assert.equal(validate(state), false, JSON.stringify(state));
  }
});

test("the Canon writer run line has one versioned, nonempty run identity", () => {
  const validateRun = new Ajv2020({ strict: true }).compile(schema.$defs.run);
  for (const example of fixtures.runLines) {
    const match = /^<!-- repo-canon:run (.+) -->$/.exec(example.line);
    assert.ok(match, example.name);
    assert.equal(validateRun(JSON.parse(match[1])), true);
  }
  assert.equal(validateRun({ format: "repo-canon/run/v1", run: "" }), false);
  assert.equal(validateRun({ format: "repo-canon/run/v2", run: "r" }), false);
  assert.equal(
    validateRun({ format: "repo-canon/run/v1", run: "r", role: "writer" }),
    false,
  );
});

test("issue 920's first v5 line retains proof recoverable at the existing historical-evaluation seam", () => {
  const previous = stateOf(fixtures.transition.previousLine);
  const first = stateOf(
    fixtures.examples.find((e) => e.name === fixtures.transition.firstV5).line,
  );
  assert.deepEqual(first.seamsExemption, previous.seamsExemption);
  assert.equal(first.grant.status, "current");
  assert.equal(first.seamsExemption.revision, first.contract.revision);
  // Test-only compatibility adapter: production intentionally still refuses v5.
  // Project only v5 facts onto the existing v3 historical-evidence interpreter.
  // The exempt revision's public source is the exemption's own, as v3 records.
  const recovered = {
    format: "repo-canon/issue-contract-state/v3",
    baseFormat: "repo-canon/issue-contract-state/v1",
    seamsExemption: first.seamsExemption,
    status: "approved",
    kind: first.contract.kind,
    revision: first.contract.revision,
    source: first.seamsExemption.source,
    label: first.grant.application.label,
    reviewer: first.grant.grantor,
    reviewEventId: first.grant.application.id,
    ...first.evaluation,
    publishedAt: first.contract.publishedAt,
    rejectionReason: first.contract.rejectionReason,
    rejectedCreationLabel: first.contract.rejectedCreationLabel,
  };
  // Only the triggering event and its time belong to one evaluation.
  const retained = ({ event: _event, evaluatedAt: _at, ...facts }) => facts;
  assert.deepEqual(retained(recovered), retained(previous));
  const snapshot = structuredClone(fixtures.transition.snapshot);
  snapshot.comments[1].body = `<!-- repo-canon:issue-contract-feedback -->\n<!-- repo-canon:issue-contract-state ${JSON.stringify(recovered)} -->`;
  const decision = decideIssueContract(snapshot);
  const next = issueContractResult([
    { id: 90, user: bot, body: decision.feedback.body },
  ]).state;
  assert.equal(decision.exitCode, 0, decision.message);
  assert.equal(next.status, "approved");
  assert.deepEqual(next.seamsExemption, previous.seamsExemption);
});

test("publication changes none of the existing v1-v4 production state lines", () => {
  const cases = [
    ...read("issue-contract-v2.json").cases,
    ...read("issue-contract-review-attestation.json").cases,
  ];
  for (const example of cases) {
    const decision = decideIssueContract(example.snapshot);
    const state = issueContractResult([
      { id: 90, user: bot, body: decision.feedback.body },
    ]).state;
    assert.deepEqual(state, example.state, example.name);
  }
  assert.equal(
    issueContractResult([
      { id: 90, user: bot, body: fixtures.examples[0].line },
    ]).state,
    null,
  );
});

test("published observation examples use the existing canonical platform-fact digest", () => {
  for (const example of fixtures.examples) {
    if (example.name === "freshness mismatch before reevaluation") continue;
    const state = stateOf(example.line);
    const facts = example.live.facts;
    const sourceEdits = { [facts.issue]: facts.bodyEdit };
    const comments = facts.comments.map((comment) => {
      const node = `COMMENT_${comment.id}`;
      sourceEdits[node] = comment.edit;
      return {
        id: comment.id,
        node_id: node,
        body: comment.body,
        user: { login: comment.author },
        updated_at: comment.editedAt,
      };
    });
    const digest = issueContractObservation({
      issue: { node_id: facts.issue, body: facts.body, labels: facts.labels },
      comments,
      sourceEdits,
      events:
        facts.observedEventId === null
          ? []
          : [
              {
                id: facts.observedEventId,
                action: "added",
                label: "state:ready",
                actor: { login: "maintainer" },
              },
            ],
    });
    assert.equal(state.observation.digest, digest, example.name);
    assert.deepEqual(state.observation.bodyEdit, facts.bodyEdit);
    assert.deepEqual(
      state.observation.commentEdits,
      facts.comments.map((c) => ({ id: c.id, edit: c.edit })),
    );
  }
});
