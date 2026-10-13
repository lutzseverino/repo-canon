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

// Run the shipped documentation checks against both contexts and the factory's
// Project README. Source-side guidance, discovery instructions, and vendored
// material stay out of the repository's documentation scope.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootDocuments = [
  "GLOSSARY.md",
  "GLOSSARY-MAP.md",
  "factory/GLOSSARY.md",
  "authoring-notes.md",
];

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
        (path.startsWith("docs/") || path.startsWith("factory/docs/")) &&
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

test("the factory passes the Project README check", () => {
  const outcome = invokeCheck(operation("check-project-readmes.mjs"), root, {
    operation: {
      declaration: "project-readmes",
      phase: "checks",
      id: "project-readme-structure",
    },
    allowedTargets: { paths: ["factory/README.md"], directories: [] },
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

test("the repository passes the sandbox image check at its root", () => {
  const outcome = invokeCheck(operation("check-sandbox-image.mjs"), root, {
    operation: {
      declaration: "factory-sandbox-image",
      phase: "checks",
      id: "sandbox-image-base",
    },
    allowedTargets: { paths: [".sandcastle/Dockerfile"], directories: [] },
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "passed", outcome.result.message);
});

test("the sandbox image is a contextual declaration whose only target is the image", () => {
  const declarations = readFileSync(join(root, "standards.yaml"), "utf8");
  const declaration = declarations.match(
    /^ {4}factory-sandbox-image:\n((?: {6}.+\n)+)/m,
  )?.[1];
  assert.ok(declaration, "the profile declares factory-sandbox-image");
  assert.match(
    declaration,
    /^ {6}kind: file\n {6}target: \.sandcastle\/Dockerfile\n {6}guidance: guidance\/factory-sandbox-image\.md\n {6}checks:\n/,
  );
  assert.doesNotMatch(declaration, /^ {6}(?:exact|fixes|discovery):/m);
  assert.equal(
    [...declarations.matchAll(/^\s+target: \.sandcastle\/Dockerfile$/gm)]
      .length,
    1,
    "only factory-sandbox-image owns the image",
  );
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

test("the vendored Matt Pocock bytes match the v1.3.1 plugin manifest, and all but implement-spec ship", () => {
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
  // Every factory run is a direct run, so the vendored `implement-spec` is not
  // installed.
  assert.deepEqual(
    shipped,
    manifest.skills
      .filter((path) => path !== "./skills/engineering/implement-spec")
      .sort(),
  );
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
    readdirSync(join(root, ".agents/skills/babysit"), {
      recursive: true,
    }).sort(),
    ["SKILL.md", "reviewer.mjs", "wait.mjs"],
  );
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
    /`gh pr merge <number> --squash --match-head-commit <SHA>`, where `<SHA>` is the full SHA that starts the wait's latest line\. If GitHub refuses because the head no longer matches, return to step 1\./,
  );
  assert.match(
    babysit,
    /When pushed fixes change enough to warrant another look/,
  );
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

test("the installed agent guidance ends every change as a babysat pull request", () => {
  const declarations = readFileSync(join(root, "standards.yaml"), "utf8");
  assert.ok(declarations.includes("target: AGENTS.md\n      exact: AGENTS.md"));
  assert.ok(
    flowedText("AGENTS.md").includes(
      "Deliver every change as one pull request: open it as `CONTRIBUTING.md` says, write its body with `pr`, then `babysit` it until it merges.",
    ),
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
  assert.match(babysit, /warrant another look/);
  assert.doesNotMatch(
    babysit,
    /ticket or scope|another layer|only the owner writes/,
  );
});

test("adoption installs the factory's exact files, which name no repository", () => {
  const declarations = readFileSync(join(root, "standards.yaml"), "utf8");
  const factory = {
    "factory-adapter": ".sandcastle/adapter.ts",
    "factory-decision-core": ".sandcastle/factory.ts",
    "factory-entry": ".sandcastle/main.ts",
    "factory-gitignore": ".sandcastle/.gitignore",
  };
  for (const [id, path] of Object.entries(factory)) {
    assert.ok(
      declarations.includes(
        `\n    ${id}:\n      kind: file\n      target: ${path}\n      exact: ${path}\n`,
      ),
      `${id} must install ${path} exactly`,
    );
  }
  // The sandbox image is the repository's own, from its contextual declaration.
  assert.deepEqual(
    trackedFiles()
      .filter((path) => path.startsWith(".sandcastle/"))
      .sort(),
    [...Object.values(factory), ".sandcastle/Dockerfile"].sort(),
  );
  for (const path of Object.values(factory)) {
    assert.doesNotMatch(
      readFileSync(join(root, path), "utf8"),
      /repo-canon|lutzseverino/i,
      `${path} must name no repository`,
    );
  }
  assert.match(
    readFileSync(join(root, ".sandcastle/main.ts"), "utf8"),
    /\nconst sandcastleVersion = "\d+\.\d+\.\d+";\n/,
  );
});
