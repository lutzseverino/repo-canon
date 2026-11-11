import { interpretMarkdown } from "../operations/lib/rendered-markdown.mjs";
import { localLinks } from "../operations/lib/local-markdown-links.mjs";
import { marked } from "../vendor/marked/marked.esm.js";
import { declarations } from "../scripts/standards-declarations.mjs";
import { execFixtureGit } from "../scripts/support/fixture-git.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { basePaths, snapshotIdentity } from "../scripts/upstream-bases.mjs";
import { decideIssueContract } from "./helpers/contract-decision.mjs";
import { completeReview } from "../.agents/skills/babysit/review-outcome.mjs";
import {
  completeAgentBrief,
  featureBody,
  repository,
} from "./helpers/issue-contracts.mjs";
import { fileDeclarations } from "./helpers/documentation.mjs";
import { declaredOperations, invokeCheck } from "./helpers/operation.mjs";

// Run the shipped documentation checks against the repository's documentation.
// Source-side guidance, discovery instructions, and vendored material stay out
// of the repository's documentation scope.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootDocuments = ["GLOSSARY.md", "authoring-notes.md"];

// The CLI's discovery observation refuses any file larger than this, which would
// reject the whole inspection before it reports anything.
const observationFileLimit = 8 * 1024 * 1024;

function trackedFiles() {
  return execFixtureGit(["-C", root, "ls-files", "-z"], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
  })
    .split("\0")
    .filter(Boolean);
}

