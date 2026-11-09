import { execFixtureGit } from "../scripts/support/fixture-git.mjs";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parseStandards } from "../scripts/standards-declarations.mjs";
import { stringify } from "yaml";
import {
  ownedSetupFiles,
  ownedSkills,
  snapshotPath,
} from "../scripts/upstream-bases.mjs";
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

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = "v1.0.0";
const previousVersion = "v0.18.0";
const orchestrateVersion = "v0.99.0";
const sourceVersion = "v0.19.0";
// Declarations whose rules govern all work, with empty confirmed scope, and
// the profiles that select them.
const repositoryWide = {
  comments: ["standard", "factory"],
  "github-repository-configuration": ["standard", "factory"],
  "factory-workflow": ["factory"],
};

// Exercise the published CLI, with its real acquisition, adoption, installation
// and rules lookup. Only GitHub HTTP and Git transport use disposable fixtures.
// No Scriptorium implementation or host is needed.
// A Project that matches the typescript-node stack's manifest facts.
const nodeProject = {
  "package.json": `${JSON.stringify(
    {
      name: "wordtally",
      private: true,
      type: "module",
      packageManager: "pnpm@11.1.2",
      engines: { node: ">=24 <25 || >=26 <27" },
      scripts: { validate: "oxlint && prettier --check . && node --test" },
      devDependencies: { oxlint: "1.86.0", prettier: "3.9.9" },
    },
    null,
    2,
  )}\n`,
  "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
};

function webProject(stack) {
  const base = JSON.parse(nodeProject["package.json"]);
  return {
    ...nodeProject,
    "package.json": JSON.stringify({
      ...base,
      description:
        stack === "astro"
          ? "A static content site"
          : "A client-side app owning routing and state",
      dependencies:
        stack === "astro"
          ? { astro: "7.0.0", react: "19.0.0" }
          : { vite: "8.0.0", react: "19.0.0" },
      devDependencies: {
        ...base.devDependencies,
        shadcn: "4.1.0",
        "prettier-plugin-astro": "0.14.0",
      },
      scripts: {
        validate: "pnpm run ui:check",
        "ui:add": "shadcn add",
        "ui:update": "shadcn add --overwrite",
        "ui:check": "node integrity.mjs",
      },
    }),
    [`${stack}.config.mjs`]: "export default {};\n",
    "components.json": JSON.stringify({
      style: "base-nova",
      iconLibrary: "lucide",
    }),
  };
}

// The assessment of the stack for the adoption with one conforming Project.
const stackAssessment = {
  status: "satisfied",
  explanation:
    "package.json is Wordtally's only Project, and it meets the typescript-node stack rules.",
  evidence: [
    "package.json sets pnpm 11, Node.js 24 or 26, oxlint 1, Prettier 3 and a validate script running node --test.",
  ],
  scopeValidity: Object.fromEntries(
    ["afterFixes", "current"].map((review) => [
      review,
      {
        status: "valid",
        explanation: "package.json is the repository's only manifest.",
        evidence: ["No other package.json or workspace configuration exists."],
        additionalPaths: [],
      },
    ]),
  ),
};

test("the release fixture vendors the triage helper without covering repository-owned source or retained state", (t) => {
  const project = mkdtempSync(join(tmpdir(), "repo-canon-attributes-"));
  t.after(() => rmSync(project, { recursive: true, force: true }));
  writeFileSync(join(project, ".gitattributes"), files[".gitattributes"]);
  execFixtureGit(["init", "--quiet", project]);
  const paths = [
    ".agents/skills/triage/ready.mjs",
    "wordtally.mjs",
    "scripts/own.mjs",
    "operations/own.mjs",
    ".agents/skills/own/run.mjs",
    ".repo-standards/inputs/source/operations/check.mjs",
  ];
  assert.deepEqual(
    execFixtureGit(
      ["-C", project, "check-attr", "linguist-vendored", "--", ...paths],
      { encoding: "utf8" },
    )
      .trim()
      .split("\n"),
    paths.map(
      (path, index) =>
        `${path}: linguist-vendored: ${index === 0 ? "set" : "unspecified"}`,
    ),
  );
});

