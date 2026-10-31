// Verifies an update from the preceding public release without editing the
// adopted fixture, answering the scope, remote setup and assessment questions.
// A profile that the preceding release does not declare has no update to
// verify, so its check is skipped.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { adoptFixture, checkStatus, fixtureAnswer } from "./adoption.mjs";
import { cliFloor } from "./named-versions.mjs";
import {
  ReleaseCheckFailure,
  fail,
  filesAt,
  git,
  parseJson,
  resolveTag,
  run,
  withTemporaryDirectory,
} from "./support.mjs";

const packageName = "@lutzseverino/repo-standards";
const registry = "https://registry.npmjs.org";
const stable = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const parts = (version) => version.match(stable)?.slice(1).map(Number);
const compare = (left, right) => {
  const a = parts(left);
  const b = parts(right);
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
};

function successful(command, args) {
  const child = run(command, args, { timeout: 180_000 });
  if (child.status !== 0)
    fail(
      `${command} ${args[0]} failed: ${(child.stderr || child.stdout).trim()}`,
    );
  return child.stdout;
}

function previousRelease(version) {
  const pages = parseJson(
    successful("gh", [
      "api",
      "--paginate",
      "--slurp",
      "repos/lutzseverino/repo-canon/releases?per_page=100",
    ]),
    "the published releases",
  );
  const previous = pages
    .flat()
    .filter(
      (release) => release.draft === false && release.prerelease === false,
    )
    .map((release) => release.tag_name)
    .filter((tag) => parts(tag) && compare(tag, version) < 0)
    .sort(compare)
    .at(-1);
  return previous ?? fail(`no published stable release precedes ${version}.`);
}

function installCli(directory, version) {
  successful("npm", [
    "install",
    "--prefix",
    directory,
    "--ignore-scripts",
    `--registry=${registry}`,
    `${packageName}@${version}`,
  ]);
  const cli = join(directory, "node_modules/.bin/repo-standards");
  const actual = successful(cli, ["--version"]).trim();
  if (actual !== version) fail(`installed CLI ${actual}, expected ${version}.`);
  return cli;
}

function update(cli, project, args = []) {
  const child = run(cli, ["adopt", ...args, "--json"], {
    cwd: project,
    timeout: 180_000,
  });
  const report = parseJson(
    child.stdout || child.stderr,
    "the update adopt output",
  );
  if (report.format !== "repo-standards/adopt/v2")
    fail(
      `the update returned an unsupported adopt report: ${child.stdout || child.stderr}`,
    );
  return { child, report };
}

function updateStopDetails(report) {
  const diagnostics = [
    report.blockers?.length && `blockers: ${JSON.stringify(report.blockers)}`,
    report.failedChecks?.length &&
      `failed checks: ${JSON.stringify(report.failedChecks)}`,
    report.run?.reason,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    `outcome ${report.outcome}; missing ${(report.missing ?? []).join(", ") || "none"}.` +
    (diagnostics ? ` ${diagnostics}` : "")
  );
}

function checkSelection(report, version, profile, newest, source) {
  const selection = report.selection ?? {};
  if (
    selection.version !== version ||
    selection.profile !== profile ||
    selection.cli !== newest ||
    selection.source !== source
  )
    fail(
      `the update selected ${JSON.stringify(selection)}, expected CLI ${newest}, ${source} ${version}, ${profile}.`,
    );
  if (report.blockers?.length || report.failedChecks?.length)
    fail(
      `the update has blockers or failed checks: ${updateStopDetails(report)}`,
    );
}

