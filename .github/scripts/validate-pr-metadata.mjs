#!/usr/bin/env node

import { appendFileSync, readFileSync } from "node:fs";
import { marked } from "../../vendor/marked/marked.esm.js";
import { parseFragment } from "../../vendor/parse5/parse5.esm.js";

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
  "validation",
  "related issue",
  "impact",
  "migration",
]);
const inlineContainers = new Set([
  "del",
  "em",
  "heading",
  "link",
  "paragraph",
  "strong",
  "text",
]);
const issueUrl = /https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/issues\/[1-9]\d*\b/i;

const blockElements = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "details",
  "dialog",
  "div",
  "dl",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hgroup",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "ul",
]);
const codeElements = new Set(["code", "kbd", "pre"]);
const hiddenElements = new Set(["script", "style", "template"]);

function parsedHtml(value, includeCode = true) {
  const links = [];
  let text = "";
  const stack = [{ node: parseFragment(value), closing: false }];

  while (stack.length) {
    const { node, closing } = stack.pop();
    if (closing) {
      text += "\n";
      continue;
    }
    if (node.nodeName === "#comment") {
      continue;
    }
    if (node.nodeName === "#text") {
      text += node.value;
      continue;
    }
    if (
      hiddenElements.has(node.nodeName) ||
      (!includeCode && codeElements.has(node.nodeName))
    ) {
      continue;
    }

    if (node.nodeName === "a") {
      const href = node.attrs?.find((attribute) => attribute.name === "href")?.value;
      if (href) {
        links.push(href);
      }
    }
    if (node.nodeName === "br") {
      text += "\n";
    }

    if (blockElements.has(node.nodeName)) {
      stack.push({ node, closing: true });
    }
    const children = node.childNodes ?? [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ node: children[index], closing: false });
    }
  }
  return { links, text };
}

function decodedText(value) {
  return parsedHtml(value).text;
}

function tokenText(token, includeCode) {
  if (token.type === "code" || token.type === "codespan") {
    return includeCode ? token.text : "";
  }
  if (token.type === "html") {
    return parsedHtml(token.text, includeCode).text;
  }
  if (token.type === "image") {
    return decodedText(token.text ?? "");
  }
  if (token.type === "br") {
    return "\n";
  }
  if (["checkbox", "def", "hr", "space"].includes(token.type)) {
    return "";
  }
  if (!includeCode && token.type === "text" && token.escaped) {
    return "";
  }
  if (token.type === "list") {
    return token.items
      .map((item) => renderedTokenList(item.tokens, includeCode))
      .join("\n");
  }
  if (token.type === "table") {
    const cells = [
      ...token.header,
      ...token.rows.flat(),
    ];
    return cells
      .map((cell) => renderedInlineTokens(cell.tokens, includeCode))
      .join("\n");
  }
  if (Array.isArray(token.tokens)) {
    return inlineContainers.has(token.type)
      ? renderedInlineTokens(token.tokens, includeCode)
      : renderedTokenList(token.tokens, includeCode);
  }
  return typeof token.text === "string" ? decodedText(token.text) : "";
}

function renderedInlineTokens(tokens, includeCode) {
  return tokens.map((token) => tokenText(token, includeCode)).join("");
}

function renderedTokenList(tokens, includeCode = true) {
  return tokens.map((token) => tokenText(token, includeCode)).join("\n");
}

