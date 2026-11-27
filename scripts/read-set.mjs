#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readsSection } from "./owned-skill-reads.mjs";
import { files, snapshotPath, upstreamBasesPath } from "./upstream-bases.mjs";
import { interpretMarkdown } from "../operations/lib/rendered-markdown.mjs";
import { isMeaningful } from "../.github/scripts/validate-pr-metadata.mjs";

// The entry documents a reached Reads item can name as members.
const entryDocuments = ["CONTRIBUTING.md", "AGENTS.md"];
const skillDirectory = ".agents/skills/";
const exceptionsPath = "scripts/skill-word-exceptions.json";
const snapshotIdentityPath = `${snapshotPath}/UPSTREAM.json`;

/** @typedef {{ paths: string[], read: (path: string) => Buffer }} Tree */

function skillMarkdown(path) {
  return (
    /\.md$/i.test(path) &&
    !/^(?:CREDITS\.md|LICEN[CS]E(?:[.-].*)?|COPYING(?:[.-].*)?)$/i.test(
      basename(path),
    )
  );
}

/** @param {Tree} tree */
export function entryPoints(tree) {
  return Object.keys(readJson(tree, upstreamBasesPath).skills).sort();
}

/** @param {Tree} tree */
function readJson(tree, path) {
  return JSON.parse(tree.read(path).toString("utf8"));
}

/** A working tree, including newly authored, untracked skill documents. */
export function directoryTree(root) {
  return {
    paths: [
      ...files(join(root, skillDirectory)).map((path) => skillDirectory + path),
      ...files(join(root, "rules")).map((path) => `rules/${path}`),
      ...files(join(root, snapshotPath)).map(
        (path) => `${snapshotPath}/${path}`,
      ),
      ...[upstreamBasesPath, exceptionsPath, ...entryDocuments].filter((path) =>
        existsSync(join(root, path)),
      ),
    ],
    read: (path) => readFileSync(join(root, path)),
  };
}

