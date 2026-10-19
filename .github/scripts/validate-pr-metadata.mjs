#!/usr/bin/env node

import { appendFileSync, readFileSync } from "node:fs";
import {
  interpretMarkdown,
  markdownInlineText,
} from "../../operations/lib/rendered-markdown.mjs";
import { marked } from "../../vendor/marked/marked.esm.js";

const allowedTypes = [
  "feat",
  "fix",
  "docs",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "style",
  "chore",
  "revert",
];
const exactPlaceholders = new Set([
  "todo",
  "tbd",
  "n/a",
  "na",
  "none",
  "not applicable",
  "not available",
  "not provided",
  "not run",
  "not tested",
  "no tests",
  "placeholder",
  "coming soon",
  "to be determined",
  "fill this in",
  "fill it in",
  "same as title",
  "see above",
  "see title",
]);
const recognizedSections = new Set([
  "summary",
  "evidence",
  "merge danger",
  "related issue",
  "impact",
  "migration",
]);
const adoptionRecordHeading = "# Repository Standards adoption record";
const recordSections = [
  "Ready to commit",
  "Selection",
  "Operations",
  "Changed paths",
  "Scope changes",
  "Identities",
];
const recordClosingSections = ["Abandoned runs", "Impact", "Migration"];
const selectionComponents = ["CLI", "Standards source", "Standards version"];
const issueUrl =
  /https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/issues\/[1-9]\d*\b/i;

function normalizedRenderedText(content, includeCode = true) {
  return content
    .text({ includeCode, blockBreaks: true })
    .text.replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function isMeaningful(text) {
  const normalized = text.replace(/\s+/g, " ").trim().toLowerCase();
  const placeholderCandidate = normalized.replace(/[.!?,;:…]+$/u, "").trim();
  const words = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];

  if (
    exactPlaceholders.has(placeholderCandidate) ||
    /^(?:todo|tbd|n\/?a|placeholder)\s*[:.\-–—]/i.test(normalized)
  ) {
    return false;
  }
  return words.length >= 2;
}

function requiredSection(sections, name, errors) {
  const matches = sections.get(name) ?? [];
  const displayName =
    name === "merge danger"
      ? "Merge Danger"
      : name === "related issue"
        ? "Related issue"
        : name[0].toUpperCase() + name.slice(1);
  if (matches.length === 0) {
    errors.push(
      `Add ${name === "evidence" ? "an" : "a"} ${displayName} section.`,
    );
    return null;
  }
  if (matches.length > 1) {
    errors.push(`Keep exactly one ${displayName} section.`);
  }
  return matches[0].content;
}

