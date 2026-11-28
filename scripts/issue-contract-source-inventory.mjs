#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";
import {
  connectionFor,
  pinnedFiles,
} from "../.agents/skills/babysit/platform.mjs";
import {
  checkLocation,
  parseRequiredChecks,
  requiredChecksTarget,
} from "../.agents/skills/babysit/required-checks.mjs";
import {
  actionsValidatorLogin,
  decideIssueContract,
  issueContractResult,
  readTrustedResultAccount,
  resolveSeamsBoundary,
} from "../vendor/repo-canon/validate-issue-contract.mjs";
import {
  loadContractSources,
  sourceEditIdentities,
  sourceContentHistories,
} from "./issue-contract-store.mjs";
import { executedAsScript } from "../vendor/repo-canon/validate.mjs";

const format = "repo-canon/source-selection-inventory/v1";
const hash = (value) =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
const legacyIssue = (issue) => ({
  ...issue,
  node_id: issue.nodeId,
  created_at: issue.createdAt,
  user: issue.author,
  html_url: issue.url,
});
const legacyComment = (comment) => ({
  ...comment,
  node_id: comment.nodeId,
  user: comment.author,
  created_at: comment.createdAt,
  updated_at: comment.updatedAt,
});
const legacyEvent = (change) => ({
  id: change.id,
  event: change.action === "added" ? "labeled" : "unlabeled",
  label: { name: change.label },
  actor: change.actor,
  created_at: change.time,
});

