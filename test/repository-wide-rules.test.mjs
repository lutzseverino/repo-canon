import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
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
import {
  assessments,
  files,
  scopes,
} from "../scripts/release/adoption-fixture.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceUrl = "https://github.com/fixture/repo-canon";
const version = "v1.0.0";
const previousVersion = "v0.18.0";
// Declarations whose rules govern all work, with empty confirmed scope, and
// the profiles that select them.
const repositoryWide = {
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
  execFileSync("git", ["init", "--quiet", project]);
  const paths = [
    ".agents/skills/triage/ready.mjs",
    "wordtally.mjs",
    "scripts/own.mjs",
    "operations/own.mjs",
    ".agents/skills/own/run.mjs",
    ".repo-standards/inputs/source/operations/check.mjs",
  ];
  assert.deepEqual(
    execFileSync(
      "git",
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

test("public CLI 10.0.0 adopts and updates both profiles with vendored installed code, repository-wide rules and stack rules only for a confirmed Project", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "repo-canon-workflow-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const prefix = process.env.REPO_STANDARDS_PREFIX ?? join(directory, "cli");
  if (!process.env.REPO_STANDARDS_PREFIX)
    execFileSync(
      "npm",
      [
        "install",
        "--prefix",
        prefix,
        "--ignore-scripts",
        "--registry=https://registry.npmjs.org",
        "@lutzseverino/repo-standards@10.0.0",
      ],
      { stdio: "pipe" },
    );
  const cli = join(prefix, "node_modules/.bin/repo-standards");
  assert.equal(
    execFileSync(cli, ["--version"], { encoding: "utf8" }).trim(),
    "10.0.0",
  );
  const validation = JSON.parse(
    execFileSync(cli, ["source", "validate", root, "--json"], {
      encoding: "utf8",
    }),
  );
  assert.equal(validation.valid, true);
  for (const [name, profile] of Object.entries(validation.profiles)) {
    assert.equal(
      profile.declarations.length,
      { standard: 58, factory: 62 }[name],
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
  assert.equal(prerequisites.size, 12);
  for (const [script, range] of prerequisites)
    assert.equal(range, ">=24.0.0 <25.0.0 || >=26.0.0 <27.0.0", script);

  const source = join(directory, "source");
  mkdirSync(source);
  // Copy only source inputs, excluding the old in-tree product even while it
  // exists. This fixture remains valid after that product's removal.
  const paths = new Set(["standards.yaml", "LICENSE"]);
  for (const profile of Object.values(validation.profiles))
    for (const declaration of profile.declarations) {
      for (const field of ["exact", "guidance", "rules", "discovery", "source"])
        if (declaration[field]) paths.add(declaration[field]);
      const fixes = declaration.fixes ?? [];
      for (const operation of [
        ...(declaration.checks ?? []),
        ...fixes,
        ...fixes.map((fix) => fix["remote-setup"]?.probe),
        declaration["discovery-script"],
      ].filter(Boolean)) {
        paths.add(operation.run.script);
        for (const resource of operation.run.resources ?? [])
          paths.add(resource);
      }
    }
  for (const path of paths) {
    assert.ok(!path.startsWith("factory/"));
    mkdirSync(dirname(join(source, path)), { recursive: true });
    cpSync(join(root, path), join(source, path), { recursive: true });
  }
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.invalid",
    GIT_COMMITTER_NAME: "Fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.invalid",
    XDG_CACHE_HOME: join(directory, "cache"),
  };
  const git = (cwd, ...args) =>
    execFileSync("git", ["-C", cwd, ...args], { env, encoding: "utf8" }).trim();
  git(source, "init", "--quiet");
  git(source, "add", "--all");
  git(
    source,
    "-c",
    "commit.gpgsign=false",
    "commit",
    "--quiet",
    "-m",
    "Fixture source",
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
  const api = "https://api.github.com/repos/fixture/repo-canon";
  const responses = join(directory, "github.json");
  const github = {
    [api]: { private: false, full_name: "fixture/repo-canon" },
    [`${api}/releases?per_page=100&page=1`]: [version, previousVersion].map(
      (tag_name) => ({ tag_name, draft: false, prerelease: false }),
    ),
  };
  for (const tag of [version, previousVersion]) {
    const sha = git(source, "rev-parse", `${tag}^{commit}`);
    const tree = git(source, "rev-parse", `${tag}^{tree}`);
    const entries = git(source, "ls-tree", "-r", "-t", tag)
      .split("\n")
      .map((line) => {
        const [, mode, type, sha, path] =
          /^(\d+) (\w+) ([a-f0-9]+)\t(.+)$/.exec(line);
        return { mode, type, sha, path };
      });
    Object.assign(github, {
      [`${api}/git/ref/tags/${tag}`]: {
        ref: `refs/tags/${tag}`,
        object: { type: "commit", sha },
      },
      [`${api}/git/commits/${sha}`]: { sha, tree: { sha: tree } },
      [`${api}/git/trees/${tree}?recursive=1`]: {
        sha: tree,
        truncated: false,
        tree: entries,
      },
    });
  }
  writeFileSync(responses, JSON.stringify(github));
  Object.assign(env, {
    NODE_OPTIONS: `--import=${join(root, "test/fixtures/github-source.mjs")}`,
    FIXTURE_GITHUB_RESPONSES: responses,
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: `url.file://${source}.insteadOf`,
    GIT_CONFIG_VALUE_0: sourceUrl,
  });
  for (const [
    label,
    profile,
    extraFiles,
  ] of /** @type {[string, string, object][]} */ ([
    ["standard", "standard", {}],
    ["factory", "factory", {}],
    ["node", "standard", nodeProject],
    ["standard-update", "standard", {}],
    ["factory-update", "factory", {}],
  ])) {
    const node = label === "node";
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
            attributesRequested = true;
            assert.deepEqual(entry.allowedTargets, {
              paths: [".gitattributes"],
              directories: [],
            });
            // Perform the contextual edit from the guidance's worked example,
            // rather than introducing an automatic fix into the source.
            const guidance =
              selectedVersion === previousVersion
                ? git(
                    source,
                    "show",
                    `${previousVersion}:guidance/git-attributes.md`,
                  )
                : readFileSync(
                    join(root, "guidance/git-attributes.md"),
                    "utf8",
                  );
            const block = /```gitattributes\n([\s\S]*?)\n\s*```/.exec(guidance);
            assert.ok(block, "the guidance gives a worked attributes block");
            writeFileSync(
              join(project, ".gitattributes"),
              originalAttributes + block[1].replaceAll(/^ {3}/gm, "") + "\n",
            );
          }
        }
        const questions = report.answers.questions.map((question) => {
          const [kind, name] = question.id.split(":");
          let answer = question.answer;
          if (kind === "scope") answer ??= scopes[name];
          if (kind === "assessment")
            answer =
              node && name === "typescript-node-stack"
                ? stackAssessment
                : assessments[name];
          if (
            kind === "assessment" &&
            name === "git-attributes" &&
            selectedVersion === previousVersion
          )
            answer = {
              ...assessments[name],
              evidence: [
                "The previous release's worked block covers its counted installed files while preserving every repository-owned attribute line.",
              ],
            };
          if (kind === "scope" && name === "typescript-node-stack") {
            // The stack's discovery script drafts the entry, with no scope
            // unless the repository holds a conforming Project.
            assert.deepEqual(answer.unresolved, []);
            assert.equal(answer.noScope, node ? undefined : true);
            assert.deepEqual(
              answer.candidates.map(({ path, decision }) => [path, decision]),
              node ? [["package.json", "include"]] : [],
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
      adopt(previousVersion);
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
        `Adopt ${previousVersion}`,
      );
    }
    assert.equal(
      adopt(version),
      true,
      `${label} requests git-attributes contextual work`,
    );
    // No scope installs no stack rules and runs no stack check; a confirmed
    // Project gets both, and its manifest passes.
    const stackChecks = invoke("check").report.checks.filter(
      (check) => check.declaration === "typescript-node-stack",
    );
    assert.deepEqual(
      stackChecks.map(({ id, status }) => [id, status]),
      node ? [["typescript-node-stack-manifests", "passed"]] : [],
      `${label} typescript-node stack checks`,
    );
    const stackRules = invoke("rules", "package.json").report.rules.filter(
      (rule) => rule.declaration === "typescript-node-stack",
    );
    assert.equal(stackRules.length, node ? 1 : 0, `${label} stack rules`);
    if (node)
      assert.equal(
        stackRules[0].content,
        readFileSync(join(root, "rules/typescript-node-stack.md"), "utf8"),
      );
    assert.equal(
      existsSync(
        join(project, ".repo-standards/rules/typescript-node-stack.md"),
      ),
      node,
    );
    assert.ok(
      readFileSync(join(project, ".gitattributes"), "utf8").startsWith(
        originalAttributes,
      ),
      `${profile} preserves every repository-owned attribute line`,
    );
    const countedFiles = [
      "scripts/validate-issue-contract.mjs",
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
    // The policy's two-axis method and implement's review invocation retain
    // their complete pinned directories in every profile.
    for (const name of ["code-review", "implement"]) {
      const source = join(
        root,
        "vendor/mattpocock-skills/skills/engineering",
        name,
      );
      for (const entry of readdirSync(source, {
        recursive: true,
        withFileTypes: true,
      }).filter((entry) => entry.isFile())) {
        const path = relative(source, join(entry.parentPath, entry.name));
        assert.deepEqual(
          readFileSync(join(project, ".agents/skills", name, path)),
          readFileSync(join(source, path)),
          `${profile} installs ${name}/${path} unchanged`,
        );
      }
    }
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