function hasIssueReference(content) {
  const rendered = content.text({ includeCode: false, blockBreaks: true });
  const text = rendered.text
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
  if (
    issueUrl.test(text) ||
    /\b[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+#[1-9]\d*\b/.test(text) ||
    /(^|[^A-Za-z0-9_])#[1-9]\d*\b/.test(text)
  ) {
    return true;
  }

  return rendered.links.some((href) => issueUrl.test(href));
}

function hasDirectChangeReason(content) {
  const rendered = normalizedRenderedText(content, false);
  const marker = rendered.match(/(?:^|\n)Direct change\s*:\s*([\s\S]*)$/i);
  return marker !== null && isMeaningful(marker[1]);
}

// A body claims to be a Repository Standards adoption record when its exact
// heading is the body's first line, after any blank lines and apart from
// trailing spaces or tabs.
function claimsAdoptionRecord(body) {
  const firstLine = body
    .split(/\r\n?|\n/)
    .find((line) => !/^[ \t]*$/.test(line));
  return firstLine?.replace(/[ \t]+$/, "") === adoptionRecordHeading;
}

function headingKey(name) {
  return name
    .replace(/\s+/g, " ")
    .trim()
    .replace(/:$/, "")
    .trim()
    .toLocaleLowerCase("en-US");
}

// The record's level-1 and level-2 headings after its own heading are the
// record sections once and in order, then any closing sections in order.
function hasRecordSections(keys) {
  const required = recordSections.map(headingKey);
  const closing = recordClosingSections.map(headingKey);
  if (required.some((key, index) => keys[index] !== key)) return false;
  let next = 0;
  for (const key of keys.slice(required.length)) {
    const index = closing.indexOf(key, next);
    if (index < 0) return false;
    next = index + 1;
  }
  return true;
}

// Each Selection component the title names, from the one row whose first cell
// names it and whose value cell holds only inline code.
function selectionValues(document) {
  const occurrences =
    document
      .sections(["selection"], {
        hierarchy: "matching",
        nameSource: "rendered",
        stripTrailingColon: true,
      })
      .get("selection") ?? [];
  if (occurrences.length !== 1) return null;
  const rows = marked
    .lexer(occurrences[0].source)
    .filter((token) => token.type === "table")
    .flatMap((table) => table.rows);
  const values = new Map();
  for (const component of selectionComponents) {
    const matches = rows.filter(
      ([name]) => markdownInlineText(name?.tokens).trim() === component,
    );
    const value = matches[0]?.[1]?.tokens.filter(
      (token) => token.type !== "text" || token.text.trim(),
    );
    if (
      matches.length !== 1 ||
      value?.length !== 1 ||
      value[0].type !== "codespan"
    )
      return null;
    values.set(component, value[0].text);
  }
  return values;
}

function adoptionTitles(values) {
  const name = values
    .get("Standards source")
    .replace(/\/+$/, "")
    .replace(/\.git$/, "")
    .split("/")
    .at(-1);
  const description = `adopt ${name} ${values.get("Standards version")} with CLI ${values.get("CLI")}`;
  return [`chore: ${description}`, `chore!: ${description}`];
}

// An adoption record replaces the required sections only when it is complete,
// ready to commit, and titled from its own Selection.
function validateAdoptionRecord(title, document, errors) {
  const headings = document.headings
    .slice(1)
    .filter((heading) => heading.level <= 2);
  if (!hasRecordSections(headings.map((heading) => headingKey(heading.name)))) {
    errors.push(
      `List the adoption record's level-2 sections as ${recordSections.slice(0, -1).join(", ")} and ${recordSections.at(-1)}, each once and in that order, optionally followed by ${recordClosingSections.join(", then ")}, with no other level-1 or level-2 heading.`,
    );
  }

  const ready = headings.find(
    (heading) => headingKey(heading.name) === "ready to commit",
  );
  const statement = ready?.body.blocks[0]?.text.replace(/\s+/g, " ").trim();
  if (statement !== "Ready to commit: yes.") {
    errors.push(
      "State Ready to commit: yes. in the adoption record's Ready to commit section; open an adoption pull request only once its run is ready to commit.",
    );
  }

  const values = selectionValues(document);
  if (values === null) {
    errors.push(
      `Give the adoption record's Selection table ${selectionComponents.slice(0, -1).join(", ")} and ${selectionComponents.at(-1)} rows, each once with an inline-code value.`,
    );
    return;
  }
  const titles = adoptionTitles(values);
  if (!titles.includes(title)) {
    errors.push(
      `Title the adoption pull request ${titles[0]}, or ${titles[1]} for a breaking adoption, from its Selection table.`,
    );
  }
}

function validateSections(sections, errors) {
  const summary = requiredSection(sections, "summary", errors);
  const evidence = requiredSection(sections, "evidence", errors);
  const mergeDanger = requiredSection(sections, "merge danger", errors);
  const relatedIssue = requiredSection(sections, "related issue", errors);

  if (summary !== null && !isMeaningful(normalizedRenderedText(summary))) {
    errors.push(
      "Replace the Summary placeholder with a meaningful problem and resulting change.",
    );
  }
  if (evidence !== null && !isMeaningful(normalizedRenderedText(evidence))) {
    errors.push(
      "Replace the Evidence placeholder with before-and-after evidence, checks and outcomes, or explain what was not run.",
    );
  }
  if (
    mergeDanger !== null &&
    !isMeaningful(normalizedRenderedText(mergeDanger))
  ) {
    errors.push(
      "Replace the Merge Danger placeholder with the door, blast radius and relevant limits.",
    );
  }
  if (
    relatedIssue !== null &&
    !hasIssueReference(relatedIssue) &&
    !hasDirectChangeReason(relatedIssue)
  ) {
    errors.push(
      "Link a related GitHub issue, or write Direct change: followed by a meaningful reason.",
    );
  }
}

function inlineExplanation(content, label) {
  const text = normalizedRenderedText(content, false);
  const match = text.match(
    new RegExp(`(?:^|\\n)(?:[-+]\\s*)?${label}\\s*:\\s*([^\\n]+)`, "i"),
  );
  return match ? isMeaningful(match[1]) : false;
}

function hasExplanation(sections, bodyContent, label) {
  const section = sections.get(label)?.[0]?.content ?? null;
  return (
    (section !== null && isMeaningful(normalizedRenderedText(section))) ||
    inlineExplanation(bodyContent, label)
  );
}

function validateTitle(title, bodyContent, sections, errors) {
  const titleMatch = title.match(
    /^(?<type>[A-Za-z]+)(?<scope>\([^()\r\n]+\))?(?<breaking>!)?: (?<description>[^\r\n]+)$/,
  );
  if (!titleMatch) {
    errors.push(
      "Use a Conventional Commit title in the form type(scope): description, with ! before : for a breaking change.",
    );
    return;
  }

  const { type, scope, breaking, description } = titleMatch.groups;
  if (!allowedTypes.includes(type)) {
    errors.push(`Use an allowed lowercase type: ${allowedTypes.join(", ")}.`);
  }
  if (scope && scope.slice(1, -1).trim() !== scope.slice(1, -1)) {
    errors.push("Remove leading or trailing whitespace from the title scope.");
  }
  if (!/[\p{L}\p{N}]/u.test(description)) {
    errors.push("Write a title description containing a letter or number.");
  }
  if (description.trim() !== description) {
    errors.push(
      "Remove leading or trailing whitespace from the title description.",
    );
  }
  if (description.endsWith(".")) {
    errors.push("Remove the trailing period from the title description.");
  }

  const structuralBody = normalizedRenderedText(bodyContent, false);
  const hasBreakingFooter = /^BREAKING[ -]CHANGE\s*:/im.test(structuralBody);
  if (hasBreakingFooter && !breaking) {
    errors.push(
      "Add ! before the title colon when the body declares a breaking change.",
    );
  }
  if (breaking) {
    if (!hasExplanation(sections, bodyContent, "impact")) {
      errors.push(
        "Explain the breaking change under an Impact heading or Impact: label.",
      );
    }
    if (!hasExplanation(sections, bodyContent, "migration")) {
      errors.push(
        "Explain migration under a Migration heading or Migration: label.",
      );
    }
  }
}

function validateAttribution(text, location, errors) {
  for (const line of text.split(/\r\n?|\n/)) {
    if (/^\s*co-authored-by:/i.test(line)) {
      errors.push(
        `Remove the co-author trailer from the PR ${location}; CONTRIBUTING.md#titles-and-commits forbids co-author trailers.`,
      );
    }
    const attributionText = line.replace(/^(?:[^\p{L}\p{N}]|\d+[.)]\s*)+/u, "");
    if (/^generated\s+(?:with|by)\b/i.test(attributionText)) {
      errors.push(
        `Remove the attribution line from the PR ${location}; CONTRIBUTING.md#titles-and-commits forbids attribution lines.`,
      );
    }
  }
}

