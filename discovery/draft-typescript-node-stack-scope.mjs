import { readFileSync, readdirSync } from "node:fs";
import { isAbsolute, sep } from "node:path";
import {
  isWorkspaceMember,
  joinPath,
  manifestName,
  parentOf,
  pnpmWorkspaceName,
  stackDifferences,
  workspaceConfiguration,
} from "../operations/lib/typescript-node-stack.mjs";

// Drafts the `typescript-node-stack` scope of a repository from its manifests
// and workspace configuration, as a Repository Standards scope proposal: one
// `package.json` per Project. It is that declaration's discovery script:
// Repository Standards runs it during inspection in a copy of the project,
// which holds the files Git keeps without Git metadata or `.repo-standards`,
// and passes a discovery request on standard input. A Project that matches the
// stack's manifest facts is included and one that differs is excluded with
// its differences, through the module the stack's check uses. Without an
// included Project the draft proposes no scope. It reads the copy and writes
// the proposal to standard output.

const requestFormat = "repo-standards/discovery/v1";
const proposalFormat = "repo-standards/scope/v2";
const declarationId = "typescript-node-stack";
const drafterPath = "discovery/draft-typescript-node-stack-scope.mjs";

// Paths Repository Standards reserves, which no declaration's scope can hold:
// its product state and its system skills, with their skill links.
const reservedPaths = [
  ".repo-standards",
  ...["repository-standards", "author-standards"].flatMap((name) => [
    `.agents/skills/${name}`,
    `.claude/skills/${name}`,
  ]),
];

// Directory names that hold test fixtures, generated output, or copied
// third-party code rather than a maintained Project. A manifest below one is
// excluded unless a workspace lists it as a member.
const unmaintainedDirectories = [
  "__fixtures__",
  "__mocks__",
  "build",
  "coverage",
  "dist",
  "fixture",
  "fixtures",
  "generated",
  "node_modules",
  "out",
  "testdata",
  "vendor",
];

function fail(message) {
  throw new Error(message);
}

function code(path) {
  return `\`${path}\``;
}

function isWithin(path, directory) {
  return path === directory || path.startsWith(`${directory}/`);
}

function byPath(left, right) {
  return left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
}

// The discovery request on standard input: its project root.
function readRequest(argv) {
  if (argv.length > 0)
    fail(
      `Unknown argument ${argv[0]}. The drafter takes no arguments; it reads a ${requestFormat} request on standard input.`,
    );
  let request;
  try {
    request = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return fail(`Standard input must hold a ${requestFormat} request.`);
  }
  if (request?.format !== requestFormat)
    fail(`Standard input must hold a ${requestFormat} request.`);
  if (request.declaration !== declarationId)
    fail(
      `The request names the ${code(String(request.declaration))} declaration; the drafter drafts ${code(declarationId)}.`,
    );
  if (
    typeof request.projectRoot !== "string" ||
    !isAbsolute(request.projectRoot)
  )
    fail("The request's projectRoot must be an absolute path.");
  return { projectRoot: request.projectRoot };
}

function absolutePath(projectRoot, path) {
  return path === ""
    ? projectRoot
    : `${projectRoot}${sep}${path.split("/").join(sep)}`;
}

// The regular files of the copy, outside the reserved paths and `node_modules`,
// reached through real directories only. The copy holds the files Git keeps,
// so these are the paths the CLI's discovery observation offers as evidence.
function keptFiles(projectRoot) {
  const files = new Set();
  const visit = (directory) => {
    for (const entry of readdirSync(absolutePath(projectRoot, directory), {
      withFileTypes: true,
    })) {
      const path = joinPath(directory, entry.name);
      if (
        path === ".git" ||
        entry.name === "node_modules" ||
        reservedPaths.some((reserved) => isWithin(path, reserved))
      )
        continue;
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.add(path);
    }
  };
  visit("");
  return files;
}

function relativeTo(directory, ancestor) {
  return ancestor === "" ? directory : directory.slice(ancestor.length + 1);
}

// The workspaces of the copy, by root directory: each directory whose
// `pnpm-workspace.yaml` or `package.json` configures one.
function workspaces(projectRoot, files) {
  const directories = new Set(
    [...files]
      .filter((path) =>
        [manifestName, pnpmWorkspaceName].includes(
          path.slice(path.lastIndexOf("/") + 1),
        ),
      )
      .map(parentOf),
  );
  const found = new Map();
  for (const directory of directories) {
    const configuration = workspaceConfiguration(projectRoot, directory);
    if (configuration) found.set(directory, configuration);
  }
  return found;
}

