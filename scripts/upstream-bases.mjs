#!/usr/bin/env node

// Owned skills and setup files and their upstream bases, as ADR 0028 decides.
// `check` fails when a recorded base differs from the vendored snapshot or an
// owned file's identity claim is wrong. `reconcile` three-way merges each
// owned file from its base in the vendored snapshot to the same path in a
// staged next snapshot.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const snapshotPath = "vendor/mattpocock-skills";
export const setupFileBasesPath = "setup-file-bases.json";
const ownedTree = ".agents/skills";
const licensePath = `${snapshotPath}/LICENSE`;

const basePattern =
  /Its upstream base is tag `([^`]+)`, commit `([0-9a-f]{40})`, at \[`([^`]+)`\]\((https:\/\/github\.com\/[^/\s]+\/[^/\s]+)\/tree\/([0-9a-f]{40})\/([^)\s]+)\)/;
const identicalClaim = /\bis identical to its upstream base\b/;
const editedClaim = /\bdiffers from its upstream base\b/;
const writtenClaim = /\bwritten for Repo Canon and has no upstream base\b/;

function files(directory, prefix = "") {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${prefix}${entry.name}`;
    return entry.isDirectory()
      ? files(join(directory, entry.name), `${path}/`)
      : [path];
  });
}

function read(root, path) {
  return readFileSync(join(root, path));
}

function sameBytes(left, right) {
  return Buffer.compare(left, right) === 0;
}

/**
 * The snapshot's identity from its provenance record.
 * @param {string} root
 * @returns {{ repository: string, tag: string, commit: string }}
 */
export function snapshotIdentity(root) {
  return JSON.parse(
    readFileSync(join(root, snapshotPath, "UPSTREAM.json"), "utf8"),
  );
}

function declarations(root) {
  return readFileSync(join(root, "standards.yaml"), "utf8");
}

/**
 * Every `kind: skill` declaration, with its CREDITS.md record.
 * @param {string} root
 */
export function ownedSkills(root) {
  return [
    ...declarations(root).matchAll(
      /^ {6}kind: skill\n {6}name: ([^\s]+)\n {6}source: ([^\s]+)/gm,
    ),
  ].map(([, name, source]) => {
    const creditsPath = `${source}/CREDITS.md`;
    const credits = existsSync(join(root, creditsPath))
      ? readFileSync(join(root, creditsPath), "utf8")
      : null;
    const match = credits && basePattern.exec(credits.replace(/\s+/g, " "));
    return {
      name,
      source,
      creditsPath,
      credits,
      base: match
        ? {
            tag: match[1],
            commit: match[2],
            path: match[3],
            repository: match[4],
            linkCommit: match[5],
            linkPath: match[6],
          }
        : null,
    };
  });
}

/**
 * The owned setup files and their recorded upstream bases.
 * @param {string} root
 * @returns {{ path: string, base: { repository: string, tag: string, commit: string, path: string }, edits: string | null }[]}
 */
export function ownedSetupFiles(root) {
  const record = JSON.parse(
    readFileSync(join(root, setupFileBasesPath), "utf8"),
  );
  return Object.entries(record.files).map(([path, { upstream, edits }]) => ({
    path,
    base: upstream,
    edits,
  }));
}

/**
 * The paths, relative to the snapshot, that some owned file takes as its base.
 * @param {string} root
 */
export function basePaths(root) {
  return {
    skills: ownedSkills(root)
      .filter(({ base }) => base)
      .map(({ base }) => base.path),
    setupFiles: ownedSetupFiles(root).map(({ base }) => base.path),
  };
}

function identityProblem(label, base, snapshot) {
  for (const key of ["repository", "tag", "commit"])
    if (base[key] !== snapshot[key])
      return `${label} records upstream base ${base.repository} ${base.tag} (${base.commit}), but the vendored snapshot is ${snapshot.repository} ${snapshot.tag} (${snapshot.commit})`;
  return null;
}

function skillFiles(root, directory) {
  return files(join(root, directory)).filter((path) => path !== "CREDITS.md");
}

function identicalToBase(root, source, base) {
  const owned = skillFiles(root, source).sort();
  const upstream = skillFiles(root, base).sort();
  return (
    owned.length === upstream.length &&
    owned.every(
      (path, index) =>
        path === upstream[index] &&
        sameBytes(
          read(root, `${source}/${path}`),
          read(root, `${base}/${path}`),
        ),
    )
  );
}

/**
 * Every problem with the owned tree's upstream bases; empty when they hold.
 * @param {string} root
 * @returns {string[]}
 */
export function checkUpstreamBases(root) {
  const problems = [];
  const snapshot = snapshotIdentity(root);
  const text = declarations(root);
  const skills = ownedSkills(root);
  const declared = text.match(/^ {6}kind: skill$/gm)?.length ?? 0;
  if (declared !== skills.length)
    problems.push(
      `standards.yaml declares ${declared} skills, but only ${skills.length} read as kind, name and source in that order`,
    );

  for (const skill of skills) {
    const label = `${skill.name} (${skill.creditsPath})`;
    if (skill.source !== `${ownedTree}/${skill.name}`) {
      problems.push(
        `${skill.name} installs from ${skill.source}, not the owned tree at ${ownedTree}/${skill.name}`,
      );
      continue;
    }
    if (skill.credits === null) {
      problems.push(`${label} is missing`);
      continue;
    }
    const credits = skill.credits.replace(/\s+/g, " ");
    if (!skill.base) {
      if (!writtenClaim.test(credits))
        problems.push(
          `${label} neither records an upstream base nor says the skill was written for Repo Canon and has no upstream base`,
        );
      continue;
    }
    const { base } = skill;
    if (base.linkCommit !== base.commit || base.linkPath !== base.path) {
      problems.push(
        `${label} links ${base.linkPath} at ${base.linkCommit}, not its recorded base ${base.path} at ${base.commit}`,
      );
      continue;
    }
    const identity = identityProblem(label, base, snapshot);
    if (identity) {
      problems.push(identity);
      continue;
    }
    const basePath = `${snapshotPath}/${base.path}`;
    if (!existsSync(join(root, basePath, "SKILL.md"))) {
      problems.push(
        `${label} records ${base.path}, which the vendored snapshot lacks`,
      );
      continue;
    }
    const identical = identicalToBase(root, skill.source, basePath);
    const claimsIdentical = identicalClaim.test(credits);
    const claimsEdits = editedClaim.test(credits);
    if (claimsIdentical === claimsEdits)
      problems.push(
        `${label} must say either that the skill is identical to its upstream base or that it differs from its upstream base`,
      );
    else if (identical && claimsEdits)
      problems.push(
        `${label} claims edits, but the skill is identical to its upstream base`,
      );
    else if (!identical && claimsIdentical)
      problems.push(
        `${label} claims the skill is identical to its upstream base, but it differs`,
      );
    // Upstream's own credits travel with the skill: keep them word for word.
    const baseCredits = join(root, basePath, "CREDITS.md");
    if (existsSync(baseCredits)) {
      const upstreamCredits = readFileSync(baseCredits, "utf8")
        .replace(/^# [^\n]*\n/, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!credits.includes(upstreamCredits))
        problems.push(
          `${label} must keep its upstream base's CREDITS.md text word for word`,
        );
    }
  }

  const setupFiles = ownedSetupFiles(root);
  for (const { path, base, edits } of setupFiles) {
    const label = `${path} (${setupFileBasesPath})`;
    if (
      !new RegExp(
        `\\n {6}target: ${RegExp.escape(path)}\\n {6}exact: ${RegExp.escape(path)}\\n`,
      ).test(text)
    ) {
      problems.push(
        `${label} is not declared as an exact file installed from itself`,
      );
      continue;
    }
    const identity = identityProblem(label, base, snapshot);
    if (identity) {
      problems.push(identity);
      continue;
    }
    const basePath = `${snapshotPath}/${base.path}`;
    if (!existsSync(join(root, basePath))) {
      problems.push(
        `${label} records ${base.path}, which the vendored snapshot lacks`,
      );
      continue;
    }
    if (edits !== null && (typeof edits !== "string" || !edits.trim())) {
      problems.push(
        `${label} must record edits as null or a summary of how the file differs`,
      );
      continue;
    }
    const identical = sameBytes(read(root, path), read(root, basePath));
    if (identical && edits !== null)
      problems.push(
        `${label} claims edits, but the file is identical to its upstream base`,
      );
    else if (!identical && edits === null)
      problems.push(
        `${label} claims no edits, but the file differs from its upstream base`,
      );
  }

  // Nothing installs from the snapshot except its license notice.
  for (const [, source] of text.matchAll(/^ {6}(?:exact|source): (\S+)$/gm))
    if (source.startsWith(`${snapshotPath}/`) && source !== licensePath)
      problems.push(
        `${source} installs from the vendored snapshot; install it from its owned copy`,
      );
  for (const [, target] of text.matchAll(
    /^ {6}target: (docs\/agents\/\S+)\n {6}exact: \S+$/gm,
  ))
    if (
      target !== "docs/agents/README.md" &&
      !setupFiles.some(({ path }) => path === target)
    )
      problems.push(
        `${target} is a skill setup file without a recorded upstream base`,
      );

  return problems;
}

