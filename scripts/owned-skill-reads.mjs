#!/usr/bin/env node

// Each owned skill works without adopting Repo Canon, as ADR 0028 decides:
// every repository path a skill names, in its text or its scripts, is either
// inside the skill or listed in its SKILL.md's Reads section with what the
// skill does when the file is missing, and no skill names an agent host
// application. `check` prints each problem and fails when there is one.

import { existsSync, readFileSync } from "node:fs";
import { basename, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { files, ownedSkills } from "./upstream-bases.mjs";

// File extensions that make a bare name, or a slash-separated name, a path.
const extensions =
  /\.(?:md|mdx|json|jsonc|mjs|cjs|js|ts|tsx|ya?ml|sh|toml|txt|html|lock)$/;
const textExtensions = /\.(?:md|ya?ml|json|mjs|js|sh|txt|html)$/;
// Product names that look like files.
const productNames = /^(?:Node|Next|Vue|Nuxt|Deno)\.js$/;
// A run of path characters, optionally slash-separated. A `<placeholder>` may
// stand for a segment or part of one.
const pathToken =
  /(?<![\w./<>@*\\-])((?:\.{1,2}\/)*[\w.*@<>{}$-]+(?:\/[\w.*@<>{}$-]+)*\/?)/g;

// Agent host applications. T3 Code also appears in tool and config names.
const hostNames =
  /\bT3 Code\b|\bT3(?:\b|code)|\bt3_|\bt3:|\bClaude Code\b|\bClaude Desktop\b|\bCodex\b|\bOpenCode\b|\bWindsurf\b|\bGitHub Copilot\b|\bGemini CLI\b/i;
// `cursor` is also pagination vocabulary; only the capitalized word names the
// application.
const cursorHost = /\bCursor\b/;

const isRelative = (path) => path.startsWith("./") || path.startsWith("../");

function isPath(token, inReads) {
  // An unspecified location, except in a Reads entry, where a placeholder
  // such as `<plan>/plan.md` stands for any such path.
  if (token.startsWith("<"))
    return inReads && isPath(token.replace(/^<[^>]*>/, "x"));
  // The end of a placeholder holding spaces, such as `<this skill's directory>/`.
  if (/^[^<]*>/.test(token)) return false;
  if (productNames.test(token)) return false;
  const trimmed = token.replace(/\/$/, "");
  const segments = trimmed.split("/");
  if (segments.some((segment) => segment === "")) return false;
  if (extensions.test(trimmed)) return true;
  if (isRelative(token)) return true;
  if (segments.length > 1 && segments[0].startsWith(".")) return true;
  // A conventional, lowercase directory name, such as `docs/`.
  return token.endsWith("/") && /^[a-z0-9_.-]+$/.test(segments[0]);
}

function urlRanges(text) {
  return [...text.matchAll(/\b[a-z][a-z0-9+.-]*:\/\/[^\s)>\]`"']+/gi)].map(
    (match) => [match.index, match.index + match[0].length],
  );
}

// Blank a match, keeping its line breaks so line numbers still hold.
const blank = (match) => match.replace(/[^\n]/g, " ");

/**
 * The paths a file names, with their line numbers. URLs, absolute paths and
 * slash commands are not repository paths. In Markdown, fenced code blocks
 * and double-quoted text illustrate, as an example layout or a quoted bad
 * example does, and name no path.
 * @param {string} text
 * @param {{ markdown?: boolean, inReads?: boolean }} [options]
 */
export function namedPaths(text, { markdown = false, inReads = false } = {}) {
  const scanned = markdown
    ? text
        .replace(/^(`{3,}|~{3,}).*\n[\s\S]*?^\1[^\S\n]*$/gm, blank)
        .replace(/"[^"\n]*"|“[^”\n]*”/g, blank)
    : text;
  const urls = urlRanges(scanned);
  const found = [];
  for (const match of scanned.matchAll(pathToken)) {
    const start = match.index;
    if (urls.some(([from, to]) => start >= from && start < to)) continue;
    const token = match[1].replace(/[.,;:]+$/, "");
    if (!isPath(token, inReads)) continue;
    const line = scanned.slice(0, start).split("\n").length;
    found.push({ path: token, line });
  }
  return found;
}

/**
 * The SKILL.md Reads section: its list items, each with the paths and skills
 * it names.
 * @param {string} skill
 */
