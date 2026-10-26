#!/usr/bin/env node

// Verifies a published release: its annotated tag on origin peels to the
// release commit, its GitHub release is an ordinary release, the public CLI at
// the required minimum version inspects it with each profile in a disposable
// repository and resolves the release commit and that profile, the same CLI
// adopts it with each profile into a fixture repository through `adopt` with
// an answers file, deferring remote setup, and the public copy at the release
// commit names no Repo Canon version and its README no CLI version. Every CLI
// version that the adoption guide and the development and authoring documents
// name there is the required minimum. The update check also commits the
// previous release's fixture adoption and updates it with the newest public CLI.

import { checkUpdates } from "./update.mjs";
import { checkAdoption } from "./adoption.mjs";
import {
  adoptionGuidePath,
  cliFloor,
  cliVersionMismatches,
  developmentDocumentPaths,
  publicCopyVersionProblems,
  standardsPath,
} from "./named-versions.mjs";
import {
  ReleaseCheckFailure,
  fail,
  filesAt,
  git,
  parseJson,
  repoStandardsCli,
  resolveCommit,
  run,
  runScript,
  withTemporaryDirectory,
} from "./support.mjs";

const sourceRepository = "https://github.com/lutzseverino/repo-canon";
const profiles = ["standard", "factory"];

function checkTag(version, releaseCommit) {
  const references = new Map();
  for (const line of git([
    "ls-remote",
    "origin",
    `refs/tags/${version}`,
    `refs/tags/${version}^{}`,
  ]).split("\n")) {
    const [object, reference] = line.split("\t");
    if (reference) references.set(reference, object);
  }
  if (!references.has(`refs/tags/${version}`))
    return { failures: [`tag ${version} is not on origin.`] };
  const peeled = references.get(`refs/tags/${version}^{}`);
  if (!peeled)
    return { failures: [`tag ${version} on origin is not an annotated tag.`] };
  if (peeled !== releaseCommit) {
    return {
      failures: [
        `tag ${version} on origin peels to ${peeled}, not the release commit ${releaseCommit}.`,
      ],
    };
  }
  return {
    pass: `tag ${version} peels to the release commit ${releaseCommit}.`,
  };
}

function checkGitHubRelease(version) {
  const child = run("gh", [
    "release",
    "view",
    version,
    "--json",
    "isDraft,isPrerelease",
  ]);
  if (child.status !== 0)
    return {
      failures: [`gh release view ${version} failed: ${child.stderr.trim()}`],
    };
  const release = parseJson(child.stdout, `gh release view ${version} output`);
  const states = [];
  if (release.isDraft !== false) states.push("a draft");
  if (release.isPrerelease !== false) states.push("a prerelease");
  if (states.length > 0) {
    return {
      failures: [
        `GitHub release ${version} is ${states.join(" and ")}; publish an ordinary release.`,
      ],
    };
  }
  return {
    pass: `GitHub release ${version} is neither a draft nor a prerelease.`,
  };
}

// The CLI version the release requires: the floor of its open-ended minimum.
function requiredCli(read) {
  const floor = cliFloor(read(standardsPath));
  if (floor === null)
    fail(
      `${standardsPath} at the release commit declares no open-ended CLI minimum.`,
    );
  return floor;
}

function checkInspection(version, releaseCommit, read, profile) {
  const floor = requiredCli(read);
  const cli = repoStandardsCli();
  const child = withTemporaryDirectory("repo-canon-verify-", (project) => {
    git(["init", "--quiet", project]);
    return run(cli, [
      "inspect",
      "--source",
      sourceRepository,
      "--standards-version",
      version,
      "--profile",
      profile,
      "--project",
      project,
      "--json",
    ]);
  });
  if (child.status !== 0) {
    return {
      failures: [
        `the ${profile} inspection of ${version} failed: ${(child.stderr || child.stdout).trim()}`,
      ],
    };
  }
  const inspection = parseJson(
    child.stdout,
    `the inspection output for ${version}`,
  );
  const selection = inspection.selection ?? {};
  const cliVersion = selection.cli?.version;
  const resolvedCommit = selection.standards?.commit;
  const declarations = inspection.sourceResolved?.declarations?.length ?? 0;
  const failures = [];
  if (cliVersion !== floor) {
    failures.push(
      `the inspection used CLI ${cliVersion}, not the required minimum ${floor}; ` +
        `install ${floor} under REPO_STANDARDS_PREFIX.`,
    );
  }
  if (selection.standards?.version !== version) {
    failures.push(
      `the inspection selected ${selection.standards?.version}, not ${version}.`,
    );
  }
  if (resolvedCommit !== releaseCommit) {
    failures.push(
      `the inspection resolved commit ${resolvedCommit}, not the release commit ${releaseCommit}.`,
    );
  }
  if (selection.profile !== profile || declarations === 0) {
    failures.push(`the inspection did not resolve the ${profile} profile.`);
  }
  if (failures.length > 0) return { failures };
  return {
    pass:
      `CLI ${cliVersion} inspected ${version} in a disposable repository and resolved ${resolvedCommit} ` +
      `with the ${profile} profile (${declarations} declarations).`,
  };
}

function checkFixtureAdoption(version, read, profile) {
  return checkAdoption(
    repoStandardsCli(),
    sourceRepository,
    version,
    profile,
    requiredCli(read),
  );
}

function checkDocuments(read) {
  const failures = [
    ...publicCopyVersionProblems(read),
    ...cliVersionMismatches(read, [
      adoptionGuidePath,
      ...developmentDocumentPaths,
    ]),
  ];
  if (failures.length > 0) return { failures };
  return {
    pass:
      `the public copy at the release commit names no Repo Canon version and its README no CLI version, ` +
      `and every CLI version the adoption guide and the development and authoring documents name is ` +
      `the required minimum ${cliFloor(read(standardsPath))}.`,
  };
}

// Reports one check's outcome and returns whether it passed. A check that
// cannot complete fails with its reason.
function report(check) {
  let outcome;
  try {
    outcome = check();
  } catch (error) {
    if (!(error instanceof ReleaseCheckFailure)) throw error;
    outcome = { failures: [error.message] };
  }
  for (const failure of outcome.failures ?? []) console.log(`fail: ${failure}`);
  if (outcome.pass) console.log(`pass: ${outcome.pass}`);
  return !outcome.failures;
}

await runScript(
  "release:verify",
  "pnpm run release:verify <version> <release-commit>",
  2,
  (version, releaseRevision) => {
    if (!/^v\d+\.\d+\.\d+$/.test(version))
      fail(`${version} is not a stable release version such as v1.2.3.`);
    const releaseCommit = resolveCommit(releaseRevision);
    const read = filesAt(releaseCommit);
    const results = [
      report(() => checkTag(version, releaseCommit)),
      report(() => checkGitHubRelease(version)),
      ...profiles.map((profile) =>
        report(() => checkInspection(version, releaseCommit, read, profile)),
      ),
      ...profiles.map((profile) =>
        report(() => checkFixtureAdoption(version, read, profile)),
      ),
      ...checkUpdates(sourceRepository, version, releaseCommit, profiles).map(
        (outcome) => report(() => outcome),
      ),
      report(() => checkDocuments(read)),
    ];
    if (results.includes(false))
      fail(`${version} did not verify; see the failed checks above.`);
    console.log(`${version} verified at ${releaseCommit}.`);
  },
);