// The standard owns recognition and revision semantics. The inventory calls
// both complete validator modules rather than copying either selector.
export async function captureSourceInventory(
  connection,
  resolveResultAccount = readTrustedResultAccount,
) {
  const tracker = connection.issueTracker;
  const paths = {
    mode: ".github/issue-contracts.json",
    factory: ".scriptorium/config.json",
    requiredChecks: requiredChecksTarget,
  };
  const pinned = await pinnedFiles(connection, paths);
  const configuration = pinned.files.mode
    ? JSON.parse(pinned.files.mode)
    : { mode: "prepared" };
  if (
    !["prepared", "body"].includes(configuration.mode) ||
    (configuration.mode === "body" &&
      !/^[0-9a-f]{40}$/.test(configuration.cutoff ?? ""))
  )
    throw new Error("Trusted source publication mode is unavailable.");
  const factory = pinned.files.factory
    ? JSON.parse(pinned.files.factory)
    : null;
  const location = checkLocation(
    parseRequiredChecks(pinned.files.requiredChecks),
  );
  const resultAccount = await resolveResultAccount(connection);
  if (
    (location === "github" && resultAccount.login !== actionsValidatorLogin) ||
    (location === "runner" && !resultAccount.configured) ||
    (factory?.contractResult?.author &&
      factory.contractResult.author !== resultAccount.login)
  )
    throw new Error(
      `Result account ${resultAccount.login} disagrees with trusted configuration at ${pinned.revision}. ${resultAccount.error ?? ""}`,
    );
  if (resultAccount.error) console.error(resultAccount.error);
  const triageResult = factory?.triageResult ?? null;
  const seamsBoundary = await resolveSeamsBoundary(connection);
  const repositoryLabels = (await tracker.labels()).map(({ name }) => name);
  const listed = await tracker.issues({ state: "open" });
  const byNumber = new Map(listed.map((issue) => [issue.number, issue]));
  const snapshots = [];
  const permissions = {};
  const captures = [];
  const startedAt = new Date().toISOString();
  for (const issue of listed) {
    const comments = await tracker.comments(issue.number);
    const events = await tracker.labelChanges(issue.number);
    const ids = [issue.nodeId, ...comments.map((comment) => comment.nodeId)];
    const sourceEdits = await sourceEditIdentities(connection, ids);
    // A verified creation identity has no edits. Reuse that complete empty
    // history, while paging every edited source through the same production
    // history reader used by the validator.
    const sourceHistory = await sourceContentHistories(
      connection,
      ids.filter((id) => sourceEdits[id].editedAt !== null),
    );
    for (const id of ids)
      if (sourceEdits[id].editedAt === null)
        sourceHistory[id] = { complete: true, edits: [] };
    for (const source of [issue, ...comments]) {
      const history = sourceHistory[source.nodeId];
      const identity = sourceEdits[source.nodeId];
      if (
        identity.id !== (history.edits[0]?.id ?? `created:${source.nodeId}`) ||
        (history.edits.length && history.edits[0].diff !== source.body)
      )
        throw new Error(
          `Current content or authenticated history changed for ${source.nodeId}.`,
        );
    }
    const sources = await loadContractSources(
      connection,
      issue.number,
      configuration,
    );
    const parent = issue.parent
      ? (byNumber.get(issue.parent.number) ??
        (await tracker.issue(issue.parent.number)))
      : null;
    const { state: recorded } = issueContractResult(
      comments,
      resultAccount.login,
    );
    const reviewers = new Set([
      ...events
        .filter((change) => change.label === "state:ready")
        .map((change) => change.actor?.login),
      recorded?.reviewer,
    ]);
    for (const login of reviewers) {
      if (!login || Object.hasOwn(permissions, login)) continue;
      permissions[login] = { role: await connection.access.role(login) };
    }
    snapshots.push({
      repository: connection.repository.path,
      validatorLogin: resultAccount.login,
      issue: legacyIssue(issue),
      comments: comments.map(legacyComment),
      parent: parent ? legacyIssue(parent) : null,
      blockedBy: issue.blockedBy,
      bodyRevision: {
        id: issue.nodeId,
        lastEditedAt: issue.bodyEditTime,
        editId: sourceEdits[issue.nodeId].id,
      },
      sourceEdits,
      sourceHistory,
      contractSources: sources,
      issueEvents: events.map(legacyEvent),
      repositoryLabels,
      permissions,
      triageResult,
      seamsBoundary,
      evaluatedAt: startedAt,
    });
    captures.push({ issue, comments, events, sources, sourceEdits });
  }
  // No frozen-publication assertion: explicitly re-read the whole population,
  // discussion, labels, durable selection and authenticated edit identities.
  const final = await tracker.issues({ state: "open" });
  if (!isDeepStrictEqual(listed, final))
    throw new Error(
      "Open issue population or issue facts changed during capture.",
    );
  for (const capture of captures) {
    const number = capture.issue.number;
    const comments = await tracker.comments(number);
    const events = await tracker.labelChanges(number);
    const sources = await loadContractSources(
      connection,
      number,
      configuration,
    );
    const sourceEdits = await sourceEditIdentities(connection, [
      capture.issue.nodeId,
      ...comments.map((comment) => comment.nodeId),
    ]);
    if (
      !isDeepStrictEqual(capture.comments, comments) ||
      !isDeepStrictEqual(capture.events, events) ||
      !isDeepStrictEqual(capture.sources, sources) ||
      !isDeepStrictEqual(capture.sourceEdits, sourceEdits)
    )
      throw new Error(`Issue #${number} changed during inventory capture.`);
  }
  const trustedAgain = await pinnedFiles(connection, paths);
  if (
    pinned.revision !== trustedAgain.revision ||
    !isDeepStrictEqual(pinned.files, trustedAgain.files)
  )
    throw new Error("Trusted source configuration changed during capture.");
  return {
    format,
    complete: true,
    repository: connection.repository.path,
    trustedRevision: pinned.revision,
    location,
    resultAccount,
    mode: configuration.mode,
    startedAt,
    capturedAt: new Date().toISOString(),
    snapshots,
    digest: hash(snapshots),
  };
}

function decisionState(decide, snapshot) {
  // An inventory has no triggering write event. Both versions receive the
  // same empty event rather than treating capture as a person's review.
  const decision = decide({ event: {}, ...structuredClone(snapshot) });
  if (!decision.feedback && decision.exitCode !== 0)
    throw new Error(`Issue #${snapshot.issue.number}: ${decision.message}`);
  const { state } = issueContractResult(
    decision.feedback
      ? [
          {
            id: 1,
            author: { login: snapshot.validatorLogin },
            body: decision.feedback.body,
          },
        ]
      : [],
    snapshot.validatorLogin,
  );
  return {
    kind: state?.kind ?? null,
    source: state?.source ?? null,
    revision: state?.revision ?? null,
    status: state?.status ?? null,
    decision,
  };
}

