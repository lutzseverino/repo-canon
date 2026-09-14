#!/usr/bin/env node

import { appendFileSync, readFileSync } from "node:fs";

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

function visibleText(markdown) {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\[(?<label>[^\]]+)]\([^)]*\)/g, "$<label>")
    .replace(/<https?:\/\/[^>]+>/g, " ")
    .replace(/[`*_~>#|\[\](){}-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isMeaningful(markdown) {
  const text = visibleText(markdown);
  const normalized = text.toLowerCase();
  const words = text.match(/[\p{L}\p{N}]+/gu) ?? [];
  const exactPlaceholders = new Set([
    "todo",
    "tbd",
    "n/a",
    "na",
    "none",
    "placeholder",
    "coming soon",
    "to be determined",
    "fill this in",
    "fill it in",
  ]);

  if (
    exactPlaceholders.has(normalized) ||
    /^(?:todo|tbd|n\/?a|placeholder)\s*:/i.test(normalized)
  ) {
    return false;
  }

  return words.length >= 2;
}

function headingName(rawHeading) {
  return rawHeading
    .replace(/[*_`]/g, "")
    .replace(/\s*#+\s*$/, "")
    .replace(/:\s*$/, "")
    .trim()
    .toLowerCase();
}

function parseSections(body) {
  const sections = new Map();
  let current;

  const uncommentedBody = body.replace(/<!--[\s\S]*?-->/g, " ");
  for (const line of uncommentedBody.replace(/\r\n?/g, "\n").split("\n")) {
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/);
    if (heading) {
      current = headingName(heading[1]);
      const values = sections.get(current) ?? [];
      values.push([]);
      sections.set(current, values);
      continue;
    }

    if (current) {
      sections.get(current).at(-1).push(line);
    }
  }

  return sections;
}

function requiredSection(sections, name, errors) {
  const matches = sections.get(name) ?? [];
  if (matches.length === 0) {
    errors.push(`Add a ${name === "related issue" ? "Related issue" : name[0].toUpperCase() + name.slice(1)} section.`);
    return null;
  }

  if (matches.length > 1) {
    errors.push(`Keep exactly one ${name === "related issue" ? "Related issue" : name[0].toUpperCase() + name.slice(1)} section.`);
  }

  return matches[0].join("\n");
}

function hasIssueReference(markdown) {
  const content = markdown.replace(/<!--[\s\S]*?-->/g, " ");
  return (
    /https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/issues\/[1-9]\d*\b/i.test(content) ||
    /\b[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+#[1-9]\d*\b/.test(content) ||
    /(^|[^A-Za-z0-9_])#[1-9]\d*\b/.test(content)
  );
}

function hasSmallCorrectionReason(markdown) {
  const content = markdown.replace(/<!--[\s\S]*?-->/g, " ");
  const marker = content.match(/(?:^|\n)\s*Small correction\s*:\s*([\s\S]*)$/i);
  return marker ? isMeaningful(marker[1]) : false;
}

function inlineExplanation(body, label) {
  for (const line of body.split(/\r?\n/)) {
    const plainLine = line.replace(/[*_`]/g, "");
    const match = plainLine.match(
      new RegExp(`^\\s*(?:[-+]\\s*)?${label}\\s*:\\s*(.+)$`, "i"),
    );
    if (match && isMeaningful(match[1])) {
      return true;
    }
  }
  return false;
}

function hasExplanation(sections, body, label) {
  const section = sections.get(label)?.[0]?.join("\n") ?? "";
  return isMeaningful(section) || inlineExplanation(body, label);
}

function validateTitle(title, body, sections, errors) {
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
  if (!isMeaningful(description)) {
    errors.push("Write a meaningful title description after the colon.");
  }
  if (description.trim() !== description) {
    errors.push("Remove leading or trailing whitespace from the title description.");
  }
  if (description.endsWith(".")) {
    errors.push("Remove the trailing period from the title description.");
  }

  const hasBreakingFooter = /^\s*BREAKING[ -]CHANGE\s*:/im.test(
    body.replace(/<!--[\s\S]*?-->/g, " "),
  );
  if (hasBreakingFooter && !breaking) {
    errors.push("Add ! before the title colon when the body declares a breaking change.");
  }

  if (breaking) {
    if (!hasExplanation(sections, body, "impact")) {
      errors.push("Explain the breaking change under an Impact heading or Impact: label.");
    }
    if (!hasExplanation(sections, body, "migration")) {
      errors.push("Explain migration under a Migration heading or Migration: label.");
    }
  }
}

function annotationValue(value) {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

function writeSummary(errors) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) {
    return;
  }

  const lines = errors.length
    ? ["## PR metadata validation failed", "", ...errors.map((error) => `- ${error}`)]
    : ["## PR metadata validation passed", "", "The title and required PR sections have the expected structure."];
  appendFileSync(summaryPath, `${lines.join("\n")}\n`, "utf8");
}

function main() {
  const eventPath = process.argv[2] ?? process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    throw new Error("Provide a GitHub pull request event through GITHUB_EVENT_PATH or the first argument.");
  }

  const event = JSON.parse(readFileSync(eventPath, "utf8"));
  const pullRequest = event.pull_request;
  if (!pullRequest || typeof pullRequest.title !== "string") {
    throw new Error("The event does not contain pull_request title and body metadata.");
  }

  const body = typeof pullRequest.body === "string" ? pullRequest.body : "";
  const errors = [];
  const sections = parseSections(body);
  const summary = requiredSection(sections, "summary", errors);
  const validation = requiredSection(sections, "validation", errors);
  const relatedIssue = requiredSection(sections, "related issue", errors);

  if (summary !== null && !isMeaningful(summary)) {
    errors.push("Replace the Summary placeholder with a meaningful problem and resulting change.");
  }
  if (validation !== null && !isMeaningful(validation)) {
    errors.push("Replace the Validation placeholder with checks and outcomes, or explain what was not run.");
  }
  if (
    relatedIssue !== null &&
    !hasIssueReference(relatedIssue) &&
    !hasSmallCorrectionReason(relatedIssue)
  ) {
    errors.push(
      "Link a related GitHub issue, or write Small correction: followed by the reason this change qualifies.",
    );
  }

  validateTitle(pullRequest.title, body, sections, errors);
  writeSummary(errors);

  if (errors.length) {
    for (const error of errors) {
      console.error(`::error title=PR metadata::${annotationValue(error)}`);
    }
    console.error(`PR metadata validation found ${errors.length} problem${errors.length === 1 ? "" : "s"}.`);
    process.exitCode = 1;
    return;
  }

  console.log("PR metadata validation passed.");
}

main();
