#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { execFileSync, spawn } from "node:child_process";
import { connect } from "../postern/postern.mjs";
import { runIssueContractValidation } from "./validate-issue-contract.mjs";
import { validatePullRequestMetadata } from "../../.github/scripts/validate-pr-metadata.mjs";

// All paths consume neutral input; the trusted trigger owns event decoding.
export async function validate(
  input,
  connection,
  resolveIssue,
  resolveBoundary,
  resolveTracker,
  credential,
) {
  if (input.kind === "issue-contract")
    return runIssueContractValidation(
      input.event,
      connection,
      resolveIssue,
      undefined,
      undefined,
      undefined,
      undefined,
      resolveBoundary,
      resolveTracker,
    );
  if (input.kind === "pr-metadata" && typeof input.pullRequest === "number") {
    const pullRequest = await connection.pullRequests.pullRequest(
      input.pullRequest,
    );
    const result = validatePullRequestMetadata(pullRequest);
    await postStatus(
      connection,
      pullRequest.headCommit,
      "PR metadata",
      result === 0 ? "success" : "failure",
    );
    return result;
  }
  if (input.kind === "pr-metadata")
    return validatePullRequestMetadata(input.pullRequest);
  if (input.kind === "check-command")
    return runCheckCommand(input, connection, credential);
  throw new Error(
    "Choose issue-contract or pr-metadata validation, or check-command.",
  );
}

async function runCheckCommand(input, connection, credential) {
  if (
    !["runner", "review"].includes(input.role) ||
    !/^[a-f0-9]{40}$/.test(input.head) ||
    typeof input.checkout !== "string" ||
    !input.checkout.trim() ||
    typeof input.command !== "string" ||
    !input.command.trim()
  )
    throw new Error(
      "Provide an exact head SHA, checkout, command and runner or review role.",
    );
  if (typeof credential !== "string" || !credential)
    throw new Error(
      "Provide the posting credential to check-command validation.",
    );
  const context = input.role === "runner" ? "Runner checks" : "Review rerun";
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: input.checkout,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  if (head !== input.head)
    throw new Error("Checkout HEAD differs from the requested head SHA.");
  await postStatus(connection, head, context, "pending");
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([name, value]) => name !== "POSTERN_TOKEN" && value !== credential,
    ),
  );
  const result = await new Promise((resolve) => {
    const child = spawn(input.command, {
      cwd: input.checkout,
      shell: true,
      stdio: "inherit",
      env,
    });
    child.once("error", () => resolve(1));
    child.once("close", (code) => resolve(code === 0 ? 0 : 1));
  });
  await postStatus(
    connection,
    head,
    context,
    result === 0 ? "success" : "failure",
  );
  return result;
}

async function postStatus(connection, head, context, state) {
  await connection.access.request({
    method: "POST",
    path: `/repos/${connection.repository.path}/statuses/${head}`,
    body: { context, state },
  });
}

export function executedAsScript(url) {
  if (!process.argv[1]) return false;
  return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(url));
}

export async function main(
  argv = process.argv.slice(2),
  connectionOptions = {},
) {
  if (argv.length !== 1)
    throw new Error(
      "Usage: node vendor/repo-canon/validate.mjs <neutral-input.json>",
    );
  const input = JSON.parse(await readFile(argv[0], "utf8"));
  const options = {
    credential: process.env.POSTERN_TOKEN,
    ...connectionOptions,
    relationshipSections: { parent: "Parent", blockedBy: "Blocked by" },
  };
  const connection =
    input.kind === "issue-contract" ||
    input.kind === "check-command" ||
    (input.kind === "pr-metadata" && typeof input.pullRequest === "number")
      ? connect(input.repository, options)
      : undefined;
  const trackerFor = (path) =>
    connect({ ...connection.repository, path }, options).issueTracker;
  return validate(
    input,
    connection,
    (reference) => trackerFor(reference.repository).issue(reference.number),
    connectionOptions.resolveBoundary,
    trackerFor,
    options.credential,
  );
}

if (import.meta.main ?? executedAsScript(import.meta.url)) {
  try {
    process.exitCode = await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
