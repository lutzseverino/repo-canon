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

function withoutHtmlComments(markdown) {
  return markdown.replace(/<!--[\s\S]*?(?:-->|$)/g, " ");
}

function markdownLines(markdown) {
  let fence;
  return withoutHtmlComments(markdown)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => {
      const fenceLine = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
      if (fence) {
        if (
          fenceLine &&
          fenceLine[1][0] === fence.character &&
          fenceLine[1].length >= fence.length &&
          fenceLine[2].trim() === ""
        ) {
          fence = undefined;
        }
        return { inFence: true, line };
      }
      if (fenceLine) {
        fence = { character: fenceLine[1][0], length: fenceLine[1].length };
        return { inFence: true, line };
      }
      return { inFence: false, line };
    });
}

function withoutFencedCode(markdown) {
  return markdownLines(markdown)
    .map(({ inFence, line }) => (inFence ? "" : line))
    .join("\n");
}

function withoutCodeExamples(markdown) {
  return withoutFencedCode(markdown).replace(/(`+)[\s\S]*?\1/g, " ");
}

function visibleText(markdown) {
  return withoutHtmlComments(markdown)
    .replace(/\[(?<label>[^\]]+)]\([^)]*\)/g, "$<label>")
    .replace(/<https?:\/\/[^>]+>/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:#\d+|#x[\da-f]+|[a-z][\da-z]+);/gi, " ")
    .replace(/[`*_~>#|\[\](){}-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isMeaningful(markdown) {
  const text = visibleText(markdown);
  const normalized = text.toLowerCase();
  const placeholderCandidate = normalized.replace(/[.!?,;:…]+$/u, "").trim();
  const words = text.match(/[\p{L}\p{N}]+/gu) ?? [];

  if (
    exactPlaceholders.has(placeholderCandidate) ||
    /^(?:todo|tbd|n\/?a|placeholder)\s*[:.\-–—]/i.test(normalized)
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
  const recognizedSections = new Set([
    "summary",
    "validation",
    "related issue",
    "impact",
    "migration",
  ]);

  for (const { inFence, line } of markdownLines(body)) {
    if (inFence) {
      if (current) {
        sections.get(current.name).at(-1).push(line);
      }
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*$/);
    if (heading) {
      const name = headingName(heading[2]);
      if (!recognizedSections.has(name)) {
        if (current && heading[1].length > current.level) {
          continue;
        }
        current = undefined;
        continue;
      }

      current = { level: heading[1].length, name };
      const values = sections.get(name) ?? [];
      values.push([]);
      sections.set(name, values);
      continue;
    }

    if (current) {
      sections.get(current.name).at(-1).push(line);
    }
  }

  return sections;
}

function requiredSection(sections, name, errors) {
  const matches = sections.get(name) ?? [];
  const displayName =
    name === "related issue"
      ? "Related issue"
      : name[0].toUpperCase() + name.slice(1);
  if (matches.length === 0) {
    errors.push(`Add a ${displayName} section.`);
    return null;
  }

  if (matches.length > 1) {
    errors.push(`Keep exactly one ${displayName} section.`);
  }

  return matches[0].join("\n");
}

function hasIssueReference(markdown) {
  const content = withoutCodeExamples(markdown);
  return (
    /https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/issues\/[1-9]\d*\b/i.test(content) ||
    /\b[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+#[1-9]\d*\b/.test(content) ||
    /(^|[^A-Za-z0-9_])#[1-9]\d*\b/.test(content)
  );
}

function hasSmallCorrectionReason(markdown) {
  const content = withoutCodeExamples(markdown);
  const marker = content.match(/(?:^|\n)\s*Small correction\s*:\s*([\s\S]*)$/i);
  return marker ? isMeaningful(marker[1]) : false;
}

function inlineExplanation(body, label) {
  for (const line of withoutCodeExamples(body).split("\n")) {
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
    withoutCodeExamples(body),
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
