import assert from "node:assert/strict";
import test from "node:test";
import { contractWorld } from "./helpers/contract-world.mjs";
import { ticketBody, completeAgentBrief } from "./helpers/issue-contracts.mjs";
import {
  contractCutoffInventory,
  issueContractResult,
  readIssueContractObservation,
} from "../vendor/repo-canon/validate-issue-contract.mjs";
import { main as inspect } from "../scripts/issue-contract-cutoff.mjs";

const runner = "contract-runner[bot]";
const result = (world) =>
  issueContractResult(
    world.comments.map((comment) => ({
      ...comment,
      author: { login: comment.author },
    })),
    runner,
  ).state;
const createWorld = (options = {}) =>
  contractWorld({
    body: ticketBody,
    labels: ["state:triage"],
    validatorLogin: runner,
    runnerAccount: runner,
    ...options,
  });

// Each observation below crosses Postern's HTTP transport, including ledger
// storage and label events. No validator collaborator is replaced.
test("runner notices survive its own removal and recognize its fallback after review", async () => {
  const world = createWorld();
  world.editBody(ticketBody, "reporter");
  await world.deliver();
  const revision = result(world).revision;
  world.label("state:ready", "outsider");
  await world.deliver();
  const rejected = result(world);
  assert.equal(rejected.status, "awaiting-review");
  assert.equal(world.issue.labels.includes("state:ready"), false);
  assert.equal(world.events.at(-1).login, runner);
  world.comment("Check the same contract again.", "reporter");
  await world.deliver();
  assert.equal(result(world).observedEventId, rejected.observedEventId);
  assert.equal(result(world).rejectionReason, rejected.rejectionReason);
  world.label("state:ready", "maintainer");
  await world.deliver();
  assert.equal(result(world).status, "approved");
  // A late own fallback fills an empty state; it cannot supersede acceptance.
  world.label("state:triage", runner);
  await world.deliver();
  assert.equal(result(world).status, "approved");
  assert.equal(result(world).revision, revision);
  assert.deepEqual(world.issue.labels, ["state:ready"]);
});

test("body-mode runner results exclude their own feedback and retain the saved notice author", async () => {
  const world = createWorld({
    sourceConfiguration: { mode: "body", cutoff: "a".repeat(40) },
  });
  world.editBody(ticketBody, "reporter");
  await world.deliver();
  world.comment("Confirm this revision.", "reporter");
  await world.deliver();
  const state = result(world);
  assert.equal(state.format, "repo-canon/issue-contract-state/v2");
  const connection = world.connectionAs("maintainer");
  const issue = await connection.issueTracker.issue(42);
  const comments = await connection.issueTracker.comments(42);
  const events = await connection.issueTracker.labelChanges(42);
  assert.equal(
    state.observation,
    await readIssueContractObservation(
      connection,
      issue,
      comments,
      events,
      runner,
    ),
  );
  assert.notEqual(
    state.observation,
    await readIssueContractObservation(connection, issue, comments, events),
  );
  assert.equal(
    world.files.get("issues/42.json").value.notice.user.login,
    runner,
  );
  // Retain the original publication when replaceable live feedback disappears.
  const publishedAt = state.publishedAt;
  world.comments.splice(0);
  world.wait(5);
  world.comment("Recover the deleted result.", "reporter");
  await world.deliver();
  assert.equal(result(world).publishedAt, publishedAt);
  assert.equal(
    world.comments.filter(({ author }) => author === runner).length,
    1,
  );
  assert.equal(
    world.requests.some(({ path }) => path.includes("/actions/variables/")),
    false,
  );

  let output;
  const log = console.log;
  console.log = (value) => {
    output = value;
  };
  try {
    await inspect(
      ["inspect", "--repo", "owner/repo", "--issue", "42"],
      () => connection,
    );
  } finally {
    console.log = log;
  }
  const inspection = JSON.parse(output);
  assert.equal(inspection.result.current, true);
  assert.equal(inspection.result.state.revision, state.revision);
  assert.equal(inspection.resultAccount.login, runner);
});

test("cutoff inventory retains only the trusted runner's legacy notice", async () => {
  const world = contractWorld({
    validatorLogin: runner,
    runnerAccount: runner,
  });
  world.comment(completeAgentBrief, "reporter");
  await world.deliver();
  const ownNotice = world.comments.find(({ author }) => author === runner);
  assert.ok(ownNotice);
  world.comment(ownNotice.body, "github-actions[bot]");
  const inventory = await contractCutoffInventory(
    world.connectionAs("maintainer"),
  );
  assert.equal(inventory.issues[0].legacy.notice.id, ownNotice.id);
});
