import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  developmentGuide,
  exactOwnedAgentConfiguration,
  fileDeclarations,
  index,
} from "./helpers/documentation.mjs";
import {
  fixture,
  invokeCheck,
  retainedCheck,
  snapshot,
} from "./helpers/operation.mjs";

const sourceRoot = fileURLToPath(new URL("..", import.meta.url));
const drafterPath = "discovery/draft-documentation-scope.mjs";
const drafter = join(sourceRoot, drafterPath);
const check = join(sourceRoot, "operations/check-documentation.mjs");

// The discovery request Repository Standards passes the drafter on standard
// input, selecting this source's standard profile by default.
const request = (root, overrides = {}) => ({
  format: "repo-standards/discovery/v1",
  declaration: "documentation",
  projectRoot: root,
  standards: {
    repository: "https://github.com/lutzseverino/repo-canon",
    version: "v0.0.0-test",
    commit: "0000000000000000000000000000000000000000",
  },
  profile: "standard",
  ...overrides,
});

// Runs the drafter as Repository Standards runs a discovery script: from the
// copy, with no arguments and the request on standard input.
function draft(
  root,
  { script = drafter, input = request(root), args = [], cwd = root } = {},
) {
  const child = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: "utf8",
    input: typeof input === "string" ? input : `${JSON.stringify(input)}\n`,
  });
  return {
    ...child,
    proposal: child.status === 0 ? JSON.parse(child.stdout) : null,
  };
}

// A project as Repository Standards copies it for a discovery script: the
// files and directories Git keeps, without Git metadata or `.repo-standards`.
function projectCopy(t, files, prepare = () => {}) {
  const project = fixture(files);
  t.after(project.close);
  rmSync(join(project.root, ".git"), { recursive: true, force: true });
  prepare(project.root);
  return project.root;
}

// Drafts a copy's scope, asserting that drafting changes nothing and that the
// proposal has the scope proposal's shape.
function drafted(t, files, prepare = () => {}, options = {}) {
  const root = projectCopy(t, files, prepare);
  const before = snapshot(root);
  const outcome = draft(root, options);
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.stderr, "");
  assert.deepEqual(
    snapshot(root),
    before,
    "the drafter must not change the copy",
  );
  assertScopeProposal(outcome.proposal, root);
  return {
    root,
    proposal: outcome.proposal,
    entry: outcome.proposal.declarations[0],
  };
}

// The regular files of a copy reached through real directories only, which
// the CLI's discovery observation holds.
function copiedFiles(root, directory = "") {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap(
    (entry) => {
      const path = directory ? `${directory}/${entry.name}` : entry.name;
      if (entry.isDirectory()) return copiedFiles(root, path);
      return entry.isFile() ? [path] : [];
    },
  );
}

// The Repository Standards scope proposal (`repo-standards/scope/v2`):
// exactly these fields, nonempty text, include or exclude decisions, no
// duplicate entries, and evidence paths that the discovery observation holds
// as eligible files or directories. Every candidate cites evidence, apart from
// an included file that does not exist yet; a missing README cites a file or
// nonempty directory within its directory. Included paths are files.
function assertScopeProposal(proposal, root) {
  const fields = (value) => Object.keys(value).sort();
  const text = (value) =>
    assert.ok(
      typeof value === "string" && value.trim() !== "" && !value.includes("\0"),
      `nonempty text: ${value}`,
    );
  const unique = (values) =>
    assert.equal(
      new Set(values).size,
      values.length,
      `no duplicates: ${values}`,
    );
  assert.deepEqual(fields(proposal), ["declarations", "format"]);
  assert.equal(proposal.format, "repo-standards/scope/v2");
  assert.equal(proposal.declarations.length, 1);
  const [entry] = proposal.declarations;
  assert.deepEqual(fields(entry), [
    "candidates",
    "coverage",
    "id",
    "unresolved",
  ]);
  assert.equal(entry.id, "documentation");
  text(entry.coverage);
  entry.unresolved.forEach(text);
  unique(entry.unresolved);
  unique(entry.candidates.map((candidate) => candidate.path));

  const files = copiedFiles(root);
  const directories = new Set(
    files.flatMap((path) =>
      path
        .split("/")
        .slice(0, -1)
        .map((_, index, segments) => segments.slice(0, index + 1).join("/")),
    ),
  );
  const eligible = (path) => files.includes(path) || directories.has(path);
  for (const candidate of entry.candidates) {
    assert.deepEqual(fields(candidate), [
      "decision",
      "evidence",
      "path",
      "reason",
    ]);
    text(candidate.path);
    text(candidate.reason);
    assert.ok(["include", "exclude"].includes(candidate.decision));
    candidate.evidence.forEach(text);
    unique(candidate.evidence);
    for (const path of candidate.evidence)
      assert.ok(
        eligible(path),
        `${candidate.path} cites eligible evidence: ${path}`,
      );
    const entryState = lstatSync(join(root, candidate.path), {
      throwIfNoEntry: false,
    });
    if (candidate.decision === "include")
      assert.ok(!entryState?.isDirectory(), `${candidate.path} is a file`);
    if (candidate.decision === "include" && !entryState) {
      if (
        candidate.path.endsWith("/README.md") &&
        candidate.evidence.length > 0
      ) {
        const parent = dirname(candidate.path);
        assert.ok(
          candidate.evidence.some(
            (path) => path === parent || path.startsWith(`${parent}/`),
          ),
          `${candidate.path} cites evidence within its directory`,
        );
      }
    } else {
      assert.ok(
        candidate.evidence.length > 0,
        `${candidate.path} cites evidence`,
      );
    }
  }
}

