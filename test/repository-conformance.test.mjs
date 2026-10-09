import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  exactOwnedAgentConfiguration,
  fileDeclarations,
} from "./helpers/documentation.mjs";
import { invokeCheck } from "./helpers/operation.mjs";

// This repository is an adopter of its own published standards, so the shipped
// checks run against the real tree on every pull request instead of against
// fixtures only. It has no Project READMEs, and an empty Project README scope
// cannot fail, so that check runs against fixtures only. The documentation
// check runs against this repository here and nowhere else. The documentation
// paths below are the repository's documentation scope: the documentation tree,
// the repository-root glossary, and the authoring notes. The source-side
// guidance, the discovery instructions, and the vendored material stay out.
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
    .filter((path) => !exactOwnedAgentConfiguration.includes(path));
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

function snapshotFiles(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${prefix}${entry.name}`;
    return entry.isDirectory()
      ? snapshotFiles(join(directory, entry.name), `${path}/`)
      : [path];
  });
}

test("the shipped Matt Pocock set and bytes match the v1.3.1 plugin manifest", () => {
  assert.deepEqual(
    snapshotFiles(snapshotRoot).sort(),
    Object.keys(upstreamSnapshot.files).sort(),
  );
  for (const [path, expected] of Object.entries(upstreamSnapshot.files)) {
    assert.equal(
      createHash("sha256")
        .update(readFileSync(join(snapshotRoot, path)))
        .digest("hex"),
      expected,
      `${path} matches ${upstreamSnapshot.tag} (${upstreamSnapshot.commit})`,
    );
  }
  const manifest = JSON.parse(
    readFileSync(join(snapshotRoot, ".claude-plugin/plugin.json"), "utf8"),
  );
  assert.equal(manifest.version, "1.3.1");
  const declarations = readFileSync(join(root, "standards.yaml"), "utf8");
  const shipped = [
    ...declarations.matchAll(
      /source: vendor\/mattpocock-skills\/(skills\/[^\s]+)/g,
    ),
  ]
    .map((match) => `./${match[1]}`)
    .sort();
  assert.deepEqual(shipped, [...manifest.skills].sort());
  assert.ok(
    !shipped.some((path) => path.endsWith("/resolving-merge-conflicts")),
  );
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

test("adoption includes the complete show-me skill from its pinned HumanLayer upstream", () => {
  const standards = readFileSync(join(root, "standards.yaml"), "utf8");
  assert.match(
    standards,
    /\n {4}skill-show-me:\n {6}kind: skill\n {6}name: show-me\n {6}source: vendor\/humanlayer-skills\/skills\/show-me\n/,
  );

  // Independent hashes of the upstream files at this commit, including the
  // SKILL.md instructions for optional HTML output. No network is needed in CI.
  const pin = "653b6411c1f70c275a18e37673b042ff99f67ceb";
  const upstreamPath = "plugins/show-me/skills/show-me";
  const source = join(root, "vendor/humanlayer-skills/skills/show-me");
  const files = readdirSync(source, { recursive: true })
    .filter((path) => lstatSync(join(source, path)).isFile())
    .sort();
  const expected = {
    "SKILL.md":
      "434a2346cc95e313b0d367d477dda2e23ba642dd2181757415a09500664af100",
    "agents/openai.yaml":
      "a1499d95abd8447558c535fe5554adcc3c9b988a0a39264a6283d430effe1e94",
  };
  assert.deepEqual(files, Object.keys(expected));
  for (const [path, digest] of Object.entries(expected)) {
    assert.equal(
      createHash("sha256")
        .update(readFileSync(join(source, path)))
        .digest("hex"),
      digest,
      `${path} must match humanlayer/skills at ${pin}:${upstreamPath}`,
    );
  }
  const provenance = readFileSync(
    join(root, "vendor/humanlayer-skills/README.md"),
    "utf8",
  );
  assert.ok(
    provenance.includes(
      `https://github.com/humanlayer/skills/tree/${pin}/${upstreamPath}`,
    ),
  );
});

test("adoption retains the HumanLayer MIT notice beside the copied skills", () => {
  const standards = readFileSync(join(root, "standards.yaml"), "utf8");
  assert.match(
    standards,
    /\n {4}humanlayer-skills-license:\n {6}kind: file\n {6}target: \.agents\/skills\/LICENSE\.humanlayer-skills\n {6}exact: vendor\/humanlayer-skills\/LICENSE\n/,
  );
  assert.equal(
    createHash("sha256")
      .update(readFileSync(join(root, "vendor/humanlayer-skills/LICENSE")))
      .digest("hex"),
    "5f13c18ea00ea5c1384f41745feeca774079164f7f59a92e4ac0899ad217b26f",
  );
  const notices = readFileSync(join(root, "THIRD_PARTY_NOTICES.md"), "utf8");
  assert.match(
    notices,
    /\[MIT License and copyright notice\]\(vendor\/humanlayer-skills\/LICENSE\)/,
  );
  assert.ok(notices.includes(".agents/skills/LICENSE.humanlayer-skills"));
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
    readdirSync(join(root, ".agents/skills/babysit"), { recursive: true }),
    ["SKILL.md"],
  );
});

test("the installed agent guidance ends every change as a babysat pull request", () => {
  const declarations = readFileSync(join(root, "standards.yaml"), "utf8");
  assert.ok(declarations.includes("target: AGENTS.md\n      exact: AGENTS.md"));
  assert.ok(
    readFileSync(join(root, "AGENTS.md"), "utf8")
      .replaceAll(/\s+/g, " ")
      .includes(
        "Deliver every change as one pull request: open it as `CONTRIBUTING.md` says, write its body with `pr`, then `babysit` it until it merges.",
      ),
  );
});
