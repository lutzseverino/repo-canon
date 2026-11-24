// One destination default-branch snapshot governs an invocation's trusted files.
import {
  checkLocation,
  parseRequiredChecks,
  requiredChecksTarget,
} from "./required-checks.mjs";
import { pinnedFiles } from "./platform.mjs";
import { parseReviewPolicy, policyTarget } from "./review-policy.mjs";
import { parseReviewer, reviewerTarget } from "./pull-request-reviewer.mjs";
import { readTrustedResultAccount } from "../../../vendor/repo-canon/validate-issue-contract.mjs";

const runnerAccountVariable = "REPO_CANON_RUNNER_ACCOUNT";

export class InvalidTrustedReviewConfiguration extends Error {
  constructor(
    evidence,
    target,
    cause,
    correction = `Correct ${target} on the destination default branch through the applicable owner-handoff/merge procedure`,
  ) {
    super(
      `Owner handoff required: invalid trusted ${target}; ${evidence}: ${cause.message.replace(/\.$/, "")}. ` +
        `${correction}; ` +
        "keep the PR open and stop babysitting. After the correction lands and continuation is authorized, invoke again to select the current default-branch revision.",
      { cause },
    );
  }
}

export async function trustedReviewConfiguration(
  connection,
  options = { requiredChecks: false },
) {
  let snapshot;
  try {
    snapshot = await pinnedFiles(connection, {
      policy: policyTarget,
      reviewer: reviewerTarget,
      ...(options.requiredChecks
        ? { requiredChecks: requiredChecksTarget }
        : {}),
    });
  } catch (error) {
    throw new Error(
      `Could not read trusted review configuration: ${error.message}`,
      { cause: error },
    );
  }
  const evidence = `review configuration: ${snapshot.evidence}`;
  const parseFile = (text, target, parse) => {
    if (text === null) return null;
    try {
      return parse(text);
    } catch (error) {
      throw new InvalidTrustedReviewConfiguration(evidence, target, error);
    }
  };
  let requiredChecks;
  if (options.requiredChecks) {
    if (snapshot.files.requiredChecks === null)
      throw new InvalidTrustedReviewConfiguration(
        evidence,
        requiredChecksTarget,
        new Error("required declaration is missing"),
      );
    requiredChecks = parseFile(
      snapshot.files.requiredChecks,
      requiredChecksTarget,
      parseRequiredChecks,
    );
  }
  const location = requiredChecks ? checkLocation(requiredChecks) : undefined;
  return {
    requiredChecks,
    location,
    resultAccount:
      location === "runner"
        ? await runnerAccount(connection, evidence)
        : null,
    policy: parseFile(snapshot.files.policy, policyTarget, parseReviewPolicy),
    reviewer: parseFile(snapshot.files.reviewer, reviewerTarget, parseReviewer),
    evidence,
    revision: snapshot.revision,
  };
}

// At runner, only statuses the repository's named account created count. An
// unset or unreadable variable can only refuse, never admit.
async function runnerAccount(connection, evidence) {
  const account = await readTrustedResultAccount(connection);
  if (account.configured) return account.login;
  throw new InvalidTrustedReviewConfiguration(
    evidence,
    runnerAccountVariable,
    new Error(
      account.error ??
        `${requiredChecksTarget} names Runner checks, but ${runnerAccountVariable} is unset`,
    ),
    account.error?.includes("Variables: read")
      ? `Give the caller's credential "Variables: read" on the repository`
      : `Set the repository variable ${runnerAccountVariable} to the runner account's REST login`,
  );
}
