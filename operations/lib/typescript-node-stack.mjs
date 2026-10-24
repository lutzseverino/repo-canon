import { lstatSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { localPathExists } from "./local-markdown-links.mjs";

// The facts of the `typescript-node` stack that a Project's manifests show,
// shared by the stack's check and its scope drafter so that both read a
// Project the same way. A Project is one `package.json`; its workspace root is
// the nearest directory at or above it whose workspace configuration lists
// it, or its own directory. Workspace-shared facts (`packageManager`, the
// lockfile and `engines`) are read at that root.

export const manifestName = "package.json";
export const lockfileName = "pnpm-lock.yaml";
export const pnpmWorkspaceName = "pnpm-workspace.yaml";
export const nodeMajors = [24, 26];
// The development tools a Project or its workspace root declares, with their
// major versions.
export const declaredTools = [
  { name: "oxlint", major: 1 },
  { name: "prettier", major: 3 },
];

const dependencyFields = ["dependencies", "devDependencies"];

function absolutePath(projectRoot, path) {
  return join(projectRoot, ...path.split("/"));
}

// The directory that holds a path, or '' for a path at the repository root.
export function parentOf(path) {
  const end = path.lastIndexOf("/");
  return end < 0 ? "" : path.slice(0, end);
}

export function joinPath(directory, name) {
  return directory === "" ? name : `${directory}/${name}`;
}

function code(text) {
  return `\`${text}\``;
}

function series(items) {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

// Whether a path is a project-relative `package.json` path, at the root or in a
// directory.
export function isManifestPath(path) {
  return (
    typeof path === "string" &&
    path !== "" &&
    !posix.isAbsolute(path) &&
    !path.includes("\\") &&
    posix.normalize(path) === path &&
    path !== ".." &&
    !path.startsWith("../") &&
    posix.basename(path) === manifestName
  );
}

// Whether a regular file, not a symbolic link, lies at a path inside the
// project. Every file the module reads passes through here: the shared
// local-path policy refuses a path whose directories leave the project
// through a symbolic link, as the Project README check does.
export function isRegularFile(projectRoot, path) {
  try {
    return (
      localPathExists(projectRoot, path) &&
      lstatSync(absolutePath(projectRoot, path)).isFile()
    );
  } catch {
    return false;
  }
}

// The parsed manifest at a path: `{ manifest }`, or `{ missing: true }` when no
// regular file lies there, or `{ unreadable: true }` when it is not a JSON
// object.
export function readManifest(projectRoot, path) {
  if (!isRegularFile(projectRoot, path)) return { missing: true };
  try {
    const manifest = JSON.parse(
      readFileSync(absolutePath(projectRoot, path), "utf8"),
    );
    if (
      manifest === null ||
      typeof manifest !== "object" ||
      Array.isArray(manifest)
    )
      return { unreadable: true };
    return { manifest };
  } catch {
    return { unreadable: true };
  }
}

// A YAML scalar without its quotes or trailing comment, or null for a form
// this reader does not decode. Single quotes decode `''`, and double quotes
// decode only `\\"`, `\\\\` and `\\/`. A plain scalar may not start with an
// indicator or hold a mapping's `: `, and inside a flow collection it may not
// hold a flow indicator.
function yamlScalar(value, { flow = false } = {}) {
  const text = value.trim();
  if (text === "" || text.startsWith("#")) return null;
  const single = /^'((?:[^']|'')*)'\s*(?:#.*)?$/.exec(text);
  if (single) return single[1].replaceAll("''", "'");
  const double = /^"((?:[^"\\]|\\["\\/])*)"\s*(?:#.*)?$/.exec(text);
  if (double) return double[1].replace(/\\(["\\/])/g, "$1");
  if (/^(?:["'&*!|>%@`[\]{},#]|[-?:](?:\s|$))/.test(text)) return null;
  const plain = text.replace(/\s+#.*$/, "");
  if (/:(?:\s|$)/.test(plain) || (flow && /[[\]{},]/.test(plain))) return null;
  return plain;
}

// The items of a flow sequence that opens at the start of `text`, which may
// span lines: `{ items, rest }`, with the text after its closing bracket, or
// null for a form this reader does not decode. Items split only at commas
// outside quoted scalars and outside nested brackets and braces, a `#` after
// whitespace outside quotes starts a comment, and one trailing comma is
// allowed. A nested collection or an item spanning lines is not decoded.
function flowSequence(text) {
  const items = [];
  let item = "";
  let depth = 0;
  let quote = null;
  for (let index = 1; index < text.length; index++) {
    const character = text[index];
    if (quote === "'") {
      item += character;
      if (character === "'") {
        if (text[index + 1] === "'") item += text[++index];
        else quote = null;
      }
      continue;
    }
    if (quote === '"') {
      item += character;
      if (character === "\\") item += text[++index] ?? "";
      else if (character === '"') quote = null;
      continue;
    }
    if (character === "#" && (index === 1 || /\s/.test(text[index - 1]))) {
      while (index + 1 < text.length && text[index + 1] !== "\n") index++;
      continue;
    }
    if (character === "'" || character === '"') quote = character;
    else if (character === "[" || character === "{") depth++;
    else if ((character === "]" || character === "}") && depth > 0) depth--;
    else if (character === "]") {
      items.push(item);
      const last = items.at(-1).trim();
      // `[]` and `[a, b,]` end with one empty item, which is no entry.
      if (last === "") items.pop();
      if (
        items.some(
          (entry) => entry.trim() === "" || entry.trim().includes("\n"),
        )
      )
        return null;
      const scalars = items.map((entry) => yamlScalar(entry, { flow: true }));
      if (scalars.includes(null)) return null;
      return { items: scalars, rest: text.slice(index + 1) };
    } else if (character === "}") return null;
    else if (character === "," && depth === 0) {
      items.push(item);
      item = "";
      continue;
    }
    item += character;
  }
  return null;
}

// The `packages` patterns of a `pnpm-workspace.yaml`, or `[]` without that
// key, or null for any form this reader does not decode, so that an
// unexpected form reads as an unreadable workspace and never as a narrower or
// wider member list. It decodes a top-level `packages` key holding:
// - a flow sequence on one or more lines, ending its line after `]`;
// - or a block sequence, indented or at the key's column;
// whose items are plain, single-quoted or double-quoted scalars, with
// comments. Anchors, aliases, tags, block scalars, nested collections,
// multi-line scalars, a quoted `packages` key and a flow-mapping document are
// not decoded. No YAML library is available to operations.
export function pnpmWorkspacePackages(text) {
  const lines = text.split(/\r?\n/);
  if (
    lines.some((line) => /^["']packages["']\s*:/.test(line)) ||
    /^(?:\s*(?:#.*)?\n)*\s*(?:---\s*\n\s*)?[{[]/.test(text)
  )
    return null;
  const start = lines.findIndex((line) => /^packages\s*:/.test(line));
  if (start === -1) return [];
  const rest = lines[start].replace(/^packages\s*:/, "").trim();
  if (rest.startsWith("[")) {
    const flow = flowSequence([rest, ...lines.slice(start + 1)].join("\n"));
    if (!flow) return null;
    const after = flow.rest.split("\n")[0].trim();
    return after === "" || after.startsWith("#") ? flow.items : null;
  }
  if (rest !== "" && !rest.startsWith("#")) return null;
  // Block sequence items may be indented or start at the key's own column, as
  // YAML allows; the next top-level key ends the sequence.
  const patterns = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    if (!/^(?:\s|-(?:\s|$))/.test(line)) break;
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (!item) return null;
    const pattern = yamlScalar(item[1]);
    if (pattern === null) return null;
    patterns.push(pattern);
  }
  return patterns;
}

// The dependency catalogs of a `pnpm-workspace.yaml`: a map from catalog name
// to a map from package name to version, with the top-level `catalog` as
// `default` beside each named catalog under `catalogs`. Entries in a form this
// reader does not decode are left out, so their specifiers stay unresolved.
export function pnpmCatalogs(text) {
  const catalogs = new Map();
  let section = null;
  let named = null;
  let namedIndent = null;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;
    const entry =
      /^\s*("[^"\\]*"|'[^']*'|[^\s:#'"][^:#]*?)\s*:(?:\s+(.*))?$/.exec(line);
    if (indent === 0) {
      section =
        entry?.[1] === "catalog" || entry?.[1] === "catalogs" ? entry[1] : null;
      named = null;
      namedIndent = null;
      if (section === "catalog") catalogs.set("default", new Map());
      continue;
    }
    if (!section || !entry) continue;
    const key = yamlScalar(entry[1]);
    const value = entry[2] === undefined ? null : yamlScalar(entry[2]);
    if (key === null) continue;
    if (
      section === "catalogs" &&
      (namedIndent === null || indent <= namedIndent)
    ) {
      // A header's value is empty, or only a comment, before its entries.
      const header = entry[2]?.trim() ?? "";
      if (header !== "" && !header.startsWith("#")) continue;
      named = key;
      namedIndent = indent;
      if (!catalogs.has(named)) catalogs.set(named, new Map());
      continue;
    }
    const catalog = catalogs.get(section === "catalog" ? "default" : named);
    if (catalog && value !== null) catalog.set(key, value);
  }
  return catalogs;
}

// The workspace configuration of a directory: `null` when it configures no
// workspace, or `{ patterns, sources }` with its member patterns and the files
// that state them, or `{ unreadable, sources }` when a file states them in a
// form this reader does not decode. A `pnpm-workspace.yaml` takes precedence
// over the `workspaces` field of the directory's `package.json`, as pnpm reads
// it.
export function workspaceConfiguration(projectRoot, directory) {
  const pnpmWorkspace = joinPath(directory, pnpmWorkspaceName);
  if (isRegularFile(projectRoot, pnpmWorkspace)) {
    const patterns = pnpmWorkspacePackages(
      readFileSync(absolutePath(projectRoot, pnpmWorkspace), "utf8"),
    );
    return patterns === null
      ? { unreadable: true, sources: [pnpmWorkspace] }
      : { patterns, sources: [pnpmWorkspace] };
  }
  const manifestPath = joinPath(directory, manifestName);
  const { manifest } = readManifest(projectRoot, manifestPath);
  if (!manifest || manifest.workspaces === undefined) return null;
  const workspaces = Array.isArray(manifest.workspaces)
    ? manifest.workspaces
    : manifest.workspaces?.packages;
  if (
    !Array.isArray(workspaces) ||
    workspaces.some((pattern) => typeof pattern !== "string")
  )
    return { unreadable: true, sources: [manifestPath] };
  return { patterns: workspaces, sources: [manifestPath] };
}

// Whether a directory matches a workspace glob, through Node's own
// `path.matchesGlob`, after the `./` prefix and trailing slashes pnpm and npm
// tolerate. A leading `**` also matches zero directories.
function matchesWorkspaceGlob(relativeDirectory, pattern) {
  return posix.matchesGlob(
    relativeDirectory,
    pattern.replace(/^\.\//, "").replace(/\/+$/, ""),
  );
}

// Whether a directory, relative to a workspace root, is a member that the
// workspace's patterns list: one positive pattern matches it and no `!`
// pattern does. `node_modules` directories are never members.
export function isWorkspaceMember(patterns, relativeDirectory) {
  if (
    relativeDirectory === "" ||
    relativeDirectory.split("/").includes("node_modules")
  )
    return false;
  const negated = patterns.filter((pattern) => pattern.startsWith("!"));
  const positive = patterns.filter((pattern) => !pattern.startsWith("!"));
  return (
    positive.some((pattern) =>
      matchesWorkspaceGlob(relativeDirectory, pattern),
    ) &&
    !negated.some((pattern) =>
      matchesWorkspaceGlob(relativeDirectory, pattern.slice(1)),
    )
  );
}

function relativeTo(directory, ancestor) {
  return ancestor === "" ? directory : directory.slice(ancestor.length + 1);
}

// The workspace root of the Project whose manifest lies at a path: its own
// directory when that configures a workspace, else the nearest ancestor whose
// workspace configuration lists it, else its own directory. Returns
// `{ root, sources }`, with the files that configure that workspace, or
// `{ unreadable }` naming the configuration file this reader cannot decode
// on the way.
export function workspaceRootOf(projectRoot, manifestPath) {
  const directory = parentOf(manifestPath);
  const own = workspaceConfiguration(projectRoot, directory);
  if (own?.unreadable) return { unreadable: own.sources[0] };
  if (own) return { root: directory, sources: own.sources };
  let ancestor = directory;
  while (ancestor !== "") {
    ancestor = parentOf(ancestor);
    const configuration = workspaceConfiguration(projectRoot, ancestor);
    if (!configuration) continue;
    if (configuration.unreadable)
      return { unreadable: configuration.sources[0] };
    if (
      isWorkspaceMember(configuration.patterns, relativeTo(directory, ancestor))
    )
      return { root: ancestor, sources: configuration.sources };
  }
  return { root: directory, sources: [] };
}

// A version or partial version, such as `24`, `24.1` or `24.1.2`, with an
// optional `v` or `=` prefix and prerelease or build suffix: its numeric
// parts, or null. `x`, `X` and `*` parts end a partial version.
function parseVersion(text) {
  const match =
    /^[v=]?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.exec(
      text,
    );
  if (!match) return null;
  const parts = [];
  for (const part of match.slice(1)) {
    if (part === undefined || /^[xX*]$/.test(part)) break;
    parts.push(Number(part));
  }
  return parts;
}

function padded(parts) {
  return [...parts, 0, 0, 0].slice(0, 3);
}

// The first version after every version a partial version names.
function after(parts) {
  const next = [...parts];
  next[next.length - 1] += 1;
  return padded(next);
}

function compare(left, right) {
  for (let index = 0; index < 3; index++)
    if (left[index] !== right[index]) return left[index] - right[index];
  return 0;
}

const everything = { low: null, high: null };

// The interval of versions one comparator admits: `low` and `high` bounds,
// each `{ version, inclusive }` or null for none. Null when it cannot be read.
function comparatorInterval(token) {
  if (/^[xX*]?$/.test(token)) return everything;
  const match = /^(<=|>=|<|>|=|\^|~)?(.+)$/.exec(token);
  const [, operator = "", rest] = match;
  const parts = parseVersion(rest);
  if (parts === null) return null;
  if (parts.length === 0)
    return operator === "<" ? { empty: true } : everything;
  const full = parts.length === 3;
  const low = padded(parts);
  switch (operator) {
    case "":
    case "=":
      return full
        ? {
            low: { version: low, inclusive: true },
            high: { version: low, inclusive: true },
          }
        : {
            low: { version: low, inclusive: true },
            high: { version: after(parts), inclusive: false },
          };
    case ">=":
      return { low: { version: low, inclusive: true }, high: null };
    case ">":
      return full
        ? { low: { version: low, inclusive: false }, high: null }
        : { low: { version: after(parts), inclusive: true }, high: null };
    case "<":
      return { low: null, high: { version: low, inclusive: false } };
    case "<=":
      return full
        ? { low: null, high: { version: low, inclusive: true } }
        : { low: null, high: { version: after(parts), inclusive: false } };
    case "^": {
      const leading = parts.findIndex((part) => part !== 0);
      const significant =
        leading === -1 ? parts.length - 1 : Math.min(leading, parts.length - 1);
      return {
        low: { version: low, inclusive: true },
        high: {
          version: after(parts.slice(0, significant + 1)),
          inclusive: false,
        },
      };
    }
    case "~":
      return {
        low: { version: low, inclusive: true },
        high: {
          version: after(parts.slice(0, Math.min(parts.length, 2))),
          inclusive: false,
        },
      };
  }
  return null;
}

function tighterLow(left, right) {
  if (left === null) return right;
  if (right === null) return left;
  const order = compare(left.version, right.version);
  if (order !== 0) return order > 0 ? left : right;
  return left.inclusive ? right : left;
}

function tighterHigh(left, right) {
  if (left === null) return right;
  if (right === null) return left;
  const order = compare(left.version, right.version);
  if (order !== 0) return order < 0 ? left : right;
  return left.inclusive ? right : left;
}

// The interval of versions a comparator set admits, or null when one of its
// comparators cannot be read. A hyphen range is one set.
function comparatorSetInterval(text) {
  const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(text);
  if (hyphen) {
    const from = parseVersion(hyphen[1]);
    const to = parseVersion(hyphen[2]);
    if (!from?.length || !to?.length) return null;
    return {
      low: { version: padded(from), inclusive: true },
      high:
        to.length === 3
          ? { version: to, inclusive: true }
          : { version: after(to), inclusive: false },
    };
  }
  const tokens = text
    .replace(/(<=|>=|<|>|=|\^|~)\s+/g, "$1")
    .split(/\s+/)
    .filter(Boolean);
  let interval = everything;
  for (const token of tokens.length > 0 ? tokens : [""]) {
    const next = comparatorInterval(token);
    if (next === null) return null;
    if (next.empty) return { empty: true };
    interval = {
      low: tighterLow(interval.low, next.low),
      high: tighterHigh(interval.high, next.high),
    };
  }
  return interval;
}

// The majors an interval admits, or `{ from }` when it admits every major
// from one on.
function intervalMajors({ low, high, empty }) {
  if (empty) return [];
  if (low && high) {
    const order = compare(low.version, high.version);
    if (order > 0 || (order === 0 && !(low.inclusive && high.inclusive)))
      return [];
  }
  const from = low ? low.version[0] : 0;
  if (high === null) return { from };
  const [major, minor, patch] = high.version;
  const to = !high.inclusive && minor === 0 && patch === 0 ? major - 1 : major;
  const majors = [];
  for (let current = from; current <= to; current++) majors.push(current);
  return majors;
}

// The majors a semantic version range admits: `{ majors }`, sorted, with
// `unboundedFrom` set when it admits every major from that one on, or null
// when it is not a range this reader understands.
export function admittedMajors(range) {
  if (typeof range !== "string") return null;
  const majors = new Set();
  let unboundedFrom = null;
  for (const set of range.split("||").map((part) => part.trim())) {
    const interval = comparatorSetInterval(set);
    if (interval === null) return null;
    const admitted = intervalMajors(interval);
    if (Array.isArray(admitted))
      for (const major of admitted) majors.add(major);
    else
      unboundedFrom =
        unboundedFrom === null
          ? admitted.from
          : Math.min(unboundedFrom, admitted.from);
  }
  return { majors: [...majors].sort((a, b) => a - b), unboundedFrom };
}

function admittedText({ majors, unboundedFrom }, prefix = "") {
  const finite = majors
    .filter((major) => unboundedFrom === null || major < unboundedFrom)
    .map((major) => `${prefix}${major}`);
  const parts = [...finite];
  if (unboundedFrom !== null)
    parts.push(`every major from ${prefix}${unboundedFrom} on`);
  return parts.length === 0 ? "no version" : series(parts);
}

// Whether a range admits only the given majors and at least one of them.
function admitsOnly(admitted, allowed) {
  return (
    admitted.unboundedFrom === null &&
    admitted.majors.length > 0 &&
    admitted.majors.every((major) => allowed.includes(major))
  );
}

function packageManagerDifference(rootManifestPath, manifest) {
  const value = manifest?.packageManager;
  if (
    typeof value === "string" &&
    /^pnpm@11\.\d+\.\d+(?:\+[0-9A-Za-z.-]+)?$/.test(value)
  )
    return null;
  const current =
    value === undefined ? "it is missing" : `it is ${code(String(value))}`;
  return `Set ${code("packageManager")} to ${code("pnpm@11.x.y")} in the workspace root ${code(rootManifestPath)}; ${current}.`;
}

function nodeEnginesDifference(rootManifestPath, manifest) {
  const range = manifest?.engines?.node;
  const wanted = `Make ${code("engines.node")} in the workspace root ${code(rootManifestPath)} admit only Node.js 24 or 26`;
  if (range === undefined) return `${wanted}; it is missing.`;
  const admitted = admittedMajors(range);
  if (admitted === null)
    return `${wanted}; ${code(String(range))} is not a version range the check reads.`;
  if (admitsOnly(admitted, nodeMajors)) return null;
  return `${wanted}; ${code(range)} admits ${admittedText(admitted, "Node.js ")}.`;
}

function declaredVersion(manifest, name) {
  for (const field of dependencyFields) {
    const version = manifest?.[field]?.[name];
    if (version !== undefined) return { field, version };
  }
  return null;
}

// The Project's own declaration of a tool, else its workspace root's.
function toolDeclaration(tool, project, root) {
  for (const { path, manifest } of [project, root]) {
    const declared = declaredVersion(manifest, tool.name);
    if (declared) return { ...declared, path };
  }
  return null;
}

function toolDifference(tool, project, root) {
  const shared = project.path !== root.path;
  const where = shared
    ? `${code(project.path)} or its workspace root ${code(root.path)}`
    : code(project.path);
  const wanted = `Declare ${code(tool.name)} at major ${tool.major} in ${where}`;
  const declared = toolDeclaration(tool, project, root);
  if (declared === null)
    return `${wanted}; ${shared ? "neither declares it" : "it is not declared"}.`;
  const { path } = declared;
  let { version } = declared;
  let declares = `${code(path)} declares ${code(String(version))}`;
  const catalogName =
    typeof version === "string" && version.startsWith("catalog:")
      ? version.slice("catalog:".length) || "default"
      : null;
  if (catalogName !== null) {
    const resolved = root.catalogs.get(catalogName)?.get(tool.name);
    if (resolved === undefined)
      return `${wanted}; ${declares}, which no catalog of the workspace root's ${code(pnpmWorkspaceName)} defines for ${code(tool.name)}.`;
    version = resolved;
    declares = `${declares}, which its catalog resolves to ${code(resolved)}`;
  }
  const admitted = admittedMajors(version);
  if (admitted !== null && admitsOnly(admitted, [tool.major])) return null;
  const current =
    admitted === null
      ? `${declares}, which is not a version range the check reads`
      : `${declares}, which admits ${admittedText(admitted, "major ")}`;
  return `${wanted}; ${current}.`;
}

function validateScriptDifference(manifestPath, manifest) {
  const script = manifest?.scripts?.validate;
  if (typeof script === "string" && script.trim() !== "") return null;
  return `Add a ${code("validate")} script to ${code(manifestPath)} that runs the Project's checks.`;
}

// How the Project whose manifest lies at a path differs from the stack's
// manifest facts: `{ differences, evidence, workspaceRoot }`, with one
// correction per difference, in a fixed order, and the existing files that
// show them. TypeScript, the test runner, the pull request checks and the
// development guide are not manifest facts and are not read.
export function stackDifferences(projectRoot, manifestPath) {
  const project = readManifest(projectRoot, manifestPath);
  if (!project.manifest)
    return {
      differences: [
        `${code(manifestPath)} is ${project.missing ? "missing, or is not a regular file inside the project" : "not a JSON object"}; a Project is one readable ${code(manifestName)}.`,
      ],
      evidence: project.missing ? [] : [manifestPath],
      workspaceRoot: null,
    };
  const workspace = workspaceRootOf(projectRoot, manifestPath);
  if (workspace.unreadable)
    return {
      differences: [
        `State the workspace members of ${code(workspace.unreadable)} as a list of plain or quoted patterns, which the check reads.`,
      ],
      evidence: [manifestPath, workspace.unreadable],
      workspaceRoot: null,
    };
  const rootManifestPath = joinPath(workspace.root, manifestName);
  const root =
    rootManifestPath === manifestPath
      ? { path: manifestPath, manifest: project.manifest }
      : {
          path: rootManifestPath,
          manifest: readManifest(projectRoot, rootManifestPath).manifest,
        };
  const pnpmWorkspace = joinPath(workspace.root, pnpmWorkspaceName);
  root.catalogs = isRegularFile(projectRoot, pnpmWorkspace)
    ? pnpmCatalogs(
        readFileSync(absolutePath(projectRoot, pnpmWorkspace), "utf8"),
      )
    : new Map();
  const lockfile = joinPath(workspace.root, lockfileName);
  const differences = [
    packageManagerDifference(rootManifestPath, root.manifest),
    isRegularFile(projectRoot, lockfile)
      ? null
      : `Add ${code(lockfileName)} at the workspace root, ${code(lockfile)}.`,
    nodeEnginesDifference(rootManifestPath, root.manifest),
    ...declaredTools.map((tool) =>
      toolDifference(
        tool,
        { path: manifestPath, manifest: project.manifest },
        root,
      ),
    ),
    validateScriptDifference(manifestPath, project.manifest),
  ].filter(Boolean);
  const evidence = [
    manifestPath,
    ...(root.manifest && root.path !== manifestPath ? [root.path] : []),
    ...(isRegularFile(projectRoot, lockfile) ? [lockfile] : []),
    ...workspace.sources,
  ];
  return {
    differences,
    evidence: [...new Set(evidence)],
    workspaceRoot: workspace.root,
  };
}