const included = (entry) =>
  entry.candidates
    .filter((candidate) => candidate.decision === "include")
    .map((candidate) => candidate.path);

function checkDraftedScope(root, paths) {
  return invokeCheck(check, root, {
    operation: {
      declaration: "documentation",
      phase: "checks",
      id: "documentation-navigation",
    },
    declarations: fileDeclarations(),
    allowedTargets: { paths, directories: [] },
  });
}

const coverage =
  "Drafted from the repository tree by `discovery/draft-documentation-scope.mjs`: every file Git keeps under the documentation root `docs`, a new index for each of its directories without one, the development guide, and the domain glossaries and context maps the rules identify. Paths other declarations own are left out, and so is each README.md outside the documentation roots. Link-repair files and move destinations enter when the work needs them.";

const underDocs = (path) => ({
  path,
  decision: "include",
  reason: "A file under the documentation root `docs`.",
  evidence: [path],
});
const owned = (path, id) => ({
  path,
  decision: "exclude",
  reason: `Owned by the \`${id}\` declaration.`,
  evidence: [path],
});
const outsideIndex = (path) => ({
  path,
  decision: "exclude",
  reason:
    "A README.md outside the documentation roots, which the documentation check would read as a documentation root's index. If it is a Project README, the `project-readmes` declaration's proposal covers it.",
  evidence: [path],
});
const unsupported = (path, directory) =>
  `Repository Standards accepts the new \`${path}\` only with evidence inside \`${directory}\`, where Git keeps no file yet. Should that directory's first content be committed in a separate reviewed change before adopting again?`;
const rootQuestion = (candidate, directories, outer = "") =>
  `Is \`${candidate}\` a documentation root${outer}? Its ${directories} Markdown documents. If it is, include its files and a new index for each of its directories without one, as this draft does for \`docs\`. If it is not, its README.md files stay out of this scope.`;

// A repository that follows every documentation rule, with the installed
// agent configuration, a domain glossary, and a Project README. Its copy holds
// its `.gitignore` but not the output it ignores.
const conforming = {
  ".gitignore": "build/\n",
  "AGENTS.md": "# Agents\n",
  "CONTRIBUTING.md": "# Contributing\n",
  "README.md": "# Widget\n",
  "GLOSSARY.md": "# Widget\n",
  "docs/README.md": index(
    "Documentation",
    "This directory maps the documentation categories.",
    [
      ["Usage", "usage/README.md", "using the widget."],
      [
        "Development",
        "development/README.md",
        "building and validating the widget.",
      ],
      ["Architecture decisions", "adr/README.md", "consequential decisions."],
      [
        "Agent configuration",
        "agents/README.md",
        "agent workflow configuration.",
      ],
    ],
  ),
  "docs/usage/README.md": index(
    "Usage",
    "This directory explains how to use the widget.",
    [["Install", "install.md", "installing the widget."]],
  ),
  "docs/usage/install.md": "# Install\n\n![Overview](overview.svg)\n",
  "docs/usage/overview.svg": "<svg/>\n",
  "docs/development/README.md": developmentGuide(),
  "docs/adr/README.md": index(
    "Architecture decisions",
    "This directory records consequential decisions.",
    [["Use Node.js", "0001-use-node.md", "the runtime choice."]],
  ),
  "docs/adr/0001-use-node.md": "# Use Node.js\n",
  "docs/agents/README.md": readFileSync(
    join(sourceRoot, "docs/agents/README.md"),
    "utf8",
  ),
  "docs/agents/domain.md": "# Domain docs\n",
  "docs/agents/issue-tracker.md": "# Issue tracker\n",
  "docs/agents/triage-labels.md": "# Triage labels\n",
  "docs/agents/project.md": "# Project guidance\n",
  "packages/widget/README.md": "# Widget package\n",
  "packages/widget/index.js": "export {};\n",
};

test("drafts the expected scope of a conforming repository", (t) => {
  const { proposal } = drafted(t, conforming);

  assert.deepEqual(proposal, {
    format: "repo-standards/scope/v2",
    declarations: [
      {
        id: "documentation",
        coverage,
        candidates: [
          {
            path: "GLOSSARY.md",
            decision: "include",
            reason: "The domain glossary at the repository root.",
            evidence: ["GLOSSARY.md"],
          },
          underDocs("docs/README.md"),
          underDocs("docs/adr/0001-use-node.md"),
          underDocs("docs/adr/README.md"),
          owned("docs/agents/README.md", "agent-configuration-index"),
          owned("docs/agents/domain.md", "domain-configuration"),
          owned("docs/agents/issue-tracker.md", "issue-tracker-configuration"),
          underDocs("docs/agents/project.md"),
          owned("docs/agents/triage-labels.md", "triage-label-configuration"),
          underDocs("docs/development/README.md"),
          underDocs("docs/usage/README.md"),
          underDocs("docs/usage/install.md"),
          underDocs("docs/usage/overview.svg"),
          outsideIndex("packages/widget/README.md"),
        ],
        unresolved: [],
      },
    ],
  });
});

