#!/usr/bin/env node

// Confirms that a release merge commit carries exactly the source inputs of
// the reviewed pull request head, over the inputs either commit selects.

import {
  fail,
  filesAt,
  git,
  resolveCommit,
  runScript,
  sourceInputsAt,
  union,
} from "./support.mjs";

import { releaseSeamsTag } from "./prepare.mjs";

await runScript(
  "release:check-merge",
  "pnpm run release:check-merge <reviewed-head> <merge-commit>",
  2,
  (reviewedRevision, mergeRevision) => {
    const reviewedHead = resolveCommit(reviewedRevision);
    const mergeCommit = resolveCommit(mergeRevision);
    if (releaseSeamsTag(filesAt(mergeCommit)) === null)
      fail(
        "Unresolved Seams release boundary; run release:prepare in the release PR before publishing.",
      );
    const inputs = union(
      sourceInputsAt(reviewedHead),
      sourceInputsAt(mergeCommit),
    );
    const stat = git([
      "diff",
      "--stat",
      reviewedHead,
      mergeCommit,
      "--",
      ...inputs,
    ]);
    if (stat.trim() !== "") {
      fail(
        `Merge commit ${mergeCommit} does not carry exactly the reviewed source inputs of ${reviewedHead}; ` +
          `review the release again. These inputs differ:\n${stat.trimEnd()}`,
      );
    }
    console.log(
      `Merge commit ${mergeCommit} carries exactly the reviewed source inputs of ${reviewedHead}.`,
    );
  },
);