/** An immutable Git tree; the current computation is used for every revision. */
export function gitTree(root, ref) {
  const commit = execFileSync(
    "git",
    ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`],
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
    commit,
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
 * Value owner: Repo Canon (ADR 0048, amended by ADR 0056).
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
    const directory = `${skillDirectory}${name}/`;
    const skillPath = `${directory}SKILL.md`;
    requireMember(skillPath, namingSkill);
    if (reached.has(name)) return;
    reached.add(name);
    for (const path of tree.paths) {
      if (path.startsWith(directory) && skillMarkdown(path)) members.add(path);
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

function wordCount(content) {
  return (content.toString("utf8").match(/\S+/g) ?? []).length;
}

/** @param {Tree} tree */
function skillWords(tree) {
  const { skills, upstream } = readJson(tree, upstreamBasesPath);
  const paths = new Set(tree.paths);
  if (
    Object.values(skills).some((skill) => skill?.path) &&
    readJson(tree, snapshotIdentityPath).commit !== upstream.commit
  )
    throw new Error(
      "Vendored skill snapshot does not match the recorded upstream commit.",
    );

  const stats = new Map();
  for (const path of tree.paths) {
    if (!path.startsWith(skillDirectory) || !skillMarkdown(path)) continue;
    const relativePath = path.slice(skillDirectory.length);
    const separator = relativePath.indexOf("/");
    const name = relativePath.slice(0, separator);
    if (separator < 0 || !Object.hasOwn(skills, name)) continue;
    const upstreamSkill = skills[name]?.path;
    const upstreamPath = `${snapshotPath}/${upstreamSkill}/${relativePath.slice(separator + 1)}`;
    const ceiling =
      upstreamSkill && paths.has(upstreamPath)
        ? Math.max(
            1000,
            Math.floor((6 * wordCount(tree.read(upstreamPath))) / 5),
          )
        : 1000;
    stats.set(relativePath, { words: wordCount(tree.read(path)), ceiling });
  }
  return stats;
}

/** @param {Tree} tree */
function skillWordExceptions(tree) {
  const record = readJson(tree, exceptionsPath);
  if (
    !/^[a-f0-9]{40}$/.test(record?.introductionBase) ||
    !record.allowances ||
    typeof record.allowances !== "object" ||
    Array.isArray(record.allowances)
  )
    throw new Error(`Invalid word exception record in ${exceptionsPath}.`);
  const allowances = new Map(Object.entries(record.allowances));
  for (const [path, count] of allowances)
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 1)
      throw new Error(
        `${path}: invalid frozen word allowance in ${exceptionsPath}.`,
      );
  return { introductionBase: record.introductionBase, allowances };
}

/**
 * Enforce fixed ceilings locally, and exception history against a PR base.
 * @param {Tree} headTree
 * @param {Tree & { commit?: string }} [baseTree]
 */
export function checkSkillWords(headTree, baseTree) {
  const head = skillWords(headTree);
  const { introductionBase, allowances } = skillWordExceptions(headTree);
  const failures = [];
  const ceilingChanges = [];
  const base = baseTree && skillWords(baseTree);
  let priorAllowances;
  if (baseTree?.paths.includes(exceptionsPath)) {
    const previous = skillWordExceptions(baseTree);
    priorAllowances = previous.allowances;
    if (previous.introductionBase !== introductionBase)
      failures.push(`${exceptionsPath}: the introduction base is frozen.`);
  } else if (baseTree?.commit === introductionBase) {
    // At introduction, an allowance is exactly the verified base word count.
    priorAllowances = new Map(
      [...base]
        .filter(([, { words, ceiling }]) => words > ceiling)
        .map(([path, { words }]) => [path, words]),
    );
  } else if (baseTree) {
    priorAllowances = new Map();
  }

  for (const [path, allowance] of allowances) {
    const current = head.get(path);
    if (!current || current.words <= current.ceiling)
      failures.push(
        `${path}: remove the word exception for this compliant or removed file.`,
      );
    if (priorAllowances && !priorAllowances.has(path))
      failures.push(
        `${path}: cannot add a word exception absent from the base.`,
      );
    else if (priorAllowances && priorAllowances.get(path) !== allowance)
      failures.push(
        `${path}: frozen word allowance must remain ${priorAllowances.get(path)}.`,
      );
  }

  for (const [path, { words, ceiling }] of head) {
    const before = base?.get(path);
    if (before && before.ceiling !== ceiling)
      ceilingChanges.push({ path, base: before.ceiling, head: ceiling });
    if (words <= ceiling) continue;
    const allowance = allowances.get(path);
    if (allowance === undefined) {
      failures.push(
        `${path}: ${words} words exceeds the ceiling of ${ceiling}.`,
      );
      continue;
    }
    if (words > allowance)
      failures.push(
        `${path}: ${words} words exceeds the frozen allowance of ${allowance}.`,
      );
    if (base && words > (before?.words ?? 0))
      failures.push(
        `${path}: word exception grew from ${before?.words ?? 0} to ${words} words.`,
      );
  }
  return { failures, ceilingChanges };
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
  const baseSkills = new Set(entryPoints(baseTree));
  const headSkills = new Set(entryPoints(headTree));
  const rows = [...new Set([...baseSkills, ...headSkills])]
    .sort()
    .map((entryPoint) => {
      const base = baseSkills.has(entryPoint)
        ? readSet(baseTree, entryPoint).bytes
        : 0;
      const head = headSkills.has(entryPoint)
        ? readSet(headTree, entryPoint).bytes
        : 0;
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

function predatesWordGuard(root, base, head) {
  if (base.paths.includes(exceptionsPath)) return false;
  const { introductionBase } = skillWordExceptions(head);
  if (base.commit === introductionBase) return false;
  try {
    execFileSync(
      "git",
      ["merge-base", "--is-ancestor", base.commit, introductionBase],
      {
        cwd: root,
      },
    );
    return true;
  } catch (error) {
    if (error.status === 1) return false;
    throw error;
  }
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
    const base = gitTree(root, ref);
    const head = directoryTree(root);
    const result = compareReadSets(
      base,
      head,
      descriptionPath ? readFileSync(descriptionPath, "utf8") : "",
    );
    console.log(`Base commit: ${base.commit}`);
    console.log("Entry point | Base bytes | Head bytes | Difference");
    for (const row of result.rows)
      console.log(
        `${row.entryPoint} | ${row.base} | ${row.head} | ${row.difference}`,
      );
    // A historical plan base supplies byte counts only. PR comparisons always
    // supply a description file and enforce exception history at their base.
    const wordBase =
      !descriptionPath && predatesWordGuard(root, base, head)
        ? undefined
        : base;
    const wordCheck = checkSkillWords(head, wordBase);
    if (wordCheck.ceilingChanges.length) {
      console.log("Skill file | Base word ceiling | Head word ceiling");
      for (const { path, base, head } of wordCheck.ceilingChanges)
        console.log(`${path} | ${base} | ${head}`);
    }
    const failures = [...wordCheck.failures, ...result.failures];
    for (const failure of failures) console.error(failure);
    process.exitCode = failures.length ? 1 : 0;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