test("drafts new indexes, the development guide, and context glossaries the rules decide", (t) => {
  const { proposal } = drafted(t, {
    "docs/README.md": "# Documentation\n",
    "docs/usage/install.md": "# Install\n",
    "docs/usage/guides/first-run.md": "# First run\n",
    "GLOSSARY-MAP.md":
      "# Contexts\n\n- [Ordering](src/ordering/GLOSSARY.md): orders.\n- [Billing](src/billing/): invoices.\n",
    "src/ordering/GLOSSARY.md": "# Ordering\n",
    "src/billing/GLOSSARY.md": "# Billing\n",
  });

  const contextGlossary = (path) => ({
    path,
    decision: "include",
    reason: "A context glossary that `GLOSSARY-MAP.md` lists.",
    evidence: [path, "GLOSSARY-MAP.md"],
  });
  assert.deepEqual(proposal.declarations[0].candidates, [
    {
      path: "GLOSSARY-MAP.md",
      decision: "include",
      reason: "The context map at the repository root.",
      evidence: ["GLOSSARY-MAP.md"],
    },
    underDocs("docs/README.md"),
    {
      path: "docs/development/README.md",
      decision: "include",
      reason:
        "The development guide, which the contribution guide requires, to create.",
      evidence: [],
    },
    {
      path: "docs/usage/README.md",
      decision: "include",
      reason:
        "The index of the documentation directory `docs/usage`, to create.",
      evidence: ["docs/usage"],
    },
    {
      path: "docs/usage/guides/README.md",
      decision: "include",
      reason:
        "The index of the documentation directory `docs/usage/guides`, to create.",
      evidence: ["docs/usage/guides"],
    },
    underDocs("docs/usage/guides/first-run.md"),
    underDocs("docs/usage/install.md"),
    contextGlossary("src/billing/GLOSSARY.md"),
    contextGlossary("src/ordering/GLOSSARY.md"),
  ]);
  assert.deepEqual(proposal.declarations[0].unresolved, [
    unsupported("docs/development/README.md", "docs/development"),
  ]);
});

test("drafts the root indexes of a repository without documentation and asks for their evidence", (t) => {
  const { entry } = drafted(t, { "README.md": "# Widget\n" });

  assert.deepEqual(entry.candidates, [
    {
      path: "docs/README.md",
      decision: "include",
      reason: "The index of the documentation root `docs`, to create.",
      evidence: [],
    },
    {
      path: "docs/development/README.md",
      decision: "include",
      reason:
        "The development guide, which the contribution guide requires, to create.",
      evidence: [],
    },
  ]);
  assert.deepEqual(entry.unresolved, [
    unsupported("docs/README.md", "docs"),
    unsupported("docs/development/README.md", "docs/development"),
  ]);
});

test("leaves the cases no rule decides as unresolved questions", (t) => {
  const { entry } = drafted(
    t,
    {
      "docs/README.md": "# Documentation\n",
      "docs/overview.md": "# Overview\n",
      "docs/usage/install.md": "# Install\n",
      "notes.md": "# Notes\n",
      "guides/setup.md": "# Setup\n",
      "packages/app/README.md": "# App\n",
      "packages/app/docs/usage/guide.md": "# Guide\n",
      "packages/app/docs/adr/0001-start.md": "# Start\n",
      "src/legacy/GLOSSARY.md": "# Legacy\n",
    },
    // The copy holds a directory whose files Git ignores, but not the files.
    (root) => mkdirSync(join(root, "docs/cache")),
  );

  assert.deepEqual(entry.candidates, [
    underDocs("docs/README.md"),
    {
      path: "docs/development/README.md",
      decision: "include",
      reason:
        "The development guide, which the contribution guide requires, to create.",
      evidence: [],
    },
    underDocs("docs/overview.md"),
    {
      path: "docs/usage/README.md",
      decision: "include",
      reason:
        "The index of the documentation directory `docs/usage`, to create.",
      evidence: ["docs/usage"],
    },
    underDocs("docs/usage/install.md"),
    outsideIndex("packages/app/README.md"),
  ]);
  assert.deepEqual(entry.unresolved, [
    rootQuestion(
      "packages/app/docs",
      "`packages/app/docs/adr` and `packages/app/docs/usage` directories hold",
    ),
    "Is `src/legacy/GLOSSARY.md` a domain glossary or context map of this repository? Include it if it is.",
    unsupported("docs/development/README.md", "docs/development"),
    "Which of these Markdown files at the repository root are documentation this scope must cover, such as a document to move into a documentation category: `notes.md`? Include each one, with its destination when it moves.",
    "Which of these Markdown files under `guides` are documentation this scope must cover, such as a document to move into a documentation category: `guides/setup.md`? Include each one, with its destination when it moves.",
    "Which of these Markdown files under `packages` are documentation this scope must cover, such as a document to move into a documentation category: `packages/app/docs/adr/0001-start.md` and `packages/app/docs/usage/guide.md`? Include each one, with its destination when it moves.",
    "`docs/cache` under the documentation root `docs` holds no file that Git keeps, but the documentation check reads it. Should it be removed, or should Git keep a file in it?",
    "`docs/overview.md` lies directly under the documentation root `docs`, outside the usage, development, adr, and agents categories. Which category does it move to? Include each destination path and any new directory's index; the files Git keeps in it are already included.",
  ]);
});

