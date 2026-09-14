#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { lexer, marked } from "../vendor/marked/marked.esm.js";
import { parseFragment } from "../vendor/parse5/parse5.esm.js";

const feedbackMarker = "<!-- repo-canon:issue-contract-feedback -->";
const readyLabels = new Set(["ready-for-agent", "ready-for-human"]);
const workflowLabels = new Set(["needs-triage", "needs-info", "ready-for-agent", "ready-for-human", "wontfix"]);
const categoryLabels = new Set(["bug", "enhancement"]);
const childLabels = new Set(["wayfinder:research", "wayfinder:prototype", "wayfinder:grilling", "wayfinder:task"]);
const agentBriefHeadingNames = new Set(["agent brief"]);
const contractSectionNames = new Set([
  "acceptance criteria",
  "actual behavior",
  "additional context",
  "blocked by",
  "decisions so far",
  "destination",
  "desired outcome",
  "environment",
  "expected behavior",
  "further notes",
  "implementation decisions",
  "not yet specified",
  "notes",
  "out of scope",
  "parent",
  "problem",
  "problem statement",
  "proposed approach",
  "question",
  "solution",
  "steps to reproduce",
  "testing decisions",
  "user stories",
  "what to build",
]);

const environment = process.env;
const event = JSON.parse(await readFile(required("GITHUB_EVENT_PATH"), "utf8"));

if (event.issue?.pull_request) {
  console.log("Skipped pull request discussion; issue contract validation handles issues only.");
  process.exit(0);
}

const issueNumber = event.issue?.number;
if (!Number.isInteger(issueNumber)) throw new Error("The event does not identify an issue number.");

const api = createApi({
  baseUrl: required("GITHUB_API_URL"),
  repository: required("GITHUB_REPOSITORY"),
  token: required("GITHUB_TOKEN"),
});

const issue = await api.getIssue(issueNumber);
if (issue.pull_request) {
  console.log("Skipped pull request discussion; issue contract validation handles issues only.");
  process.exit(0);
}

const comments = await api.listComments(issueNumber);
const blockedBy = await api.listBlockedBy(issueNumber);
const relationships = await readRelationships(api, issue, blockedBy);
const result = validate({
  issue,
  comments,
  blockedBy: relationships.blockedBy,
  parent: relationships.parent,
  relationshipErrors: relationships.errors,
});

if (!result.valid) {
  await removeReadiness(api, issueNumber, result.labels);
  if (result.triaged) await returnTriagedRequestToReview(api, issueNumber, result.labels);
  await maintainFeedback(api, issueNumber, comments, invalidFeedback(result.errors));
  console.error(result.errors.join("\n"));
  process.exit(1);
}

const previousFeedback = findFeedback(comments);
if (previousFeedback) {
  await maintainFeedback(api, issueNumber, comments, resolvedFeedback(result.kind));
}
console.log(`Valid ${result.kind}.`);

