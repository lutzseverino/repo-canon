import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const sharedInputs = [
  "AGENTS.md",
  "CONTRIBUTING.md",
  "docs/agents/README.md",
  "docs/agents/domain.md",
  "docs/agents/issue-tracker.md",
  "docs/agents/triage-labels.md",
  "scripts/support/fixture-authoring.mjs",
];

// What each builder records in its manifest, read the same way for all four.
const builders = [
  {
    name: "engineering",
    script: "scripts/create-engineering-skill-fixtures.mjs",
    manifest: (output) => JSON.parse(output),
    head: (manifest) => manifest.source.worktreeCommit,
    builderSha256: (manifest) => manifest.source.fixtureBuilderSha256,
    skills: (manifest) => manifest.skills,
    inputs: [],
    laterCommit: "architecture",
  },
  {
    name: "productivity",
    script: "scripts/create-productivity-skill-fixtures.mjs",
    manifest: (output) => JSON.parse(output),
    head: (manifest) => manifest.source.worktreeCommit,
    builderSha256: (manifest) => manifest.source.builderSha256,
    skills: (manifest) => manifest.source.skills,
    inputs: [],
    laterCommit: "teach",
  },
  {
    name: "planning",
    script: "scripts/create-planning-skill-fixtures.mjs",
    manifest: (_output, root) =>
      JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")),
    head: (manifest) => manifest.source.repositoryHead,
    builderSha256: (manifest) => manifest.source.fixtureBuilderSha256,
    skills: (manifest) => manifest.source.linkedSkillDirectories,
    inputs: [],
    laterCommit: "delivery",
  },
  {
    name: "deliver",
    script: "scripts/create-deliver-skill-fixtures.mjs",
    manifest: (output) => JSON.parse(output),
    head: (manifest) => manifest.source.worktreeCommit,
    builderSha256: (manifest) => manifest.source.builderSha256,
    skills: (manifest) => manifest.source.skills,
    inputs: [
      ".github/PULL_REQUEST_TEMPLATE.md",
      ".github/workflows/pr-metadata.yml",
      ".github/scripts/validate-pr-metadata.mjs",
      "operations/lib/rendered-markdown.mjs",
      "vendor/marked/marked.esm.js",
      "vendor/parse5/parse5.esm.js",
      "scripts/support/exercise-gh.mjs",
      "scripts/support/exercise-repo-standards.mjs",
    ],
    laterCommit: "work",
  },
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
  }).trim();
}

function sha256Directory(root) {
  const digest = createHash("sha256");
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
      (left, right) => left.name.localeCompare(right.name),
    )) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else {
        digest.update(relative(root, absolute).replaceAll("\\", "/"));
        digest.update("\0");
        digest.update(readFileSync(absolute));
        digest.update("\0");
      }
    }
  }
  visit(root);
  return digest.digest("hex");
}