// Read every source reference in the authored manifest, across both profiles.
// Directory references select their descendants; adopter target paths do not.
function sourceInputFiles() {
  const paths = new Set(["standards.yaml"]);
  for (const declaration of manifestDeclarations())
    for (const field of ["exact", "guidance", "rules", "discovery", "source"])
      if (declaration[field]) paths.add(declaration[field]);
  for (const { run } of declaredOperations(root)) {
    paths.add(run.script);
    for (const path of run.resources ?? []) paths.add(path);
  }

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
        const refs = execFixtureGit(
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

// ADR 0031 renamed the workflow states and categories into label families and
// removed `factory:needs-input`. Installed text names only the new labels; the
// vendored upstream snapshot and each skill's credits describe upstream's own
// roles, the triage label mapping's first column names them, and label setup
// names the former labels it renames.
test("no source input names a label that ADR 0031 renamed or removed", () => {
  const former =
    /(?<![\w-])(?:needs-triage|needs-info|ready-for-agent|ready-for-human|needs-input|needsInput)(?![\w-])/;
  for (const path of sourceInputFiles()) {
    if (
      path.startsWith("vendor/") ||
      path.endsWith("/CREDITS.md") ||
      path === "operations/setup-github-labels.mjs"
    )
      continue;
    let text = readFileSync(join(root, path), "utf8");
    if (path === "docs/agents/triage-labels.md")
      text = text.replace(/^\| `[\w-]+` +\|/gm, "|");
    assert.doesNotMatch(text, former, path);
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

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

// The orchestrate skill is a core `SKILL.md` and the references it links.
const orchestrateReferences = [
  "templates.md",
  "launches.md",
  "close.md",
  "intake.md",
];

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

// The factory's repository files, which only the factory profile installs.
const factoryFiles = [
  ".scriptorium/config.json",
  ".scriptorium/Dockerfile",
  ".github/workflows/sandbox-image.yml",
];

test("the standard profile installs no factory file, and the factory profile adds exactly the factory's", () => {
  const profiles = declarations(root);
  assert.deepEqual(Object.keys(profiles), ["standard", "factory", "workbench"]);
  for (const path of factoryFiles)
    assert.ok(!profiles.standard.some(({ target }) => target === path));
  assert.ok(!profiles.standard.some(({ id }) => id === "factory-workflow"));
  assert.deepEqual(
    profiles.factory.filter(
      ({ id }) => !profiles.standard.some((entry) => entry.id === id),
    ),
    [
      {
        id: "skill-factory",
        kind: "skill",
        name: "factory",
        source: ".agents/skills/factory",
      },
      {
        id: "factory-configuration",
        kind: "file",
        target: ".scriptorium/config.json",
        exact: ".scriptorium/config.json",
      },
      {
        id: "factory-workflow",
        kind: "repository",
        rules: "rules/factory-workflow.md",
        guidance: "guidance/factory-workflow.md",
        discovery: "discovery/factory-workflow.md",
        checks: [
          {
            id: "factory-model-policy",
            run: {
              executable: "node",
              script: "operations/check-factory-model-policy.mjs",
              resources: ["operations/lib/factory-model-policy.mjs"],
              arguments: [],
            },
            prerequisite: {
              "version-arguments": ["--version"],
              version: ">=24.0.0 <25.0.0 || >=26.0.0 <27.0.0",
            },
            "timeout-seconds": 30,
          },
        ],
      },
      {
        id: "factory-sandbox-image",
        kind: "repository",
        targets: {
          paths: [
            ".scriptorium/Dockerfile",
            ".factory/Dockerfile",
            ".factory/config.json",
          ],
          directories: [],
        },
        rules: "rules/factory-sandbox-image.md",
        guidance: "guidance/factory-sandbox-image.md",
      },
      {
        id: "factory-sandbox-image-workflow",
        kind: "file",
        target: ".github/workflows/sandbox-image.yml",
        exact: ".github/workflows/sandbox-image.yml",
      },
    ],
  );
});

test("both profiles inherit the exact standards update workflow from defaults", () => {
  for (const profile of ["standard", "factory"])
    assert.deepEqual(
      declarations(root)[profile].find(
        ({ id }) => id === "standards-update-workflow",
      ),
      {
        id: "standards-update-workflow",
        kind: "file",
        target: ".github/workflows/standards-update.yml",
        exact: ".github/workflows/standards-update.yml",
      },
    );
});

test("the standards retire the in-repository factory, its sandbox base, and the issue-contract kind runtime", () => {
  const manifest = JSON.stringify(declarations(root));
  for (const retired of [
    ".sandcastle",
    "sandbox-image-base",
    "check-sandbox-image",
    "issue-contract-kind",
  ])
    assert.ok(!manifest.includes(retired), `standards.yaml names ${retired}`);
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
  comments: "both",
  documentation: "both",
  "factory-workflow": "both",
  "factory-sandbox-image": "both",
  "git-attributes": "both",
  "github-repository-configuration": "both",
  "project-agent-guidance": "both",
  "project-readmes": "both",
  "repository-license": "both",
  "repository-readme": "both",
  "typescript-node-stack": "both",
  "typescript-astro-stack": "both",
  "typescript-vite-stack": "both",
};

test("self-adoption leaves Repo Canon's own installed source unvendored", () => {
  const paths = [
    "vendor/repo-canon/validate-issue-contract.mjs",
    "vendor/repo-canon/validate.mjs",
    "operations/lib/rendered-markdown.mjs",
    ".agents/skills/triage/ready.mjs",
    ".agents/skills/review/round.mjs",
    ...readdirSync(join(root, ".agents/skills/babysit"))
      .filter((name) => name.endsWith(".mjs"))
      .map((name) => `.agents/skills/babysit/${name}`),
  ];
  const attributes = execFixtureGit(
    ["-C", root, "check-attr", "linguist-vendored", "--", ...paths],
    { encoding: "utf8" },
  );
  assert.deepEqual(
    attributes.trim().split("\n"),
    paths.map((path) => `${path}: linguist-vendored: unspecified`),
  );
});

// Every declaration in `standards.yaml`, with the source files its `guidance`
// and `rules` fields name.
function manifestDeclarations() {
  return [
    ...new Map(
      Object.values(declarations(root))
        .flat()
        .map((entry) => [JSON.stringify(entry), entry]),
    ).values(),
  ];
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

test("the contribution guide leaves documentation rules to their declaration", () => {
  assert.ok(
    !interpretMarkdown(read("CONTRIBUTING.md")).headings.some(
      ({ folded }) => folded === "documentation",
    ),
  );
});

test("the source keeps each rule in one place, with web stacks sharing their source", () => {
  const rules = manifestDeclarations().filter(({ rules }) => rules);
  for (const { id, rules: path } of rules)
    assert.equal(
      path,
      ["typescript-astro-stack", "typescript-vite-stack"].includes(id)
        ? "rules/typescript-web-stacks.md"
        : `rules/${id}.md`,
      `${id} keeps its rules in rules/`,
    );
  assert.deepEqual(
    readdirSync(join(root, "rules")).sort(),
    [
      ...new Set(rules.map(({ rules: path }) => path.slice("rules/".length))),
    ].sort(),
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

test("reviewer schema and wait policy have a single home in the GitHub rules", () => {
  assert.doesNotMatch(
    read(".agents/skills/babysit/SKILL.md"),
    /commentMarker|responseMinutes|"version"|onOpen|reviewRequests|5 minutes|30 minutes/,
  );
  assert.doesNotMatch(
    read("CONTRIBUTING.md"),
    /bounds\.responseMinutes|bounds\.reviewMinutes|5 minutes|merging agent comments/,
  );
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

test("runner prerequisites live only in the GitHub rules", () => {
  assert.doesNotMatch(
    read("guidance/github-repository-configuration.md"),
    /The runners need/,
  );
});

test("AGENTS.md names no rules path", () => {
  assert.doesNotMatch(
    readFileSync(join(root, "AGENTS.md"), "utf8"),
    /\.repo-standards\/rules|(?:^|[\s(`"'/])rules\/[\w.-]+|repo-standards rules\b/m,
  );
});

// Fixed budgets make entry-document growth visible in review.
const wordBudgets = { "CONTRIBUTING.md": 3109, "AGENTS.md": 223 };

function wordCount(text) {
  return text.match(/\S+/gu)?.length ?? 0;
}

// The failure for a document over its budget, naming the document, its actual
// count, and its limit; null when the count is at or under the limit.
function wordBudgetFailure(document, text, limit) {
  const count = wordCount(text);
  return count > limit
    ? `${document} is over its word budget: ${count} words, limit ${limit}`
    : null;
}

test("word counts split on whitespace only", () => {
  assert.equal(wordCount(""), 0);
  assert.equal(wordCount(" \n\t \r\n\u00a0\u3000 "), 0);
  assert.equal(wordCount("one"), 1);
  assert.equal(wordCount("  one \t two\nthree\r\n\nfour  "), 4);
  assert.equal(wordCount("well-known `a/b.md` (see [x](y))"), 4);
  assert.equal(wordCount("# Title\n\n- item\n"), 4);
});

test("a word budget passes at its limit and fails above it with the document, count, and limit", () => {
  assert.equal(wordBudgetFailure("A.md", "", 0), null);
  assert.equal(wordBudgetFailure("A.md", "   \n", 0), null);
  assert.equal(wordBudgetFailure("A.md", "one two three", 3), null);
  assert.equal(wordBudgetFailure("A.md", "one two", 3), null);
  assert.equal(
    wordBudgetFailure("A.md", "one two three four", 3),
    "A.md is over its word budget: 4 words, limit 3",
  );
  assert.equal(
    wordBudgetFailure("B.md", "one two", 1),
    "B.md is over its word budget: 2 words, limit 1",
  );
});

test("CONTRIBUTING.md and AGENTS.md stay within their word budgets", () => {
  for (const [document, limit] of Object.entries(wordBudgets))
    assert.equal(
      wordBudgetFailure(
        document,
        readFileSync(join(root, document), "utf8"),
        limit,
      ),
      null,
    );
});

test("standards.yaml declares no repository-owned optional policy file", () => {
  assert.doesNotMatch(
    JSON.stringify(declarations(root)),
    /pull-request-reviewer\.json|factory-review-policy\.json|factory-model-policy\.json/,
  );
});

// Configuration version 3 maps each run kind a repository turns on to a skill
// and its arguments; policy and host own execution choices. Labels belong to the
// `state:`, `gate:`, `factory:` and `priority:` families (ADR 0031), distinct
// ignoring case. Triage needs the triage result its readiness is checked
// against (ADR 0030). This repository imports no factory code, so the shape
// is checked here.
const runKindNames = ["triage", "implement", "review"];
const labelRoles = [
  "triage",
  "reporter",
  "grill",
  "owner",
  "ready",
  "ownerReview",
  "majorRelease",
  "running",
  "paused",
  "failed",
  "skip",
  "hold",
  "releaseHold",
  "priorityHigh",
  "priorityNormal",
  "priorityLow",
];

function trimmed(value) {
  return (
    typeof value === "string" && value.length > 0 && value.trim() === value
  );
}

function factoryConfigurationFailure(configuration) {
  if (configuration?.version !== 3)
    return `version ${configuration?.version} is not 3`;
  const allowed = [
    "$schema",
    "version",
    "labels",
    "modelLabelPrefix",
    "runKinds",
    "contractResult",
    "triageResult",
    "comments",
  ];
  const unknown = Object.keys(configuration).filter(
    (key) => !allowed.includes(key),
  );
  if (unknown.length) return `unknown fields: ${unknown.join(", ")}`;
  const labels = Object.entries(configuration.labels ?? {});
  const roles = labels.map(([role]) => role);
  if (roles.some((role) => !labelRoles.includes(role)))
    return `unknown label roles: ${roles.filter((role) => !labelRoles.includes(role)).join(", ")}`;
  if (!labels.every(([, name]) => trimmed(name)))
    return "labels need trimmed names";
  if (
    !labels.every(([, name]) => /^(?:state|gate|factory|priority):/.test(name))
  )
    return "labels outside the state:, gate:, factory: and priority: families";
  if (
    new Set(labels.map(([, name]) => name.toLowerCase())).size !== labels.length
  )
    return "labels are not distinct ignoring case";
  for (const role of ["ready", "running", "failed", "paused"])
    if (!configuration.labels?.[role]) return `labels.${role} is missing`;
  if (!trimmed(configuration.modelLabelPrefix))
    return "modelLabelPrefix is missing";
  for (const result of ["contractResult", "triageResult"]) {
    const value = configuration[result];
    if (value === undefined && result === "triageResult") continue;
    if (!trimmed(value?.marker) || !trimmed(value?.author))
      return `${result} needs a marker and an author`;
  }
  const kinds = configuration.runKinds ?? {};
  if (!kinds.implement) return "the implement run kind is missing";
  for (const [kind, run] of Object.entries(kinds)) {
    if (!runKindNames.includes(kind)) return `unknown run kind ${kind}`;
    if (!trimmed(run?.skill) || typeof run.arguments !== "string")
      return `runKinds.${kind} needs a skill and arguments`;
    const fields = ["skill", "arguments"];
    if (kind === "review") fields.push("differentProvider");
    if (Object.keys(run).some((key) => !fields.includes(key)))
      return `runKinds.${kind} has an unknown field`;
    if (
      run.differentProvider !== undefined &&
      typeof run.differentProvider !== "boolean"
    )
      return "runKinds.review.differentProvider is not a boolean";
  }
  if (kinds.triage) {
    for (const role of ["triage", "reporter", "grill", "owner"])
      if (!configuration.labels?.[role]) return `triage needs labels.${role}`;
    if (!configuration.triageResult) return "triage needs a triageResult";
  }
  return null;
}

test("the factory configuration is version 3 with Repo Canon's three run kinds", () => {
  const configuration = JSON.parse(
    readFileSync(join(root, ".scriptorium/config.json"), "utf8"),
  );
  assert.equal(factoryConfigurationFailure(configuration), null);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(configuration.runKinds).map(([kind, { skill }]) => [
        kind,
        skill,
      ]),
    ),
    { triage: "triage", implement: "implement", review: "review" },
  );
  for (const skill of runKindNames)
    assert.ok(existsSync(join(root, ".agents/skills", skill, "SKILL.md")));
  assert.equal(configuration.runKinds.review.differentProvider, true);
  assert.equal(
    configuration.contractResult.author,
    "github-actions[bot]",
    "the issue-contract workflow posts the contract result",
  );
});

test("the factory configuration check rejects version 2 and malformed version 3", () => {
  const shipped = JSON.parse(
    readFileSync(join(root, ".scriptorium/config.json"), "utf8"),
  );
  const { runKinds, ...rest } = shipped;
  const version2 = {
    ...rest,
    version: 2,
    skill: "implement",
    arguments: "#{issue}",
  };
  const implementOnly = {
    ...rest,
    runKinds: { implement: runKinds.implement },
  };
  delete implementOnly.triageResult;
  assert.equal(factoryConfigurationFailure(implementOnly), null);
  for (const configuration of [
    version2,
    { ...version2, version: 3 },
    { ...shipped, runKinds: { triage: runKinds.triage } },
    {
      ...shipped,
      labels: { ...shipped.labels, needsInput: "factory:needs-input" },
    },
    { ...shipped, labels: { ...shipped.labels, other: "State:Ready" } },
    {
      ...shipped,
      runKinds: {
        ...runKinds,
        implement: { ...runKinds.implement, model: "claude-opus-5-5" },
      },
    },
    {
      ...shipped,
      runKinds: { ...runKinds, review: { skill: "review", arguments: null } },
    },
    ...["triage", "review"].flatMap((kind) =>
      ["provider", "model", "effort"].map((field) => ({
        ...shipped,
        runKinds: {
          ...runKinds,
          [kind]: { ...runKinds[kind], [field]: "embedded-choice" },
        },
      })),
    ),
    {
      ...shipped,
      runKinds: {
        ...runKinds,
        implement: { ...runKinds.implement, retry: {} },
      },
    },
    { ...implementOnly, runKinds },
  ])
    assert.notEqual(
      factoryConfigurationFailure(configuration),
      null,
      JSON.stringify(configuration),
    );
});

test("this repository's toolchain Dockerfile has one stage and needs no build context", () => {
  const dockerfile = readFileSync(
    join(root, ".scriptorium/Dockerfile"),
    "utf8",
  );
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
  return manifestDeclarations()
    .filter(({ kind }) => kind === "skill")
    .map(({ name, source }) => ({ name, source }));
}

function snapshotFiles(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${prefix}${entry.name}`;
    return entry.isDirectory()
      ? snapshotFiles(join(directory, entry.name), `${path}/`)
      : [path];
  });
}

// Adoption installs only workflow skills, as ADR 0018 decides, each an owned
// skill (ADR 0028): 17 taken from upstream, triage among them (ADR 0021), and
// the creation skills, babysit, factory, orchestrate and review, written for Repo Canon.
const workflowSkills = [
  "babysit",
  "code-review",
  "codebase-design",
  "create-adopted-repo",
  "create-repository",
  "diagnosing-bugs",
  "domain-modeling",
  "factory",
  "grill-with-docs",
  "grilling",
  "implement",
  "improve-codebase-architecture",
  "orchestrate",
  "pr",
  "prototype",
  "research",
  "review",
  "tdd",
  "to-spec",
  "to-tickets",
  "triage",
  "wayfinder",
  "writing-for-agents",
];

test("implement allows model invocation in both harness formats", () => {
  const directory = join(root, ".agents/skills/implement");
  const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(
    readFileSync(join(directory, "SKILL.md"), "utf8"),
  )?.[1];
  assert.ok(frontmatter);
  assert.doesNotMatch(frontmatter, /^disable-model-invocation:/m);
  assert.match(
    readFileSync(join(directory, "agents/openai.yaml"), "utf8"),
    /^ {2}allow_implicit_invocation: true$/m,
  );
});

test("creation entry points are discoverable standalone and allow model invocation", () => {
  const bundled = readdirSync(join(root, ".agents/skills"), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .filter((entry) =>
      existsSync(join(root, ".agents/skills", entry.name, "SKILL.md")),
    )
    .map((entry) => entry.name);
  for (const name of ["create-repository", "create-adopted-repo"]) {
    assert.ok(bundled.includes(name), name);
    const directory = join(root, ".agents/skills", name);
    const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(
      readFileSync(join(directory, "SKILL.md"), "utf8"),
    )?.[1];
    assert.ok(frontmatter);
    assert.match(frontmatter, /^disable-model-invocation: false$/m);
    assert.match(
      readFileSync(join(directory, "agents/openai.yaml"), "utf8"),
      /^ {2}allow_implicit_invocation: true$/m,
    );
  }
});

// The skill setup files take these seeds as their upstream bases (ADR 0028),
// so they stay vendored without the setup skill itself.
const setupSeeds =
  /^skills\/engineering\/setup-matt-pocock-skills\/(?!SKILL\.md$)[^/]+\.md$/;

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
  for (const profile of ["standard", "factory"])
    assert.deepEqual(
      declarations(root)[profile].find(
        ({ id }) => id === "humanlayer-skills-license",
      ),
      {
        id: "humanlayer-skills-license",
        kind: "file",
        target: ".agents/skills/LICENSE.humanlayer-skills",
        exact: "vendor/humanlayer-skills/LICENSE",
      },
    );

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

// Notices in credits are literal copies; THIRD_PARTY_NOTICES links to copies.
const licensePaths = [
  "vendor/mattpocock-skills/LICENSE",
  "vendor/humanlayer-skills/LICENSE",
  "vendor/marked/LICENSE",
  "vendor/parse5/LICENSE.parse5",
  "vendor/parse5/LICENSE.entities",
  "vendor/postern/LICENSE",
];

function noticeLinks(text) {
  return localLinks(
    root,
    "THIRD_PARTY_NOTICES.md",
    interpretMarkdown(text).content.elements,
  ).map(({ path }) => path);
}

function checkNotices(readBytes) {
  const links = noticeLinks(
    readBytes("THIRD_PARTY_NOTICES.md").toString("utf8"),
  );
  assert.deepEqual(links.toSorted(), ["LICENSE", ...licensePaths].toSorted());
  for (const path of links)
    assert.deepEqual(readBytes(path), readFileSync(join(root, path)), path);
  for (const { path, license } of skillNotices())
    assert.ok(
      readBytes(path).includes(readFileSync(join(root, license))),
      `${path} must reproduce ${license} byte for byte`,
    );
}

function skillNotices() {
  const bases = JSON.parse(read("upstream-bases.json")).skills;
  return declaredSkills().flatMap(({ name, source }) =>
    [
      ...(bases[name]?.path ? [licensePaths[0]] : []),
      ...(name === "pr" ? [licensePaths[1]] : []),
    ].map((license) => ({ path: `${source}/CREDITS.md`, license })),
  );
}

test("owned skills and third-party notices retain their vendored licenses byte for byte", () => {
  checkNotices((path) => readFileSync(join(root, path)));
  const notices = read("THIRD_PARTY_NOTICES.md");
  const reordered = notices
    .replaceAll(licensePaths[0], "LICENSE.swap")
    .replaceAll(licensePaths[1], licensePaths[0])
    .replaceAll("LICENSE.swap", licensePaths[1]);
  checkNotices((path) =>
    path === "THIRD_PARTY_NOTICES.md"
      ? Buffer.from(reordered)
      : readFileSync(join(root, path)),
  );
});

test("dropped or altered license notices fail, including linked notices", () => {
  const readBytes = (path) => readFileSync(join(root, path));
  for (const { path, license: licensePath } of [
    ...skillNotices(),
    ...licensePaths.map((path) => ({ path, license: path })),
  ]) {
    const original = readBytes(path);
    const license = readBytes(licensePath);
    for (const replacement of [
      Buffer.alloc(0),
      Buffer.from(license.toString().replace("Copyright", "Altered copyright")),
    ]) {
      const changed = Buffer.from(
        original.toString().replace(license.toString(), replacement.toString()),
      );
      assert.throws(
        () =>
          checkNotices((requested) =>
            requested === path ? changed : readBytes(requested),
          ),
        assert.AssertionError,
        path,
      );
    }
  }
  const text = read("THIRD_PARTY_NOTICES.md");
  for (const target of licensePaths)
    assert.throws(
      () =>
        checkNotices((path) =>
          path === "THIRD_PARTY_NOTICES.md"
            ? Buffer.from(text.replace(target, "LICENSE"))
            : readBytes(path),
        ),
      assert.AssertionError,
      target,
    );
});

test("operations retaining third-party notices also retain every linked license", () => {
  const licenses = noticeLinks(read("THIRD_PARTY_NOTICES.md"));
  const resources = declaredOperations(root)
    .map(({ run }) => run.resources ?? [])
    .filter((paths) => paths.includes("THIRD_PARTY_NOTICES.md"));
  assert.ok(resources.length > 0);
  for (const paths of resources)
    for (const license of licenses) {
      assert.ok(
        paths.includes(license),
        `retain ${license} with third-party notices`,
      );
      assert.ok(existsSync(join(root, license)), `${license} exists`);
    }
});

test("the vendored Matt Pocock tree holds only owned skills' upstream bases and setup seeds, matching v1.3.1", () => {
  assert.equal(upstreamManifest.version, "1.3.1");
  assert.deepEqual(snapshotIdentity(root), {
    repository: "https://github.com/mattpocock/skills",
    tag: upstreamSnapshot.tag,
    commit: upstreamSnapshot.commit,
  });
  const { skills: sources, setupFiles } = basePaths(root);
  for (const seed of setupFiles)
    assert.match(seed, setupSeeds, `${seed} is a setup seed`);
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
  // UPSTREAM.json is Repo Canon's provenance record, not an upstream file.
  assert.deepEqual(
    snapshotFiles(snapshotRoot)
      .filter((path) => path !== "UPSTREAM.json")
      .sort(),
    retained.sort(),
  );
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

// A route is a `/name` invocation or a Skill tool call naming the skill in the
// same sentence, such as `call the Skill tool twice, for "a" and "b"`.
function routesTo(content, target) {
  const name = RegExp.escape(target);
  return (
    new RegExp(`/${name}(?![a-z0-9-])`).test(content) ||
    new RegExp(`Skill tool\\b[^.\\n]*?["\`]${name}["\`]`).test(content)
  );
}

// Owned skills are edited rather than overridden, so none routes to a skill
// that adoption does not install.
test("installed skills route to no uninstalled vendored skill", () => {
  const installed = declaredSkills();
  // An owned skill taken from upstream is installed under its upstream name.
  const uninstalled = upstreamManifest.skills
    .map((path) => basename(path))
    .filter((name) => !installed.some((skill) => skill.name === name));
  assert.ok(uninstalled.includes("setup-matt-pocock-skills"));
  for (const { name, source } of installed) {
    for (const path of snapshotFiles(join(root, source))) {
      const content = readFileSync(join(root, source, path), "utf8");
      for (const target of uninstalled)
        assert.ok(
          !routesTo(content, target),
          `${name} (${source}/${path}) routes to uninstalled ${target}; edit the owned skill instead of overriding the route`,
        );
    }
  }
});

test("the owned setup files install from themselves and record how they differ from their v1.3.1 seeds", () => {
  const declared = manifestDeclarations();
  const bases = JSON.parse(
    readFileSync(join(root, "upstream-bases.json"), "utf8"),
  ).files;
  for (const { target, seed, edited } of [
    { target: "docs/agents/domain.md", seed: "domain.md", edited: false },
    {
      target: "docs/agents/issue-tracker.md",
      seed: "issue-tracker-github.md",
      edited: true,
    },
    {
      target: "docs/agents/triage-labels.md",
      seed: "triage-labels.md",
      edited: true,
    },
  ]) {
    assert.ok(
      declared.some(
        (entry) => entry.target === target && entry.exact === target,
      ),
    );
    const sameAsSeed =
      createHash("sha256")
        .update(readFileSync(join(root, target)))
        .digest("hex") ===
      upstreamSnapshot.files[
        `skills/engineering/setup-matt-pocock-skills/${seed}`
      ];
    assert.equal(sameAsSeed, !edited, `${target} edited: ${edited}`);
    assert.equal(bases[target].edits === null, !edited, target);
  }
});

test("setup overrides have no second home in shared documents", () => {
  for (const document of [
    "CONTRIBUTING.md",
    "rules/github-repository-configuration.md",
    "rules/factory-workflow.md",
    "rules/documentation.md",
    "AGENTS.md",
    "docs/agents/README.md",
    ".agents/skills/triage/SKILL.md",
  ])
    assert.doesNotMatch(
      read(document).replaceAll(/\s+/g, " "),
      /take precedence over (?:its|the configuration's) upstream Meaning column|upstream tracker guide|precedence over the fallback/,
      document,
    );
  for (const [path, required] of [
    ["CONTRIBUTING.md", ["Triage", "Readiness"]],
    ["rules/factory-workflow.md", ["State labels"]],
  ]) {
    const headings = interpretMarkdown(read(path)).headings.map(
      ({ name }) => name,
    );
    for (const name of required)
      assert.ok(headings.includes(name), `${path}: ${name}`);
  }
});

test("the agent documentation index links the triage label mapping", () => {
  assert.ok(
    localLinks(
      root,
      "docs/agents/README.md",
      interpretMarkdown(read("docs/agents/README.md")).content.elements,
    ).some(
      ({ path, broken }) => path === "docs/agents/triage-labels.md" && !broken,
    ),
  );
});

test("the pr skill has a Related issue section", () => {
  assert.ok(
    interpretMarkdown(read(".agents/skills/pr/SKILL.md")).headings.some(
      ({ name, level }) => name === "Related issue" && level === 3,
    ),
  );
  assert.deepEqual(
    interpretMarkdown(read(".github/PULL_REQUEST_TEMPLATE.md")).headings.map(
      ({ name }) => name,
    ),
    ["Summary", "Evidence", "Merge Danger", "Related issue"],
  );
});

test("adoption installs the model-invocable babysit skill in place of deliver", () => {
  assert.deepEqual(
    declaredSkills().find((skill) => skill.name === "babysit"),
    { name: "babysit", source: ".agents/skills/babysit" },
  );
  assert.ok(!declaredSkills().some(({ name }) => name === "deliver"));
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
      "CREDITS.md",
      "SKILL.md",
      "body-links.mjs",
      "merge.mjs",
      "platform.mjs",
      "pull-request-reviewer.mjs",
      "request.mjs",
      "required-checks.mjs",
      "review-outcome.mjs",
      "review-policy.mjs",
      "reviewer.mjs",
      "trusted-review-config.mjs",
      "wait.mjs",
    ],
  );
});

test("adoption installs Repo Canon's own triage, with its retained files", () => {
  assert.deepEqual(
    declaredSkills().find((skill) => skill.name === "triage"),
    { name: "triage", source: ".agents/skills/triage" },
  );
  const owned = join(root, ".agents/skills/triage");
  assert.deepEqual(snapshotFiles(owned).sort(), [
    "AGENT-BRIEF.md",
    "CREDITS.md",
    "OUT-OF-SCOPE.md",
    "SKILL.md",
    "agents/openai.yaml",
    "ready.mjs",
  ]);
  assert.ok(
    existsSync(join(snapshotRoot, "skills/engineering/triage/SKILL.md")),
    "the vendored snapshot keeps triage's upstream base",
  );
  // The files triage keeps unchanged still match the upstream base's bytes.
  for (const path of ["OUT-OF-SCOPE.md", "agents/openai.yaml"])
    assert.equal(
      createHash("sha256")
        .update(readFileSync(join(owned, path)))
        .digest("hex"),
      upstreamSnapshot.files[`skills/engineering/triage/${path}`],
      `${path} is unchanged from ${upstreamSnapshot.tag}`,
    );
});

test("only workbench installs orchestrate, while Canon retains its complete standalone source", () => {
  for (const [profile, selected] of Object.entries(declarations(root))) {
    assert.deepEqual(
      selected
        .filter(({ kind }) => kind === "skill")
        .map(({ name }) => name)
        .sort(),
      workflowSkills.filter((name) =>
        profile === "workbench"
          ? name !== "factory"
          : ![
              "create-adopted-repo",
              "create-repository",
              "orchestrate",
            ].includes(name) &&
            (profile === "factory" || name !== "factory"),
      ),
      `${profile} skill membership`,
    );
  }
  assert.deepEqual(
    declaredSkills().find((skill) => skill.name === "orchestrate"),
    { name: "orchestrate", source: ".agents/skills/orchestrate" },
  );
  const directory = join(root, ".agents/skills/orchestrate");
  assert.deepEqual(snapshotFiles(directory).sort(), [
    "CREDITS.md",
    "SKILL.md",
    "agents/openai.yaml",
    "records.mjs",
    "references/close.md",
    "references/intake.md",
    "references/launches.md",
    "references/templates.md",
    "wait.mjs",
  ]);
  const frontmatter =
    /^---\n([\s\S]*?)\n---\n/.exec(
      readFileSync(join(directory, "SKILL.md"), "utf8"),
    )?.[1] ?? "";
  assert.match(frontmatter, /^name: orchestrate$/m);
  assert.match(frontmatter, /^description: \S/m);
  assert.match(frontmatter, /^disable-model-invocation: true$/m);
  assert.match(
    readFileSync(join(directory, "agents/openai.yaml"), "utf8"),
    /^ {2}allow_implicit_invocation: false$/m,
  );
});

// The core holds the purpose, the workbench files, the lifecycle, the wait
// step and the report-back rule; templates, launches and Close live in the
// references it links (#790).
const orchestrateCoreLineLimit = 120;

test("orchestrate keeps its core within its line limit and links its references", () => {
  const path = ".agents/skills/orchestrate/SKILL.md";
  const core = read(path);
  const lines = core.replace(/\n$/, "").split("\n").length;
  assert.ok(
    lines <= orchestrateCoreLineLimit,
    `${path} has ${lines} lines; the limit is ${orchestrateCoreLineLimit}`,
  );
  const document = interpretMarkdown(core);
  const links = localLinks(root, path, document.content.elements);
  for (const name of orchestrateReferences)
    assert.ok(
      links.some(
        (link) =>
          link.path === `.agents/skills/orchestrate/references/${name}` &&
          !link.broken,
      ),
      `links ${name}`,
    );
  for (const section of [
    "Workbench",
    "Lifecycle",
    "The wait step",
    "Report-back",
  ])
    assert.ok(
      document.headings.some(
        ({ name, level }) => name === section && level === 2,
      ),
      section,
    );
  assert.ok(
    marked
      .lexer(core)
      .flatMap((token) => token.tokens ?? [])
      .some((token) => token.type === "codespan" && token.text === "factory"),
  );
});

test("all hand launches share one invocation-and-context template", () => {
  const tokens = marked.lexer(
    read(".agents/skills/orchestrate/references/launches.md"),
  );
  const templates = tokens.filter(
    (token) => token.type === "code" && token.lang === "text",
  );
  assert.equal(templates.length, 1);
  const [invocation, ...body] = templates[0].text.split("\n");
  assert.equal(invocation, "<skill invocation>");
  assert.deepEqual(
    body
      .filter((line) => /^[A-Z][^:]+:/.test(line))
      .map((line) => line.split(":")[0]),
    [
      "Issues",
      "Evidence",
      "Recorded decisions",
      "Scope",
      "Workspace",
      "Plan references",
      "Model",
      "Effective effort",
      "Launch report",
    ],
  );
  assert.ok(templates[0].text.endsWith("status: done"));
  const sections = new Map();
  let section;
  for (const token of tokens) {
    if (token.type === "heading" && token.depth === 2) {
      section = token.text;
      sections.set(section, []);
    } else if (section) sections.get(section).push(token);
  }
  /** @type {[string, string[]][]} */
  const launches = [
    ["Triage run", ["/triage"]],
    ["Grill", ["/grill-with-docs"]],
    ["Publication and review", ["/to-spec", "/to-tickets", "/review"]],
    ["Worker", ["/implement"]],
    ["Architecture review", ["/improve-codebase-architecture"]],
    ["Handover", ["/orchestrate"]],
    ["Retro", []],
  ];
  for (const [name, commands] of launches) {
    const role = sections.get(name);
    assert.ok(role, name);
    assert.ok(
      !role.some((token) => token.type === "code"),
      `${name} uses the shared template`,
    );
    const spans = role
      .flatMap((token) => token.tokens ?? [])
      .filter((token) => token.type === "codespan")
      .map((token) => token.text);
    for (const command of commands)
      assert.ok(spans.includes(command), `${name}: ${command}`);
  }
});

test("orchestration text stays within its per-file and total budgets", () => {
  const paths = [
    "SKILL.md",
    ...orchestrateReferences.map((name) => `references/${name}`),
  ];
  let total = 0;
  for (const path of paths) {
    const lines = read(`.agents/skills/orchestrate/${path}`)
      .trimEnd()
      .split("\n").length;
    assert.ok(lines <= 200, `${path}: ${lines} > 200`);
    total += lines;
  }
  // Revision 2 recorded 686 orchestration lines before this rewrite.
  assert.ok(total < 686, `orchestration text grew to ${total} lines`);
  const architectureText = read(
    ".agents/skills/improve-codebase-architecture/SKILL.md",
  );
  const architectureLines = architectureText.trimEnd().split("\n").length;
  assert.ok(architectureLines <= 200);
  assert.ok(total + architectureLines <= 686 + 90, "net skill text grows");
  const architecture = interpretMarkdown(architectureText);
  const headings = architecture.headings.map(({ name }) => name);
  assert.ok(headings.includes("Orchestrated launch"));
  assert.ok(
    headings.indexOf("Orchestrated launch") < headings.indexOf("Process"),
  );
});

// Check the whole installed directory and the shared delegation guidance.
// The only exempt test source is this exact detector declaration; comments,
// strings and assertions elsewhere in the test remain subject to the scan.
const privateOrchestrationNames =
  /\bT3(?:\b|code)|\bt3_|\bt3:|delegate_task|schedule_task|watch_pull_request/i;

test("shared orchestration material excludes private application mappings everywhere", () => {
  const directory = join(root, ".agents/skills/orchestrate");
  const paths = [
    ...snapshotFiles(directory).map(
      (path) => `.agents/skills/orchestrate/${path}`,
    ),
    "authoring-notes.md",
    "docs/usage/adopt-repo-canon.md",
    "docs/development/README.md",
    "AGENTS.md",
    "CONTRIBUTING.md",
    ".agents/skills/triage/SKILL.md",
    "test/repository-conformance.test.mjs",
    "scripts/create-planning-skill-fixtures.mjs",
    "test/planning-skill-fixtures.test.mjs",
    "docs/development/skill-exercises.md",
  ];
  for (const path of paths) {
    let text = readFileSync(join(root, path), "utf8");
    if (path === "test/repository-conformance.test.mjs") {
      const detector = `const privateOrchestrationNames =\n  ${privateOrchestrationNames};`;
      assert.equal(
        text.split(detector).length,
        2,
        "one exact detector declaration",
      );
      text = text.replace(detector, "");
    }
    assert.doesNotMatch(text, privateOrchestrationNames, path);
  }
});

test("factory image rules discover released documentation through configuration", () => {
  assert.match(read("rules/factory-sandbox-image.md"), /\$schema/);
  assert.doesNotMatch(
    read("rules/factory-sandbox-image.md"),
    /scriptorium-v2\.0\.0/,
  );
  const configuration = JSON.parse(read(".scriptorium/config.json"));
  assert.equal(
    configuration.$schema,
    "https://raw.githubusercontent.com/lutzseverino/scriptorium/scriptorium-v4.1.0/schemas/factory-configuration.schema.json",
  );
});

test("babysit leaves review and no-check outcome rules to the GitHub rules", () => {
  assert.doesNotMatch(
    read(".agents/skills/babysit/SKILL.md"),
    /comments on it that the configured reviewer|fully or partly|minutes of the latest review request|unfinished/,
  );
});

test("readiness mechanics and brief syntax live only in the GitHub rules", () => {
  assert.doesNotMatch(
    read("CONTRIBUTING.md"),
    /issue_id|node_id|`admin`|`maintain`|`triage` role|brief's heading comes right after/,
  );
});

test("delivery and triage requirements keep their single homes", () => {
  /** @type {[string[], RegExp][]} */
  const homes = [
    [
      [
        "CONTRIBUTING.md",
        ".agents/skills/babysit/SKILL.md",
        ".agents/skills/implement/SKILL.md",
      ],
      /factory:skip/,
    ],
    [
      [".agents/skills/babysit/SKILL.md", ".agents/skills/implement/SKILL.md"],
      /factory:needs-input/,
    ],
    [
      [".agents/skills/orchestrate/SKILL.md"],
      /Never infer a default|readiness label|`state:ready`/,
    ],
    [
      [".agents/skills/triage/SKILL.md"],
      /Never infer a default|Reversible within the work|one channel (?:for questions )?to the owner|never write a brief you accept|applies no readiness|cites only records in the repository/i,
    ],
    [
      [
        ".agents/skills/triage/SKILL.md",
        ".agents/skills/orchestrate/SKILL.md",
        ".agents/skills/orchestrate/references/launches.md",
      ],
      /The grill calls the Skill tool twice|updates `GLOSSARY\.md` and ADRs inline|in short rounds of numbered questions|one question at a time/,
    ],
    [
      ["CONTRIBUTING.md"],
      /request\.onOpen|request\.comment|reviewRequests|fully or partly|request bound|request phrase/,
    ],
    [
      [".agents/skills/babysit/SKILL.md"],
      /ticket or scope|another layer|only the owner writes/,
    ],
    [
      ["rules/factory-workflow.md"],
      /Owner review is required when either|Before merging a designated PR|Any head change requires renewed owner approval/,
    ],
  ];
  for (const [paths, phrase] of homes)
    for (const path of paths)
      assert.doesNotMatch(read(path).replaceAll(/\s+/g, " "), phrase, path);
  for (const file of ["request.mjs", "wait.mjs", "merge.mjs"])
    assert.doesNotMatch(
      read(`.agents/skills/babysit/${file}`),
      /update-branch|updateBranch/,
    );
});

// GitHub's heading anchor: lowercase, punctuation dropped, spaces hyphenated.
const headingAnchor = (name) =>
  name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s/g, "-");

test("every skill step's comment rules section exists", () => {
  const anchors = interpretMarkdown(read("rules/comments.md")).headings.map(
    ({ name }) => headingAnchor(name),
  );
  const named = [];
  for (const { source } of declaredSkills())
    for (const path of readdirSync(join(root, source), { recursive: true }))
      if (String(path).endsWith(".md"))
        for (const [, anchor] of read(join(source, String(path))).matchAll(
          /\.repo-standards\/rules\/comments\.md#([\w-]+)/g,
        )) {
          named.push(anchor);
          assert.ok(anchors.includes(anchor), `${source}/${path}: #${anchor}`);
        }
  for (const skill of ["babysit", "factory", "orchestrate", "triage"])
    assert.ok(
      readdirSync(join(root, ".agents/skills", skill), { recursive: true })
        .filter((path) => String(path).endsWith(".md"))
        .some((path) =>
          read(join(".agents/skills", skill, String(path))).includes(
            ".repo-standards/rules/comments.md#",
          ),
        ),
      `${skill} names the comment rules' sections`,
    );
  assert.ok(named.length > 0);
});

test("the disclaimer lines live only in the comment rules and the shapes checks enforce", () => {
  const owners = ["rules/comments.md"];
  const documents = [
    "CONTRIBUTING.md",
    ...readdirSync(join(root, "rules")).map((name) => `rules/${name}`),
    ...declaredSkills().flatMap(({ source }) =>
      readdirSync(join(root, source), { recursive: true })
        .filter((path) => String(path).endsWith(".md"))
        .map((path) => join(source, String(path))),
    ),
  ];
  for (const path of documents.filter((path) => !owners.includes(path)))
    assert.doesNotMatch(read(path), /This was generated by AI/, path);
});

test("the comment rules' review template is the review merge accepts", () => {
  const head = "c".repeat(40);
  const reviews = interpretMarkdown(read("rules/comments.md"))
    .sections(["Reviews"])
    .values()
    .next().value[0];
  const template = marked
    .lexer(reviews.source)
    .find(({ type }) => type === "code").text;
  const unfilled = template.replace("<full head SHA>", head);
  assert.equal(completeReview(unfilled, head), false);
  const filled = unfilled
    .replace(/^(Standards|Spec): <.*>$/gm, "$1: Passed.")
    .replace(/^Fixed: <.*>$/m, "Fixed: Nothing")
    .replace(/^Findings: <.*>$/m, "Findings:")
    .replace(/^- `<path>:<line>` <.*>$/m, "- `rules/comments.md:1` a finding");
  assert.equal(completeReview(filled, head), true);
});

test("the comment rules' triage disclaimer example passes the issue-contract check", () => {
  const document = interpretMarkdown(read("rules/comments.md"));
  const policy = document.sections(["Disclaimers"]).values().next().value[0];
  const examples = marked
    .lexer(policy.source)
    .filter(({ type }) => type === "code");
  const triageLine = examples
    .map(({ text }) => text)
    .find((text) => text.includes("during triage"));
  assert.ok(triageLine);
  const decision = decideIssueContract({
    repository,
    event: { issue: { number: 42 } },
    issue: {
      number: 42,
      body: featureBody,
      labels: [{ name: "type:enhancement" }, { name: "state:triage" }],
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