test("public CLI 10.0.0 adopts and updates the standard and factory profiles with vendored installed code, repository-wide rules and stack rules only for a confirmed Project", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "repo-canon-workflow-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const cli = publicCli(directory);
  const validation = JSON.parse(
    execFileSync(cli, ["source", "validate", root, "--json"], {
      encoding: "utf8",
    }),
  );
  assert.equal(validation.valid, true);
  assert.deepEqual(Object.keys(validation.profiles).sort(), [
    "factory",
    "standard",
    "workbench",
  ]);
  // The workbench profile has its own test; these two select every default.
  for (const name of ["standard", "factory"]) {
    const profile = validation.profiles[name];
    assert.equal(
      profile.declarations.length,
      { standard: 64, factory: 69 }[name],
    );
    assert.deepEqual(
      profile.declarations.find(({ id }) => id === "standards-update-workflow"),
      {
        id: "standards-update-workflow",
        kind: "file",
        target: ".github/workflows/standards-update.yml",
        exact: ".github/workflows/standards-update.yml",
        checks: [],
        fixes: [],
      },
      `${name} selects the exact opt-in update caller`,
    );
    const attributes = profile.declarations.find(
      (declaration) => declaration.id === "git-attributes",
    );
    assert.ok(attributes, "both profiles select git-attributes");
    assert.equal(attributes.kind, "file");
    assert.equal(attributes.target, ".gitattributes");
    assert.equal(attributes.rules, "rules/git-attributes.md");
    assert.equal(attributes.guidance, "guidance/git-attributes.md");
    assert.equal(attributes.exact, undefined);
    assert.deepEqual(attributes.checks, []);
    assert.deepEqual(attributes.fixes, []);
    const github = profile.declarations.find(
      (declaration) => declaration.id === "github-repository-configuration",
    );
    assert.deepEqual(
      github.checks.map(({ id }) => id),
      ["pull-request-reviewer", "factory-review-policy"],
      `${name} validates both optional repository-owned configurations`,
    );
  }
  // Every authored Node prerequisite must retain the same stable-major union,
  // including discovery and the two nested remote-setup probes.
  const prerequisites = new Map();
  for (const profile of Object.values(validation.profiles))
    for (const declaration of profile.declarations) {
      const fixes = declaration.fixes ?? [];
      for (const operation of [
        ...(declaration.checks ?? []),
        ...fixes,
        ...fixes.map((fix) => fix["remote-setup"]?.probe),
        declaration["discovery-script"],
      ].filter(Boolean))
        if (operation.run.executable === "node")
          prerequisites.set(
            operation.run.script,
            operation.prerequisite.version,
          );
    }
  assert.equal(prerequisites.size, 17);
  for (const [script, range] of prerequisites)
    assert.equal(range, ">=24.0.0 <25.0.0 || >=26.0.0 <27.0.0", script);

  const { source, env, git, publish } = fixtureSource(directory, validation);
  // A preceding local release selects today's complete orchestrate from
  // defaults, so removal exercises its executable and reference inventory.
  const candidateManifest = readFileSync(
    join(source, "standards.yaml"),
    "utf8",
  );
  const legacy = parseStandards(candidateManifest);
  const attributesPath = join(source, "guidance/git-attributes.md");
  const candidateAttributes = readFileSync(attributesPath, "utf8");
  writeFileSync(
    attributesPath,
    candidateAttributes.replace(
      "   .agents/skills/babysit/** linguist-vendored\n",
      "   .agents/skills/babysit/** linguist-vendored\n   .agents/skills/orchestrate/** linguist-vendored\n",
    ),
  );
  legacy.defaults.declarations["skill-orchestrate"] =
    legacy.profiles.workbench.declarations["skill-orchestrate"];
  delete legacy.profiles.workbench.declarations["skill-orchestrate"];
  writeFileSync(join(source, "standards.yaml"), stringify(legacy));
  git(
    source,
    "-c",
    "commit.gpgsign=false",
    "commit",
    "--quiet",
    "-am",
    "Legacy selection",
  );
  git(source, "-c", "tag.gpgsign=false", "tag", orchestrateVersion);
  writeFileSync(join(source, "standards.yaml"), candidateManifest);
  writeFileSync(attributesPath, candidateAttributes);
  git(
    source,
    "-c",
    "commit.gpgsign=false",
    "commit",
    "--quiet",
    "-am",
    "Workbench-only selection",
  );
  git(source, "-c", "tag.gpgsign=false", "tag", version);
  // Fetch the actual previous release even in a shallow CI checkout, then
  // serve its objects alongside the candidate through the local fixture.
  git(
    source,
    "fetch",
    "--quiet",
    "https://github.com/lutzseverino/repo-canon",
    `refs/tags/${previousVersion}:refs/tags/${previousVersion}`,
  );
  git(
    source,
    "fetch",
    "--quiet",
    "https://github.com/lutzseverino/repo-canon",
    `refs/tags/${sourceVersion}:refs/tags/${sourceVersion}`,
  );
  publish([version, orchestrateVersion, sourceVersion, previousVersion]);
  for (const [
    label,
    profile,
    extraFiles,
  ] of /** @type {[string, string, object][]} */ ([
    ["standard", "standard", {}],
    ["factory", "factory", {}],
    ["source-update", "factory", {}],
    ["edited-update", "standard", {}],
    ["standard-orchestrate-update", "standard", {}],
    ["factory-orchestrate-update", "factory", {}],
    ["node", "standard", nodeProject],
    ...["astro", "vite"].flatMap((stack) =>
      ["standard", "factory"].flatMap((profile) => [
        [`${stack}-${profile}`, profile, webProject(stack)],
        [`${stack}-${profile}-update`, profile, webProject(stack)],
      ]),
    ),
    ["standard-update", "standard", {}],
    [
      "factory-policy",
      "factory",
      {
        ".github/factory-model-policy.json":
          '{ "version": 1, "fallback": "wait", "runKinds": {} }\n',
      },
    ],
    [
      "factory-update",
      "factory",
      {
        ".github/factory-model-policy.json":
          '{ "version": 1, "fallback": "host-default", "runKinds": { "implement": { "retry": { "source": "issue-label" } } } }\n',
      },
    ],
  ])) {
    const web = label.startsWith("astro-")
      ? "astro"
      : label.startsWith("vite-")
        ? "vite"
        : null;
    const node = label === "node";
    const selectedStack = web ?? (node ? "node" : null);
    const authoring = label === "source-update";
    const edited = label === "edited-update";
    const baselineVersion = authoring
      ? sourceVersion
      : edited || label.includes("-orchestrate-")
        ? orchestrateVersion
        : previousVersion;
    const project = join(directory, label);
    mkdirSync(project);
    for (const [path, content] of Object.entries({ ...files, ...extraFiles })) {
      mkdirSync(dirname(join(project, path)), { recursive: true });
      writeFileSync(join(project, path), content);
    }
    const originalAttributes =
      "* text=auto eol=lf\n*.bat text eol=crlf\n# Project-owned attributes\n";
    writeFileSync(join(project, ".gitattributes"), originalAttributes);
    const ownScripts = [
      "scripts/own.mjs",
      "operations/own.mjs",
      ".agents/skills/own/scripts/run.sh",
    ];
    for (const path of ownScripts) {
      mkdirSync(dirname(join(project, path)), { recursive: true });
      writeFileSync(join(project, path), "# Repository-owned source\n");
    }
    git(project, "init", "--quiet");
    git(project, "add", "--all");
    git(
      project,
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "-m",
      "Fixture project",
    );
    const invoke = (...args) => {
      const child = spawnSync(cli, [...args, "--project", project, "--json"], {
        cwd: project,
        env,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      });
      assert.ifError(child.error);
      const report = JSON.parse(child.stdout || child.stderr);
      return { report, child };
    };
    const adopt = (selectedVersion) => {
      let { report } = invoke(
        "adopt",
        sourceUrl,
        "--standards-version",
        selectedVersion,
        "--profile",
        profile,
      );
      let attributesRequested = false;
      for (
        let round = 0;
        report.outcome !== "complete" && round < 10;
        round++
      ) {
        assert.ok(
          ["answers-required", "contextual"].includes(report.outcome),
          JSON.stringify(report),
        );
        for (const entry of report.contextual ?? []) {
          if (repositoryWide[entry.id]) {
            assert.ok(repositoryWide[entry.id].includes(profile), entry.id);
            assert.deepEqual(entry.allowedTargets, {
              paths: [],
              directories: [],
            });
          }
          if (entry.id === "git-attributes") {
            assert.deepEqual(entry.allowedTargets, {
              paths: [".gitattributes"],
              directories: [],
            });
          }
        }
        // The contextual inventory includes reused assessments. Only an actual
        // missing question authorizes new contextual work and a new judgment.
        if (report.missing.includes("assessment:git-attributes")) {
          attributesRequested = true;
          const guidance =
            selectedVersion !== version
              ? git(
                  source,
                  "show",
                  `${selectedVersion}:guidance/git-attributes.md`,
                )
              : readFileSync(join(root, "guidance/git-attributes.md"), "utf8");
          const block = /```gitattributes\n([\s\S]*?)\n\s*```/.exec(guidance);
          assert.ok(block, "the guidance gives a worked attributes block");
          writeFileSync(
            join(project, ".gitattributes"),
            originalAttributes + block[1].replaceAll(/^ {3}/gm, "") + "\n",
          );
        }
        const questions = report.answers.questions.map((question) => {
          const [kind, name] = question.id.split(":");
          let answer = question.answer;
          if (kind === "scope") {
            // Updates offer the previous confirmed answer alongside a fresh
            // discovery draft. Reassess stack membership with that draft;
            // an old Node inclusion must not override new web exclusions.
            if (/^typescript-(?:node|astro|vite)-stack$/.test(name))
              answer = question.details?.draft ?? answer;
            answer ??= scopes[name];
            if (
              (authoring || edited) &&
              name === "documentation" &&
              selectedVersion === version
            ) {
              const draft = question.details?.draft;
              if (
                draft?.unresolved.some((question) =>
                  question.includes(".agents/skills/orchestrate/"),
                )
              ) {
                const source = ".agents/skills/orchestrate";
                answer = {
                  ...draft,
                  unresolved: [],
                  candidates: [
                    ...draft.candidates,
                    ...readdirSync(join(project, source), {
                      recursive: true,
                      withFileTypes: true,
                    })
                      .filter(
                        (entry) => entry.isFile() && entry.name.endsWith(".md"),
                      )
                      .map((entry) => ({
                        path: relative(
                          project,
                          join(entry.parentPath, entry.name),
                        ),
                        decision: "exclude",
                        reason:
                          "Authoritative skill source, outside repository documentation.",
                        evidence: [
                          relative(project, join(entry.parentPath, entry.name)),
                        ],
                      })),
                  ],
                };
              }
            }
          }
          if (kind === "assessment" && report.missing.includes(question.id))
            answer =
              name === `typescript-${selectedStack}-stack` ||
              (web &&
                selectedVersion === previousVersion &&
                name === "typescript-node-stack")
                ? {
                    ...stackAssessment,
                    explanation: `The fixture root matches ${name}; its retained configuration and manifest provide the evidence.`,
                    evidence: [
                      "package.json, components.json and framework configuration establish membership and tools; the fixture assessment accepts the remaining contextual rules.",
                    ],
                  }
                : assessments[name];
          if (
            kind === "assessment" &&
            report.missing.includes(question.id) &&
            name === "git-attributes" &&
            selectedVersion === previousVersion
          )
            answer = {
              ...assessments[name],
              evidence: [
                "The previous release's worked block covers its counted installed files while preserving every repository-owned attribute line.",
              ],
            };
          if (
            kind === "scope" &&
            /^typescript-(?:node|astro|vite)-stack$/.test(name) &&
            selectedVersion === version
          ) {
            // The stack's discovery script drafts the entry, with no scope
            // unless the repository holds a conforming Project.
            assert.deepEqual(answer.unresolved, []);
            const covered = name === `typescript-${selectedStack}-stack`;
            assert.equal(
              answer.noScope,
              covered ? undefined : true,
              `${label} ${name}: ${JSON.stringify(question)}`,
            );
            assert.deepEqual(
              answer.candidates.map(({ path, decision }) => [path, decision]),
              selectedStack
                ? [["package.json", covered ? "include" : "exclude"]]
                : [],
            );
          }
          if (kind === "version") answer = selectedVersion;
          if (kind === "profile") answer = profile;
          if (kind === "remote-setup") answer = "defer";
          if (
            kind === "inspection" &&
            report.missing.some((id) => !/^(inspection|remote-setup)$/.test(id))
          )
            answer = null;
          assert.notEqual(answer, undefined, question.id);
          if (repositoryWide[name] && kind === "scope") {
            assert.ok(repositoryWide[name].includes(profile), name);
            assert.deepEqual(answer.candidates, []);
            assert.deepEqual(answer.unresolved, []);
          }
          return { ...question, answer };
        });
        const answers = join(directory, `${label}-answers.json`);
        writeFileSync(
          answers,
          JSON.stringify({ ...report.answers, questions }),
        );
        ({ report } = invoke("adopt", "--answers", answers));
      }
      assert.equal(report.outcome, "complete", JSON.stringify(report));
      assert.equal(invoke("status").report.readyToCommit, true);
      return attributesRequested;
    };
    if (label.endsWith("-update")) {
      assert.equal(
        adopt(baselineVersion),
        true,
        `${label} records the previous release's requested Git attributes assessment`,
      );
      if (baselineVersion === previousVersion)
        assert.equal(
          git(
            project,
            "check-attr",
            "linguist-vendored",
            "--",
            ".agents/skills/triage/ready.mjs",
          ),
          ".agents/skills/triage/ready.mjs: linguist-vendored: unspecified",
          "the conforming previous adoption has no triage executable entry",
        );
      git(project, "add", "--all");
      git(
        project,
        "-c",
        "commit.gpgsign=false",
        "commit",
        "--quiet",
        "-m",
        `Adopt ${baselineVersion}`,
      );
      const skill = ".agents/skills/orchestrate";
      assert.ok(existsSync(join(project, skill, "SKILL.md")));
      if (baselineVersion === orchestrateVersion)
        assert.ok(existsSync(join(project, skill, "wait.mjs")));
      if (authoring || edited) {
        if (authoring) {
          for (const file of ["SKILL.md", "CREDITS.md"])
            assert.notDeepEqual(
              readFileSync(join(project, skill, file)),
              readFileSync(join(root, skill, file)),
              `Canon has authored ${file} since its recorded baseline`,
            );
          assert.deepEqual(
            readFileSync(join(project, skill, "agents/openai.yaml")),
            readFileSync(join(root, skill, "agents/openai.yaml")),
          );
          for (const file of [
            "wait.mjs",
            "records.mjs",
            "references/close.md",
            "references/launches.md",
            "references/templates.md",
          ])
            assert.equal(
              existsSync(join(project, skill, file)),
              false,
              `${file} is newer authoring source`,
            );
          cpSync(join(root, skill), join(project, skill), { recursive: true });
        } else
          writeFileSync(
            join(project, skill, "SKILL.md"),
            "# Local skill edits\n",
          );
        git(project, "add", skill);
        git(
          project,
          "-c",
          "commit.gpgsign=false",
          "commit",
          "--quiet",
          "-m",
          "Author the skill",
        );
      }
      const { report: inspection } = invoke(
        "inspect",
        "--source",
        sourceUrl,
        "--standards-version",
        version,
        "--profile",
        profile,
      );
      const removal = inspection.removed.find(({ target }) => target === skill);
      if (authoring || edited) {
        assert.equal(removal, undefined);
        assert.ok(inspection.kept.some(({ target }) => target === skill));
      } else {
        assert.ok(removal, `${label} records the selected removal`);
        assert.deepEqual(
          removal.files.map(({ path }) => path).sort(),
          readdirSync(join(project, skill), {
            recursive: true,
            withFileTypes: true,
          })
            .filter((entry) => entry.isFile())
            .map((entry) =>
              relative(project, join(entry.parentPath, entry.name)),
            )
            .sort(),
          `${label} records the whole skill's selected removal`,
        );
      }
      assert.equal(inspection.confirmation.required, false);
    }
    // The local preceding release has identical contextual rules, so the CLI
    // reuses its assessment; the historical release requires a new one.
    assert.equal(
      adopt(version),
      !label.endsWith("-update") || baselineVersion !== orchestrateVersion,
      `${label} preserves the CLI's contextual assessment reuse`,
    );
    for (const path of [
      ".agents/skills/orchestrate",
      ".claude/skills/orchestrate",
    ])
      assert.equal(
        !!lstatSync(join(project, path), { throwIfNoEntry: false }),
        authoring || edited,
        `${label} removes unchanged installations and keeps local edits at ${path}`,
      );
    assert.equal(
      existsSync(
        join(
          project,
          ".repo-standards/inputs/source/.agents/skills/orchestrate",
        ),
      ),
      false,
    );
    if (edited)
      assert.equal(
        readFileSync(
          join(project, ".agents/skills/orchestrate/SKILL.md"),
          "utf8",
        ),
        "# Local skill edits\n",
      );
    if (authoring) {
      // Canon's real source differs from its recorded adoption. Normal
      // retirement keeps the whole edited tree, including unchanged files.
      for (const entry of readdirSync(
        join(root, ".agents/skills/orchestrate"),
        {
          recursive: true,
          withFileTypes: true,
        },
      ).filter((entry) => entry.isFile())) {
        const path = relative(root, join(entry.parentPath, entry.name));
        assert.deepEqual(
          readFileSync(join(project, path)),
          readFileSync(join(root, path)),
          path,
        );
      }
      assert.ok(
        !JSON.parse(
          readFileSync(
            join(project, ".repo-standards/inputs/resolved.json"),
            "utf8",
          ),
        ).declarations.some(({ id }) => id === "skill-orchestrate"),
      );
      assert.equal(invoke("status").report.readyToCommit, true);
      const lock = JSON.parse(
        readFileSync(join(project, ".repo-standards/lock.json"), "utf8"),
      );
      assert.ok(
        !Object.keys(lock.files).some((path) =>
          path.startsWith(".agents/skills/orchestrate/"),
        ),
      );
    }
    if (profile === "factory")
      assert.deepEqual(
        readFileSync(join(project, ".factory/config.json")),
        readFileSync(join(root, ".factory/config.json")),
        `${label} installs the shipped version-3 factory configuration byte for byte`,
      );
    const modelPolicy = ".github/factory-model-policy.json";
    if (Object.hasOwn(extraFiles, modelPolicy))
      assert.equal(
        readFileSync(join(project, modelPolicy), "utf8"),
        extraFiles[modelPolicy],
        `${label} preserves repository policy bytes`,
      );
    else
      assert.equal(
        existsSync(join(project, modelPolicy)),
        false,
        `${label} never seeds model policy`,
      );
    if (profile === "factory") {
      const policyCheck = () =>
        invoke("check").report.checks.find(
          ({ id }) => id === "factory-model-policy",
        );
      assert.equal(policyCheck().status, "passed");
      if (label === "factory-policy") {
        const invalid = '{ "version": 99, "fallback": "invalid" }\n';
        writeFileSync(join(project, modelPolicy), invalid);
        assert.equal(policyCheck().status, "failed");
        assert.equal(readFileSync(join(project, modelPolicy), "utf8"), invalid);
        writeFileSync(join(project, modelPolicy), extraFiles[modelPolicy]);
      }
    }
    // Exercise no scope and covered checks/rules for all stacks in both profiles,
    // including updates from a source that did not ship web declarations.
    const checks = invoke("check").report.checks;
    const rules = invoke("rules", "package.json").report.rules;
    for (const stack of ["node", "astro", "vite"]) {
      const declaration = `typescript-${stack}-stack`;
      const covered = stack === selectedStack;
      assert.deepEqual(
        checks
          .filter((check) => check.declaration === declaration)
          .map(({ id, status }) => [id, status]),
        covered ? [[`${declaration}-manifests`, "passed"]] : [],
        label,
      );
      const selectedRules = rules.filter(
        (rule) => rule.declaration === declaration,
      );
      assert.equal(
        selectedRules.length,
        covered ? 1 : 0,
        `${label} ${declaration} rules`,
      );
      if (covered)
        assert.equal(
          selectedRules[0].content,
          readFileSync(
            join(
              root,
              stack === "node"
                ? "rules/typescript-node-stack.md"
                : "rules/typescript-web-stacks.md",
            ),
            "utf8",
          ),
        );
      assert.equal(
        existsSync(join(project, `.repo-standards/rules/${declaration}.md`)),
        covered,
        label,
      );
    }
    assert.ok(
      readFileSync(join(project, ".gitattributes"), "utf8").startsWith(
        originalAttributes,
      ),
      `${profile} preserves every repository-owned attribute line`,
    );
    const countedFiles = [
      "scripts/validate-issue-contract.mjs",
      "scripts/issue-contract-sources.mjs",
      "scripts/issue-contract-store.mjs",
      "scripts/issue-contract-cutoff.mjs",
      "scripts/validate.mjs",
      "operations/lib/rendered-markdown.mjs",
      ".agents/skills/triage/ready.mjs",
      ...readdirSync(join(project, ".agents/skills/babysit"))
        .filter((name) => name.endsWith(".mjs"))
        .map((name) => `.agents/skills/babysit/${name}`),
      ".agents/skills/diagnosing-bugs/scripts/hitl-loop.template.sh",
    ];
    for (const [paths, expected] of /** @type {[string[], string][]} */ ([
      [countedFiles, "set"],
      [ownScripts, "unspecified"],
    ])) {
      for (const path of paths) assert.ok(readFileSync(join(project, path)));
      assert.deepEqual(
        git(project, "check-attr", "linguist-vendored", "--", ...paths).split(
          "\n",
        ),
        paths.map((path) => `${path}: linguist-vendored: ${expected}`),
        `${profile} attributes for installed and repository-owned source`,
      );
    }
    const attributesLookup = invoke("rules", ".gitattributes");
    assert.equal(attributesLookup.child.status, 0);
    assert.equal(
      attributesLookup.report.rules.find(
        (rule) => rule.declaration === "git-attributes",
      ).content,
      readFileSync(join(root, "rules/git-attributes.md"), "utf8"),
    );
    // Adoption installs the source's triage fork and the contribution guide
    // whose rules it carries out, and the opt-in update caller, byte for byte.
    for (const path of [
      "CONTRIBUTING.md",
      ".github/workflows/standards-update.yml",
      ".agents/skills/triage/AGENT-BRIEF.md",
      ".agents/skills/triage/CREDITS.md",
      ".agents/skills/triage/OUT-OF-SCOPE.md",
      ".agents/skills/triage/SKILL.md",
      ".agents/skills/triage/agents/openai.yaml",
      ...readdirSync(join(root, ".agents/skills/babysit")).map(
        (name) => `.agents/skills/babysit/${name}`,
      ),
    ])
      assert.deepEqual(
        readFileSync(join(project, path)),
        readFileSync(join(root, path)),
        `${profile} installs ${path}`,
      );
    // Every selected owned skill installs whole from the owned tree. Apart from the
    // CREDITS.md each gains, a skill identical to its upstream base installs
    // the base's bytes, as it did when it installed from the snapshot, and
    // the setup files install their seeds' bytes.
    for (const { name, source, base } of ownedSkills(root)) {
      const selected = validation.profiles[profile].declarations.some(
        (declaration) =>
          declaration.kind === "skill" && declaration.name === name,
      );
      if (!selected) {
        assert.equal(
          existsSync(join(project, source)),
          (authoring || edited) && name === "orchestrate",
          `${profile} excludes ${name}`,
        );
        continue;
      }
      const files = readdirSync(join(root, source), {
        recursive: true,
        withFileTypes: true,
      })
        .filter((entry) => entry.isFile())
        .map((entry) =>
          relative(join(root, source), join(entry.parentPath, entry.name)),
        );
      assert.deepEqual(
        readdirSync(join(project, ".agents/skills", name), {
          recursive: true,
          withFileTypes: true,
        })
          .filter((entry) => entry.isFile())
          .map((entry) =>
            relative(
              join(project, ".agents/skills", name),
              join(entry.parentPath, entry.name),
            ),
          )
          .sort(),
        files.sort(),
        `${profile} installs ${name} whole`,
      );
      const unchanged =
        base &&
        /identical to its upstream base/.test(
          readFileSync(join(root, source, "CREDITS.md"), "utf8"),
        );
      for (const path of files) {
        const installed = readFileSync(
          join(project, ".agents/skills", name, path),
        );
        assert.deepEqual(
          installed,
          readFileSync(join(root, source, path)),
          `${profile} installs ${name}/${path} from the owned tree`,
        );
        if (unchanged && path !== "CREDITS.md")
          assert.deepEqual(
            installed,
            readFileSync(join(root, snapshotPath, base.path, path)),
            `${profile} installs ${name}/${path} unchanged from its base`,
          );
      }
    }
    if (authoring) {
      git(project, "add", "--all");
      git(
        project,
        "-c",
        "commit.gpgsign=false",
        "commit",
        "--quiet",
        "-m",
        "Update while retaining authoring source",
      );
      adopt(version);
      assert.ok(
        existsSync(join(project, ".agents/skills/orchestrate/SKILL.md")),
      );
      assert.equal(
        git(project, "diff", "--", ".agents/skills/orchestrate"),
        "",
        "a later self-update leaves the now-unowned authoring source unchanged",
      );
    }
    for (const { path, base, edits } of ownedSetupFiles(root))
      if (edits === null)
        assert.deepEqual(
          readFileSync(join(project, path)),
          readFileSync(join(root, snapshotPath, base.path)),
          `${profile} installs ${path} unchanged from its seed`,
        );
    assert.equal(
      existsSync(join(project, ".github/factory-review-policy.json")),
      false,
      `${profile} never enrolls an adopter in app-author review skipping`,
    );
    for (const path of [null, "wordtally.mjs", ".factory/config.json"]) {
      const { report: lookup, child } = invoke(
        "rules",
        ...(path ? [path] : []),
      );
      assert.equal(child.status, 0, JSON.stringify(lookup));
      for (const [declaration, profiles] of Object.entries(repositoryWide)) {
        const rules = lookup.rules.filter(
          (rule) => rule.declaration === declaration,
        );
        const expected = profiles.includes(profile) ? 1 : 0;
        assert.equal(rules.length, expected, `${profile} ${declaration}`);
        if (!expected) continue;
        assert.equal(rules[0].coverage, "repository");
        assert.equal(
          rules[0].content,
          readFileSync(join(root, `rules/${declaration}.md`), "utf8"),
        );
        assert.equal(
          readFileSync(join(project, rules[0].path), "utf8"),
          rules[0].content,
        );
      }
      assert.ok(
        !lookup.rules.some(
          (rule) => rule.declaration === "factory-configuration",
        ),
      );
    }
  }
  const configuration = validation.profiles.factory.declarations.find(
    (declaration) => declaration.id === "factory-configuration",
  );
  assert.equal(configuration.kind, "file");
  assert.equal(configuration.target, ".factory/config.json");
  assert.equal(configuration.exact, ".factory/config.json");
  assert.equal(configuration.rules, undefined);
});