function checkUpdate({
  cli,
  baseline,
  source,
  previous,
  version,
  commit,
  profile,
  floor,
  newest,
}) {
  return withTemporaryDirectory("repo-canon-update-fixture-", (directory) => {
    const { project } = adoptFixture(
      baseline,
      source,
      previous,
      profile,
      floor,
      directory,
      {
        initialArgs: ["--standards-version", previous, "--profile", profile],
        formats: ["repo-standards/adopt/v1", "repo-standards/adopt/v2"],
      },
    );
    git(["-C", project, "add", "--all"]);
    git([
      "-C",
      project,
      "-c",
      "user.name=Repo Canon release verification",
      "-c",
      "user.email=release-verification@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "--no-verify",
      "--message",
      `Adopt ${previous}`,
    ]);
    let { child, report } = update(cli, project);
    const answered = new Set();
    for (let round = 0; round < 10; round += 1) {
      checkSelection(report, version, profile, newest, source);
      const missing = report.missing ?? [];
      const line = report.inspection?.summary?.match(
        /^## Adopter action\n\n([^\n]+)/m,
      )?.[1];
      console.log(
        `update (${profile}, CLI ${floor} to ${newest}): outcome ${report.outcome}; questions ${missing.join(", ") || "none"}.` +
          (line ? ` Adopter action: ${line}` : ""),
      );
      const questions = report.answers?.questions ?? [];
      const confirmation = questions.find((entry) =>
        /^(confirmation|fix)(:|$)/.test(entry.id),
      );
      if (confirmation)
        fail(
          `the update asks to confirm a confirmation-required change (${confirmation.id}).`,
        );
      if (report.outcome === "complete") break;
      if (
        !["answers-required", "contextual"].includes(report.outcome) ||
        !missing.length
      )
        fail(`the update stopped with ${updateStopDetails(report)}`);
      for (const id of missing) {
        if (answered.has(id))
          fail(
            `the update stopped again after answering ${id}; outcome ${report.outcome}.`,
          );
        if (!/^(scope:[^:]+|assessment:[^:]+|remote-setup)$/.test(id))
          fail(`the update asks an unexpected question ${id}.`);
        if (!questions.some((question) => question.id === id))
          fail(`the update has no question for ${id}.`);
      }
      const submitted = questions.map((question) => {
        if (!missing.includes(question.id)) return question;
        answered.add(question.id);
        return {
          ...question,
          answer: fixtureAnswer(question, report, version, profile),
        };
      });
      const answers = join(directory, "update-answers.json");
      writeFileSync(
        answers,
        `${JSON.stringify({ ...report.answers, questions: submitted }, null, 2)}\n`,
      );
      ({ child, report } = update(cli, project, ["--answers", answers]));
    }
    checkSelection(report, version, profile, newest, source);
    if (report.outcome !== "complete")
      fail(
        `the update did not complete after answering; outcome ${report.outcome}.`,
      );
    if (child.status !== 0 || report.missing?.length)
      fail(
        `the complete update exited ${child.status} with open questions ${JSON.stringify(report.missing)}.`,
      );
    const status = checkStatus(cli, project, profile);
    const selection = status.selection;
    if (
      selection?.cli?.version !== newest ||
      selection?.standards?.version !== version ||
      selection?.standards?.commit !== commit ||
      selection?.standards?.repository !== source ||
      selection?.profile !== profile
    )
      fail("the ready status does not identify the verified release and CLI.");
    const line = status.impact?.derived;
    if (
      typeof line !== "string" ||
      !line.trim() ||
      /[\r\n\u2028\u2029]/u.test(line)
    )
      fail("the update did not report a derived adopter-action line.");
    return {
      pass: `CLI ${floor} adopted ${previous}; CLI ${newest} updated to ${version} with the ${profile} profile; questions ${[...answered].join(", ") || "none"}; outcome ${report.outcome}, ready to commit with ${profile === "workbench" ? "no remote setup" : "both GitHub remote setup fixes deferred"}. Adopter action: ${line}`,
    };
  });
}

// The profile names that a `standards.yaml` declares.
function profileNames(standardsText) {
  const profiles = /^profiles:[ \t]*\r?\n((?:(?:[ \t]+.*)?\r?\n?)*)/m.exec(
    standardsText,
  )?.[1];
  return [...(profiles ?? "").matchAll(/^ {2}([A-Za-z0-9._-]+):/gm)].map(
    ([, name]) => name,
  );
}

export function checkUpdates(source, version, commit, profiles) {
  try {
    const previous = previousRelease(version);
    const manifest = filesAt(resolveTag(previous))("standards.yaml");
    const floor = cliFloor(manifest);
    if (!floor) fail(`${previous} declares no open-ended CLI minimum.`);
    const declared = profileNames(manifest);
    const newest = parseJson(
      successful("npm", [
        "view",
        packageName,
        "version",
        `--registry=${registry}`,
        "--json",
      ]),
      "the newest published CLI version",
    );
    if (typeof newest !== "string" || !parts(newest))
      fail("npm did not report a stable published CLI version.");
    return withTemporaryDirectory("repo-canon-update-clis-", (directory) => {
      const baseline = installCli(join(directory, "previous"), floor);
      const cli = installCli(join(directory, "newest"), newest);
      return profiles.map((profile) => {
        if (!declared.includes(profile))
          return {
            skip: `${previous} declares no ${profile} profile, so no ${profile} adoption precedes ${version} to update.`,
          };
        try {
          return checkUpdate({
            cli,
            baseline,
            source,
            previous,
            version,
            commit,
            profile,
            floor,
            newest,
          });
        } catch (error) {
          if (!(error instanceof ReleaseCheckFailure)) throw error;
          return {
            failures: [
              `the ${profile} update from ${previous} to ${version} (CLI ${floor} to ${newest}) failed: ${error.message}`,
            ],
          };
        }
      });
    });
  } catch (error) {
    if (!(error instanceof ReleaseCheckFailure)) throw error;
    return profiles.map((profile) => ({
      failures: [
        `the ${profile} update to ${version} failed: ${error.message}`,
      ],
    }));
  }
}
