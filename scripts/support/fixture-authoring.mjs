import { execFixtureGit } from "./fixture-git.mjs";
import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const helperPath = fileURLToPath(import.meta.url);

export const DIRECTORY_HASH_SERIALIZATION =
  "repo-canon/directory-sha256/recursive-locale-path-nul-bytes-nul/v1";

function git(root, args) {
  return execFixtureGit(args, { cwd: root, encoding: "utf8" }).trim();
}

export function initializeFixtureRepository(root, { author, remote = null }) {
  git(root, ["init", "--quiet", "--initial-branch=main"]);
  git(root, ["config", "user.name", author.name]);
  git(root, ["config", "user.email", author.email]);
  git(root, ["config", "commit.gpgsign", "false"]);
  if (remote !== null) git(root, ["remote", "add", "origin", remote]);
}

export function commitFixture(root, message) {
  git(root, ["add", "--all"]);
  git(root, ["commit", "--quiet", "--no-gpg-sign", "-m", message]);
  return git(root, ["rev-parse", "HEAD"]);
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function hashDirectory(root) {
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

export function identifyFixtureSource({
  sourceRoot,
  builderPath,
  files = [],
  directories = {},
}) {
  const helperSourcePath = relative(sourceRoot, helperPath).replaceAll(
    "\\",
    "/",
  );
  const sourceFiles = [
    ...new Set([
      builderPath,
      ...files,
      helperSourcePath,
      "scripts/support/fixture-git.mjs",
    ]),
  ];
  return {
    head: git(sourceRoot, ["rev-parse", "HEAD"]),
    inputFiles: Object.fromEntries(
      sourceFiles.map((path) => [
        path,
        {
          sha256: hashFile(join(sourceRoot, path)),
        },
      ]),
    ),
    directories: Object.fromEntries(
      Object.entries(directories).map(([name, path]) => [
        name,
        {
          path,
          sha256: hashDirectory(path),
        },
      ]),
    ),
    directoryHashSerialization: DIRECTORY_HASH_SERIALIZATION,
  };
}

// Inputs copied by the local-only rules adapter, shared by all three builders.
export const fixtureStandardsInputs = [
  "rules/comments.md",
  "rules/planning.md",
  "rules/github-repository-configuration.md",
  "rules/factory-workflow.md",
  "scripts/support/repository-standards/SKILL.md",
  "scripts/support/repository-standards/rules.mjs",
];

export function installFixtureStandards(
  sourceRoot,
  root,
  profile = "standard",
) {
  const write = (repository, path, content) => {
    const target = join(repository, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  };
  cpSync(
    join(sourceRoot, "scripts/support/repository-standards"),
    join(root, ".agents/skills/repository-standards"),
    { recursive: true },
  );
  const declarations = [
    "comments",
    "planning",
    "github-repository-configuration",
  ];
  if (profile === "factory") declarations.push("factory-workflow");
  const rules = declarations.map((declaration) => {
    const input = `rules/${declaration}.md`;
    const path = `.repo-standards/${input}`;
    write(root, path, readFileSync(join(sourceRoot, input)));
    return { declaration, coverage: "repository", path, input };
  });
  write(
    root,
    ".repo-standards/rules/index.json",
    `${JSON.stringify({ profile, rules }, null, 2)}\n`,
  );
  write(
    root,
    ".repo-standards/rules/README.md",
    `# Installed exercise rules\n\nProfile: ${profile}. These canonical rules apply to the whole repository, including tracker work.\n\nRun \`node .agents/skills/repository-standards/rules.mjs [path]\` from the fixture root.\n\n${rules.map(({ declaration }) => `- [${declaration}](${declaration}.md) covers the whole repository.`).join("\n")}\n`,
  );
}
