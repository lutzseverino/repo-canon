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
  assert.ok(!defaults.includes("factory-workflow"));
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

      factory-workflow:
        kind: repository
        rules: rules/factory-workflow.md
        guidance: guidance/factory-workflow.md
        discovery: discovery/factory-workflow.md

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

test("both profiles inherit the exact standards update workflow from defaults", () => {
  const declarations = readFileSync(join(root, "standards.yaml"), "utf8");
  const defaults = /^defaults:\n([\s\S]*?)^profiles:\n/m.exec(declarations)[1];
  assert.match(
    defaults,
    /^ {4}standards-update-workflow:\n {6}kind: file\n {6}target: \.github\/workflows\/standards-update.yml\n {6}exact: \.github\/workflows\/standards-update.yml$/m,
  );
  for (const profile of ["standard", "factory"])
    assert.doesNotMatch(
      profileDeclarations(declarations, profile),
      /standards-update-workflow:/,
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
  "factory-workflow": "both",
  "factory-sandbox-image": "both",
  "git-attributes": "both",
  "github-repository-configuration": "both",
  "project-agent-guidance": "both",
  "project-readmes": "both",
  "repository-license": "both",
  "repository-readme": "both",
  "typescript-node-stack": "both",
};

test("self-adoption leaves Repo Canon's own installed source unvendored", () => {
  const paths = [
    "scripts/validate-issue-contract.mjs",
    "scripts/validate.mjs",
    "operations/lib/rendered-markdown.mjs",
    ".agents/skills/triage/ready.mjs",
    ...readdirSync(join(root, ".agents/skills/babysit"))
      .filter((name) => name.endsWith(".mjs"))
      .map((name) => `.agents/skills/babysit/${name}`),
  ];
  const attributes = execFileSync(
    "git",
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
    /The `github-repository-configuration` rules state when a head with no check counts as passed, and, for the optional repository-owned `\.github\/pull-request-reviewer\.json`, its schema, review requests, and merging with or without the configured reviewer's review/,
  );
  assert.doesNotMatch(guide, /`babysit`\]\([^)]*\) documents its schema/);
  assert.match(
    rules,
    /`bounds\.reviewRequests`: optional positive integer; the total request bound defined under \[review requests\]\(#review-requests\)/,
  );
  assert.doesNotMatch(rules, /contribution guide's Merging section/);
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

test("adoption and babysit keep the policy reader byte-identical", () => {
  assert.deepEqual(
    readFileSync(join(root, "operations/lib/review-policy.mjs")),
    readFileSync(join(root, ".agents/skills/babysit/review-policy.mjs")),
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

test("the GitHub guidance leaves the reviewer file to a separate commit after the run", () => {
  const guidance = flowedText("guidance/github-repository-configuration.md");
  const section = guidance.slice(
    guidance.indexOf("## Pull request reviewer"),
    guidance.indexOf("## Installed workflow runners"),
  );
  assert.match(section, /not adoption output/);
  assert.match(section, /the run leaves the file untouched/);
  assert.match(
    section,
    /in a separate commit after the run completes, following the schema in the rules/,
  );
  assert.match(section, /never in the adoption commit or pull request/);
  assert.doesNotMatch(section, /Decide whether the repository adds/);
  assert.doesNotMatch(section, /choose a reviewer, or leave the file absent/);
});

test("AGENTS.md names no rules path", () => {
  assert.doesNotMatch(
    readFileSync(join(root, "AGENTS.md"), "utf8"),
    /\.repo-standards\/rules|(?:^|[\s(`"'/])rules\/[\w.-]+|repo-standards rules\b/m,
  );
});

// Word budgets keep growth of the two entry documents visible in review. A word
// is a maximal run of non-whitespace characters in the file's UTF-8 text, so
// Markdown syntax, punctuation, and code spans count as written and no word is
// split or merged by hyphens, slashes, or backticks. Each limit is the document's
// count after the last held rules move (#517, #518). Raising one is a deliberate
// edit here in the same pull request; never derive a limit from the document.
const wordBudgets = {
  // Raised from 1970 for the Triage section (#500), then from 2263 for the
  // adoption pull request's pre-commit verdict (#540), then for automated
  // update titles (#561), then for the inference test, the grill flow and
  // question routing (#595), then for prescribed merge-role handoffs (#609).
  "CONTRIBUTING.md": 2713,
  "AGENTS.md": 108,
};

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

test("standards.yaml declares no pull request reviewer file", () => {
  assert.doesNotMatch(
    readFileSync(join(root, "standards.yaml"), "utf8"),
    /pull-request-reviewer\.json/,
  );
});

// The shipped configuration targets factory configuration version 1, whose
// schema Scriptorium documents: exactly these fields, six labels, the skip
// label among them, distinct ignoring case, and a prompt holding both `{skillPrefix}` and `{issue}`. This
// repository imports no factory code; the exact shape pins the file.
test("the factory configuration names Repo Canon's labels, model label prefix, and implement prompt", () => {
  const configuration = JSON.parse(
    readFileSync(join(root, ".factory/config.json"), "utf8"),
  );
  const labels = Object.values(configuration.labels);
  assert.ok(labels.every((label) => typeof label === "string" && label.trim()));
  assert.equal(
    new Set(labels.map((label) => label.toLowerCase())).size,
    labels.length,
  );
  assert.match(configuration.prompt, /\{skillPrefix\}/);
  assert.match(configuration.prompt, /\{issue\}/);
  assert.deepEqual(configuration, {
    version: 1,
    labels: {
      ready: "ready-for-agent",
      skip: "factory:skip",
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

// Adoption installs only workflow skills, as ADR 0018 decides: 16 pinned
// upstream skills, Repo Canon's own babysit and orchestrate, and its triage
// fork (ADR 0021).
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
  "orchestrate",
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
  // A forked skill is installed under its upstream name from its own source.
  const uninstalled = upstreamManifest.skills
    .map((path) => basename(path))
    .filter((name) => !installed.some((skill) => skill.name === name));
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

test("installed label rules override upstream meanings while retaining configured label strings", () => {
  const github = flowedText("rules/github-repository-configuration.md");
  const labels = /## Labels (.*?) ## Merge settings/.exec(github)?.[1] ?? "";
  for (const requirement of [
    /`docs\/agents\/triage-labels\.md` maps canonical roles to tracker label strings; use the configured string for each role/,
    /Role meanings in these rules and the contribution guide take precedence over its upstream Meaning column, including the conflicting `needs-info` and `ready-for-human` entries/,
    /For `needs-info`, follow the contribution guide's Triage section for question routing and its inference test/,
    /Agent work follows the agent path; where factory workflow rules are installed, follow them for factory pickup exclusions/,
  ])
    assert.match(labels, requirement);
});

test("configuration and triage pointers distinguish label mapping from authoritative meanings", () => {
  assert.match(
    flowedText("docs/agents/README.md"),
    /\[Triage labels\]\(triage-labels\.md\): the label strings for the five canonical triage roles\. For role meanings, follow the installed `github-repository-configuration` rules and the contribution guide/,
  );
  assert.match(
    flowedText(".agents/skills/triage/SKILL.md"),
    /The actual label strings are in the triage label configuration, `docs\/agents\/triage-labels\.md`\. For role meanings, follow the installed `github-repository-configuration` rules and the contribution guide; they take precedence over the configuration's upstream Meaning column/,
  );
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
      "platform.mjs",
      "pull-request-reviewer.mjs",
      "request.mjs",
      "review-policy.mjs",
      "reviewer.mjs",
      "trusted-review-config.mjs",
      "wait.mjs",
    ],
  );
});

test("adoption installs Repo Canon's triage fork, which credits its upstream and leaves the pin", () => {
  const declarations = readFileSync(join(root, "standards.yaml"), "utf8");
  assert.match(
    declarations,
    /\n {4}skill-triage:\n {6}kind: skill\n {6}name: triage\n {6}source: \.agents\/skills\/triage\n/,
  );
  const fork = join(root, ".agents/skills/triage");
  assert.deepEqual(snapshotFiles(fork).sort(), [
    "AGENT-BRIEF.md",
    "CREDITS.md",
    "OUT-OF-SCOPE.md",
    "SKILL.md",
    "agents/openai.yaml",
    "ready.mjs",
  ]);
  assert.ok(
    !existsSync(join(snapshotRoot, "skills/engineering/triage")),
    "the forked skill leaves the vendored snapshot",
  );
  // The files the fork keeps unchanged still match the pinned upstream bytes.
  for (const path of ["OUT-OF-SCOPE.md", "agents/openai.yaml"])
    assert.equal(
      createHash("sha256")
        .update(readFileSync(join(fork, path)))
        .digest("hex"),
      upstreamSnapshot.files[`skills/engineering/triage/${path}`],
      `${path} is unchanged from ${upstreamSnapshot.tag}`,
    );
  const credits = flowedText(".agents/skills/triage/CREDITS.md");
  assert.ok(credits.includes(upstreamSnapshot.commit));
  assert.match(credits, /tag `v1\.3\.1`/);
  assert.match(credits, /`\.agents\/skills\/LICENSE\.mattpocock-skills`/);
  assert.match(
    flowedText("THIRD_PARTY_NOTICES.md"),
    /Repo Canon's `triage` skill is a fork of the collection's `triage` skill and keeps the forked material under the same notice/,
  );
});

test("the guide, the installed rules and the triage skill route by uncertainty and accept only reviewed briefs", () => {
  const guide = flowedText("CONTRIBUTING.md");
  const triage = /## Triage (.*?) ## Readiness/.exec(guide)?.[1] ?? "";
  for (const requirement of [
    /routes an intake request by where its uncertainty lies, not by its category label/,
    /A request is code-bound when its expected result is clear/,
    /It is intent-bound when an open question needs the owner's intent, a policy, or a trade-off they choose/,
    /including for a bug/,
    /Missing evidence or access never licenses inventing policy/,
    /the research run verifies the claim and posts the Agent Brief/,
    /The orchestrating agent runs triage and starts a research run, a separate agent, for each request/,
    /it first gathers the facts from the code/,
    /Under the inference test, the orchestrating agent may answer an intent question itself only when all three hold: it can cite the answer's source, the owner's approved goal for the work, a recorded owner decision or wish, or the owner's quoted words, each with its date/,
    /the choice is reversible within that work, so no value or policy outlives it, and it adds no public name and no breaking change; and it changes neither the goal nor the scope/,
    /A default, limit, timeout, or fallback that persists in the product is never inferred/,
    /its triage notes list it with its citation under \*\*Inferred intent\*\*/,
    /lists every inferred answer in its next report to the owner, so the owner can veto it\. A veto is an owner decision, and the brief is revised from it/,
    /Questions it cannot infer go to a separate grilling session with the owner, in short rounds of numbered questions, each with a recommended answer/,
    /The grill records the owner's decisions and drafts the Agent Briefs in a proposed ticket split; it files no issue and applies no readiness/,
    /The orchestrating agent decides the split: it may merge, split, or drop a draft, or set it aside for later work/,
    /each issue's triage notes record the owner decisions its brief relies on, each with its date and where the owner gave it/,
    /A recorded decision is not asked again/,
    /The orchestrating agent never writes a brief it accepts: when its split changes a draft substantially, the grill rewrites that brief, and a research run writes one only when it needs code facts the grill did not gather/,
    /The orchestrating agent, never the agent that wrote the brief, then reviews/,
    /Passing the structure check never makes a brief hold/,
    /an implementation choice, an option list, or a fallback value, does not hold/,
    /an unanswered required question blocks acceptance/,
    /accepts a brief that holds by applying readiness to its revision, records its blockers, and tells the owner with links/,
    /When the revision notice never arrives, or its credentials cannot apply readiness, it leaves readiness to the owner/,
    /Every question reaches the orchestrating agent first\. `needs-info` means information is missing/,
    /a question for an outside reporter still goes to the reporter/,
    /A question only the owner can answer goes into its decision inbox with its recommendation; the decision inbox is the one channel for questions to the owner/,
    /When the owner runs triage themselves, they are the orchestrating agent/,
  ])
    assert.match(triage, requirement);
  const comments = /## Comments (.*)$/.exec(guide)?.[1] ?? "";
  assert.match(
    comments,
    /The orchestrating agent reads the question first: when it can answer under the \[triage\]\(#triage\) inference test, it answers on the issue; otherwise it puts the question in its decision inbox/,
  );
  const github = flowedText("rules/github-repository-configuration.md");
  for (const requirement of [
    /An orchestrating agent that accepts an Agent Brief applies its readiness only when the credentials it was given hold one of these roles, and only after the issue-contract workflow's revision notice for the brief revision it reviewed/,
    /With other credentials, or without that notice, it applies no readiness and leaves readiness to the owner/,
    /The run that wrote the brief never applies its readiness/,
    /an edit to the brief removes it until the new revision is reviewed/,
  ])
    assert.match(github, requirement);
  const factory = flowedText("rules/factory-workflow.md");
  for (const requirement of [
    /An orchestrating agent that accepts the brief is that reviewer: it chooses the label itself/,
    /the research run that suggested it applies no label/,
    /The factory accepts readiness only from a person/,
    /tells the owner, with links, that the brief it accepted waits for a person's readiness, even when its own readiness stands under the GitHub rules/,
    /It never reports that its own readiness started a run/,
    /The question reaches the orchestrating agent first, as those rules say: it answers on the issue when the triage inference test lets it, and otherwise puts the question in its decision inbox for the owner/,
    /With no open pull request, whoever answers, the orchestrating agent or the owner, removes the label/,
  ])
    assert.match(factory, requirement);
  const skill = flowedText(".agents/skills/triage/SKILL.md");
  for (const method of [
    /### Code-bound path/,
    /### Intent-bound path/,
    /### Accept a brief that holds/,
    /Passing the issue-contract check proves the shape, never that the brief holds/,
    /Leave readiness, labels, and the judgment of its brief to yourself/,
    /Every research run, on either path, does two checks first/,
    /The grill calls the Skill tool twice, for "grilling" and "domain-modeling"/,
    /It skips every question a recorded owner decision already answers/,
    /accept only once every one the owner must answer is answered/,
    /`needs-info`: information is missing; you, the orchestrating agent, answer it or route it/,
    /`needs-info` returns to `needs-triage` once the missing information arrives: your own answer, the reporter's reply, or the owner's decision/,
    /## Route questions/,
    /The decision inbox is the one channel for questions to the owner/,
    /Never infer a default, limit, timeout, or fallback that persists in the product/,
    /It files no issue and applies no readiness/,
    /never write or rewrite one yourself/,
    /If no notice arrives, leave readiness to the owner/,
  ])
    assert.match(skill, method);
  // The owner's amendment withdrew the rule that the owner finishes every
  // brief; nothing restates it.
  for (const document of [
    "CONTRIBUTING.md",
    "rules/github-repository-configuration.md",
    "rules/factory-workflow.md",
    ".agents/skills/triage/SKILL.md",
    ".agents/skills/triage/AGENT-BRIEF.md",
  ])
    assert.doesNotMatch(
      flowedText(document),
      /owner (?:must )?finish(?:es)? (?:every|each|the) brief|never applies readiness or `model:` labels to a briefed issue/i,
      document,
    );
  assert.doesNotMatch(skill, /setup-matt-pocock-skills/);
  assert.doesNotMatch(skill, /waiting on reporter|once the reporter replies/);
  assert.match(
    flowedText(".agents/skills/triage/AGENT-BRIEF.md"),
    /\*\*Inferred intent\*\*: each answer the orchestrating agent inferred under the inference test, which the brief states as behavior, with its citation/,
  );
});

test("brief writers receive and record an existing owner-review reservation with its source", () => {
  const skill = flowedText(".agents/skills/triage/SKILL.md");
  const context =
    /1\. \*\*Gather context\.\*\* (.*?) Every research run/.exec(skill)?.[1] ??
    "";
  assert.match(
    context,
    /Pass any recorded owner-review reservation and its dated source to the brief's writer on either path/,
  );
  const brief = flowedText(".agents/skills/triage/AGENT-BRIEF.md");
  assert.match(
    brief,
    /When the owner has reserved review before merge, state that designation as contract behavior and retain its dated decision source in the triage notes for the worker's PR handoff/,
  );
  assert.match(
    brief,
    /Use the recorded reservation, not a routing label, as its source/,
  );
  assert.match(
    brief,
    /\*\*Owner decisions\*\*: each decision the brief relies on, including any owner-review reservation, with its date and a link to where the owner gave it/,
  );
  assert.doesNotMatch(brief, /factory:skip/);
});

test("owner-review routing returns an incomplete brief to its writer before accepting a new revision", () => {
  const skill = flowedText(".agents/skills/triage/SKILL.md");
  const acceptance =
    /### Accept a brief that holds (.*?) ## Other outcomes/.exec(skill)?.[1] ??
    "";
  assert.match(
    acceptance,
    /When owner review before merge is the reason for bypassing factory pickup, verify that the brief explicitly designates it as contract behavior and its triage notes retain the dated decision source/,
  );
  assert.match(
    acceptance,
    /Check this even when that reason first arises here, after the initial brief review/,
  );
  assert.match(
    acceptance,
    /If the designation or its source is missing or unclear, return the brief to its writer with the recorded reservation and source; the writer corrects it/,
  );
  assert.match(
    acceptance,
    /Independently review the corrected brief from the top, then return to step 1 for its new validator revision notice before applying readiness/,
  );
  assert.match(acceptance, /Never write or rewrite the brief you accept/);
});

test("triage keeps workflow-only skips undesignated and factory routing conditional on installed rules", () => {
  const skill = flowedText(".agents/skills/triage/SKILL.md");
  const acceptance =
    /### Accept a brief that holds (.*?) ## Other outcomes/.exec(skill)?.[1] ??
    "";
  assert.match(
    acceptance,
    /For workflow-edit-only work without a separate owner-review designation, follow the ordinary applicable merge conditions in the installed rules; the skip marker alone supplies no designation/,
  );
  assert.match(acceptance, /Without those rules there is no skip label/);
  assert.doesNotMatch(flowedText("CONTRIBUTING.md"), /factory:skip/);
});

test("adoption installs Repo Canon's user-invoked orchestrate skill, which credits chief-of-staff", () => {
  const declarations = readFileSync(join(root, "standards.yaml"), "utf8");
  assert.match(
    declarations,
    /\n {4}skill-orchestrate:\n {6}kind: skill\n {6}name: orchestrate\n {6}source: \.agents\/skills\/orchestrate\n/,
  );
  const directory = join(root, ".agents/skills/orchestrate");
  assert.deepEqual(snapshotFiles(directory).sort(), [
    "CREDITS.md",
    "SKILL.md",
    "agents/openai.yaml",
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
  const credits = flowedText(".agents/skills/orchestrate/CREDITS.md");
  assert.match(
    credits,
    /`chief-of-staff` skill in \[Matt Pocock's skills\]\(https:\/\/github\.com\/mattpocock\/skills\), compared at commit `5beb35b040e3de97e54fa9e386d7e42d15c295c2`/,
  );
  const skill = flowedText(".agents/skills/orchestrate/SKILL.md");
  // A method that cites the contribution guide rather than restating it.
  assert.match(
    skill,
    /contribution guide, `CONTRIBUTING\.md`, decides triage, readiness, question routing and delivery/,
  );
  assert.doesNotMatch(
    skill,
    /Never infer a default|readiness label|`ready-for-agent`/,
  );
});

test("orchestrate wishes preserve mandatory Findings reporting", () => {
  const skill = flowedText(".agents/skills/orchestrate/SKILL.md");
  const wish = flowedText("GLOSSARY.md")
    .split("**Wish**:")[1]
    .split("_Avoid_:")[0];

  assert.doesNotMatch(
    skill,
    /owner's quoted words or the finding|A defect others need to see may still be filed|\*\*Wish:\*\* it lies outside the goal\. Add it to `wishes\.md`, and file no issue/,
  );
  assert.doesNotMatch(wish, /or the finding|instead of an issue/);
  assert.match(skill, /contribution guide's Findings section/);
  assert.match(
    skill,
    /first link an existing open issue reporting the finding; otherwise file it/,
  );
  assert.match(
    skill,
    /A wish never replaces the finding's tracker record or reporting links/,
  );
  assert.match(
    skill,
    /\*\*Wish:\*\* it lies outside the goal and is not a Finding/,
  );
  assert.match(skill, /A wish may link a filed finding for future planning/);
  assert.match(
    skill,
    /One line per wish: the date, the owner's quoted words or idea, a link to its source, and the repository it concerns/,
  );
  assert.match(wish, /non-finding idea outside its plan's goal/);
  assert.match(wish, /may link a reported finding for future planning/);

  // The method defers to the installed rule for the full reporting contract.
  const findings = flowedText("CONTRIBUTING.md")
    .split("## Findings ")[1]
    .split("## Titles and commits")[0];
  for (const requirement of [
    "Fix defects inside the change's responsibility in the change",
    "check for an open issue that already reports the finding and link it",
    "one issue per finding through the target repository's issue forms, labelled `needs-triage`",
    "repository responsible for the affected material or tooling",
    "distinguishes what the run observed from what it only read in code",
    "links them from a comment on that pull request",
    "links them from the issue it was working on",
    "lists them in its final message",
    "If filing fails, list each unfiled finding",
    "Findings never block or delay",
  ])
    assert.ok(findings.includes(requirement), requirement);
});

// The orchestrate skill and its workbench stay harness-neutral; its last
// section alone maps the steps to one harness's tools.
const harnessSection = "## With T3 Code";
const harnessNames =
  /\bT3(?:\b|code)|\bt3_|\bt3:|delegate_task|schedule_task|watch_pull_request/i;

function outsideHarnessSection(content) {
  const sections = content.split(/^(?=## )/m);
  const last = sections.at(-1);
  return last.startsWith(`${harnessSection}\n`)
    ? sections.slice(0, -1).join("")
    : content;
}

test("the orchestrate skill names its harness and that harness's tools only in its closing section", () => {
  const directory = join(root, ".agents/skills/orchestrate");
  const skill = readFileSync(join(directory, "SKILL.md"), "utf8");
  assert.equal(
    skill.split(/^## /m).at(-1).split("\n")[0],
    harnessSection.slice(3),
    "the harness section closes the skill",
  );
  for (const path of snapshotFiles(directory)) {
    const content = readFileSync(join(directory, path), "utf8");
    const outside =
      path === "SKILL.md" ? outsideHarnessSection(content) : content;
    assert.doesNotMatch(outside, harnessNames, path);
  }
  for (const [label, content] of [
    ["a tool name", "Start workers with `delegate_task`."],
    ["the harness", "Open grills on T3 Code."],
    ["the harness as one word", "Open grills on T3code."],
    ["a thread reference", "Record it as `t3:<id>`."],
    ["a t3_ tool", "Send with `t3_thread_send`."],
  ])
    assert.match(
      outsideHarnessSection(
        `# Skill\n\n## Steps\n\n${content}\n\n${harnessSection}\n\nTools.\n`,
      ),
      harnessNames,
      `${label} outside the closing section is caught`,
    );
  assert.doesNotMatch(
    outsideHarnessSection(
      `# Skill\n\n## Steps\n\nWork.\n\n${harnessSection}\n\nUse \`delegate_task\`.\n`,
    ),
    harnessNames,
  );
});

test("babysit and the factory image rules name both supported Node.js majors", () => {
  const babysit = flowedText(".agents/skills/babysit/SKILL.md");
  const rules = flowedText("rules/factory-sandbox-image.md");
  assert.match(babysit, /scripts require Node\.js 24 or 26\./);
  assert.match(rules, /currently stable Node\.js 24 or 26,/);
});

test("babysit waits only through its script, and the GitHub rules own the no-check and no-review rules", () => {
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
    /Before the first wait, apply the `github-repository-configuration` rules' review request rule to the pull request's head, using step 4 to post any required request\./,
  );
  assert.match(
    babysit,
    /4\. Apply the review request rule to each new head after a fix push\. When it requires a request, post the review request comment as the `github-repository-configuration` rules describe/,
  );
  assert.match(
    babysit,
    /"checks passed" also covers a head with no check that the `github-repository-configuration` rules count as passed/,
  );
  assert.match(
    babysit,
    /follow the `github-repository-configuration` rules for merging without that review/,
  );
  assert.doesNotMatch(
    babysit,
    /onOpen|reviewRequests|fully or partly|CONTRIBUTING\.md#merging/,
  );
  assert.doesNotMatch(babysit, /warrant another look/);
  assert.doesNotMatch(
    babysit,
    /5 minutes|minutes of the latest review request|30 minutes|unfinished/,
  );
  const rules = flowedText("rules/github-repository-configuration.md");
  for (const requirement of [
    /A pull request head that has no check counts as having its checks passed once 5 minutes have passed since the later of the pull request's opening and a push of that head that GitHub recorded, and only while no workflow run for the head is unfinished or counted as failed/,
    /A workflow whose latest run failed with no check from that run or attempt counts as a failed check/,
    /A head with no recorded push and no check or workflow run never settles its checks: they neither pass nor fail/,
    /The merging agent then comments on it that the configured reviewer did not review that head and why, under the contribution guide's comment rules/,
    /it is unavailable, no review was requested after the head's push, it did not respond within `bounds.responseMinutes` of the latest review request, or no review arrived within `bounds.reviewMinutes` of it/,
    /For a head with no request after its push, the comment says whether the request rule required none or the bound was reached/,
    /Without the file, no reviewer wait or comment about an absent review is required/,
  ])
    assert.match(rules, requirement);
  const minutes = /once (\d+) minutes have passed since the later/.exec(
    rules,
  )?.[1];
  assert.match(
    readFileSync(join(root, ".agents/skills/babysit/wait.mjs"), "utf8"),
    new RegExp(`const checksBoundMs = ${minutes} \\* 60_000;`),
    "the wait's no-check bound is the rules' bound",
  );
  const guide = flowedText("CONTRIBUTING.md");
  assert.match(
    guide,
    /Merge a pull request once every required check passes on its latest head and every review thread is answered with its fix or a reasoned decline/,
  );
  assert.doesNotMatch(
    guide,
    /merging agent comments|bounds\.responseMinutes|bounds\.reviewMinutes|5 minutes/,
  );
});

test("app-author review guidance keeps policy skips distinct and preserves merge obligations", () => {
  const rules = flowedText("rules/github-repository-configuration.md");
  const factory = flowedText("rules/factory-workflow.md");
  const babysit = flowedText(".agents/skills/babysit/SKILL.md");
  for (const text of [rules, factory, babysit]) {
    assert.match(text, /\.github\/factory-review-policy\.json/);
    assert.match(text, /Standards and Spec reviews/);
    assert.match(text, /findings that (?:actually )?arrive/);
  }
  assert.match(rules, /No external reviewer runs on app-authored PRs\./);
  assert.match(rules, /actual internal Standards and Spec review outcomes/);
  assert.match(rules, /Absent policy is supported/);
  assert.match(rules, /merge authorization/);
  assert.match(rules, /Use only supplied credentials/);
  assert.match(babysit, /request\.mjs <number>/);
  assert.match(
    babysit,
    /`6`: checks passed and external review was skipped by app-author policy/,
  );
});

test("policy-skipped PRs require defined internal reviews and their actual outcomes", () => {
  const rules = flowedText("rules/github-repository-configuration.md");
  assert.match(
    rules,
    /For a policy-skipped pull request, complete internal Standards and Spec reviews before merge/,
  );
  assert.match(
    rules,
    /Standards checks the change against the repository's documented standards/,
  );
  assert.match(
    rules,
    /Spec checks it against its originating implementation contract/,
  );
  assert.match(
    rules,
    /installed `code-review` workflow provides both axes, including its handling of a missing specification/,
  );
  assert.match(
    rules,
    /These internal reviews are distinct from the configured external reviewer/,
  );
  assert.match(
    rules,
    /A policy skip supplies neither internal nor external approval/,
  );
  assert.match(
    rules,
    /At merge, record the actual internal Standards and Spec review outcomes/,
  );

  const factory = flowedText("rules/factory-workflow.md");
  assert.match(
    factory,
    /internal Standards and Spec reviews defined by the `github-repository-configuration` rules' app-author policy/,
  );
});

test("nonmatching and absent-policy PRs keep applicable reviews without a blanket babysit gate", () => {
  const rules = flowedText("rules/github-repository-configuration.md");
  assert.match(
    rules,
    /For nonmatching and absent-policy pull requests, keep the existing applicable internal-review workflow/,
  );
  const babysit = flowedText(".agents/skills/babysit/SKILL.md");
  assert.match(
    babysit,
    /Follow the `github-repository-configuration` rules for applicable internal Standards and Spec reviews and their merge record/,
  );
  assert.doesNotMatch(babysit, /Complete internal Standards and Spec reviews/);
  assert.match(
    flowedText(".agents/skills/implement/SKILL.md"),
    /Once done, use \/code-review to review the work/,
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
      /otherwise fix the invocation or other platform error and run it again/,
    );
  }
  assert.doesNotMatch(
    babysit,
    /`gh` access|instead of retrying|only the credentials|another identity|other identities|search(?:ing)? for credentials|ask(?:s|ing)? the owner|factory:needs-input/,
  );
});

test("the installed delivery route honors prescribed worker handoffs before merging", () => {
  const declarations = readFileSync(join(root, "standards.yaml"), "utf8");
  assert.ok(declarations.includes("target: AGENTS.md\n      exact: AGENTS.md"));
  assert.ok(
    flowedText("AGENTS.md").includes(
      "Deliver every change as one pull request: open it and write its body as `CONTRIBUTING.md` says, using `pr` where it directs, then `babysit` it through merge or the prescribed handoff.",
    ),
  );
  const guide = flowedText("CONTRIBUTING.md");
  assert.match(
    guide,
    /Before delivery, read applicable installed rules for merge ownership and owner review/,
  );
  assert.match(
    guide,
    /When they assign the merge to another agent, the worker records the prescribed PR handoff and stops without merging/,
  );
  const babysit = flowedText(".agents/skills/babysit/SKILL.md");
  assert.match(
    babysit,
    /Before requesting or waiting, establish your delivery role/,
  );
  assert.match(
    babysit,
    /If they prescribe a worker handoff, record it on the open PR and stop/,
  );
  const orchestrate = flowedText(".agents/skills/orchestrate/SKILL.md");
  assert.match(
    orchestrate,
    /When applicable installed rules assign a worker's merge to you, read its accepted brief and PR handoff, then resume `babysit`/,
  );
  for (const text of [guide, babysit, orchestrate])
    assert.doesNotMatch(text, /factory:skip/);
});

test("every skipped factory PR has worker completion and an orchestrator-owned merge", () => {
  const factory = flowedText("rules/factory-workflow.md");
  assert.match(
    factory,
    /For every skip-labelled PR, the implementing worker delivers an open PR and hands it to the orchestrating agent without merging/,
  );
  assert.match(
    factory,
    /Worker completion is the recorded PR handoff; the issue stays open until delivery finishes/,
  );
  assert.match(
    factory,
    /The orchestrating agent continues `babysit` and owns the merge/,
  );
  assert.match(
    factory,
    /The handoff records the PR's current head, validation and internal review outcomes, outstanding findings, and any owner-review requirement with its source/,
  );
});

test("either owner-review designation source survives the PR handoff without making every skip require review", () => {
  const factory = flowedText("rules/factory-workflow.md");
  assert.match(
    factory,
    /Owner review is required when either the accepted brief or the worker's handoff says so/,
  );
  assert.match(
    factory,
    /Read both sources; an omission in one does not cancel a designation in the other/,
  );
  assert.match(
    factory,
    /Carry that designation and its source into the PR handoff/,
  );
  assert.match(
    factory,
    /The skip marker alone requires no owner review; without a designation, the orchestrating agent merges under the ordinary applicable conditions/,
  );
});

test("owner-reviewed heads need explicit current-head approval independently of other delivery gates", () => {
  const factory = flowedText("rules/factory-workflow.md");
  assert.match(
    factory,
    /Before merging a designated PR, the orchestrating agent verifies the owner's explicit approval of the current head/,
  );
  assert.match(
    factory,
    /Any head change requires renewed owner approval; approval of an earlier head does not authorize the new one/,
  );
  assert.match(
    factory,
    /Passing checks, a configured external review, its absence or timeout, and an app-author review-policy skip never substitute for owner approval/,
  );
  assert.match(
    factory,
    /When approval is missing, follow the contribution guide's owner-question handoff and leave the PR unmerged/,
  );
  const babysit = flowedText(".agents/skills/babysit/SKILL.md");
  assert.match(
    babysit,
    /Before each merge attempt, verify merge ownership and any required owner approval against the current head/,
  );
  assert.match(babysit, /`2` means the head changed, so return to step 1/);
  assert.match(
    babysit,
    /When required approval is missing, use the contribution guide's owner-question handoff and stop with the PR unmerged/,
  );
  const mergeDoc = flowedText("docs/development/babysit-merge.md");
  assert.match(
    mergeDoc,
    /The caller establishes merge ownership and any required owner approval of the current head before invoking the script/,
  );
  assert.match(
    mergeDoc,
    /The script's expected-head check preserves that decision against a head change; it does not establish authorization itself/,
  );
});

test("the GitHub rules require a first review request before waiting when opening is not a request", () => {
  const rules = flowedText("rules/github-repository-configuration.md");
  for (const requirement of [
    /a review request is the pull request's opening when `request.onOpen` is true, or a later comment whose whole trimmed body equals `request.comment`; a push is never one/,
    /When `request.onOpen` is false and the pull request has had no review request, an agent must post the review request comment for its head before it first waits on the pull request/,
    /The request bound cannot stop this first request, since none has been counted yet/,
    /Count the opening when `request.onOpen` is true and every comment whose whole trimmed body equals `request.comment`, whoever posted it/,
  ])
    assert.match(rules, requirement);
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
  const rules = flowedText("rules/github-repository-configuration.md");
  for (const requirement of [
    /After that first request, an agent must post the review request comment for a new head when its push fixes, fully or partly, a review finding the contribution guide does not let it decline, and the request bound has not been reached/,
    /No other push gets a request: a push that only follows declines, changes only tests, documentation or wording, or only fixes a failing check gets none/,
    /The optional `bounds.reviewRequests` limits the total review requests a pull request gets/,
    /Once that count reaches the bound, no agent requests another review\. Without the field there is no count bound/,
    /The bound creates no reason to decline a real finding and no grouped follow-up issue/,
    /fix every finding the contribution guide does not let the agent decline and push without another request, and answer any review that arrives anyway/,
  ])
    assert.match(rules, requirement);
  assert.doesNotMatch(
    guide,
    /request\.onOpen|request\.comment|reviewRequests|fully or partly|request bound/,
  );
  assert.doesNotMatch(
    babysit,
    /ticket or scope|another layer|only the owner writes/,
  );
});

test("the GitHub rules keep the request phrase out of other text and exempt the request comment from the disclaimer", () => {
  const rules = flowedText("rules/github-repository-configuration.md");
  for (const requirement of [
    /Write the configured reviewer's request phrase only in a comment that requests a review/,
    /That comment holds exactly `request.comment`, with no AI disclaimer: it is exempt from the contribution guide's disclaimer rule/,
    /The phrase never appears in prose, quotations, or code spans in any other comment, issue or pull request title, or body/,
    /describe it as "the review request comment"/,
  ])
    assert.match(rules, requirement);
  const guide = flowedText("CONTRIBUTING.md");
  assert.match(
    guide,
    /A review request comment follows the `github-repository-configuration` rules instead/,
  );
  assert.doesNotMatch(guide, /request phrase/);
});

test("the GitHub rules hold the readiness roles and native blocker mechanics, and the guide keeps general readiness", () => {
  const rules = flowedText("rules/github-repository-configuration.md");
  assert.match(
    rules,
    /They apply to all work in the repository, including tracker work that changes no file/,
  );
  for (const requirement of [
    /Applying `ready-for-agent` or `ready-for-human` needs the repository `admin`, `maintain`, or `triage` role/,
    /A `write` role, an author association, a bot identity, or a passing structure check supplies no authority/,
    /When adding a native blocker, pass the blocking issue's numeric database ID as `issue_id`, not its issue number or `node_id`/,
  ])
    assert.match(rules, requirement);
  const guide = flowedText("CONTRIBUTING.md");
  assert.doesNotMatch(
    guide,
    /issue_id|node_id|`admin`|`maintain`|`triage` role/,
  );
  for (const requirement of [
    /Applying `ready-for-agent` or `ready-for-human` is the review action, and the `github-repository-configuration` rules name the roles it needs/,
    /After revising a contract or posting an Agent Brief, wait for the issue-contract workflow's revision notice before applying readiness\. Editing a contract removes its readiness/,
    /A specification or ticket can be ready while its blockers are open/,
    /Start a ticket only after its blockers are closed/,
    /A triaged request's contract is its latest Agent Brief comment/,
  ])
    assert.match(guide, requirement);
  assert.doesNotMatch(guide, /brief's heading comes right after/);
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

test("the guide's triage disclaimer matches the triage skill and passes the issue-contract check", () => {
  const guide = readFileSync(join(root, "CONTRIBUTING.md"), "utf8");
  const triageLine =
    /^```markdown\n(> \*This was generated by AI during triage\.\*)\n```$/m.exec(
      guide,
    )?.[1];
  const skill = readFileSync(
    join(root, ".agents/skills/triage/SKILL.md"),
    "utf8",
  );
  const skillLine = /^```\n(> [^\n]+)\n```$/m.exec(skill)?.[1];
  assert.ok(triageLine);
  assert.ok(skillLine);
  assert.equal(triageLine, skillLine);

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
  assert.match(pullRequests, /If the work finished the issue, close it/);
  assert.match(
    flowedText("rules/factory-workflow.md"),
    /A merged pull request that leaves its issue open fails the factory run for good, without a retry/,
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
  assert.doesNotMatch(guide, /factory|`model:/);
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
    /Work without an issue asks on its pull request instead/,
  );
  const rules = flowedText("rules/factory-workflow.md");
  assert.match(rules, /add `factory:needs-input` to the issue/);
  assert.match(
    rules,
    /While the run's pull request is open, removing the label starts no run in a repository a factory serves/,
  );
  assert.match(
    rules,
    /With no open pull request, whoever answers, the orchestrating agent or the owner, removes the label to return the issue to the frontier as a fresh first attempt/,
  );
  assert.match(
    rules,
    /the owner, even after the orchestrating agent answers, either finishes the pull request by merging it, for example after pushing the refused change, and ensuring the issue is closed under the contribution guide's pull request rules, or hands it back: close it before removing the label, wait for `factory:running` to disappear, then remove the label so a fresh first attempt continues its branch/,
  );
  assert.match(
    comments,
    /If the answer changes the implementation contract, edit the contract; that drops readiness and requires review again/,
  );
});

test("factory workflow rules preserve readiness, models, state recovery and safe stop notes", () => {
  const rules = flowedText("rules/factory-workflow.md");
  for (const requirement of [
    /A parent \(a specification or any issue with sub-issues\) never runs/,
    /its tickets, which each also need their own readiness/,
    /again when a ticket is published later/,
    /remove `ready-for-agent` and add it back/,
    /only once the latest ticket link appears in the parent's timeline/,
    /Readiness recorded in the same second as that link holds the tickets/,
    /exactly one `model:` label they chose, before readiness or together with it, even when it names the host's default model/,
    /A parent needs no `model:` label of its own, and `ready-for-human` needs none/,
    /`model:<slug>` or `model:<provider>\/<slug>`, optionally followed by `@<effort>`/,
    /create the label if the repository lacks it/,
    /A `claude-\*` or `gpt-\*` slug needs no provider/,
    /triage notes after its Agent Brief suggest one `model:` label with a one-line reason/,
    /runs an unlabelled ticket on the host's default model/,
    /accepts readiness only from a person/,
    /an agent adds `factory:needs-input` with its question/,
    /`factory:skip` marks ready agent work the factory must not pick up/,
    /`ready-for-human` is only for work that needs the owner's own accounts or credentials, or a taste call the owner reserved for themselves/,
    /Agent work the factory must not pick up gets `ready-for-agent`, one `model:` label and `factory:skip`, applied together: work that edits `\.github\/workflows\/`, or work the owner reviews before merge/,
    /Whoever applies `factory:skip` creates it if the repository lacks it, as for `model:` labels; the factory never creates or removes it/,
    /An agent working on the owner's account implements skip-labelled work, and the orchestrating agent merges it; when the owner reviews the work before merge, the orchestrating agent merges it after the owner's review/,
    /the factory adds `factory:running` while it holds an issue, `factory:failed` after a run fails for good, and `factory:paused` when it pauses a run/,
    /resumes it by itself.*nobody removes the label by hand/,
    /Remove `factory:failed` to run the issue again once its failure note or the factory's comment is dealt with/,
    /stops without a pull request and without a question under `factory:needs-input` comments one short paragraph/,
    /Never paste log output, environment values or tokens into that note/,
  ])
    assert.match(rules, requirement);
});

// `ready-for-human` covers only work that needs the owner; agent work the
// factory must not pick up carries `factory:skip`, which only the factory
// rules' State labels section names.
test("ready-for-human needs the owner, and only the factory rules' State labels name factory:skip", () => {
  const narrowed =
    /needs the owner's (?:own )?accounts(?: or|,) credentials,? or a (?:reserved )?taste call/;
  for (const document of [
    "rules/github-repository-configuration.md",
    "docs/development/github-label-setup.md",
    "operations/setup-github-labels.mjs",
    ".agents/skills/triage/SKILL.md",
    "rules/factory-workflow.md",
  ]) {
    const text = flowedText(document);
    assert.match(text, narrowed, document);
    assert.doesNotMatch(
      text,
      /requires human implementation|needs human implementation|judgment calls, external access|ready for a human to merge/i,
      document,
    );
  }
  const github = flowedText("rules/github-repository-configuration.md");
  assert.doesNotMatch(
    github.replace("name no `factory:` label", ""),
    /factory:/,
  );
  const factory = readFileSync(join(root, "rules/factory-workflow.md"), "utf8");
  const sections = factory.split(/^## /m);
  for (const section of sections)
    if (!section.startsWith("State labels\n"))
      assert.doesNotMatch(section, /factory:skip/);
  const skill = flowedText(".agents/skills/triage/SKILL.md");
  const forPr = /For a PR, (.+?) Every triaged issue/.exec(skill)?.[1] ?? "";
  for (const meaning of [
    /`ready-for-agent` means a brief is attached and an agent should take the next step on the diff/,
    /`ready-for-human` keeps the owner-only meaning above/,
    /Work an agent can perform stays `ready-for-agent`, including work awaiting the owner's review/,
    /In repositories with installed factory rules, follow those rules for work the factory must not pick up/,
  ])
    assert.match(forPr, meaning);
  const accept =
    /### Accept a brief that holds (.+?)## Other outcomes/.exec(skill)?.[1] ??
    "";
  for (const choice of [
    /`ready-for-human` only when the work needs the owner's own accounts or credentials, or a taste call the owner reserved for themselves/,
    /`ready-for-agent` with `factory:skip` for agent work the factory must not pick up, by the tests in the installed factory rules/,
    /`ready-for-agent` alone for any other work/,
  ])
    assert.match(accept, choice);
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