export function readsSection(skill) {
  const match = /^## Reads\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(skill);
  if (!match) return null;
  const items = [];
  for (const line of match[1].split("\n")) {
    if (line.startsWith("- ")) items.push(line.slice(2));
    else if (items.length && /^ {2}\S/.test(line))
      items[items.length - 1] += ` ${line.trim()}`;
  }
  return items.map((text) => ({
    text,
    paths: namedPaths(text, { markdown: true, inReads: true }).map(
      ({ path }) => path,
    ),
    skills: [...text.matchAll(/\bthe `([\w-]+)` skill/gi)].map(
      ([, name]) => name,
    ),
  }));
}

// A `<placeholder>` matches one segment, `**` any run of segments and `*`
// any run within one segment.
const globParts = { "**": ".*", "*": "[^/]*" };

function globPattern(entry) {
  const source = entry.replace(/<[^>]*>|\*\*|\*|[.+?^${}()|[\]\\]/g, (part) =>
    part.startsWith("<") ? "[^/]+" : (globParts[part] ?? `\\${part}`),
  );
  return new RegExp(`^${source}$`);
}

function declared(path, entries) {
  return entries.some((entry) => {
    if (entry === path) return true;
    if (entry.endsWith("/") && (path.startsWith(entry) || `${path}/` === entry))
      return true;
    if (!path.includes("/") && globPattern(basename(entry)).test(path))
      return true;
    return globPattern(entry).test(path);
  });
}

/**
 * Problems with one owned skill's standalone use.
 * @param {string} directory the skill's directory
 * @param {string} name the skill's name
 * @returns {string[]}
 */
export function skillProblems(directory, name) {
  const problems = [];
  const inside = new Set(files(directory));
  const textFiles = [...inside].filter((path) => textExtensions.test(path));
  const skillText = existsSync(join(directory, "SKILL.md"))
    ? readFileSync(join(directory, "SKILL.md"), "utf8")
    : "";
  const reads = readsSection(skillText) ?? [];
  const entries = reads.flatMap(({ paths }) => paths);
  const skills = reads.flatMap(({ skills }) => skills);
  for (const { text } of reads)
    if (!/\b(?:missing|absent)\b/i.test(text))
      problems.push(
        `${name}/SKILL.md: Reads item does not say what the skill does when the file is missing: ${text}`,
      );

  for (const file of textFiles) {
    const text = readFileSync(join(directory, file), "utf8");
    const host = hostNames.exec(text) ?? cursorHost.exec(text);
    if (host) {
      const line = text.slice(0, host.index).split("\n").length;
      problems.push(`${name}/${file}:${line}: names the host ${host[0]}`);
    }
    const markdown = file.endsWith(".md");
    for (const { path, line } of namedPaths(text, { markdown })) {
      const where = `${name}/${file}:${line}`;
      if (isRelative(path)) {
        // Relative to the file, in a skill installed at `<skills>/<name>`.
        const resolved = posix.normalize(
          posix.join("skills", name, posix.dirname(file), path),
        );
        const [top, owner, ...rest] = resolved.split("/");
        if (top === "skills" && owner === name) continue;
        if (top === "skills" && owner && rest.length) {
          if (!skills.includes(owner))
            problems.push(
              `${where}: depends on the ${owner} skill, which its Reads section does not name: ${path}`,
            );
          continue;
        }
        const repositoryPath = resolved.replace(/^(?:\.\.\/)+/, "");
        if (!declared(repositoryPath, entries))
          problems.push(
            `${where}: names ${repositoryPath}, which is outside the skill and not in its Reads section: ${path}`,
          );
        continue;
      }
      const relativeToFile = posix.normalize(
        posix.join(posix.dirname(file), path.replace(/\/$/, "")),
      );
      if (inside.has(path) || inside.has(relativeToFile)) continue;
      if (!path.includes("/") && [...inside].some((p) => basename(p) === path))
        continue;
      if (!declared(path, entries))
        problems.push(
          `${where}: names ${path}, which is outside the skill and not in its Reads section`,
        );
    }
  }
  return problems;
}

/**
 * Problems across every owned skill a source declares.
 * @param {string} root
 */
export function checkOwnedSkillReads(root) {
  return ownedSkills(root).flatMap(({ name, source }) =>
    skillProblems(join(root, source), name),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command] = process.argv.slice(2);
  if (command !== "check") {
    console.error("Usage: node scripts/owned-skill-reads.mjs check");
    process.exit(1);
  }
  const root = fileURLToPath(new URL("..", import.meta.url));
  const problems = checkOwnedSkillReads(root);
  for (const problem of problems) console.error(problem);
  process.exit(problems.length ? 1 : 0);
}
