#!/usr/bin/env node

// Verifies the update from the previous published release to a pushed release
// tag before the release is published: for each profile that the previous
// release declares, the previous release's required minimum CLI adopts it into
// a fixture repository, and the newest public CLI updates that adoption to the
// candidate, selected by its version.

import { checkUpdates } from "./update.mjs";
import {
  fail,
  profiles,
  releaseVersion,
  report,
  resolveCommit,
  runScript,
  sourceRepository,
} from "./support.mjs";

await runScript(
  "release:check-update",
  "pnpm run release:check-update <version> <release-commit>",
  2,
  (version, releaseRevision) => {
    releaseVersion(version);
    const releaseCommit = resolveCommit(releaseRevision);
    const results = checkUpdates(
      sourceRepository,
      version,
      releaseCommit,
      profiles,
    ).map((outcome) => report(() => outcome));
    if (results.includes(false))
      fail(
        `the update to ${version} did not verify; see the failed checks above.`,
      );
    console.log(`the update to ${version} verified at ${releaseCommit}.`);
  },
);
