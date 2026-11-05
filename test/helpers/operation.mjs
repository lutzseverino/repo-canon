import { declarations } from "../../scripts/standards-declarations.mjs";
import {
  execFixtureGit,
  fixtureGitEnvironment,
} from "../../scripts/support/fixture-git.mjs";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

const sourceRoot = new URL("../..", import.meta.url).pathname;

// Every executable run, including discovery and remote-setup probes.
export function declaredOperations(root = sourceRoot) {
  return Object.values(declarations(root))
    .flat()
    .flatMap((declaration) =>
      [
        declaration["discovery-script"],
        ...(declaration.checks ?? []),
        ...(declaration.fixes ?? []).flatMap((fix) => [
          fix,
          fix["remote-setup"]?.probe,
        ]),
      ].filter(Boolean),
    );
}

function declaredResources(scriptPath) {
  const operation = declaredOperations().find(
    ({ run }) => run.script === scriptPath,
  );
  if (!operation)
    throw new Error(
      `standards.yaml declares no operation script ${scriptPath}.`,
    );
  return operation.run.resources ?? [];
}

// Copies an operation script and only its declared resources into a fresh
// tree, as the CLI retains them.
export function retainedCheck(t, scriptPath) {
  const root = mkdtempSync(join(tmpdir(), "repo-canon-retained-check-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const path of [scriptPath, ...declaredResources(scriptPath)]) {
    const destination = join(root, path);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(join(sourceRoot, path), destination, { recursive: true });
  }
  return join(root, scriptPath);
}

export function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "repo-canon-operation-"));
  for (const [path, content] of Object.entries(files)) {
    const absolute = join(root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  }
  execFixtureGit(["init", "--quiet"], { cwd: root });
  return { root, close: () => rmSync(root, { recursive: true, force: true }) };
}

export function invokeCheck(script, root, overrides = {}) {
  const request = {
    format: "repo-standards/operation/v2",
    operation: {
      declaration: "repository-readme",
      phase: "checks",
      id: "structure",
    },
    projectRoot: root,
    standards: {
      repository: "https://github.com/lutzseverino/repo-canon",
      version: "v0.0.0-test",
      commit: "0000000000000000000000000000000000000000",
    },
    profile: "standard",
    declarations: [],
    overwriteAllowed: false,
    allowedTargets: { paths: ["README.md"], directories: [] },
    ...overrides,
  };
  const child = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: "utf8",
    env: fixtureGitEnvironment(),
    input: JSON.stringify(request),
  });
  return {
    ...child,
    result:
      child.status === 0 && child.stdout.trim()
        ? JSON.parse(child.stdout)
        : null,
  };
}

export function invokeOperation(script, request, options = {}) {
  const child = spawnSync(
    process.execPath,
    [...(options.nodeArguments ?? []), script],
    {
      cwd: request.projectRoot,
      encoding: "utf8",
      env: fixtureGitEnvironment(options.env),
      input: JSON.stringify(request),
    },
  );
  return {
    ...child,
    result:
      child.status === 0 && child.stdout.trim()
        ? JSON.parse(child.stdout)
        : null,
  };
}

export function snapshot(root) {
  const entries = {};
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const absolute = join(directory, entry.name);
      const path = relative(root, absolute).replaceAll("\\", "/");
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isSymbolicLink())
        entries[path] = `symlink:${readlinkSync(absolute)}`;
      else entries[path] = readFileSync(absolute).toString("base64");
    }
  }
  visit(root);
  return entries;
}
