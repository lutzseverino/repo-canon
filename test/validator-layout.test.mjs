import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  assessments,
  files,
  scopes,
} from "../scripts/release/adoption-fixture.mjs";
import {
  fixtureSource,
  publicCli,
  sourceUrl,
} from "./helpers/fixture-source.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const previous = "v0.25.0";
const candidate = "v1.0.0";
const retired = ["scripts/validate.mjs", "scripts/validate-issue-contract.mjs"];
const own = "scripts/own.mjs";
const ownBytes = "export const project = true;\n";
const attributes =
  "* text=auto eol=lf\n/scripts/own.mjs linguist-vendored=false\n";

// All installation and retained inputs come from the public CLI. Only remote
// source transport is replaced; no installed source or CLI state is patched.
test("public CLI relocates validators in every fresh profile and preceding-release update", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "validator-layout-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const cli = publicCli(directory);
  const validation = JSON.parse(
    execFileSync(cli, ["source", "validate", root, "--json"], {
      encoding: "utf8",
    }),
  );
  assert.equal(validation.valid, true);
  const { source, env, git, publish } = fixtureSource(directory, validation);
  git(source, "-c", "tag.gpgsign=false", "tag", candidate);
  git(
    source,
    "fetch",
    "--quiet",
    "https://github.com/lutzseverino/repo-canon",
    `refs/tags/${previous}:refs/tags/${previous}`,
  );
  publish([candidate, previous]);

  for (const profile of ["standard", "factory", "workbench"]) {
    for (const mode of [
      "fresh",
      "update",
      ...(profile === "standard" ? ["edited"] : []),
    ]) {
      const project = join(directory, `${profile}-${mode}`);
      mkdirSync(project);
      for (const [path, content] of Object.entries({
        ...files,
        [own]: ownBytes,
        ".gitattributes": attributes,
      })) {
        mkdirSync(dirname(join(project, path)), { recursive: true });
        writeFileSync(join(project, path), content);
      }
      git(project, "init", "--quiet");
      const commit = () => {
        git(project, "add", "--all");
        git(
          project,
          "-c",
          "commit.gpgsign=false",
          "commit",
          "--quiet",
          "-m",
          "Fixture adoption",
        );
      };
      commit();
      const invoke = (...args) => {
        const child = spawnSync(
          cli,
          [...args, "--project", project, "--json"],
          { cwd: project, env, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
        );
        assert.ifError(child.error);
        const report = JSON.parse(child.stdout || child.stderr);
        assert.ok([0, 1].includes(child.status), JSON.stringify(report));
        return report;
      };
      const adopt = (version) => {
        let report = invoke(
          "adopt",
          sourceUrl,
          "--standards-version",
          version,
          "--profile",
          profile,
        );
        for (
          let round = 0;
          report.outcome !== "complete" && round < 10;
          round++
        ) {
          assert.ok(
            ["answers-required", "contextual"].includes(report.outcome),
            JSON.stringify(report),
          );
          if (report.missing.includes("assessment:git-attributes")) {
            const guidance = git(
              source,
              "show",
              `${version}:guidance/git-attributes.md`,
            );
            const block = /```gitattributes\n([\s\S]*?)\n\s*```/.exec(guidance);
            assert.ok(block);
            writeFileSync(
              join(project, ".gitattributes"),
              attributes + block[1].replaceAll(/^ {3}/gm, "") + "\n",
            );
          }
          const questions = report.answers.questions.map((question) => {
            const [kind, name] = question.id.split(":");
            let answer = question.answer;
            if (kind === "scope")
              answer ??= question.details?.draft ?? scopes[name];
            if (kind === "assessment" && report.missing.includes(question.id))
              answer = assessments[name];
            if (kind === "version") answer = version;
            if (kind === "profile") answer = profile;
            if (kind === "remote-setup") answer = "defer";
            if (
              kind === "inspection" &&
              report.missing.some(
                (id) => !/^(inspection|remote-setup)$/.test(id),
              )
            )
              answer = null;
            assert.notEqual(answer, undefined, question.id);
            return { ...question, answer };
          });
          const answers = join(directory, "answers.json");
          writeFileSync(
            answers,
            JSON.stringify({ ...report.answers, questions }),
          );
          report = invoke("adopt", "--answers", answers);
        }
        assert.equal(report.outcome, "complete", JSON.stringify(report));
        assert.equal(invoke("status").readyToCommit, true);
      };
      if (mode !== "fresh") {
        adopt(previous);
        for (const path of retired)
          assert.equal(
            existsSync(join(project, path)),
            profile !== "workbench" || path.includes("issue-contract"),
          );
        commit();
        if (mode === "edited") {
          writeFileSync(
            join(project, retired[1]),
            "// Project-owned retained validator\n",
          );
          commit();
        }
        const inspection = invoke(
          "inspect",
          "--source",
          sourceUrl,
          "--standards-version",
          candidate,
          "--profile",
          profile,
        );
        for (const path of retired.filter(
          (path) => profile !== "workbench" || path.includes("issue-contract"),
        )) {
          const kept = mode === "edited" && path === retired[1];
          assert.ok(
            inspection[kept ? "kept" : "removed"].some(
              ({ target }) => target === path,
            ),
            `${profile} ${mode}: ${path}`,
          );
        }
      }
      adopt(candidate);
      const selected = validation.profiles[profile].declarations;
      const validators = selected.filter(({ id }) =>
        ["validator-command", "issue-contract-validator"].includes(id),
      );
      assert.deepEqual(
        validators.map(({ target }) => target).sort(),
        [
          ...(profile === "workbench"
            ? []
            : ["vendor/repo-canon/validate.mjs"]),
          "vendor/repo-canon/validate-issue-contract.mjs",
        ].sort(),
      );
      for (const path of retired)
        assert.equal(
          existsSync(join(project, path)),
          mode === "edited" && path === retired[1],
        );
      if (mode === "edited")
        assert.equal(
          readFileSync(join(project, retired[1]), "utf8"),
          "// Project-owned retained validator\n",
        );
      assert.equal(readFileSync(join(project, own), "utf8"), ownBytes);
      const lock = JSON.parse(
        readFileSync(join(project, ".repo-standards/lock.json"), "utf8"),
      );
      for (const path of retired)
        assert.equal(Object.hasOwn(lock.files, path), false);
      // Check every exact file and whole selected skill, and CLI-retained inputs.
      for (const declaration of selected) {
        if (declaration.exact) {
          assert.deepEqual(
            readFileSync(join(project, declaration.target)),
            readFileSync(join(source, declaration.exact)),
            declaration.target,
          );
          assert.deepEqual(
            readFileSync(
              join(project, ".repo-standards/inputs/source", declaration.exact),
            ),
            readFileSync(join(source, declaration.exact)),
          );
        }
        if (declaration.kind === "skill") {
          for (const entry of readdirSync(join(source, declaration.source), {
            recursive: true,
            withFileTypes: true,
          }).filter((entry) => entry.isFile())) {
            const path = join(entry.parentPath, entry.name).slice(
              join(source, declaration.source).length + 1,
            );
            assert.deepEqual(
              readFileSync(
                join(project, ".agents/skills", declaration.name, path),
              ),
              readFileSync(join(entry.parentPath, entry.name)),
            );
          }
        }
      }
      assert.ok(
        invoke("check").checks.every(({ status }) => status === "passed"),
      );
      if (profile === "workbench") {
        for (const path of [".github", "vendor/repo-canon/validate.mjs"])
          assert.equal(existsSync(join(project, path)), false);
      } else {
        const currentAttributes = readFileSync(
          join(project, ".gitattributes"),
          "utf8",
        );
        assert.ok(currentAttributes.startsWith(attributes));
        for (const path of [
          ...retired,
          ...validators.map(({ target }) => target),
        ])
          assert.ok(!currentAttributes.includes(path));
      }
      const imports = [
        ...validators.map(({ target }) => target),
        ".agents/skills/triage/ready.mjs",
        ...(profile === "workbench" ? [] : [".github/scripts/validate.mjs"]),
      ];
      const child = spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `globalThis.fetch = () => { throw new Error("Unexpected network"); }; for (const path of ${JSON.stringify(imports)}) await import(new URL(path, "file://" + process.cwd() + "/"));`,
        ],
        { cwd: project, env: { PATH: process.env.PATH }, encoding: "utf8" },
      );
      assert.equal(child.status, 0, child.stderr);
      assert.equal(child.stdout + child.stderr, "");
      const ready = spawnSync(
        process.execPath,
        [".agents/skills/triage/ready.mjs"],
        { cwd: project, env: { PATH: process.env.PATH }, encoding: "utf8" },
      );
      assert.equal(ready.status, 1);
      assert.match(ready.stderr, /Usage:/);
      if (profile !== "workbench") {
        for (const kind of ["pr-metadata", "issue-contract"]) {
          const event = join(project, "event.json");
          writeFileSync(
            event,
            JSON.stringify(
              kind === "pr-metadata"
                ? {
                    pull_request: {
                      title: "fix: preserve trusted validation",
                      body: "## Summary\n\nPreserve validation.\n\n## Evidence\n\nFixtures pass.\n\n## Merge Danger\n\nPublic paths move.\n\n## Related issue\n\nCloses #927",
                      head: { repo: { fork: true } },
                    },
                  }
                : {
                    action: "created",
                    repository: { full_name: "example/repository" },
                    sender: { login: "reporter", type: "User" },
                    issue: { number: 42, pull_request: {} },
                    comment: { id: 17, body: "Hostile PR comment" },
                  },
            ),
          );
          const run = spawnSync(
            process.execPath,
            [".github/scripts/validate.mjs", kind],
            {
              cwd: project,
              env: {
                PATH: process.env.PATH,
                GITHUB_EVENT_PATH: event,
                GITHUB_EVENT_NAME: "issue_comment",
                GITHUB_REPOSITORY: "example/repository",
              },
              encoding: "utf8",
            },
          );
          assert.equal(run.status, 0, run.stderr);
        }
      }
    }
  }
});