function mergeFile(owned, base, next) {
  const child = spawnSync(
    "git",
    [
      "merge-file",
      "-p",
      "-L",
      "owned",
      "-L",
      "base",
      "-L",
      "upstream",
      owned,
      base,
      next,
    ],
    { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 },
  );
  if (child.error) throw child.error;
  if (child.status === null || child.status < 0 || child.status > 127)
    throw new Error(`git merge-file failed for ${owned}: ${child.stderr}`);
  return { merged: child.stdout, conflicts: child.status };
}

/**
 * Plans the three-way merge of one owned file. Paths are absolute; a missing
 * file is absent on that side.
 */
function reconcileFile(owned, base, next) {
  const has = (path) => existsSync(path);
  const bytes = (path) => readFileSync(path);
  if (has(base) && has(next)) {
    if (!has(owned))
      return sameBytes(bytes(base), bytes(next))
        ? { outcome: "unchanged" }
        : {
            outcome: "conflict",
            reason: "changed upstream but removed from the owned copy",
          };
    const { merged, conflicts } = mergeFile(owned, base, next);
    if (conflicts > 0)
      return {
        outcome: "conflict",
        content: merged,
        reason: `${conflicts} conflicting hunk(s)`,
      };
    return sameBytes(merged, bytes(owned))
      ? { outcome: "unchanged" }
      : { outcome: "merged", content: merged };
  }
  if (has(next)) {
    if (!has(owned)) return { outcome: "added", content: bytes(next) };
    return sameBytes(bytes(owned), bytes(next))
      ? { outcome: "unchanged" }
      : {
          outcome: "conflict",
          reason:
            "added upstream, but the owned copy already has a different file",
        };
  }
  if (has(base) && has(owned))
    return sameBytes(bytes(owned), bytes(base))
      ? { outcome: "removed" }
      : {
          outcome: "conflict",
          reason: "removed upstream but edited in the owned copy",
        };
  return { outcome: "unchanged" };
}