test("every builder records its dirty source bytes and builds repositories with local Git policy that survives hostile host signing", (t) => {
  const parent = mkdtempSync(
    join(tmpdir(), "repo-canon-builder-provenance-test-"),
  );
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const source = join(parent, "source");
  cpSync(repositoryRoot, source, {
    recursive: true,
    filter: (path) => basename(path) !== ".git",
  });
  git(source, "init", "--quiet", "--initial-branch=main");
  git(source, "config", "user.name", "Repo Canon provenance test");
  git(source, "config", "user.email", "provenance@example.invalid");
  git(source, "config", "commit.gpgsign", "false");
  git(source, "add", "--all");
  git(source, "commit", "--quiet", "-m", "chore: establish provenance source");
  const sourceHead = git(source, "rev-parse", "HEAD");

  // Uncommitted changes to shared guidance, the fixture-authoring module, and
  // one skill of each builder, so only the working tree's bytes can match.
  const dirtyFiles = ["AGENTS.md", "scripts/support/fixture-authoring.mjs"];
  const dirtySkills = {
    engineering: "tdd",
    productivity: "grilling",
    planning: "tdd",
    deliver: "deliver",
  };
  const dirtySkillDirectories = [
    "vendor/mattpocock-skills/skills/engineering/tdd",
    "vendor/mattpocock-skills/skills/productivity/grilling",
    ".agents/skills/deliver",
  ];
  const committedSkillSha256 = Object.fromEntries(
    dirtySkillDirectories.map((path) => [
      path,
      sha256Directory(join(source, path)),
    ]),
  );
  for (const path of dirtyFiles)
    appendFileSync(
      join(source, path),
      path.endsWith(".mjs")
        ? "\n// uncommitted provenance test\n"
        : "\n<!-- uncommitted provenance test -->\n",
    );
  for (const path of dirtySkillDirectories) {
    appendFileSync(
      join(source, path, "SKILL.md"),
      "\n<!-- uncommitted provenance test -->\n",
    );
    assert.notEqual(
      sha256Directory(join(source, path)),
      committedSkillSha256[path],
    );
  }
  for (const path of dirtyFiles)
    assert.notEqual(
      sha256(readFileSync(join(source, path))),
      sha256(execFileSync("git", ["show", `HEAD:${path}`], { cwd: source })),
    );

  // A host whose global configuration requires signing with an unusable
  // program, for the builds and for the later ordinary commits.
  const hostileGlobalConfig = join(parent, "hostile-global-gitconfig");
  const hostileGlobalConfigBytes =
    "[commit]\n\tgpgSign = true\n[gpg]\n\tprogram = /bin/false\n";
  writeFileSync(hostileGlobalConfig, hostileGlobalConfigBytes);
  const hostileEnv = { ...process.env, GIT_CONFIG_GLOBAL: hostileGlobalConfig };

  for (const builder of builders) {
    const root = join(parent, builder.name);
    const manifest = builder.manifest(
      execFileSync(
        process.execPath,
        [join(source, builder.script), "--root", root],
        { cwd: source, encoding: "utf8", env: hostileEnv },
      ),
      root,
    );

    assert.equal(builder.head(manifest), sourceHead, builder.name);
    assert.equal(
      manifest.source.directoryHashSerialization,
      "repo-canon/directory-sha256/recursive-locale-path-nul-bytes-nul/v1",
      builder.name,
    );
    const { inputFiles } = manifest.source;
    for (const path of [...sharedInputs, ...builder.inputs, builder.script])
      assert.ok(path in inputFiles, `${builder.name} records ${path}`);
    for (const [path, { sha256: recorded }] of Object.entries(inputFiles))
      assert.equal(
        recorded,
        sha256(readFileSync(join(source, path))),
        `${builder.name} ${path}`,
      );
    assert.equal(
      builder.builderSha256(manifest),
      inputFiles[builder.script].sha256,
      builder.name,
    );
    const skills = builder.skills(manifest);
    assert.ok(dirtySkills[builder.name] in skills, builder.name);
    for (const [skill, { path, sha256: recorded }] of Object.entries(skills))
      assert.equal(recorded, sha256Directory(path), `${builder.name} ${skill}`);

    for (const [name, repository] of Object.entries(manifest.repositories)) {
      const label = `${builder.name} ${name}`;
      const local = (key) =>
        git(repository.path, "config", "--local", "--get", key);
      assert.equal(local("commit.gpgsign"), "false", label);
      assert.equal(local("user.name"), "Repo Canon Exercise", label);
      assert.equal(local("user.email"), "exercise@example.invalid", label);
      assert.equal(git(repository.path, "branch", "--show-current"), "main");
      if (builder.name !== "deliver")
        assert.equal(git(repository.path, "remote"), "", label);
    }

    const repository = manifest.repositories[builder.laterCommit].path;
    writeFileSync(
      join(repository, "later-agent-work.md"),
      "# Later agent work\n",
    );
    execFileSync("git", ["add", "--all"], { cwd: repository, env: hostileEnv });
    execFileSync(
      "git",
      ["commit", "--quiet", "-m", "test: record later agent work"],
      { cwd: repository, env: hostileEnv },
    );
  }
  assert.equal(
    readFileSync(hostileGlobalConfig, "utf8"),
    hostileGlobalConfigBytes,
  );
});
