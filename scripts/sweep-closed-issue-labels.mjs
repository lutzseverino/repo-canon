#!/usr/bin/env node

import {
  connectionFor,
  executedAsScript,
} from "../.agents/skills/babysit/platform.mjs";
import { PlatformError } from "../vendor/postern/postern.mjs";
import { decideIssueContract } from "./validate-issue-contract.mjs";

function argumentsFor(argv) {
  const repositories = [];
  let mode;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--repo") {
      const repository = argv[++index];
      if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repository ?? ""))
        throw new Error("--repo requires an explicit GitHub OWNER/REPO.");
      repositories.push(repository);
    } else if (["--dry-run", "--apply"].includes(arg) && mode === undefined) {
      mode = arg;
    } else {
      throw new Error(`Unknown or repeated argument: ${arg}`);
    }
  }
  if (repositories.length === 0 || mode === undefined)
    throw new Error(
      "Usage: node scripts/sweep-closed-issue-labels.mjs --repo OWNER/REPO [--repo OWNER/REPO ...] (--dry-run | --apply)",
    );
  return {
    repositories: [...new Set(repositories)],
    dryRun: mode === "--dry-run",
  };
}

// Explicit destinations only; connectionFor uses the supplied gh credential.
// Read each issue again so one reopened since enumeration is left untouched.
/**
 * @param {string[]} [argv]
 * @param {(repository: string) => { issueTracker: Pick<ReturnType<typeof connectionFor>["issueTracker"], "issues" | "issue" | "removeLabel"> }} [connect]
 * @param {(line: string) => void} [report]
 */
export async function main(
  argv = process.argv.slice(2),
  connect = connectionFor,
  report = console.log,
) {
  const { repositories, dryRun } = argumentsFor(argv);
  let exitCode = 0;
  for (const repository of repositories) {
    let scanned = 0;
    let needingCleanup = 0;
    let removed = 0;
    let failures = 0;
    let permissionRefused = false;
    const failed = (target, error) => {
      failures++;
      exitCode = 1;
      report(`${target}: FAILED: ${error.message}`);
      permissionRefused =
        error instanceof PlatformError &&
        ["unauthenticated", "forbidden"].includes(error.reason);
    };
    try {
      const tracker = connect(repository).issueTracker;
      const issues = await tracker.issues({ state: "closed" });
      for (const candidate of issues) {
        scanned++;
        const target = `${repository}#${candidate.number}`;
        try {
          const issue = await tracker.issue(candidate.number);
          if (issue.state !== "closed") continue;
          const { removeLabels } = decideIssueContract({ issue });
          if (removeLabels.length === 0) continue;
          needingCleanup++;
          if (dryRun) {
            report(`${target}: would remove ${JSON.stringify(removeLabels)}`);
          } else {
            for (const label of removeLabels) {
              await tracker.removeLabel(issue.number, label);
              removed++;
              report(`${target}: removed ${JSON.stringify(label)}`);
            }
          }
        } catch (error) {
          failed(target, error);
          if (permissionRefused) break;
        }
      }
    } catch (error) {
      failed(repository, error);
    }
    report(
      `${repository}: ${dryRun ? "dry run" : "applied"}; ${scanned} scanned, ${needingCleanup} needing cleanup, ${removed} labels removed, ${failures} failures`,
    );
    // A permission refusal stands for the whole run, including other targets.
    if (permissionRefused) return 1;
  }
  return exitCode;
}

if (import.meta.main ?? executedAsScript(import.meta.url)) {
  try {
    process.exitCode = await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