/**
 * Three-way merges every owned skill and setup file from its base in the
 * vendored snapshot to the same path in `next`, a staged snapshot directory.
 * Without `write`, it only reports what would change.
 * @param {string} root
 * @param {string} next
 * @param {{ write?: boolean }} [options]
 */
export function reconcileUpstreamBases(root, next, { write = false } = {}) {
  const snapshot = join(root, snapshotPath);
  const identity = snapshotIdentity(root);
  const entries = [];
  // A base the vendored snapshot no longer is would merge from the wrong base.
  const staleBase = (path, base) => {
    const problem = identityProblem(path, base, identity);
    if (problem) entries.push({ path, outcome: "conflict", reason: problem });
    return problem;
  };
  const plan = (owned, base, nextPath) => {
    const result = reconcileFile(
      join(root, owned),
      join(snapshot, base),
      join(next, nextPath),
    );
    if (result.outcome !== "unchanged")
      entries.push({ path: owned, ...result });
  };

  for (const { source, base, credits: ownedCredits } of ownedSkills(root)) {
    if (!base) {
      // Only a skill written for Repo Canon has no base to merge from.
      if (!writtenClaim.test((ownedCredits ?? "").replace(/\s+/g, " ")))
        entries.push({
          path: source,
          outcome: "conflict",
          reason:
            "its CREDITS.md records no upstream base and does not say it was written for Repo Canon",
        });
      continue;
    }
    if (staleBase(source, base)) continue;
    if (!existsSync(join(next, base.path, "SKILL.md"))) {
      entries.push({
        path: source,
        outcome: "conflict",
        reason: `the next snapshot has no ${base.path}`,
      });
      continue;
    }
    const paths = new Set([
      ...skillFiles(root, source),
      ...files(join(snapshot, base.path)),
      ...files(join(next, base.path)),
    ]);
    paths.delete("CREDITS.md");
    for (const path of [...paths].sort())
      plan(`${source}/${path}`, `${base.path}/${path}`, `${base.path}/${path}`);
    // Upstream credits are carried into the owned CREDITS.md by hand.
    const credits = (directory) => {
      const path = join(directory, base.path, "CREDITS.md");
      return existsSync(path) ? readFileSync(path) : null;
    };
    const [before, after] = [credits(snapshot), credits(next)];
    if (
      (before === null) !== (after === null) ||
      (before && !sameBytes(before, after))
    )
      entries.push({
        path: `${source}/CREDITS.md`,
        outcome: "conflict",
        reason:
          "upstream's CREDITS.md changed; carry the change into the owned CREDITS.md",
      });
  }
  for (const { path, base } of ownedSetupFiles(root)) {
    if (staleBase(path, base)) continue;
    if (!existsSync(join(next, base.path))) {
      entries.push({
        path,
        outcome: "conflict",
        reason: `the next snapshot has no ${base.path}`,
      });
      continue;
    }
    plan(path, base.path, base.path);
  }

  if (write)
    for (const { path, outcome, content } of entries) {
      const target = join(root, path);
      if (outcome === "removed") {
        rmSync(target);
        // Drop directories the removal leaves empty inside a skill.
        let directory = dirname(target);
        for (
          let inside = relative(join(root, ownedTree), directory);
          inside.includes("/") &&
          !inside.startsWith("..") &&
          readdirSync(directory).length === 0;
          inside = relative(join(root, ownedTree), directory)
        ) {
          rmdirSync(directory);
          directory = dirname(directory);
        }
      } else if (content) {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, content);
      }
    }
  return entries;
}

