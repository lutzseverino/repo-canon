import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { decideIssueContract } from "../scripts/validate-issue-contract.mjs";
import {
  completeAgentBrief,
  featureBody,
  repository,
} from "./helpers/issue-contracts.mjs";
import { fileDeclarations } from "./helpers/documentation.mjs";
import { invokeCheck } from "./helpers/operation.mjs";

// Run the shipped documentation checks against the repository's documentation.
// Source-side guidance, discovery instructions, and vendored material stay out
// of the repository's documentation scope.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootDocuments = ["GLOSSARY.md", "authoring-notes.md"];

// The CLI's discovery observation refuses any file larger than this, which would
// reject the whole inspection before it reports anything.
const observationFileLimit = 8 * 1024 * 1024;

function trackedFiles() {
  return execFileSync("git", ["-C", root, "ls-files", "-z"], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
  })
    .split("\0")
    .filter(Boolean);
}

// Read every source reference in the authored manifest, across both profiles.
// Directory references select their descendants; adopter target paths do not.
function sourceInputFiles() {
  const manifest = readFileSync(join(root, "standards.yaml"), "utf8");
  const paths = new Set(["standards.yaml"]);
  for (const [, path] of manifest.matchAll(
    /^\s+(?:exact|guidance|rules|discovery|source|script): (\S+)$/gm,
  ))
    paths.add(path);
  for (const [, resources] of manifest.matchAll(
    /^\s+resources:\n((?: +-[^\n]+\n)+)/gm,
  ))
    for (const [, path] of resources.matchAll(/^ +- (\S+)$/gm)) paths.add(path);

  return [...paths].flatMap((path) =>
    lstatSync(join(root, path)).isDirectory()
      ? snapshotFiles(join(root, path)).map((file) => `${path}/${file}`)
      : [path],
  );
}

