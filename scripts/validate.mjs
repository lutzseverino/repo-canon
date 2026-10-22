#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { connect } from "../vendor/postern/postern.mjs";
import { runIssueContractValidation } from "./validate-issue-contract.mjs";
import { validatePullRequestMetadata } from "../.github/scripts/validate-pr-metadata.mjs";

// Both paths consume neutral input; the trusted trigger owns event decoding.
export async function validate(input, connection, resolveIssue) {
  if (input.kind === "issue-contract")
    return runIssueContractValidation(input.event, connection, resolveIssue);
  if (input.kind === "pr-metadata")
    return validatePullRequestMetadata(input.pullRequest);
  throw new Error("Choose issue-contract or pr-metadata validation.");
}

export function executedAsScript(url) {
  return (
    Boolean(process.argv[1]) &&
    realpathSync(process.argv[1]) === realpathSync(fileURLToPath(url))
  );
}

if (import.meta.main ?? executedAsScript(import.meta.url)) {
  const input = JSON.parse(await readFile(process.argv[2], "utf8"));
  const options = {
    credential: process.env.POSTERN_TOKEN,
    relationshipSections: { parent: "Parent", blockedBy: "Blocked by" },
  };
  const connection =
    input.kind === "issue-contract"
      ? connect(input.repository, options)
      : undefined;
  process.exitCode = await validate(input, connection, (reference) =>
    connect(
      `https://github.com/${reference.repository}`,
      options,
    ).issueTracker.issue(reference.number),
  );
}