const usage =
  "Usage: node scripts/upstream-bases.mjs check | reconcile <next-snapshot> [--dry-run]";

function main(args) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  if (args.length === 1 && args[0] === "check") {
    const problems = checkUpstreamBases(root);
    for (const problem of problems) console.error(problem);
    if (problems.length > 0) return 1;
    console.log(
      "Every owned skill and setup file matches its recorded upstream base.",
    );
    return 0;
  }
  const dryRun = args.includes("--dry-run");
  const rest = args.filter((arg) => arg !== "--dry-run");
  if (rest.length !== 2 || rest[0] !== "reconcile" || !rest[1]) {
    console.error(usage);
    return 1;
  }
  const next = resolve(rest[1]);
  if (!existsSync(join(next, "LICENSE"))) {
    console.error(`${rest[1]} is not a staged snapshot: it has no LICENSE`);
    return 1;
  }
  const entries = reconcileUpstreamBases(root, next, { write: !dryRun });
  for (const { path, outcome, reason } of entries)
    console.log(`${outcome} ${path}${reason ? `: ${reason}` : ""}`);
  if (entries.length === 0) console.log("No owned file changes.");
  return entries.some(({ outcome }) => outcome === "conflict") ? 2 : 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  process.exitCode = main(process.argv.slice(2));
