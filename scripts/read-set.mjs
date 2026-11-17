#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readsSection } from "./owned-skill-reads.mjs";
import { files } from "./upstream-bases.mjs";
import { interpretMarkdown } from "../operations/lib/rendered-markdown.mjs";
import { isMeaningful } from "../.github/scripts/validate-pr-metadata.mjs";

// Repository-owned entry points, decided in ADR 0048. No stored byte budget.
export const entryPoints = [
  "orchestrate",
  "factory",
  "triage",
  "implement",
  "review",
];

// The entry documents a reached Reads item can name as members.
const entryDocuments = ["CONTRIBUTING.md", "AGENTS.md"];

/** @typedef {{ paths: string[], read: (path: string) => Buffer }} Tree */

/** A working tree, including newly authored, untracked skill documents. */
export function directoryTree(root) {
  return {
    paths: [
      ...files(join(root, ".agents/skills")).map(
        (path) => `.agents/skills/${path}`,
      ),
      ...files(join(root, "rules")).map((path) => `rules/${path}`),
      ...entryDocuments.filter((path) => existsSync(join(root, path))),
    ],
    read: (path) => readFileSync(join(root, path)),
  };
}

/** An immutable Git tree; the current computation is used for every revision. */
export function gitTree(root, ref) {
  const commit = execFileSync(
    "git",
    ["rev-parse", "--verify", `${ref}^{commit}`],
    {
      cwd: root,
      encoding: "utf8",
    },
  ).trim();
  const paths = execFileSync(
    "git",
    ["ls-tree", "-r", "--name-only", "-z", commit],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    },
  )
    .split("\0")
    .filter(Boolean);
  const cache = new Map();
  return {
    paths,
    read(path) {
      if (!cache.has(path))
        cache.set(
          path,
          execFileSync("git", ["show", `${commit}:${path}`], {
            cwd: root,
            maxBuffer: 16 * 1024 * 1024,
          }),
        );
      return cache.get(path);
    },
  };
}

/**
 * Compute one entry point's Markdown and named source rules, once per member.
 * Value owner: ADR 0048 / #1058; consumers: this comparison and the conformance suite.
 * @param {Tree} tree
 * @param {string} entryPoint
 */
export function readSet(tree, entryPoint) {
  const available = new Set(tree.paths);
  const members = new Set();
  const reached = new Set();
  function requireMember(path, namingSkill) {
    if (!available.has(path))
      throw new Error(
        `${entryPoint}: ${namingSkill} names missing member ${path}`,
      );
    members.add(path);
  }
  function visit(name, namingSkill) {
    const directory = `.agents/skills/${name}/`;
    const skillPath = `${directory}SKILL.md`;
    requireMember(skillPath, namingSkill);
    if (reached.has(name)) return;
    reached.add(name);
    for (const path of tree.paths) {
      if (
        path.startsWith(directory) &&
        /\.md$/i.test(path) &&
        !/^(?:CREDITS\.md|LICEN[CS]E(?:[.-].*)?|COPYING(?:[.-].*)?)$/i.test(
          basename(path),
        )
      )
        members.add(path);
    }
    for (const item of readsSection(tree.read(skillPath).toString("utf8")) ??
      []) {
      for (const skill of item.skills) visit(skill, name);
      for (const rule of item.rules) requireMember(`rules/${rule}.md`, name);
      for (const path of item.paths) {
        const rule = /^\.repo-standards\/rules\/([\w-]+)\.md$/.exec(path);
        if (rule) requireMember(`rules/${rule[1]}.md`, name);
        else if (entryDocuments.includes(path)) requireMember(path, name);
      }
    }
  }
  visit(entryPoint, entryPoint);
  const sorted = [...members].sort();
  return {
    members: sorted,
    bytes: sorted.reduce((sum, path) => sum + tree.read(path).length, 0),
  };
}

function hasRaiseReason(description) {
  // Inline code can name the affected skill; fenced examples cannot grant a raise.
  function meaningfulLine(blocks) {
    return blocks.some((block) => {
      if (block.tag === "pre") return false;
      if (block.blocks.length) return meaningfulLine(block.blocks);
      return block.text
        .split("\n")
        .some(
          (line) =>
            line.startsWith("Read set:") &&
            isMeaningful(line.slice("Read set:".length)),
        );
    });
  }
  const sections =
    interpretMarkdown(description)
      .sections(["merge danger"], {
        hierarchy: "matching",
        nameSource: "rendered",
        stripTrailingColon: true,
      })
      .get("merge danger") ?? [];
  return sections.some(({ source }) =>
    meaningfulLine(interpretMarkdown(source).blocks),
  );
}

/**
 * @param {Tree} baseTree
 * @param {Tree} headTree
 * @param {string} description
 */
export function compareReadSets(baseTree, headTree, description = "") {
  const allowed = hasRaiseReason(description);
  const rows = entryPoints.map((entryPoint) => {
    const base = baseTree.paths.includes(
      `.agents/skills/${entryPoint}/SKILL.md`,
    )
      ? readSet(baseTree, entryPoint).bytes
      : 0;
    const head = readSet(headTree, entryPoint).bytes;
    return { entryPoint, base, head, difference: head - base };
  });
  const failures = allowed
    ? []
    : rows
        .filter(({ difference }) => difference > 0)
        .map(
          ({ entryPoint, base, head }) =>
            `${entryPoint}: read set grew from ${base} to ${head} bytes; add Read set: <reason> in Merge Danger.`,
        );
  return { rows, failures };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const [command, ref, flag, descriptionPath, ...extra] =
      process.argv.slice(2);
    if (
      command !== "compare" ||
      !ref ||
      (flag && (flag !== "--description" || !descriptionPath)) ||
      extra.length
    )
      throw new Error(
        "Usage: node scripts/read-set.mjs compare <ref> [--description <file>]",
      );
    const root = resolve(".");
    const result = compareReadSets(
      gitTree(root, ref),
      directoryTree(root),
      descriptionPath ? readFileSync(descriptionPath, "utf8") : "",
    );
    console.log("Entry point | Base bytes | Head bytes | Difference");
    for (const row of result.rows)
      console.log(
        `${row.entryPoint} | ${row.base} | ${row.head} | ${row.difference}`,
      );
    for (const failure of result.failures) console.error(failure);
    process.exitCode = result.failures.length ? 1 : 0;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