test("asks about a stray directory and a symbolic link under a root without drafting their indexes", (t) => {
  const { entry } = drafted(
    t,
    {
      "docs/README.md": "# Documentation\n",
      "docs/development/README.md": developmentGuide(),
      "docs/api/endpoints.md": "# Endpoints\n",
      "docs/usage/README.md": "# Usage\n",
    },
    (root) => symlinkSync("README.md", join(root, "docs/usage/alias.md")),
  );

  assert.deepEqual(included(entry), [
    "docs/README.md",
    "docs/api/endpoints.md",
    "docs/development/README.md",
    "docs/usage/README.md",
  ]);
  assert.deepEqual(entry.unresolved, [
    "`docs/api` lies directly under the documentation root `docs`, outside the usage, development, adr, and agents categories. Which category does it move to? Include each destination path and any new directory's index; the files Git keeps in it are already included.",
    "`docs/usage/alias.md` under the documentation root `docs` is a symbolic link or special file, which the scope cannot hold. Should it be replaced with a regular file or removed?",
  ]);
});

test("leaves out the paths that other declarations and Repository Standards own", (t) => {
  const { entry } = drafted(t, {
    "docs/README.md": "# Documentation\n",
    "docs/development/README.md": developmentGuide(),
    "AGENTS.md": "# Agents\n",
    "CONTRIBUTING.md": "# Contributing\n",
    "THIRD_PARTY_NOTICES.md": "# Notices\n",
    ".github/PULL_REQUEST_TEMPLATE.md": "## Summary\n",
    ".agents/skills/tdd/SKILL.md": "# TDD\n",
    ".agents/skills/repository-standards/SKILL.md": "# Repository Standards\n",
    ".agents/skills/repository-standards/usage/README.md": "# Usage\n",
    ".agents/skills/author-standards/references/README.md": "# References\n",
    ".claude/skills/repository-standards/SKILL.md": "# Repository Standards\n",
    ".claude/skills/author-standards/usage/guide.md": "# Guide\n",
    ".repo-standards/inputs/source/docs/usage/guide.md": "# Guide\n",
    "vendor/marked/README.md": "# Marked\n",
    "vendor/marked/usage/README.md": "# Usage\n",
  });

  assert.deepEqual(included(entry), [
    "docs/README.md",
    "docs/development/README.md",
  ]);
  assert.deepEqual(
    entry.candidates.filter((candidate) => candidate.decision === "exclude"),
    [outsideIndex("vendor/marked/usage/README.md")],
  );
  assert.deepEqual(entry.unresolved, [
    "Which of these Markdown files at the repository root are documentation this scope must cover, such as a document to move into a documentation category: `THIRD_PARTY_NOTICES.md`? Include each one, with its destination when it moves.",
  ]);
  assert.equal(entry.coverage, coverage);
});

test("leaves the retired system skills out of the proposal and says why", (t) => {
  const retired = [
    ".agents/skills/adopt-standards",
    ".agents/skills/standards-updates",
  ];
  const { proposal, entry } = drafted(
    t,
    {
      "docs/README.md": "# Documentation\n",
      "docs/development/README.md": developmentGuide(),
      ".agents/skills/adopt-standards/SKILL.md": "# Adopt\n",
      ".agents/skills/adopt-standards/references/README.md": "# References\n",
      ".agents/skills/adopt-standards/usage/guide.md": "# Guide\n",
      ".agents/skills/standards-updates/SKILL.md": "# Standards updates\n",
    },
    (root) => {
      mkdirSync(join(root, ".claude/skills"), { recursive: true });
      for (const path of retired)
        symlinkSync(
          `../../${path}`,
          join(root, ".claude/skills", path.split("/").at(-1)),
        );
    },
  );

  assert.deepEqual(included(entry), [
    "docs/README.md",
    "docs/development/README.md",
  ]);
  assert.deepEqual(entry.unresolved, []);
  assert.equal(
    entry.coverage,
    `${coverage} The retired Repository Standards skills \`.agents/skills/adopt-standards\`, \`.agents/skills/standards-updates\`, \`.claude/skills/adopt-standards\`, and \`.claude/skills/standards-updates\` are left out too, because the run that drafts this scope removes them.`,
  );
  assert.doesNotMatch(
    JSON.stringify({ ...entry, coverage: "" }),
    /adopt-standards|standards-updates/,
    "questions, targets, and evidence must leave out the retired skills",
  );

  const one = drafted(t, {
    "docs/README.md": "# Documentation\n",
    "docs/development/README.md": developmentGuide(),
    ".agents/skills/standards-updates/SKILL.md": "# Standards updates\n",
  });
  assert.equal(
    one.entry.coverage,
    `${coverage} The retired Repository Standards skill \`.agents/skills/standards-updates\` is left out too, because the run that drafts this scope removes it.`,
  );
  assert.ok(proposal);
});