// The workspace that lists a directory as a member, nearest first, or null.
function listingWorkspace(directory, found) {
  for (
    let ancestor = directory;
    ancestor !== "";
    ancestor = parentOf(ancestor)
  ) {
    const root = parentOf(ancestor);
    const configuration = found.get(root);
    if (
      configuration?.patterns &&
      isWorkspaceMember(configuration.patterns, relativeTo(directory, root))
    )
      return { root, configuration };
  }
  return null;
}

const reasons = {
  matches: (path) =>
    `The Project of ${code(path)} matches the typescript-node stack's manifest facts: pnpm 11, its lockfile, Node.js 24 or 26, oxlint 1, Prettier 3 and a validate script.`,
  differs: (path, differences) =>
    `The Project of ${code(path)} differs from the typescript-node stack, so it stays out of the scope until a migration brings it in: ${differences.join(" ")}`,
  unmaintained: (path, directory) =>
    `${code(path)} lies under ${code(directory)}, which holds fixtures, generated output, or copied code rather than a maintained Project, and no workspace lists it.`,
};

const questions = {
  standalone: (path) =>
    `Is ${code(path)} the manifest of a maintained Project? No workspace lists it. If it is, include it when it matches the stack, or exclude it naming its differences; otherwise exclude it as no maintained Project.`,
  workspace: (path) =>
    `${code(path)} states its workspace members in a form the drafter cannot read. Which manifests under it belong to maintained Projects? Include each one that matches the stack and exclude the rest with their reasons.`,
};

function coverage({ included, projects }) {
  const drafted = `Drafted from manifests and workspace configuration by ${code(drafterPath)}: one ${code(manifestName)} per Project, a workspace's root and members alike, included when it matches the stack's manifest facts and excluded naming its differences otherwise.`;
  if (included > 0) return drafted;
  if (projects === 0)
    return `${drafted} The repository holds no Node.js Project, so the declaration has no scope.`;
  return `${drafted} No Project matches the stack, so the declaration has no scope; each differing Project stays out until a migration brings it in.`;
}

function draftStackScope({ projectRoot }) {
  const files = keptFiles(projectRoot);
  const found = workspaces(projectRoot, files);
  const candidates = [];
  const unresolved = [];
  let projects = 0;

  for (const configuration of found.values())
    if (configuration.unreadable)
      unresolved.push(questions.workspace(configuration.sources[0]));

  const manifests = [...files]
    .filter(
      (path) => path === manifestName || path.endsWith(`/${manifestName}`),
    )
    .sort();
  for (const path of manifests) {
    const directory = parentOf(path);
    const ownWorkspace = found.get(directory);
    const unreadableAbove = [...found].some(
      ([root, configuration]) =>
        configuration.unreadable &&
        root !== directory &&
        (root === "" || isWithin(directory, root)),
    );
    const isProject =
      directory === "" ||
      ownWorkspace !== undefined ||
      listingWorkspace(directory, found) !== null;
    if (!isProject) {
      if (unreadableAbove) continue;
      const unmaintained = directory
        .split("/")
        .map((_, index, segments) => segments.slice(0, index + 1).join("/"))
        .find((ancestor) =>
          unmaintainedDirectories.includes(
            ancestor.slice(ancestor.lastIndexOf("/") + 1),
          ),
        );
      if (unmaintained)
        candidates.push({
          path,
          decision: "exclude",
          reason: reasons.unmaintained(path, unmaintained),
          evidence: [path],
        });
      else unresolved.push(questions.standalone(path));
      continue;
    }
    projects += 1;
    const { differences, evidence } = stackDifferences(projectRoot, path);
    candidates.push(
      differences.length === 0
        ? { path, decision: "include", reason: reasons.matches(path), evidence }
        : {
            path,
            decision: "exclude",
            reason: reasons.differs(path, differences),
            evidence: [path],
          },
    );
  }

  const included = candidates.filter(
    (candidate) => candidate.decision === "include",
  ).length;
  const entry = {
    id: declarationId,
    coverage: coverage({ included, projects }),
    candidates: candidates.sort(byPath),
    unresolved: unresolved.sort(),
  };
  if (included === 0) entry.noScope = true;
  return { format: proposalFormat, declarations: [entry] };
}

try {
  process.stdout.write(
    `${JSON.stringify(draftStackScope(readRequest(process.argv.slice(2))), null, 2)}\n`,
  );
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