function required(name) {
  const value = environment[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function createApi({ baseUrl, repository, token }) {
  const issuePath = `/repos/${repository}/issues`;

  async function requestResponse(path, { allowNotFound = false, ...options } = {}) {
    const response = await fetch(path.startsWith("http") ? path : `${baseUrl}${path}`, {
      ...options,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
        ...options.headers,
      },
    });
    if (allowNotFound && response.status === 404) return { data: null, link: null };
    if (!response.ok) {
      throw new Error(`GitHub API ${options.method ?? "GET"} ${path} returned ${response.status}: ${await response.text()}`);
    }
    return {
      data: response.status === 204 ? null : await response.json(),
      link: response.headers.get("link"),
    };
  }

  async function request(path, options = {}) {
    return (await requestResponse(path, options)).data;
  }

  async function paginate(path, options = {}) {
    const values = [];
    let next = path;
    while (next) {
      const response = await requestResponse(next, options);
      if (!response.data) break;
      values.push(...response.data);
      next = response.link?.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
    }
    return values;
  }

  return {
    getIssue: (number) => request(`${issuePath}/${number}`),
    getParent: (number) => request(`${issuePath}/${number}/parent`, { allowNotFound: true }),
    getOptionalUrl: (url) => request(url, { allowNotFound: true }),
    listComments: (number) => paginate(`${issuePath}/${number}/comments?per_page=100`),
    listBlockedBy: (number) => paginate(`${issuePath}/${number}/dependencies/blocked_by?per_page=100`, { allowNotFound: true }),
    removeLabel: (number, label) => request(`${issuePath}/${number}/labels/${encodeURIComponent(label)}`, { method: "DELETE" }),
    addLabels: (number, labels) => request(`${issuePath}/${number}/labels`, { method: "POST", body: JSON.stringify({ labels }) }),
    createComment: (number, body) => request(`${issuePath}/${number}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
    updateComment: (id, body) => request(`${issuePath}/comments/${id}`, { method: "PATCH", body: JSON.stringify({ body }) }),
  };
}

async function readRelationships(apiClient, issue, nativeBlockedBy) {
  const sections = parseSections(issue.body ?? "");
  const errors = [];
  const nativeParent = await apiClient.getParent(issue.number);
  const parentReference = firstIssueReference(sections.get("parent"));
  const fallbackParent = !nativeParent && parentReference ? await apiClient.getOptionalUrl(parentReference) : null;
  const parent = nativeParent ?? fallbackParent;
  if (parentReference && !parent) errors.push(`Could not resolve the \`Parent\` issue reference ${parentReference}.`);
  const blockedBy = [...nativeBlockedBy];
  const knownReferences = new Set(nativeBlockedBy.map((blocker) => issueReferenceFor(blocker)).filter(Boolean));
  for (const reference of issueReferences(sections.get("blocked by"))) {
    if (knownReferences.has(reference)) continue;
    const blocker = await apiClient.getOptionalUrl(reference);
    if (blocker) blockedBy.push(blocker);
    else errors.push(`Could not resolve the \`Blocked by\` issue reference ${reference}.`);
  }
  return { parent, blockedBy, errors };
}

function issueReferenceFor(issue) {
  if (issue.url) return new URL(issue.url).pathname;
  const match = issue.html_url?.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
  return match ? `/repos/${match[1]}/${match[2]}/issues/${match[3]}` : null;
}

function firstIssueReference(value) {
  return issueReferences(value)[0] ?? null;
}

function issueReferences(value = "") {
  const references = [];
  const seen = new Set();
  const repository = required("GITHUB_REPOSITORY");
  const expression = /https:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/issues\/(\d+)|(?:^|[\s(])#(\d+)\b/gim;
  for (const match of markdownReferenceText(value).matchAll(expression)) {
    const reference = match[4]
      ? `/repos/${repository}/issues/${match[4]}`
      : `/repos/${match[1]}/${match[2]}/issues/${match[3]}`;
    if (!seen.has(reference)) {
      seen.add(reference);
      references.push(reference);
    }
  }
  return references;
}

function markdownReferenceText(markdown) {
  const fragments = [];

  function visit(node) {
    if (node.nodeName === "#text") {
      fragments.push(node.value);
      return;
    }
    if (["code", "pre", "script", "style", "template"].includes(node.tagName)) return;
    const href = node.tagName === "a" ? node.attrs?.find(({ name }) => name === "href")?.value : null;
    if (href) fragments.push(href);
    for (const child of node.childNodes ?? []) visit(child);
  }

  visit(renderedMarkdownFragment(markdown));
  return fragments.join("\n");
}

function markdownVisibleText(markdown) {
  return htmlVisibleText(renderedMarkdownFragment(markdown));
}

function renderedMarkdownFragment(markdown) {
  return parseFragment(marked.parse(markdown));
}

function htmlVisibleText(fragment) {
  function textContent(node) {
    if (node.nodeName === "#text") return node.value;
    if (["script", "style", "template"].includes(node.tagName)) return "";
    if (node.tagName === "img") return node.attrs?.find(({ name }) => name === "alt")?.value ?? "";
    return (node.childNodes ?? []).map(textContent).join("");
  }

  return textContent(fragment);
}

function validate({ issue, comments, blockedBy, parent, relationshipErrors }) {
  const labels = new Set((issue.labels ?? []).map(labelName));
  const sections = parseSections(issue.body ?? "");
  const errors = [];

  if (labels.has("wayfinder:map")) {
    validateWayfinderMap(sections, labels, errors);
    return outcome("Wayfinder map", errors, labels, false);
  }

  const wayfinderChildren = [...labels].filter((label) => childLabels.has(label));
  if (wayfinderChildren.length > 0) {
    errors.push(...relationshipErrors);
    validateWayfinderChild(sections, labels, wayfinderChildren, parent, errors);
    return outcome("Wayfinder child", errors, labels, false);
  }

  const brief = latestAgentBrief(comments);
  if (brief && [...labels].some((label) => categoryLabels.has(label))) {
    validateTriagedLabels(labels, null, errors);
    validateAgentBrief(brief.body, labels, errors);
    return outcome("triaged Agent Brief", errors, labels, true);
  }

  const contractKind = identifyContract(sections);
  if (contractKind === "specification") {
    requireSections(sections, ["Problem Statement", "Solution", "User Stories", "Out of Scope"], errors);
    for (const name of ["Implementation Decisions", "Testing Decisions", "Further Notes"]) {
      requireSection(sections, name, errors, { allowEmpty: true });
    }
    return outcome("specification", errors, labels, false);
  }

  if (contractKind === "implementation ticket") {
    errors.push(...relationshipErrors);
    requireSections(sections, ["What to build", "Acceptance criteria"], errors);
    requireSection(sections, "Blocked by", errors, { allowExternalValue: blockedBy.length > 0 });
    return outcome("implementation ticket", errors, labels, false);
  }

  if (brief) {
    validateTriagedLabels(labels, null, errors);
    validateAgentBrief(brief.body, labels, errors);
    return outcome("triaged Agent Brief", errors, labels, true);
  }

  if (contractKind === "bug report") {
    requireSections(sections, ["Steps to reproduce", "Expected behavior", "Actual behavior"], errors);
    validateTriagedLabels(labels, "bug", errors);
    requireAgentBriefForReadiness(labels, errors);
    return outcome("bug report", errors, labels, true);
  }

  if (contractKind === "feature request") {
    requireSections(sections, ["Problem", "Desired outcome"], errors);
    validateTriagedLabels(labels, "enhancement", errors);
    requireAgentBriefForReadiness(labels, errors);
    return outcome("feature request", errors, labels, true);
  }

  errors.push("Use one supported issue contract: a public form, native specification or ticket, triaged Agent Brief, Wayfinder map, or labeled Wayfinder child.");
  return outcome("issue contract", errors, labels, false);
}

function identifyContract(sections) {
  const headings = new Map([
    ["problem statement", "specification"],
    ["solution", "specification"],
    ["user stories", "specification"],
    ["what to build", "implementation ticket"],
    ["blocked by", "implementation ticket"],
    ["steps to reproduce", "bug report"],
    ["expected behavior", "bug report"],
    ["actual behavior", "bug report"],
    ["problem", "feature request"],
    ["desired outcome", "feature request"],
  ]);
  for (const heading of sections.keys()) {
    if (headings.has(heading)) return headings.get(heading);
  }
  return null;
}

function outcome(kind, errors, labels, triaged) {
  return { valid: errors.length === 0, kind, errors: [...new Set(errors)], labels, triaged };
}

function parseSections(markdown) {
  const markdownHeadings = findMarkdownHeadings(markdown);
  const headings = markdownHeadings.filter((heading) => contractSectionNames.has(normalize(heading.name)));
  const sections = new Map();
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const name = normalize(heading.name);
    const start = heading.index + heading.length;
    const nextPeer = markdownHeadings.find((candidate) => candidate.index > heading.index && candidate.level <= heading.level);
    const end = Math.min(headings[index + 1]?.index ?? markdown.length, nextPeer?.index ?? markdown.length);
    sections.set(name, markdown.slice(start, end).trim());
  }
  return sections;
}

function findMarkdownHeadings(markdown, acceptedNames = null) {
  return markdownTokenSpans(markdown)
    .filter(({ token }) => token.type === "heading")
    .map(({ token, index }) => ({
      index,
      length: token.raw.length,
      level: token.depth,
      name: markdownInlineText(token.tokens),
    }))
    .filter(({ name }) => !acceptedNames || acceptedNames.has(normalize(name)));
}

function markdownTokenSpans(markdown) {
  let cursor = 0;
  return lexer(markdown).map((token) => {
    const index = markdown.indexOf(token.raw, cursor);
    if (index === -1) throw new Error(`Could not locate parsed Markdown token after offset ${cursor}.`);
    cursor = index + token.raw.length;
    return { token, index };
  });
}

function markdownInlineText(tokens) {
  return (tokens ?? []).map((token) => {
    if (token.type === "html") return "";
    if (token.type === "codespan") return token.text;
    if (token.tokens) return markdownInlineText(token.tokens);
    return typeof token.text === "string" ? token.text : "";
  }).join("");
}

function briefFieldMatches(markdown) {
  const matches = [];
  for (const { token, index } of markdownTokenSpans(markdown)) {
    if (token.type !== "paragraph") continue;
    let cursor = index;
    let lineStart = true;
    for (const inlineToken of token.tokens ?? []) {
      const inlineIndex = markdown.indexOf(inlineToken.raw, cursor);
      if (inlineIndex === -1) throw new Error(`Could not locate parsed inline Markdown token after offset ${cursor}.`);
      cursor = inlineIndex + inlineToken.raw.length;
      const fieldName = inlineToken.type === "strong" && lineStart
        ? markdownInlineText(inlineToken.tokens).match(/^([^:\n]+):$/)?.[1]
        : null;
      if (fieldName) matches.push({ index: inlineIndex, length: inlineToken.raw.length, name: fieldName });
      lineStart = inlineToken.raw.endsWith("\n");
    }
  }
  return matches;
}

function normalize(value) {
  return value.replace(/[*_`]/g, "").replace(/[ \t]+/g, " ").trim().toLowerCase();
}

function requireSections(sections, names, errors) {
  for (const name of names) requireSection(sections, name, errors);
}

function requireSection(sections, name, errors, { allowEmpty = false, allowExternalValue = false } = {}) {
  const key = normalize(name);
  if (!sections.has(key)) {
    errors.push(`Add the \`${name}\` section.`);
    return;
  }
  if (!allowEmpty && !allowExternalValue && isPlaceholder(sections.get(key))) {
    errors.push(`Replace the placeholder under \`${name}\` with the required information.`);
  }
}

function isPlaceholder(value) {
  const withoutEmptyTasks = value.replace(/^\s*[-+*]\s*\[[ xX]\]\s*$/gm, "");
  const visibleText = markdownVisibleText(withoutEmptyTasks).trim();
  if (!visibleText) return true;
  return /^(?:no response|tbd|todo|\[(?:your |add |describe |enter )?[^\]]+\])\.?$/i.test(visibleText);
}

function validateWayfinderMap(sections, labels, errors) {
  if ([...labels].some((label) => childLabels.has(label))) {
    errors.push("Keep `wayfinder:map` separate from Wayfinder child labels.");
  }
  requireSections(sections, ["Destination", "Notes", "Not yet specified", "Out of scope"], errors);
  requireSection(sections, "Decisions so far", errors, { allowEmpty: true });
}

function validateWayfinderChild(sections, labels, childLabelList, parent, errors) {
  if (childLabelList.length !== 1 || labels.has("wayfinder:map")) {
    errors.push("Apply exactly one Wayfinder child label and do not combine it with `wayfinder:map`.");
  }
  requireSection(sections, "Question", errors);
  if (!parent) {
    errors.push("Link the Wayfinder child to its parent map using the native parent relationship or a `Parent` section.");
  } else if (!(parent.labels ?? []).some((label) => labelName(label) === "wayfinder:map")) {
    errors.push("Link the Wayfinder child to an issue labeled `wayfinder:map`.");
  }
}

function labelName(label) {
  return typeof label === "string" ? label : label.name;
}

function validateTriagedLabels(labels, expectedCategory, errors) {
  const categories = [...labels].filter((label) => categoryLabels.has(label));
  const states = [...labels].filter((label) => workflowLabels.has(label));
  if (categories.length !== 1) errors.push("Apply exactly one category label: `bug` or `enhancement`.");
  if (expectedCategory && (categories.length !== 1 || categories[0] !== expectedCategory)) {
    errors.push(`Use the \`${expectedCategory}\` category for this issue form.`);
  }
  if (states.length !== 1) errors.push("Apply exactly one workflow state label.");
}

function requireAgentBriefForReadiness(labels, errors) {
  if ([...labels].some((label) => readyLabels.has(label))) {
    errors.push("Add a reviewed Agent Brief before applying a readiness label to a triaged request.");
  }
}

function latestAgentBrief(comments) {
  return [...comments].reverse().find((comment) => agentBriefHeading(comment.body ?? ""));
}

function validateAgentBrief(body, labels, errors) {
  const heading = agentBriefHeading(body);
  if (!isAgentBriefPreamble(body.slice(0, heading.index))) {
    errors.push("Start the Agent Brief comment with `> *This was generated by AI during triage.*`.");
  }
  const fields = parseBriefFields(markdownSection(body, heading));
  for (const name of ["Category", "Summary", "Current behavior", "Desired behavior", "Key interfaces", "Acceptance criteria", "Out of scope"]) {
    if (!fields.has(normalize(name)) || isPlaceholder(fields.get(normalize(name)))) {
      errors.push(`Complete the Agent Brief \`${name}\` field.`);
    }
  }
  const category = normalize(fields.get("category") ?? "");
  if (category && !categoryLabels.has(category)) errors.push("Set the Agent Brief `Category` to `bug` or `enhancement`.");
  if (category && !labels.has(category)) errors.push(`Apply the Agent Brief's \`${category}\` category label.`);
}

function markdownSection(markdown, heading) {
  const end = findMarkdownHeadings(markdown)
    .find((candidate) => candidate.index > heading.index && candidate.level <= heading.level)?.index ?? markdown.length;
  return markdown.slice(heading.index + heading.length, end);
}

function parseBriefFields(body) {
  const matches = briefFieldMatches(body);
  const fields = new Map();
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const start = match.index + match.length;
    const end = matches[index + 1]?.index ?? body.length;
    fields.set(normalize(match.name), body.slice(start, end).trim());
  }
  return fields;
}