test("asks about entries that block a root or an index", (t) => {
  const fileGuide = drafted(t, {
    "docs/README.md": "# Documentation\n",
    "docs/development": "Not a directory.\n",
  });
  assert.deepEqual(included(fileGuide.entry), [
    "docs/README.md",
    "docs/development",
  ]);
  assert.deepEqual(fileGuide.entry.unresolved, [
    "`docs/development` must be a directory to hold its documentation index, but it is not. Should it be removed or renamed?",
  ]);

  const fileDocs = drafted(t, { docs: "Not a directory.\n" });
  assert.deepEqual(fileDocs.entry.candidates, []);
  assert.deepEqual(fileDocs.entry.unresolved, [
    "`docs` must be a directory to hold its documentation index, but it is not. Should it be removed or renamed?",
  ]);

  const directoryIndex = drafted(t, {
    "docs/README.md": "# Documentation\n",
    "docs/development/README.md": developmentGuide(),
    "docs/usage/README.md/notes.md": "# Notes\n",
  });
  assert.deepEqual(included(directoryIndex.entry), [
    "docs/README.md",
    "docs/development/README.md",
  ]);
  assert.deepEqual(directoryIndex.entry.unresolved, [
    "`docs/usage/README.md` must be a file, the documentation index of its directory, but it is a directory. Should it be removed or renamed?",
  ]);
});

test("over conforming repositories the drafted scope passes the documentation check", (t) => {
  const single = drafted(t, conforming);
  assert.equal(
    checkDraftedScope(single.root, included(single.entry)).result.status,
    "passed",
  );

  // A context-local documentation root is a question; answering it as the
  // question says gives a scope that passes.
  const contexts = {
    "docs/README.md": index(
      "Documentation",
      "This directory maps the documentation categories.",
      [
        [
          "Development",
          "development/README.md",
          "building and validating the project.",
        ],
      ],
    ),
    "docs/development/README.md": developmentGuide(),
    "GLOSSARY-MAP.md":
      "# Contexts\n\n- [Ordering](src/ordering/GLOSSARY.md): orders.\n",
    "src/ordering/GLOSSARY.md": "# Ordering\n",
    "src/ordering/docs/README.md": index(
      "Ordering documentation",
      "This directory maps the ordering documentation.",
      [["Architecture decisions", "adr/README.md", "ordering decisions."]],
    ),
    "src/ordering/docs/adr/README.md": index(
      "Architecture decisions",
      "This directory records ordering decisions.",
      [["Event sourcing", "0001-event-sourcing.md", "how orders are stored."]],
    ),
    "src/ordering/docs/adr/0001-event-sourcing.md": "# Event sourcing\n",
  };
  const asked = drafted(t, contexts);
  assert.deepEqual(asked.entry.unresolved, [
    rootQuestion(
      "src/ordering/docs",
      "`src/ordering/docs/adr` directory holds",
    ),
    "Which of these Markdown files under `src` are documentation this scope must cover, such as a document to move into a documentation category: `src/ordering/docs/adr/0001-event-sourcing.md`? Include each one, with its destination when it moves.",
  ]);
  assert.ok(
    asked.entry.candidates.every(
      (candidate) => !candidate.path.startsWith("src/ordering/docs/"),
    ),
    "the root question decides the candidate root's READMEs",
  );
  const answered = [
    ...included(asked.entry),
    ...Object.keys(contexts).filter((path) =>
      path.startsWith("src/ordering/docs/"),
    ),
  ];
  const outcome = checkDraftedScope(asked.root, answered);
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "passed", outcome.result.message);
});

test("qualifies nested candidate roots", (t) => {
  const { entry } = drafted(t, {
    "docs/README.md": "# Documentation\n",
    "docs/development/README.md": developmentGuide(),
    "docs/usage/README.md": "# Usage\n",
    "pkg/a/docs/usage/guide.md": "# Guide\n",
    "pkg/a/docs/usage/agents/notes.md": "# Notes\n",
  });

  assert.deepEqual(
    entry.unresolved.filter(
      (question) => !question.startsWith("Which of these"),
    ),
    [
      rootQuestion(
        "pkg/a/docs/usage",
        "`pkg/a/docs/usage/agents` directory holds",
        ", if `pkg/a/docs` is not",
      ),
      rootQuestion("pkg/a/docs", "`pkg/a/docs/usage` directory holds"),
    ],
  );
});

test("drafts the copy the request names from any working directory", (t) => {
  const root = projectCopy(t, conforming);
  const fromCopy = draft(root);
  const elsewhere = draft(root, { cwd: tmpdir() });
  assert.equal(elsewhere.status, 0, elsewhere.stderr);
  assert.equal(elsewhere.stdout, fromCopy.stdout);
});