export function compareSourceInventory(
  capture,
  before,
  after = decideIssueContract,
) {
  if (
    capture?.format !== format ||
    capture.complete !== true ||
    !Array.isArray(capture.snapshots) ||
    capture.digest !== hash(capture.snapshots)
  )
    throw new Error("Complete unmodified source inventory capture required.");
  const issues = capture.snapshots.map((snapshot) => {
    for (const source of [snapshot.issue, ...snapshot.comments]) {
      const id = source.node_id ?? source.nodeId;
      const history = snapshot.sourceHistory?.[id];
      const edit = snapshot.sourceEdits?.[id];
      if (
        history?.complete !== true ||
        !Array.isArray(history.edits) ||
        edit?.id !== (history.edits[0]?.id ?? `created:${id}`) ||
        (history.edits.length && history.edits[0].diff !== source.body)
      )
        throw new Error(`Incomplete current-content proof for ${id}.`);
    }
    const previous = decisionState(before, snapshot);
    const proposed = decisionState(after, snapshot);
    const switched = !isDeepStrictEqual(
      [previous.kind, previous.source, previous.revision],
      [proposed.kind, proposed.source, proposed.revision],
    );
    if (switched && proposed.status === "approved")
      throw new Error(
        `Issue #${snapshot.issue.number} inherited approval after a source change.`,
      );
    return {
      number: snapshot.issue.number,
      title: snapshot.issue.title,
      switched,
      freshReviewRequired: switched,
      before: previous,
      after: proposed,
    };
  });
  return {
    format,
    repository: capture.repository,
    complete: true,
    capturedAt: capture.capturedAt,
    trustedRevision: capture.trustedRevision,
    location: capture.location,
    resultAccount: capture.resultAccount,
    captureDigest: capture.digest,
    issueCount: issues.length,
    commentCount: capture.snapshots.reduce((n, s) => n + s.comments.length, 0),
    editCount: capture.snapshots.reduce(
      (n, s) =>
        n +
        Object.values(s.sourceHistory).reduce((m, h) => m + h.edits.length, 0),
      0,
    ),
    switches: issues
      .filter((issue) => issue.switched)
      .map(({ number }) => number),
    issues,
  };
}

export async function main(args = process.argv.slice(2)) {
  const [action, ...options] = args;
  const flags = new Map();
  while (options.length) {
    const flag = options.shift();
    if (
      !["--repo", "--input", "--before", "--output"].includes(flag) ||
      flags.has(flag)
    )
      throw new Error("Unknown or repeated inventory option.");
    const value = options.shift();
    if (!value || value.startsWith("--"))
      throw new Error(`Missing ${flag} value.`);
    flags.set(flag, value);
  }
  let result;
  if (action === "capture" && flags.has("--repo") && flags.has("--output")) {
    result = await captureSourceInventory(connectionFor(flags.get("--repo")));
  } else if (
    action === "compare" &&
    flags.has("--input") &&
    flags.has("--before") &&
    flags.has("--output")
  ) {
    const baseline = await import(
      pathToFileURL(resolve(flags.get("--before"))).href
    );
    if (typeof baseline.decideIssueContract !== "function")
      throw new Error(
        "Baseline must export the production decideIssueContract.",
      );
    result = compareSourceInventory(
      JSON.parse(readFileSync(flags.get("--input"), "utf8")),
      baseline.decideIssueContract,
    );
  } else {
    throw new Error(
      "Usage: issue-contract-source-inventory.mjs capture --repo OWNER/REPO --output FILE | compare --input FILE --before OLD_VALIDATOR --output FILE",
    );
  }
  writeFileSync(flags.get("--output"), `${JSON.stringify(result, null, 2)}\n`);
  console.log(
    `Complete ${action}: ${result.repository}; ${result.issueCount ?? result.snapshots.length} issues.`,
  );
}

if (executedAsScript(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