function pinnedDocumentReference(reference, { tags, branches }) {
  if (/^[a-f0-9]{40}\//i.test(reference)) return true;
  const longestTag = Math.max(
    0,
    ...tags
      .filter((tag) => reference.startsWith(`${tag}/`))
      .map((tag) => tag.length),
  );
  return (
    longestTag > 0 &&
    !branches.some(
      (branch) =>
        reference.startsWith(`${branch}/`) && branch.length >= longestTag,
    )
  );
}

test("GitHub document pins accept tags and full commits, and reject branches", () => {
  const refs = {
    tags: ["scriptorium-v1.0.1", "release/candidate", "ambiguous"],
    branches: ["main", "release", "scriptorium-v1.0.1/next", "ambiguous"],
  };
  for (const reference of [
    "scriptorium-v1.0.1/factory/docs/usage/sandbox-image.md",
    "release/candidate/docs/README.md",
    "f0b6f1083b439a60059d3627a1bd9b03ddaadf88/docs/README.md",
  ])
    assert.ok(pinnedDocumentReference(reference, refs), reference);
  for (const reference of [
    "main/docs/README.md",
    "feature/contract/docs/README.md",
    "scriptorium-v2.0.0/docs/README.md",
    "scriptorium-v1.0.1-extra/docs/README.md",
    "f0b6f10/docs/README.md",
    "scriptorium-v1.0.1/next/docs/README.md",
    "ambiguous/docs/README.md",
  ])
    assert.ok(!pinnedDocumentReference(reference, refs), reference);
});

test("every lutzseverino GitHub document link in source inputs is pinned", () => {
  const refsByRepository = new Map();
  for (const path of sourceInputFiles()) {
    const text = readFileSync(join(root, path), "utf8");
    for (const [url, repository, encodedReference] of text.matchAll(
      /https?:\/\/github\.com\/lutzseverino\/([\w.-]+)\/(?:blob|tree)\/([^\s<>"'`()[\]{}]+)/gi,
    )) {
      const reference = decodeURIComponent(encodedReference);
      if (/^[a-f0-9]{40}\//i.test(reference)) continue;
      if (!refsByRepository.has(repository)) {
        // Ref names alone cannot distinguish a tag from an arbitrary branch.
        // Read published refs without using another GitHub identity.
        const refs = execFileSync(
          "git",
          [
            "ls-remote",
            "--refs",
            `https://github.com/lutzseverino/${repository}.git`,
            "refs/tags/*",
            "refs/heads/*",
          ],
          { encoding: "utf8", timeout: 30_000 },
        );
        refsByRepository.set(repository, {
          tags: [...refs.matchAll(/\trefs\/tags\/(.+)$/gm)].map(
            ([, tag]) => tag,
          ),
          branches: [...refs.matchAll(/\trefs\/heads\/(.+)$/gm)].map(
            ([, branch]) => branch,
          ),
        });
      }
      assert.ok(
        pinnedDocumentReference(reference, refsByRepository.get(repository)),
        `${path}: pin ${url} to a published tag or full commit SHA`,
      );
    }
  }
});

test("no source input names the retained source layout", () => {
  // Repository Standards runs and retains source inputs; they cite its
  // commands, never where it keeps them.
  for (const path of sourceInputFiles())
    assert.ok(
      !readFileSync(join(root, path), "utf8").includes(
        ".repo-standards/inputs/source",
      ),
      `${path} names .repo-standards/inputs/source`,
    );
});

function flowedText(path) {
  return readFileSync(join(root, path), "utf8").replaceAll(/\s+/g, " ");
}

function operation(name) {
  return fileURLToPath(new URL(`../operations/${name}`, import.meta.url));
}

function documentationScope() {
  const documentation = trackedFiles()
    .filter(
      (path) =>
        path.startsWith("docs/") &&
        path.toLocaleLowerCase("en-US").endsWith(".md"),
    )
    .filter(
      (path) => !fileDeclarations().some(({ target }) => path === target),
    );
  return [...documentation, ...rootDocuments].sort();
}

test("the repository passes the documentation navigation check at its root", () => {
  const outcome = invokeCheck(operation("check-documentation.mjs"), root, {
    operation: {
      declaration: "documentation",
      phase: "checks",
      id: "documentation-navigation",
    },
    declarations: fileDeclarations(),
    allowedTargets: { paths: documentationScope(), directories: [] },
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "passed", outcome.result.message);
});

test("the repository passes the Repository README check at its root", () => {
  const outcome = invokeCheck(operation("check-repository-readme.mjs"), root, {
    operation: {
      declaration: "repository-readme",
      phase: "checks",
      id: "repository-readme-structure",
    },
    allowedTargets: { paths: ["README.md"], directories: [] },
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "passed", outcome.result.message);
});

// The declarations of one profile in `standards.yaml`, as its block of text.
function profileDeclarations(declarations, name) {
  return new RegExp(
    `^ {2}${name}:\\n {4}description: .+\\n {4}declarations:((?: \\{\\}|\\n(?: {6}.*\\n|\\n)*))`,
    "m",
  ).exec(declarations)?.[1];
}

// The factory's repository files, which only the factory profile installs.
const factoryFiles = [
  ".factory/config.json",
  ".factory/Dockerfile",
  ".github/workflows/sandbox-image.yml",
];

test("the standard profile installs no factory file, and the factory profile adds exactly the factory's", () => {
  const declarations = readFileSync(join(root, "standards.yaml"), "utf8");
  assert.deepEqual(
    [...declarations.matchAll(/^ {2}([a-z0-9-]+):\n {4}description:/gm)].map(
      ([, name]) => name,
    ),
    ["standard", "factory"],
  );
  const defaults = /^defaults:\n([\s\S]*?)^profiles:\n/m.exec(declarations)[1];
  assert.equal(profileDeclarations(declarations, "standard"), " {}");
  for (const path of factoryFiles)
    assert.ok(
      !defaults.includes(path),
      `the standard profile must not install ${path}`,
    );

  assert.equal(
    profileDeclarations(declarations, "factory"),
    `
      factory-configuration:
        kind: file
        target: .factory/config.json
        exact: .factory/config.json

      factory-sandbox-image:
        kind: file
        target: .factory/Dockerfile
        rules: rules/factory-sandbox-image.md
        guidance: guidance/factory-sandbox-image.md

      factory-sandbox-image-workflow:
        kind: file
        target: .github/workflows/sandbox-image.yml
        exact: .github/workflows/sandbox-image.yml
`,
    "the factory profile adds the configuration exactly, the Dockerfile as contextual with its rules and adoption guidance, and the workflow exactly",
  );
});

test("the standards retire the in-repository factory, its sandbox base, and the issue-contract kind runtime", () => {
  const declarations = readFileSync(join(root, "standards.yaml"), "utf8");
  for (const retired of [
    ".sandcastle",
    "sandbox-image-base",
    "check-sandbox-image",
    "issue-contract-kind",
  ])
    assert.ok(
      !declarations.includes(retired),
      `standards.yaml names ${retired}`,
    );
  for (const path of [
    ".sandcastle",
    "operations/check-sandbox-image.mjs",
    "operations/sandbox-image-base.Dockerfile",
    "operations/lib/issue-contract-kind.mjs",
  ])
    assert.ok(!existsSync(join(root, path)), `${path} is retired`);
});

// Each declaration with rules or adoption guidance, across both profiles, and
// its decided outcome, as ADR 0016 decides. A guidance split moves a
// declaration's entry to `rules` or `both`.
const requirementOutcomes = {
  documentation: "both",
  "factory-sandbox-image": "both",
  "github-repository-configuration": "both",
  "project-agent-guidance": "both",
  "project-readmes": "both",
  "repository-license": "both",
  "repository-readme": "both",
};

// Every declaration in `standards.yaml`, with the source files its `guidance`
// and `rules` fields name.
function manifestDeclarations() {
  const manifest = readFileSync(join(root, "standards.yaml"), "utf8");
  return [
    ...manifest.matchAll(
      /^( +)([a-z0-9-]+):\n(\1 {2}kind: .*\n(?:\1 {2}.*\n)*)/gm,
    ),
  ].map(([, indent, id, body]) => {
    const field = (name) =>
      new RegExp(`^${indent} {2}${name}: (\\S+)$`, "m").exec(body)?.[1];
    return { id, guidance: field("guidance"), rules: field("rules") };
  });
}

test("each declaration with rules or adoption guidance has its decided outcome", () => {
  const outcomes = Object.fromEntries(
    manifestDeclarations()
      .filter(({ guidance, rules }) => guidance || rules)
      .map(({ id, guidance, rules }) => [
        id,
        guidance && rules ? "both" : rules ? "rules" : "guidance",
      ]),
  );
  assert.deepEqual(outcomes, requirementOutcomes);
});

test("the contribution guide leaves documentation rules to the documentation declaration", () => {
  assert.doesNotMatch(
    readFileSync(join(root, "CONTRIBUTING.md"), "utf8"),
    /^## Documentation$/m,
  );
});

test("the source keeps every declaration's rules in one place, named by the declaration", () => {
  const rules = manifestDeclarations().filter(({ rules }) => rules);
  for (const { id, rules: path } of rules)
    assert.equal(path, `rules/${id}.md`, `${id} keeps its rules in rules/`);
  assert.deepEqual(
    readdirSync(join(root, "rules")).sort(),
    rules.map(({ id }) => `${id}.md`).sort(),
    "rules/ holds only declared rules",
  );
  assert.ok(
    !documentationScope().some((path) => path.startsWith("rules/")),
    "rules stay outside this repository's documentation scope",
  );
});

// Phrases that mark a one-time adoption step, which belongs in adoption
// guidance and never in rules: an assessment instruction, a question for the
// maintainer, a migration, or a step of the adoption run.
const oneTimeStepMarkers = [
  /\bassess\b[^.]*?\bas\b/i,
  /\bask(?:s|ing)? (?:the )?maintainers?\b/i,
  /\buntil the maintainer answers\b/i,
  /\bduring (?:an|the) (?:update|adoption)\b/i,
  /\bmigrat(?:e|es|ion|ions)\b/i,
  /\bbefore adoption continues\b/i,
  /\bstops the run\b/i,
];

function oneTimeSteps(text) {
  const flowed = text.replaceAll(/\s+/g, " ");
  return oneTimeStepMarkers
    .map((marker) => marker.exec(flowed)?.[0])
    .filter(Boolean);
}

test("the one-time step markers find each kind of step", () => {
  for (const [text, step] of [
    [
      "Assess `repository-license` as\n`blocked`.",
      "Assess `repository-license` as",
    ],
    ["Otherwise, ask the maintainer to name it.", "ask the maintainer"],
    ["During an update, move the file.", "During an update"],
    ["Until the maintainer answers, wait.", "Until the maintainer answers"],
  ])
    assert.deepEqual(oneTimeSteps(text), [step], text);
  assert.deepEqual(
    oneTimeSteps("Assess purpose against evidence. Keep it as it is."),
    [],
  );
});

test("no rules file holds a one-time adoption step", () => {
  for (const { id, rules } of manifestDeclarations().filter(
    ({ rules }) => rules,
  ))
    assert.deepEqual(
      oneTimeSteps(readFileSync(join(root, rules), "utf8")),
      [],
      `${id}'s rules hold one-time steps; move them to its adoption guidance`,
    );
});

test("a rules file holding a one-time step fails the marker test", () => {
  const rules = `${readFileSync(join(root, "rules/repository-license.md"), "utf8")}
Assess \`repository-license\` as \`satisfied\` once \`LICENSE\` meets these rules.
`;
  assert.notDeepEqual(oneTimeSteps(rules), []);
});

test("the GitHub rules state the reviewer file's schema, and babysit only cites them", () => {
  const rules = flowedText("rules/github-repository-configuration.md");
  for (const field of [
    "version",
    "account",
    "request.comment",
    "request.onOpen",
    "finished",
    "commentMarker",
    "unavailable",
    "bounds.responseMinutes",
    "bounds.reviewMinutes",
    "bounds.reviewRequests",
  ])
    assert.ok(rules.includes(`\`${field}\``), `the rules state ${field}`);
  assert.match(
    rules,
    /Every field is required except `finished` and `bounds\.reviewRequests`/,
  );
  assert.match(rules, /A review of the pull request's head is complete when/);
  assert.match(rules, /marks the reviewer unavailable/);
  const babysit = flowedText(".agents/skills/babysit/SKILL.md");
  assert.doesNotMatch(babysit, /^## /m);
  assert.doesNotMatch(babysit, /commentMarker|responseMinutes|"version"/);
  assert.match(
    babysit,
    /whose schema the `github-repository-configuration` rules state/,
  );
  const guide = flowedText("CONTRIBUTING.md");
  assert.match(
    guide,
    /the `github-repository-configuration` rules state its schema/,
  );
  assert.doesNotMatch(guide, /`babysit`\]\([^)]*\) documents its schema/);
});

test("neither the GitHub rules nor babysit names a particular reviewer", () => {
  const { account } = JSON.parse(
    readFileSync(join(root, ".github/pull-request-reviewer.json"), "utf8"),
  );
  for (const path of [
    "rules/github-repository-configuration.md",
    ".agents/skills/babysit/SKILL.md",
  ]) {
    const text = readFileSync(join(root, path), "utf8");
    assert.ok(!text.includes(account), `${path} names ${account}`);
    assert.doesNotMatch(text, /codex|copilot|coderabbit/i, path);
  }
});

test("the reviewer check and babysit validate the reviewer file with one parser", () => {
  const parser = "operations/lib/pull-request-reviewer.mjs";
  assert.equal(
    readFileSync(
      join(root, ".agents/skills/babysit/pull-request-reviewer.mjs"),
      "utf8",
    ),
    readFileSync(join(root, parser), "utf8"),
    `babysit's pull-request-reviewer.mjs is a byte-identical copy of ${parser}`,
  );
  assert.doesNotMatch(
    readFileSync(
      join(root, "operations/check-pull-request-reviewer.mjs"),
      "utf8",
    ),
    /\.agents\/skills/,
  );
  const manifest = readFileSync(join(root, "standards.yaml"), "utf8");
  assert.match(
    manifest,
    /script: operations\/check-pull-request-reviewer\.mjs\n {12}resources:\n {14}- operations\/lib\/pull-request-reviewer\.mjs\n {12}arguments/,
  );
});

test("the GitHub rules hold the runner variable, and its guidance the assessment", () => {
  const rules = flowedText("rules/github-repository-configuration.md");
  for (const requirement of [
    /Every installed job reads `vars\.REPO_CANON_RUNS_ON`\. Unset or empty selects `ubuntu-latest`/,
    /a JSON array of runner label strings/,
    /Set the variable only when the repository has matching runners/,
    /The runners need `git`, `bash`, and network access/,
    /deleting the variable or setting it to `\["ubuntu-latest"\]`/,
    /a repository-level value takes precedence/,
  ])
    assert.match(rules, requirement);
  const guidance = flowedText("guidance/github-repository-configuration.md");
  assert.match(
    guidance,
    /Assess the repository's visibility and the repository-level `REPO_CANON_RUNS_ON` variable as unset, valid with its labels, or invalid/,
  );
  assert.match(guidance, /never sets, changes, or deletes the variable/);
  assert.doesNotMatch(guidance, /The runners need/);
});

test("AGENTS.md names no rules path", () => {
  assert.doesNotMatch(
    readFileSync(join(root, "AGENTS.md"), "utf8"),
    /\.repo-standards\/rules|(?:^|[\s(`"'/])rules\/[\w.-]+|repo-standards rules\b/m,
  );
});

test("standards.yaml declares no pull request reviewer file", () => {
  assert.doesNotMatch(
    readFileSync(join(root, "standards.yaml"), "utf8"),
    /pull-request-reviewer\.json/,
  );
});

// The shipped configuration targets factory configuration version 1, whose
// schema Scriptorium documents: exactly these fields, five distinct state
// labels, and a prompt naming the issue. Scriptorium's own tests parse the copy
// it adopts, so this repository imports no factory code.
test("the factory configuration names Repo Canon's labels, model label prefix, and implement prompt", () => {
  const configuration = JSON.parse(
    readFileSync(join(root, ".factory/config.json"), "utf8"),
  );
  const labels = Object.values(configuration.labels);
  assert.equal(new Set(labels).size, labels.length);
  assert.ok(labels.every((label) => typeof label === "string" && label));
  assert.match(configuration.prompt, /\{issue\}/);
  assert.deepEqual(configuration, {
    version: 1,
    labels: {
      ready: "ready-for-agent",
      running: "factory:running",
      failed: "factory:failed",
      needsInput: "factory:needs-input",
      paused: "factory:paused",
    },
    modelLabelPrefix: "model:",
    prompt: "{skillPrefix}implement #{issue}",
  });
});

test("this repository's toolchain Dockerfile has one stage and needs no build context", () => {
  const dockerfile = readFileSync(join(root, ".factory/Dockerfile"), "utf8");
  assert.equal([...dockerfile.matchAll(/^FROM\s/gim)].length, 1);
  assert.doesNotMatch(dockerfile, /^(?:COPY|ADD|ENTRYPOINT|CMD)\s/im);
});

test("no tracked file reaches the observation limit that would reject inspection", () => {
  const oversized = trackedFiles()
    .map((path) => ({ path, state: lstatSync(join(root, path)) }))
    .filter(({ state }) => state.isFile() && state.size >= observationFileLimit)
    .map(({ path, state }) => `${path} (${state.size} bytes)`);

  assert.deepEqual(
    oversized,
    [],
    `keep every tracked file below ${observationFileLimit} bytes so the CLI can observe it`,
  );
});

// Expected digests were taken from the upstream v1.3.1 checkout, independently
// of the distributed snapshot. Keep the plugin manifest as the set authority.
const upstreamSnapshot = JSON.parse(
  readFileSync(join(root, "test/fixtures/mattpocock-v1.3.1.json"), "utf8"),
);
const snapshotRoot = join(root, "vendor/mattpocock-skills");
const upstreamManifest = JSON.parse(
  readFileSync(join(snapshotRoot, ".claude-plugin/plugin.json"), "utf8"),
);

function declaredSkills() {
  const declarations = readFileSync(join(root, "standards.yaml"), "utf8");
  return [
    ...declarations.matchAll(
      /^ {6}kind: skill\n {6}name: ([^\s]+)\n {6}source: ([^\s]+)/gm,
    ),
  ].map((match) => ({ name: match[1], source: match[2] }));
}

function snapshotFiles(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${prefix}${entry.name}`;
    return entry.isDirectory()
      ? snapshotFiles(join(directory, entry.name), `${path}/`)
      : [path];
  });
}

// Adoption installs only workflow skills, as ADR 0018 decides: 17 pinned
// upstream skills and Repo Canon's own babysit.
const workflowSkills = [
  "babysit",
  "code-review",
  "codebase-design",
  "diagnosing-bugs",
  "domain-modeling",
  "grill-with-docs",
  "grilling",
  "implement",
  "improve-codebase-architecture",
  "pr",
  "prototype",
  "research",
  "tdd",
  "to-spec",
  "to-tickets",
  "triage",
  "wayfinder",
  "writing-for-agents",
];

// The skill setup files are installed from these seeds (ADR 0008), so they stay
// vendored without the setup skill itself.
const setupSeeds =
  /^skills\/engineering\/setup-matt-pocock-skills\/(?!SKILL\.md$)[^/]+\.md$/;

function vendoredSkillSources() {
  return declaredSkills()
    .filter(({ source }) => source.startsWith("vendor/mattpocock-skills/"))
    .map(({ source }) => source.slice("vendor/mattpocock-skills/".length));
}

test("adoption declares exactly the workflow skills and no show-me skill", () => {
  assert.deepEqual(
    declaredSkills()
      .map(({ name }) => name)
      .sort(),
    workflowSkills,
  );
  assert.ok(!existsSync(join(root, "vendor/humanlayer-skills/skills/show-me")));
});

test("both profiles install HumanLayer's pinned upstream license beside the skills", () => {
  const declarations = readFileSync(join(root, "standards.yaml"), "utf8");
  const defaults = /^defaults:\n([\s\S]*?)^profiles:\n/m.exec(declarations)[1];
  assert.match(
    defaults,
    /^ {4}humanlayer-skills-license:\n {6}kind: file\n {6}target: \.agents\/skills\/LICENSE\.humanlayer-skills\n {6}exact: vendor\/humanlayer-skills\/LICENSE$/m,
  );
  for (const profile of ["standard", "factory"]) {
    assert.doesNotMatch(
      profileDeclarations(declarations, profile),
      /humanlayer-skills-license/,
      `${profile} inherits the default license declaration unchanged`,
    );
  }

  const directory = join(root, "vendor/humanlayer-skills");
  assert.deepEqual(snapshotFiles(directory).sort(), [
    "LICENSE",
    "UPSTREAM.json",
  ]);
  assert.deepEqual(
    JSON.parse(readFileSync(join(directory, "UPSTREAM.json"), "utf8")),
    {
      repository: "https://github.com/humanlayer/skills",
      commit: "653b6411c1f70c275a18e37673b042ff99f67ceb",
      path: "LICENSE",
    },
  );
  // Digest from the pinned upstream LICENSE, independently downloaded and
  // compared with the copy shipped in v0.10.1. Never derive it from vendor/.
  assert.equal(
    createHash("sha256")
      .update(readFileSync(join(directory, "LICENSE")))
      .digest("hex"),
    "5f13c18ea00ea5c1384f41745feeca774079164f7f59a92e4ac0899ad217b26f",
  );
});

test("third-party notices cover the reproduced pr Summary and its installed HumanLayer notice", () => {
  const notices = flowedText("THIRD_PARTY_NOTICES.md");
  assert.match(
    notices,
    /`pr` skill's Summary section reproduces material from HumanLayer's `show-me` skill/,
  );
  assert.match(
    notices,
    /\[MIT License and copyright notice\]\(vendor\/humanlayer-skills\/LICENSE\)/,
  );
  assert.match(
    notices,
    /Adoption installs the same notice beside the copied skills, at `\.agents\/skills\/LICENSE\.humanlayer-skills` in the adopting repository/,
  );
});

test("operations retaining third-party notices also retain every linked license", () => {
  const notices = readFileSync(join(root, "THIRD_PARTY_NOTICES.md"), "utf8");
  const licenses = [...notices.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(
    ([, path]) => path,
  );
  const declarations = readFileSync(join(root, "standards.yaml"), "utf8");
  const resources = [
    ...declarations.matchAll(/^([ ]+)resources:\n((?:\1 {2}- [^\n]+\n)+)/gm),
  ]
    .map(([, , block]) =>
      [...block.matchAll(/- ([^\n]+)/g)].map(([, path]) => path),
    )
    .filter((paths) => paths.includes("THIRD_PARTY_NOTICES.md"));
  assert.ok(resources.length > 0, "at least one operation retains the notices");
  for (const paths of resources) {
    for (const license of licenses) {
      assert.ok(
        paths.includes(license),
        `retain ${license} with third-party notices`,
      );
      assert.ok(existsSync(join(root, license)), `${license} exists`);
    }
  }
});

test("the vendored Matt Pocock tree holds only declared skills and setup seeds, matching v1.3.1", () => {
  assert.equal(upstreamManifest.version, "1.3.1");
  const sources = vendoredSkillSources();
  for (const source of sources) {
    assert.ok(
      upstreamManifest.skills.includes(`./${source}`),
      `${source} is a skill of the pinned manifest`,
    );
  }
  const retained = Object.keys(upstreamSnapshot.files).filter(
    (path) =>
      !path.startsWith("skills/") ||
      setupSeeds.test(path) ||
      sources.some((source) => path.startsWith(`${source}/`)),
  );
  assert.deepEqual(snapshotFiles(snapshotRoot).sort(), retained.sort());
  for (const path of retained) {
    assert.equal(
      createHash("sha256")
        .update(readFileSync(join(snapshotRoot, path)))
        .digest("hex"),
      upstreamSnapshot.files[path],
      `${path} matches ${upstreamSnapshot.tag} (${upstreamSnapshot.commit})`,
    );
  }
});

// Routes from an installed skill to an uninstalled one that cannot fire in an
// adopting repository. Any other such route needs a CONTRIBUTING.md override.
const missingSetupFiles =
  "fires only when the installed docs/agents skill setup files are missing";
const dormantRoutes = [
  {
    skill: "code-review",
    target: "setup-matt-pocock-skills",
    reason: missingSetupFiles,
  },
  {
    skill: "to-spec",
    target: "setup-matt-pocock-skills",
    reason: missingSetupFiles,
  },
  {
    skill: "to-tickets",
    target: "setup-matt-pocock-skills",
    reason: missingSetupFiles,
  },
  {
    skill: "triage",
    target: "setup-matt-pocock-skills",
    reason: missingSetupFiles,
  },
  {
    skill: "wayfinder",
    target: "setup-matt-pocock-skills",
    reason: missingSetupFiles,
  },
];

// A route is a `/name` invocation or a Skill tool call naming the skill in the
// same sentence, such as `call the Skill tool twice, for "a" and "b"`.
function routesTo(content, target) {
  const name = RegExp.escape(target);
  return (
    new RegExp(`/${name}(?![a-z0-9-])`).test(content) ||
    new RegExp(`Skill tool\\b[^.\\n]*?["\`]${name}["\`]`).test(content)
  );
}

test("installed skill routes to uninstalled vendored skills are dormant or have contribution overrides", () => {
  const installed = declaredSkills();
  const uninstalled = upstreamManifest.skills
    .filter(
      (path) =>
        !installed.some(
          ({ source }) =>
            source === `vendor/mattpocock-skills/${path.slice(2)}`,
        ),
    )
    .map((path) => basename(path));
  const contributing = readFileSync(join(root, "CONTRIBUTING.md"), "utf8");
  const firing = new Set();

  for (const { name, source } of installed) {
    for (const path of snapshotFiles(join(root, source))) {
      const content = readFileSync(join(root, source, path), "utf8");
      for (const target of uninstalled.filter((target) =>
        routesTo(content, target),
      )) {
        firing.add(`${name} -> ${target}`);
        if (
          dormantRoutes.some(
            (route) => route.skill === name && route.target === target,
          )
        ) {
          continue;
        }
        assert.ok(
          new RegExp(
            `(?<![a-z0-9-])${RegExp.escape(target)}(?![a-z0-9-])`,
          ).test(contributing),
          `${name} (${source}/${path}) routes to uninstalled ${target}; list the route as dormant with its reason, or CONTRIBUTING.md must name ${target} to override it`,
        );
      }
    }
  }
  for (const { skill, target, reason } of dormantRoutes) {
    assert.ok(
      reason,
      `the dormant ${skill} route to ${target} states its reason`,
    );
    assert.ok(
      firing.has(`${skill} -> ${target}`),
      `${skill} no longer routes to uninstalled ${target}; remove its dormant route`,
    );
  }
});

test("the installed setup files retain the v1.3.1 seed bytes", () => {
  const declarations = readFileSync(join(root, "standards.yaml"), "utf8");
  for (const [target, seed] of [
    ["docs/agents/domain.md", "domain.md"],
    ["docs/agents/issue-tracker.md", "issue-tracker-github.md"],
    ["docs/agents/triage-labels.md", "triage-labels.md"],
  ]) {
    const source = `vendor/mattpocock-skills/skills/engineering/setup-matt-pocock-skills/${seed}`;
    assert.ok(
      declarations.includes(`target: ${target}\n      exact: ${source}`),
    );
    assert.deepEqual(
      readFileSync(join(root, target)),
      readFileSync(join(root, source)),
    );
  }
});

test("adoption installs the model-invocable babysit skill in place of deliver", () => {
  const declarations = readFileSync(join(root, "standards.yaml"), "utf8");
  assert.match(
    declarations,
    /\n {4}skill-babysit:\n {6}kind: skill\n {6}name: babysit\n {6}source: \.agents\/skills\/babysit\n/,
  );
  assert.doesNotMatch(declarations, /deliver/);
  const frontmatter =
    /^---\n([\s\S]*?)\n---\n/.exec(
      readFileSync(join(root, ".agents/skills/babysit/SKILL.md"), "utf8"),
    )?.[1] ?? "";
  assert.match(frontmatter, /^name: babysit$/m);
  assert.match(frontmatter, /^description: \S/m);
  assert.doesNotMatch(frontmatter, /disable-model-invocation/);
  assert.deepEqual(
    readdirSync(join(root, ".agents/skills/babysit"), {
      recursive: true,
    }).sort(),
    [
      "SKILL.md",
      "merge.mjs",
      "pull-request-reviewer.mjs",
      "reviewer.mjs",
      "wait.mjs",
    ],
  );
});

test("babysit names the Node.js major required by the factory image rules", () => {
  const babysit = flowedText(".agents/skills/babysit/SKILL.md");
  const rules = flowedText("rules/factory-sandbox-image.md");
  const skillMajor = /scripts require Node\.js (\d+)/.exec(babysit)?.[1];
  const imageMajor = /currently Node\.js (\d+)/.exec(rules)?.[1];
  assert.ok(skillMajor, "babysit states its scripts' Node.js major");
  assert.ok(imageMajor, "factory image rules state the supported major");
  assert.equal(skillMajor, imageMajor);
});

test("babysit waits only through its script, and the guide owns the no-review rule", () => {
  const babysit = flowedText(".agents/skills/babysit/SKILL.md");
  assert.match(babysit, /wait\.mjs <number>/);
  assert.match(babysit, /600000 ms/);
  assert.match(babysit, /longest wait/);
  assert.match(babysit, /`5`: still waiting; run it again/);
  assert.match(
    readFileSync(join(root, ".agents/skills/babysit/wait.mjs"), "utf8"),
    /One invocation covers 9 minutes waited; repository data sets review bounds\./,
  );
  assert.doesNotMatch(babysit, /--watch|watch tool|poll for reviews/);
  assert.doesNotMatch(babysit, /comments on it that the configured reviewer/);
  assert.match(babysit, /`4` for the reason its line gives/);
  assert.match(
    babysit,
    /`node <this skill's directory>\/merge\.mjs <number> <SHA>`, where `<SHA>` is the full SHA that starts the wait's latest line\. Exit `0` means merged; `2` means the head changed, so return to step 1/,
  );
  assert.match(
    babysit,
    /Before the first wait, apply the \[Merging request rule\]\(\.\.\/\.\.\/\.\.\/CONTRIBUTING\.md#merging\) to the pull request's head, using step 4 to post any required request\. 1\. Wait with/,
  );
  assert.match(
    babysit,
    /4\. Apply the \[Merging request rule\]\(\.\.\/\.\.\/\.\.\/CONTRIBUTING\.md#merging\) to each new head after a fix push/,
  );
  assert.doesNotMatch(babysit, /onOpen|reviewRequests|fully or partly/);
  assert.doesNotMatch(babysit, /warrant another look/);
  assert.match(
    babysit,
    /"checks passed" also covers no check arriving within 5 minutes of a push GitHub recorded, with no unfinished or failed workflow run for the head/,
  );
  assert.doesNotMatch(
    babysit,
    /5 minutes of the latest review request|30 minutes/,
  );
  const guide = flowedText("CONTRIBUTING.md");
  assert.match(
    guide,
    /the merging agent comments on it that the configured reviewer did not review that head and why/,
  );
  assert.match(guide, /a push is not one/);
  assert.match(
    guide,
    /it is unavailable, no review was requested after the head's push, it did not respond within `bounds.responseMinutes` of the latest review request, or no review arrived within `bounds.reviewMinutes` of it/,
  );
});

test("both babysit exit-1 instructions defer permission refusals to Credentials", () => {
  const babysit = flowedText(".agents/skills/babysit/SKILL.md");
  const instructions = [
    /- `1`: (.*?) 2\. Verify/.exec(babysit)?.[1] ?? "",
    /; `1` means (.*?) 6\. Stop/.exec(babysit)?.[1] ?? "",
  ];
  for (const instruction of instructions) {
    assert.match(
      instruction,
      /follow \[Credentials\]\(\.\.\/\.\.\/\.\.\/CONTRIBUTING\.md#credentials\) for a permission refusal; otherwise/,
    );
    assert.match(
      instruction,
      /otherwise fix the invocation or other `gh` error and run it again/,
    );
  }
  assert.doesNotMatch(
    babysit,
    /`gh` access|instead of retrying|only the credentials|another identity|other identities|search(?:ing)? for credentials|ask(?:s|ing)? the owner|factory:needs-input/,
  );
});

test("the installed agent guidance ends every change as a babysat pull request", () => {
  const declarations = readFileSync(join(root, "standards.yaml"), "utf8");
  assert.ok(declarations.includes("target: AGENTS.md\n      exact: AGENTS.md"));
  assert.ok(
    flowedText("AGENTS.md").includes(
      "Deliver every change as one pull request: open it and write its body as `CONTRIBUTING.md` says, using `pr` where it directs, then `babysit` it until it merges.",
    ),
  );
});

test("the guide requires a first review request before waiting when opening is not a request", () => {
  const guide = flowedText("CONTRIBUTING.md");
  assert.match(
    guide,
    /A review request is the pull request's opening when `request.onOpen` is true, or a later comment whose whole trimmed body equals `request.comment`; a push is not one/,
  );
  assert.match(
    guide,
    /When `request.onOpen` is false and the pull request has had no review request, an agent must post the review request comment for its head before it first waits on the pull request/,
  );
  assert.match(
    guide,
    /The request bound cannot stop this first request, since none has been counted yet/,
  );
  assert.match(
    guide,
    /Count the opening when `request.onOpen` is true and every comment whose whole trimmed body equals `request.comment`, whoever posted it/,
  );
});

test("review converges on fixes and reasoned declines the guide allows", () => {
  const guide = flowedText("CONTRIBUTING.md");
  assert.ok(
    guide.includes(
      "every review thread is answered with its fix or a reasoned decline",
    ),
  );
  assert.match(guide, /another layer owns/);
  assert.match(guide, /files only the owner writes/);
  const babysit = flowedText(".agents/skills/babysit/SKILL.md");
  assert.match(babysit, /does not let you decline/);
  assert.match(
    guide,
    /After that first request, an agent must post the review request comment for a new head when its push fixes, fully or partly, a review finding these rules do not let it decline, and the request bound has not been reached/,
  );
  assert.match(
    guide,
    /No other push gets a request: a push that only follows declines, changes only tests, documentation or wording, or only fixes a failing check gets none/,
  );
  assert.match(
    guide,
    /Once that count reaches the bound, no agent requests another review\. Without the field there is no count bound/,
  );
  assert.match(
    guide,
    /fix every finding the agent may not decline and push without another request/,
  );
  assert.match(
    guide,
    /The bound creates no decline reason and no grouped follow-up issue/,
  );
  assert.doesNotMatch(
    babysit,
    /ticket or scope|another layer|only the owner writes/,
  );
});

test("comment disclaimers show exact blockquote source followed by a blank line", () => {
  const guide = readFileSync(join(root, "CONTRIBUTING.md"), "utf8");
  const comments = /## Comments\n([\s\S]*?)(?=\n## |$)/.exec(guide)?.[1] ?? "";
  assert.match(
    comments.replaceAll(/\s+/g, " "),
    /disclaimer line, `>` included, followed by a blank line/,
  );
  assert.match(comments, /^```markdown\n> _This was generated by AI\._\n```$/m);
  assert.match(
    comments,
    /^```markdown\n> \*This was generated by AI during triage\.\*\n```$/m,
  );
});

test("the guide's triage disclaimer matches the pinned skill and passes the issue-contract check", () => {
  const guide = readFileSync(join(root, "CONTRIBUTING.md"), "utf8");
  const triageLine =
    /^```markdown\n(> \*This was generated by AI during triage\.\*)\n```$/m.exec(
      guide,
    )?.[1];
  const skill = readFileSync(
    join(root, "vendor/mattpocock-skills/skills/engineering/triage/SKILL.md"),
    "utf8",
  );
  const pinnedLine = /^```\n(> [^\n]+)\n```$/m.exec(skill)?.[1];
  assert.ok(triageLine);
  assert.ok(pinnedLine);
  assert.equal(triageLine, pinnedLine);

  const decision = decideIssueContract({
    repository,
    event: { issue: { number: 42 } },
    issue: {
      number: 42,
      body: featureBody,
      labels: [{ name: "enhancement" }, { name: "needs-triage" }],
      state: "open",
    },
    comments: [
      {
        id: 12,
        user: { login: "maintainer" },
        body: completeAgentBrief.replace(/^[^\n]+/, triageLine),
      },
    ],
    issueEvents: [],
    blockedBy: [],
    parent: null,
    relatedIssues: {},
    permissions: {},
  });
  assert.equal(decision.exitCode, 0, decision.message);
  assert.match(decision.message, /valid triaged Agent Brief/i);
});

test("pull requests close finished issues and leave partial work linked without closing", () => {
  const guide = flowedText("CONTRIBUTING.md");
  const pullRequests =
    /## Pull requests (.*?)### Opening a pull request/.exec(guide)?.[1] ?? "";
  assert.match(
    pullRequests,
    /A pull request that finishes its issue links it with a closing reference, such as `Closes #123`, so merging it closes the issue/,
  );
  assert.match(
    pullRequests,
    /A pull request that does only part of an issue's work links it without a closing reference, such as `Part of #123`/,
  );
  assert.match(
    pullRequests,
    /A closing reference closes the issue only when the pull request merges into the default branch; with another base branch, whoever merges closes the issue after the merge/,
  );
  assert.match(
    pullRequests,
    /In a repository a factory serves, a merged pull request that leaves its issue open fails the run for good, without a retry; if the work finished the issue, close it/,
  );
});

test("the pull request template distinguishes finished issues from partial work", () => {
  const template = flowedText(".github/PULL_REQUEST_TEMPLATE.md");
  const relatedIssue = /## Related issue (.*)/.exec(template)?.[1] ?? "";
  assert.match(
    relatedIssue,
    /Link the issue with a closing reference, such as Closes #123, if the pull request finishes it; for partial work, use a nonclosing reference, such as Part of #123/,
  );
  assert.doesNotMatch(relatedIssue, /when appropriate/);
  assert.match(
    relatedIssue,
    /For work without a ticket, write Direct change: followed by its reason instead/,
  );
});

test("owner questions stay on the issue and leave an open pull request unmerged", () => {
  const guide = flowedText("CONTRIBUTING.md");
  const comments = /## Comments (.*?)(?= ## |$)/.exec(guide)?.[1] ?? "";
  assert.match(comments, /post the question as one issue comment/);
  assert.match(comments, /add `factory:needs-input`, and stop/);
  assert.match(comments, /without a pull request if none is open/);
  assert.match(
    comments,
    /leaving the open pull request unmerged and linked from the question/,
  );
  assert.match(
    comments,
    /This owner handoff ends the agent's babysitting of the pull request/,
  );
  assert.match(
    comments,
    /Work without an issue asks on its pull request instead, with no label/,
  );
  assert.match(
    comments,
    /While the run's pull request is open, removing the label starts no run in a repository a factory serves/,
  );
  assert.match(
    comments,
    /With no open pull request, the owner answers and removes the label to return the issue to the frontier as a fresh first attempt/,
  );
  assert.match(
    comments,
    /The owner either finishes the pull request by merging it, for example after pushing the refused change, and ensuring the issue is closed under the \[pull request rules\]\(#pull-requests\), or hands it back: close it before removing the label, wait for `factory:running` to disappear, then remove the label so a fresh first attempt continues its branch/,
  );
  assert.match(
    comments,
    /If the answer changes the implementation contract, edit the contract; that drops readiness and requires review again/,
  );
});

test("the contribution guide limits each run to its credentials and stops at permission refusals", () => {
  const guide = flowedText("CONTRIBUTING.md");
  const credentials =
    /## Credentials ([^#]+)## Comments/.exec(guide)?.[1] ?? "";
  assert.match(
    credentials,
    /An agent run uses only the credentials it was given\./,
  );
  assert.equal(
    [
      ...guide.matchAll(
        /An agent run uses only the credentials it was given\./g,
      ),
    ].length,
    1,
  );
  assert.match(
    credentials,
    /It never looks for, tests, or uses another identity, whether a token, a CLI login, an environment variable, a connector, or an app, including one reached through the agent provider's own login\./,
  );
  assert.match(
    credentials,
    /Searching for one, such as listing credential environment variables or probing other `gh` configurations, counts as looking\./,
  );
  assert.match(
    credentials,
    /When a push, merge, or API call is refused for permission, the refusal stands: the agent stops and asks the owner, as for any answer only the owner can give, and never retries under another identity\./,
  );
});