test("rejects arguments and requests it cannot read with a process error", (t) => {
  const root = projectCopy(t, conforming);
  for (const [options, message] of [
    [
      { args: ["--root", "docs"] },
      /Unknown argument --root\. The drafter takes no arguments/,
    ],
    [
      { input: "" },
      /Standard input must hold a repo-standards\/discovery\/v1 request/,
    ],
    [
      { input: "{" },
      /Standard input must hold a repo-standards\/discovery\/v1 request/,
    ],
    [
      { input: "null" },
      /Standard input must hold a repo-standards\/discovery\/v1 request/,
    ],
    [
      { input: request(root, { format: "repo-standards/operation/v2" }) },
      /Standard input must hold a repo-standards\/discovery\/v1 request/,
    ],
    [
      { input: request(root, { declaration: "project-readmes" }) },
      /names the `project-readmes` declaration; the drafter drafts `documentation`/,
    ],
    [
      { input: request("relative/copy") },
      /projectRoot must be an absolute path/,
    ],
    [
      { input: request(root, { projectRoot: undefined }) },
      /projectRoot must be an absolute path/,
    ],
    [
      { input: request(root, { profile: 1 }) },
      /profile must be a profile name/,
    ],
  ]) {
    const outcome = draft(root, options);
    assert.equal(outcome.status, 1, JSON.stringify(options));
    assert.equal(outcome.stdout, "");
    assert.match(outcome.stderr, message);
  }
});

// The drafter and only its declared resources, as Repository Standards retains
// them: `standards.yaml` lies beside it there too.
const retainedDrafter = (t) => retainedCheck(t, drafterPath);

for (const profile of ["standard", "factory"]) {
  test(`the acquired and the retained source draft the same ${profile} scope without changing the copy`, (t) => {
    const root = projectCopy(t, conforming);
    const before = snapshot(root);
    const input = request(root, { profile });

    const fromSource = draft(root, { input });
    assert.equal(fromSource.status, 0, fromSource.stderr);
    assert.equal(fromSource.stderr, "");
    assert.deepEqual(snapshot(root), before);

    const fromRetained = draft(root, { script: retainedDrafter(t), input });
    assert.equal(fromRetained.status, 0, fromRetained.stderr);
    assert.equal(fromRetained.stderr, "");
    assert.equal(fromRetained.stdout, fromSource.stdout);
    assert.deepEqual(snapshot(root), before);
    assertScopeProposal(fromRetained.proposal, root);
    assert.ok(
      fromRetained.proposal.declarations[0].candidates.some((candidate) =>
        candidate.reason.startsWith("Owned by"),
      ),
    );
  });
}

// The documentation declaration, with its check.
const documentationDeclaration = (indent) =>
  [
    "documentation:",
    "  checks:",
    "    - id: documentation-navigation",
    "      run:",
    "        executable: node",
    "        script: operations/check-documentation.mjs",
    "        resources:",
    "          - operations/lib/documentation-model.mjs",
    "        arguments: []",
    "      prerequisite:",
    "        version-arguments:",
    "          - --version",
    '        version: ">=24.0.0 <25.0.0"',
    "      timeout-seconds: 30",
    "  fixes: []",
    "  kind: repository",
    "  guidance: guidance/documentation.md",
    "  discovery: discovery/documentation.md",
  ]
    .map((line) => `${" ".repeat(indent)}${line}`)
    .join("\n");

const header = `format: repo-standards/v2
name: widget-standards
description: Widget repository standards, with a description long enough to
  fold onto a second line
requires:
  repo-standards: ">=7.0.0"
`;

test("reads the declarations that the selected profile resolves to", (t) => {
  const root = projectCopy(t, {
    "-notes.md": "# Notes\n",
    "docs/README.md": "# Documentation\n",
    "docs/development/README.md": developmentGuide(),
    "docs/usage/README.md": "# Usage\n",
    "docs/usage/added's.md": "# Added\n",
    "docs/usage/dropped.md": "# Dropped\n",
    "docs/usage/kept.md": "# Kept\n",
    "docs/usage/replaced.md": "# Replaced\n",
  });

  // A source whose profile replaces, excludes, and adds to its defaults.
  const script = retainedDrafter(t);
  writeFileSync(
    join(dirname(dirname(script)), "standards.yaml"),
    `---
${header}
defaults:
  declarations:
    documentation:
      kind: repository
      discovery: discovery/documentation.md
      discovery-script:
        run:
          executable: node
          script: discovery/draft-documentation-scope.mjs
          resources:
          - standards.yaml
      checks:
      - id: documentation-navigation
        run:
          executable: node
          script: operations/check-documentation.mjs
          resources:
          - operations/lib/documentation-model.mjs

    usage-guide:
      kind: file
      target: docs/usage/kept.md # the usage guide
      exact: kept.md

    dropped-guide:
      kind: file
      target: 'docs/usage/dropped.md'
      exact: dropped.md

profiles:
  complete:
    description: The complete widget standards profile
    declarations:
      usage-guide:
        kind: file
        target: "docs/usage/replaced.md" # replaces the usage guide
        exact: replaced.md
      dropped-guide: {exclude: true} # no longer installed
      added-guide:
        kind: file
        target: 'docs/usage/added''s.md' # added
        exact: added.md
      notes:
        kind: file
        target: -notes.md
        exact: notes.md
`,
  );
  const outcome = draft(root, {
    script,
    input: request(root, { profile: "complete" }),
  });
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.deepEqual(outcome.proposal.declarations[0].candidates, [
    underDocs("docs/README.md"),
    underDocs("docs/development/README.md"),
    underDocs("docs/usage/README.md"),
    owned("docs/usage/added's.md", "added-guide"),
    underDocs("docs/usage/dropped.md"),
    underDocs("docs/usage/kept.md"),
    owned("docs/usage/replaced.md", "usage-guide"),
  ]);
  assert.deepEqual(outcome.proposal.declarations[0].unresolved, []);

  const unnamed = draft(root, {
    script,
    input: request(root, { profile: undefined }),
  });
  assert.equal(unnamed.status, 0, unnamed.stderr);
  assert.equal(
    unnamed.stdout,
    outcome.stdout,
    "a manifest with one profile needs no profile name",
  );
});