function isAgentBriefPreamble(markdown) {
  const blocks = lexer(markdown).filter((token) => token.type !== "space");
  if (blocks.length !== 1 || blocks[0].type !== "blockquote") return false;
  const quoteBlocks = blocks[0].tokens?.filter((token) => token.type !== "space") ?? [];
  if (quoteBlocks.length !== 1 || quoteBlocks[0].type !== "paragraph") return false;
  const inline = quoteBlocks[0].tokens ?? [];
  return inline.length === 1
    && inline[0].type === "em"
    && markdownInlineText(inline[0].tokens) === "This was generated by AI during triage.";
}

function agentBriefHeading(body) {
  return findMarkdownHeadings(body, agentBriefHeadingNames)[0] ?? null;
}

async function removeReadiness(apiClient, number, labels) {
  for (const label of labels) {
    if (readyLabels.has(label)) await apiClient.removeLabel(number, label);
  }
}

async function returnTriagedRequestToReview(apiClient, number, labels) {
  const hadReadiness = [...labels].some((label) => readyLabels.has(label));
  const remainingStates = [...labels].filter((label) => workflowLabels.has(label) && !readyLabels.has(label));
  if (hadReadiness && remainingStates.length === 0) await apiClient.addLabels(number, ["needs-triage"]);
}

async function maintainFeedback(apiClient, number, comments, body) {
  const existing = findFeedback(comments);
  if (!existing) return apiClient.createComment(number, body);
  if (existing.body !== body) return apiClient.updateComment(existing.id, body);
}

function findFeedback(comments) {
  return [...comments].reverse().find((comment) => comment.body?.includes(feedbackMarker) && comment.user?.login === "github-actions[bot]");
}

function invalidFeedback(errors) {
  return `${feedbackMarker}\n## Issue contract needs attention\n\n${errors.map((error) => `- ${error}`).join("\n")}\n\nFix the items above. Structural validation will re-run, but only an authorized reviewer can grant readiness.`;
}

function resolvedFeedback(kind) {
  return `${feedbackMarker}\n## Issue contract structure corrected\n\nThe ${kind} now has the required structure. A fresh authorized review is still required before restoring readiness.`;
}