function annotationValue(value) {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

function writeSummary(errors, adoptionRecord) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) {
    return;
  }
  const passed = adoptionRecord
    ? "The title has the expected structure, and the body is a Repository Standards adoption record."
    : "The title and required PR sections have the expected structure.";
  const lines = errors.length
    ? [
        "## PR metadata validation failed",
        "",
        ...errors.map((error) => `- ${error}`),
      ]
    : ["## PR metadata validation passed", "", passed];
  appendFileSync(summaryPath, `${lines.join("\n")}\n`, "utf8");
}

function main() {
  const eventPath = process.argv[2] ?? process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    throw new Error(
      "Provide a GitHub pull request event through GITHUB_EVENT_PATH or the first argument.",
    );
  }

  const event = JSON.parse(readFileSync(eventPath, "utf8"));
  const pullRequest = event.pull_request;
  if (!pullRequest || typeof pullRequest.title !== "string") {
    throw new Error(
      "The event does not contain pull_request title and body metadata.",
    );
  }

  const body = typeof pullRequest.body === "string" ? pullRequest.body : "";
  const errors = [];
  validateAttribution(pullRequest.title, "title", errors);
  validateAttribution(body, "body", errors);
  const document = interpretMarkdown(body);
  const sections = document.sections(recognizedSections, {
    hierarchy: "matching",
    nameSource: "rendered",
    stripTrailingColon: true,
  });
  const adoptionRecord = claimsAdoptionRecord(body);
  if (adoptionRecord) {
    validateAdoptionRecord(pullRequest.title, document, errors);
  } else {
    validateSections(sections, errors);
  }

  validateTitle(pullRequest.title, document.content, sections, errors);
  writeSummary(errors, adoptionRecord);

  if (errors.length) {
    for (const error of errors) {
      console.error(`::error title=PR metadata::${annotationValue(error)}`);
    }
    console.error(
      `PR metadata validation found ${errors.length} problem${errors.length === 1 ? "" : "s"}.`,
    );
    process.exitCode = 1;
    return;
  }
  console.log("PR metadata validation passed.");
}

main();