test("drafts the profile the request selects from a source with several", (t) => {
  const root = projectCopy(t, {
    "docs/README.md": "# Documentation\n",
    "docs/development/README.md": developmentGuide(),
    "docs/usage/README.md": "# Usage\n",
    "docs/usage/guide.md": "# Guide\n",
  });
  const script = retainedDrafter(t);
  writeFileSync(
    join(dirname(dirname(script)), "standards.yaml"),
    `${header}defaults:
  declarations:
${documentationDeclaration(4)}
profiles:
  standard:
    description: Standard
    declarations: {}
  extended:
    description: Extended
    declarations:
      usage-guide:
        kind: file
        target: docs/usage/guide.md
        exact: guide.md
`,
  );
  const drafted = (profile) =>
    draft(root, { script, input: request(root, { profile }) });

  const standard = drafted("standard");
  assert.equal(standard.status, 0, standard.stderr);
  assert.deepEqual(
    standard.proposal.declarations[0].candidates.find(
      ({ path }) => path === "docs/usage/guide.md",
    ),
    underDocs("docs/usage/guide.md"),
  );
  const extended = drafted("extended");
  assert.equal(extended.status, 0, extended.stderr);
  assert.deepEqual(
    extended.proposal.declarations[0].candidates.find(
      ({ path }) => path === "docs/usage/guide.md",
    ),
    owned("docs/usage/guide.md", "usage-guide"),
  );

  for (const profile of [undefined, null]) {
    const unnamed = drafted(profile);
    assert.equal(unnamed.status, 1);
    assert.match(
      unnamed.stderr,
      /declares 2 profiles \(`standard` and `extended`\); the request must name the selected one\./,
    );
  }
  const unknown = drafted("complete");
  assert.equal(unknown.status, 1);
  assert.match(
    unknown.stderr,
    /declares no `complete` profile; it declares `standard` and `extended`\./,
  );
});