function normalizedRenderedText(tokens, includeCode = true) {
  return renderedTokenList(tokens, includeCode)
    .replace(/[\t\f\v ]+/g, " ")
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

function headingName(token) {
  return normalizedRenderedText(token.tokens)
    .replace(/:\s*$/, "")
    .trim()
    .toLowerCase();
}

function parseSections(tokens) {
  const sections = new Map();
  let current;

  for (const token of tokens) {
    if (token.type === "heading") {
      const name = headingName(token);
      if (!recognizedSections.has(name)) {
        if (!current || token.depth <= current.level) {
          current = undefined;
        }
        continue;
      }

      current = { level: token.depth, name };
      const values = sections.get(name) ?? [];
      values.push([]);
      sections.set(name, values);
      continue;
    }

    if (current) {
      sections.get(current.name).at(-1).push(token);
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
  return matches[0];
}

function hasIssueReference(tokens) {
  const content = normalizedRenderedText(tokens, false);
  if (
    issueUrl.test(content) ||
    /\b[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+#[1-9]\d*\b/.test(content) ||
    /(^|[^A-Za-z0-9_])#[1-9]\d*\b/.test(content)
  ) {
    return true;
  }

  let found = false;
  marked.walkTokens(tokens, (token) => {
    if (token.type === "link" && issueUrl.test(token.href)) {
      found = true;
    }
    if (
      token.type === "html" &&
      !token.inRawBlock &&
      parsedHtml(token.text, false).links.some((href) => issueUrl.test(href))
    ) {
      found = true;
    }
  });
  return found;
}

function hasSmallCorrectionReason(tokens) {
  const content = normalizedRenderedText(tokens, false);
  const marker = content.match(/(?:^|\n)Small correction\s*:\s*([\s\S]*)$/i);
  if (!marker || !isMeaningful(marker[1])) {
    return false;
  }
  return /\b(?:typo|spelling|punctuation|format(?:ting)?|whitespace|(?:broken|dead)[\s-]+(?:Markdown[\s-]+)?(?:link|anchor))\b/i.test(
    marker[1],
  );
}

function inlineExplanation(tokens, label) {
  const content = normalizedRenderedText(tokens, false);
  const match = content.match(
    new RegExp(`(?:^|\\n)(?:[-+]\\s*)?${label}\\s*:\\s*([^\\n]+)`, "i"),
  );
  return match ? isMeaningful(match[1]) : false;
}

function hasExplanation(sections, bodyTokens, label) {
  const section = sections.get(label)?.[0] ?? [];
  return (
    isMeaningful(normalizedRenderedText(section)) ||
    inlineExplanation(bodyTokens, label)
  );
}

function validateTitle(title, bodyTokens, sections, errors) {
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
    errors.push("Remove leading or trailing whitespace from the title description.");
  }
  if (description.endsWith(".")) {
    errors.push("Remove the trailing period from the title description.");
  }

  const structuralBody = normalizedRenderedText(bodyTokens, false);
  const hasBreakingFooter = /^BREAKING[ -]CHANGE\s*:/im.test(structuralBody);
  if (hasBreakingFooter && !breaking) {
    errors.push("Add ! before the title colon when the body declares a breaking change.");
  }
  if (breaking) {
    if (!hasExplanation(sections, bodyTokens, "impact")) {
      errors.push("Explain the breaking change under an Impact heading or Impact: label.");
    }
    if (!hasExplanation(sections, bodyTokens, "migration")) {
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
  const bodyTokens = marked.lexer(body);
  const sections = parseSections(bodyTokens);
  const summary = requiredSection(sections, "summary", errors);
  const validation = requiredSection(sections, "validation", errors);
  const relatedIssue = requiredSection(sections, "related issue", errors);

  if (summary !== null && !isMeaningful(normalizedRenderedText(summary))) {
    errors.push("Replace the Summary placeholder with a meaningful problem and resulting change.");
  }
  if (validation !== null && !isMeaningful(normalizedRenderedText(validation))) {
    errors.push("Replace the Validation placeholder with checks and outcomes, or explain what was not run.");
  }
  if (
    relatedIssue !== null &&
    !hasIssueReference(relatedIssue) &&
    !hasSmallCorrectionReason(relatedIssue)
  ) {
    errors.push(
      "Link a related GitHub issue, or write Small correction: with a meaningful typo, broken-link, or formatting reason.",
    );
  }

  validateTitle(pullRequest.title, bodyTokens, sections, errors);
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
