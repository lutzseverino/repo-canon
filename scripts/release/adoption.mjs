// Adopts a published release into the fixture repository through `adopt` with
// an answers file, as an agent would without a terminal, and checks that the
// run completes with the GitHub remote setup deferred. The fixture and the
// answers file live in a temporary directory that is removed, and the fixture
// has no Git remote, so the run changes no repository or GitHub state.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { assessments, files, scopes } from "./adoption-fixture.mjs";
import {
  ReleaseCheckFailure,
  fail,
  git,
  parseJson,
  run,
  withTemporaryDirectory,
} from "./support.mjs";

const adoptFormat = "repo-standards/adopt/v2";
// The remote setup the fixture cannot apply without a GitHub remote.
const remoteSetup = [
  "github-repository-configuration/canonical-labels",
  "github-repository-configuration/pull-request-integration",
];
// More rounds than a run needs: the template, the scopes, the start, and the
// assessments.
const maximumRounds = 10;

function createFixture(project) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(project, path)), { recursive: true });
    writeFileSync(join(project, path), content);
  }
  const fixtureGit = (...args) =>
    git([
      "-C",
      project,
      "-c",
      "user.name=Repo Canon release verification",
      "-c",
      "user.email=release-verification@example.invalid",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ]);
  fixtureGit("init", "--quiet", "--initial-branch=main");
  fixtureGit("add", "--all");
  fixtureGit("commit", "--quiet", "--no-verify", "--message", "Wordtally");
}

function adopt(cli, args, formats = [adoptFormat]) {
  const child = run(cli, ["adopt", ...args, "--json"]);
  const report = parseJson(child.stdout || child.stderr, "the adopt output");
  if (!formats.includes(report.format)) {
    const errors = (report.errors ?? []).map((error) => error.message);
    fail(
      `adopt failed: ${errors.join(" ") || (child.stderr || child.stdout).trim()}`,
    );
  }
  return report;
}

const fixId = (entry) => `${entry.declaration}/${entry.id}`;

// The answer the fixture gives a question, keeping one `adopt` proposed, such
// as a discovery script's draft. A run starts only on the `inspection` answer,
// so it names the inspection only once every other answer is in and the
// inspection offers to defer all the remote setup.
function answer(question, report, version, profile) {
  const { id } = question;
  const [kind, name] = id.split(":");
  switch (kind) {
    case "version":
      return version;
    case "profile":
      return profile;
    case "scope": {
      const open = question.details?.unresolved ?? [];
      if (open.length > 0)
        fail(`the ${name} scope has open questions: ${JSON.stringify(open)}`);
      return (
        question.answer ??
        scopes[name] ??
        fail(`the fixture has no ${name} scope.`)
      );
    }
    case "remote-setup":
      return "defer";
    case "inspection": {
      if (
        report.missing.some(
          (missing) => !/^(inspection|remote-setup)$/.test(missing),
        )
      )
        return null;
      const offered = (
        report.answers.questions.find((entry) => entry.id === "remote-setup")
          ?.details ?? []
      ).map(fixId);
      const undeferred = remoteSetup.filter((fix) => !offered.includes(fix));
      if (undeferred.length > 0)
        fail(
          `the inspection offers no deferral of remote setup ${undeferred.join(", ")}; starting would apply it.`,
        );
      return question.answer;
    }
    case "assessment":
      return (
        assessments[name] ?? fail(`the fixture has no ${name} assessment.`)
      );
    case "confirmation":
    case "fix":
      return fail(
        `the run asks to confirm a confirmation-required change (${id}): ${question.context}`,
      );
    default:
      return fail(`adopt asks an unexpected question ${id}.`);
  }
}

// The deferred remote setup that `status` reports for the completed run.
export function checkStatus(cli, project) {
  const child = run(cli, ["status", "--project", project, "--json"]);
  const status = parseJson(child.stdout || child.stderr, "the status output");
  if (child.status !== 0)
    fail(
      `status failed: ${(status.errors ?? []).map((error) => error.message).join(" ")}`,
    );
  if (status.readyToCommit !== true)
    fail(
      `status does not report the run ready to commit: ${(status.readinessReasons ?? []).join(" ")}`,
    );
  const deferred = (status.deferred ?? []).map(fixId);
  const missing = remoteSetup.filter((fix) => !deferred.includes(fix));
  if (missing.length > 0)
    fail(
      `status does not list remote setup ${missing.join(", ")} as deferred.`,
    );
  return status;
}

// Prepares the same fixture for fresh adoption and update verification.
export function adoptFixture(
  cli,
  source,
  version,
  profile,
  floor,
  directory,
  { initialArgs = [], formats = [adoptFormat] } = {},
) {
  const project = join(directory, "project");
  const answersPath = join(directory, "answers.json");
  createFixture(project);
  let report = adopt(
    cli,
    [source, ...initialArgs, "--project", project],
    formats,
  );
  const cliVersion = report.selection?.cli;
  if (cliVersion !== floor)
    fail(
      `adopt ran CLI ${cliVersion}, not the required minimum ${floor}; install ${floor} under REPO_STANDARDS_PREFIX.`,
    );
  for (let round = 1; round <= maximumRounds; round += 1) {
    switch (report.outcome) {
      case "complete": {
        const status = checkStatus(cli, project);
        return { project, cliVersion, status };
      }
      case "answers-required":
      case "contextual": {
        if (report.failedChecks?.length)
          fail(
            `the run's checks failed: ${report.failedChecks
              .map(
                (check) => `${check.declaration}/${check.id}: ${check.message}`,
              )
              .join(" ")}`,
          );
        const questions = report.answers.questions.map((question) => ({
          ...question,
          answer: answer(question, report, version, profile),
        }));
        writeFileSync(
          answersPath,
          `${JSON.stringify({ ...report.answers, questions }, null, 2)}\n`,
        );
        report = adopt(
          cli,
          ["--answers", answersPath, "--project", project],
          formats,
        );
        break;
      }
      default: {
        const blockers = (report.blockers ?? []).map(
          (blocker) => blocker.message ?? JSON.stringify(blocker),
        );
        fail(
          `the adoption is ${report.outcome}: ${[...blockers, report.run?.reason].filter(Boolean).join(" ")}`,
        );
      }
    }
  }
  return fail(
    `the adoption did not complete in ${maximumRounds} rounds; adopt last reported ${report.outcome}, missing ${report.missing.join(", ")}.`,
  );
}

// Adopts `version` with `profile` into a fresh fixture repository, through the
// CLI at `cli`, which must be at `floor`.
export function checkAdoption(cli, source, version, profile, floor) {
  try {
    return withTemporaryDirectory("repo-canon-adopt-", (directory) => {
      const { cliVersion, status } = adoptFixture(
        cli,
        source,
        version,
        profile,
        floor,
        directory,
      );
      const deferred = status.deferred.map(fixId);
      return {
        pass:
          `CLI ${cliVersion} adopted ${version} with the ${profile} profile into a fixture repository ` +
          `through adopt with an answers file; status reports the run ready to commit, with remote setup ` +
          `${deferred.join(" and ")} deferred.`,
      };
    });
  } catch (error) {
    if (!(error instanceof ReleaseCheckFailure)) throw error;
    return {
      failures: [
        `the ${profile} adoption of ${version} failed: ${error.message}`,
      ],
    };
  }
}