test("fails without a manifest it can read beside it", (t) => {
  const root = projectCopy(t, conforming);
  const script = retainedDrafter(t);
  const beside = join(dirname(dirname(script)), "standards.yaml");

  unlinkSync(beside);
  const withoutManifest = draft(root, { script });
  assert.equal(withoutManifest.status, 1);
  assert.equal(withoutManifest.stdout, "");
  assert.ok(
    withoutManifest.stderr.includes(
      `Cannot read the standards manifest ${beside} beside the drafter.`,
    ),
    withoutManifest.stderr,
  );

  const withDefaults = (declarations) =>
    `${header}defaults:\n  declarations:\n${documentationDeclaration(4)}\n${declarations}profiles:\n  complete:\n    description: Complete\n    declarations: {}\n`;
  const unreadable = "declares guide in a form the drafter cannot read";
  for (const [manifest, message] of [
    [
      `${header}defaults:\n  declarations:\n${documentationDeclaration(4)}\nprofiles:\n  complete:\n    description: Complete\n    declarations: {}\n  minimal:\n    description: Minimal\n    declarations: {}\n`,
      "declares 2 profiles",
    ],
    [
      `${header}defaults:\n  declarations:\n${documentationDeclaration(4)}\nprofiles:\n  complete:\n    description: Complete\n    declarations: []\n`,
      "lists its declarations in a form the drafter cannot read",
    ],
    [
      `${header}defaults:\n  declarations: {}\nprofiles:\n  complete:\n    description: Complete\n    declarations: {}\n`,
      "declares no documentation repository declaration",
    ],
    // Forms of a declaration, or of a field that decides its targets, that
    // the drafter does not read.
    [
      withDefaults("    guide: {kind: file, target: docs/usage/guide.md}\n"),
      unreadable,
    ],
    [
      withDefaults(
        "    guide: &guide\n      kind: file\n      target: docs/usage/guide.md\n",
      ),
      unreadable,
    ],
    [
      withDefaults(
        '    guide:\n      kind: file\n      target: "docs/usage/guide\\x2emd"\n',
      ),
      unreadable,
    ],
    [
      withDefaults(
        "    guide:\n      kind: file\n      target: 'docs/usage/guide.md'#unspaced\n",
      ),
      unreadable,
    ],
    [
      withDefaults(
        '    guide:\n      kind: file\n      target: "docs/usage/guide.md\n',
      ),
      unreadable,
    ],
    [
      withDefaults(
        "    guide:\n      kind: file\n      target: >-\n        docs/usage/guide.md\n",
      ),
      unreadable,
    ],
    [
      withDefaults(
        "    guide:\n      kind: file\n      target:\n        docs/usage/guide.md\n",
      ),
      unreadable,
    ],
    [
      withDefaults(
        "    guide:\n      kind: file\n      target: docs/usage/\n        guide.md\n",
      ),
      unreadable,
    ],
    [
      withDefaults("    guide:\n      kind: file\n      target: *guide\n"),
      unreadable,
    ],
    [
      withDefaults(
        '    guide:\n      kind: file\n      "target": docs/usage/guide.md\n',
      ),
      "has a line under defaults.declarations.guide that the drafter cannot read",
    ],
    [
      withDefaults(
        "    guide:\n      kind: file\n      target : docs/usage/guide.md\n",
      ),
      "has a line under defaults.declarations.guide that the drafter cannot read",
    ],
    [
      withDefaults(
        "    guide:\n      kind: file\n      ? target\n      : docs/usage/guide.md\n",
      ),
      "has a line under defaults.declarations.guide that the drafter cannot read",
    ],
    [
      `${header}"defaults":\n  declarations:\n    guide:\n      kind: file\n      target: docs/usage/guide.md\nprofiles:\n  complete:\n    description: Complete\n    declarations:\n${documentationDeclaration(6)}\n`,
      'has a line at its top level that the drafter cannot read: "defaults":',
    ],
    [
      `${header}defaults: {declarations: {guide: {kind: file, target: docs/usage/guide.md}}}\nprofiles:\n  complete:\n    description: Complete\n    declarations:\n${documentationDeclaration(6)}\n`,
      "writes defaults in a form the drafter cannot read",
    ],
    [
      `${header}defaults:\n  declarations:\n${documentationDeclaration(4)}\nprofiles:\n  complete: {description: Complete, declarations: {guide: {kind: file, target: docs/usage/guide.md}}}\n`,
      "writes profiles.complete in a form the drafter cannot read",
    ],
    [
      `${header}defaults:\n  declarations:\n${documentationDeclaration(4)}\nprofiles:\n  complete:\n    description: Complete\n    "declarations":\n      guide:\n        kind: file\n        target: docs/usage/guide.md\n`,
      "has a line under profiles.complete that the drafter cannot read",
    ],
  ]) {
    writeFileSync(beside, manifest);
    const outcome = draft(root, {
      script,
      input: request(root, { profile: undefined }),
    });
    assert.equal(outcome.status, 1, manifest);
    assert.equal(outcome.stdout, "");
    assert.ok(
      outcome.stderr.includes(`${beside} ${message}`),
      `${manifest}\n${outcome.stderr}`,
    );
  }
});

// The files of this repository that Git keeps, copied as Repository Standards
// copies a project for a discovery script.
function repositoryCopy(t) {
  const copy = mkdtempSync(join(tmpdir(), "repo-canon-copy-"));
  t.after(() => rmSync(copy, { recursive: true, force: true }));
  const paths = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: sourceRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  )
    .split("\0")
    .filter((path) => path && !path.startsWith(".repo-standards/"));
  for (const path of paths) {
    const from = join(sourceRoot, path);
    const state = lstatSync(from, { throwIfNoEntry: false });
    if (!state) continue;
    mkdirSync(dirname(join(copy, path)), { recursive: true });
    if (state.isSymbolicLink())
      symlinkSync(readlinkSync(from), join(copy, path));
    else copyFileSync(from, join(copy, path));
  }
  return copy;
}

test("drafts this repository's own documentation scope", (t) => {
  const root = repositoryCopy(t);
  const outcome = draft(root, { input: request(root, { profile: "factory" }) });
  assert.equal(outcome.status, 0, outcome.stderr);
  assertScopeProposal(outcome.proposal, root);
  const [entry] = outcome.proposal.declarations;
  const files = copiedFiles(root).filter(
    (path) => !exactOwnedAgentConfiguration.includes(path),
  );
  const factoryDocumentation = files.filter((path) =>
    path.startsWith("factory/docs/"),
  );
  assert.deepEqual(
    included(entry),
    [
      "GLOSSARY-MAP.md",
      "GLOSSARY.md",
      "factory/GLOSSARY.md",
      ...files.filter((path) => path.startsWith("docs/")),
    ].sort(),
  );
  const [rootQuestions, otherQuestions] = [true, false].map((asked) =>
    entry.unresolved.filter(
      (question) => question.startsWith("Is `factory/docs`") === asked,
    ),
  );
  assert.equal(rootQuestions.length, 1, entry.unresolved.join("\n"));
  assert.ok(
    otherQuestions.every((question) =>
      question.startsWith("Which of these Markdown files"),
    ),
    otherQuestions.join("\n"),
  );
  assert.ok(
    otherQuestions.some((question) =>
      question.includes("`authoring-notes.md`"),
    ),
  );

  // Answering the root question and the authoring notes' gives the scope the
  // repository's own documentation check passes.
  const answered = [
    ...included(entry),
    ...factoryDocumentation,
    "authoring-notes.md",
  ];
  const check = checkDraftedScope(root, answered);
  assert.equal(check.status, 0, check.stderr);
  assert.equal(check.result.status, "passed", check.result.message);
});
