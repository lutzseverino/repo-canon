#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const feedbackMarker = "<!-- repo-canon:issue-contract-feedback -->";
const readyLabels = new Set(["ready-for-agent", "ready-for-human"]);
const workflowLabels = new Set(["needs-triage", "needs-info", "ready-for-agent", "ready-for-human", "wontfix"]);
const categoryLabels = new Set(["bug", "enhancement"]);
const childLabels = new Set(["wayfinder:research", "wayfinder:prototype", "wayfinder:grilling", "wayfinder:task"]);

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
const result = validate({ issue, comments, blockedBy: relationships.blockedBy, parent: relationships.parent });

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

  async function requestResponse(path, options = {}) {
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

  async function paginate(path) {
    const values = [];
    let next = path;
    while (next) {
      const response = await requestResponse(next);
      values.push(...response.data);
      next = response.link?.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
    }
    return values;
  }

  return {
    getIssue: (number) => request(`${issuePath}/${number}`),
    getUrl: (url) => request(url),
    listComments: (number) => paginate(`${issuePath}/${number}/comments?per_page=100`),
    listBlockedBy: (number) => paginate(`${issuePath}/${number}/dependencies/blocked_by?per_page=100`),
    removeLabel: (number, label) => request(`${issuePath}/${number}/labels/${encodeURIComponent(label)}`, { method: "DELETE" }),
    addLabels: (number, labels) => request(`${issuePath}/${number}/labels`, { method: "POST", body: JSON.stringify({ labels }) }),
    createComment: (number, body) => request(`${issuePath}/${number}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
    updateComment: (id, body) => request(`${issuePath}/comments/${id}`, { method: "PATCH", body: JSON.stringify({ body }) }),
  };
}

async function readRelationships(apiClient, issue, nativeBlockedBy) {
  const sections = parseSections(issue.body ?? "");
  const parentReference = issue.parent_issue_url ?? firstIssueReference(sections.get("parent"));
  const parent = parentReference ? await apiClient.getUrl(parentReference) : null;
  const blockedBy = [...nativeBlockedBy];
  const knownReferences = new Set(nativeBlockedBy.map((blocker) => issueReferenceFor(blocker)).filter(Boolean));
  for (const reference of issueReferences(sections.get("blocked by"))) {
    if (!knownReferences.has(reference)) blockedBy.push(await apiClient.getUrl(reference));
  }
  return { parent, blockedBy };
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
  for (const match of value.matchAll(expression)) {
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

function validate({ issue, comments, blockedBy, parent }) {
  const labels = new Set((issue.labels ?? []).map((label) => typeof label === "string" ? label : label.name));
  const sections = parseSections(issue.body ?? "");
  const errors = [];

  if (labels.has("wayfinder:map")) {
    validateWayfinderMap(sections, labels, errors);
    return outcome("Wayfinder map", errors, labels, false);
  }

  const wayfinderChildren = [...labels].filter((label) => childLabels.has(label));
  if (wayfinderChildren.length > 0) {
    validateWayfinderChild(sections, labels, wayfinderChildren, issue, parent, errors);
    return outcome("Wayfinder child", errors, labels, false);
  }

  if (sections.has("problem statement") || sections.has("user stories")) {
    requireSections(sections, ["Problem Statement", "Solution", "User Stories", "Out of Scope"], errors);
    return outcome("specification", errors, labels, false);
  }

  if (sections.has("what to build") || sections.has("acceptance criteria") || sections.has("blocked by")) {
    requireSections(sections, ["What to build", "Acceptance criteria"], errors);
    requireSection(sections, "Blocked by", errors, { allowExternalValue: blockedBy.length > 0 });
    return outcome("implementation ticket", errors, labels, false);
  }

  if (sections.has("steps to reproduce") || sections.has("expected behavior") || sections.has("actual behavior")) {
    requireSections(sections, ["Steps to reproduce", "Expected behavior", "Actual behavior"], errors);
    validateTriagedLabels(labels, "bug", errors);
    validateAgentBriefIfApplicable(labels, comments, "bug", errors);
    return outcome("bug report", errors, labels, true);
  }

  if (sections.has("desired outcome") || sections.has("problem")) {
    requireSections(sections, ["Problem", "Desired outcome"], errors);
    validateTriagedLabels(labels, "enhancement", errors);
    validateAgentBriefIfApplicable(labels, comments, "enhancement", errors);
    return outcome("feature request", errors, labels, true);
  }

  const brief = latestAgentBrief(comments);
  if (brief) {
    validateTriagedLabels(labels, null, errors);
    validateAgentBrief(brief.body, labels, errors);
    return outcome("triaged Agent Brief", errors, labels, true);
  }

  errors.push("Use one supported issue contract: a public form, native specification or ticket, triaged Agent Brief, Wayfinder map, or labeled Wayfinder child.");
  return outcome("issue contract", errors, labels, false);
}

function outcome(kind, errors, labels, triaged) {
  return { valid: errors.length === 0, kind, errors: [...new Set(errors)], labels, triaged };
}

function parseSections(markdown) {
  const headings = [...markdown.matchAll(/^(#{1,6})[ \t]+(.+?)[ \t]*$/gim)];
  const sections = new Map();
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const name = normalize(heading[2]);
    const start = heading.index + heading[0].length;
    const end = headings[index + 1]?.index ?? markdown.length;
    sections.set(name, markdown.slice(start, end).trim());
  }
  return sections;
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
  const withoutComments = value.replace(/<!--[\s\S]*?-->/g, "").trim();
  if (!withoutComments) return true;
  return /^(?:[_*]*no response[_*]*|tbd|todo|\[(?:your |add |describe |enter )?[^\]]+\]|<[^>]+>)\.?$/i.test(withoutComments);
}

function validateWayfinderMap(sections, labels, errors) {
  if ([...labels].some((label) => childLabels.has(label))) {
    errors.push("Keep `wayfinder:map` separate from Wayfinder child labels.");
  }
  requireSection(sections, "Destination", errors);
  for (const name of ["Notes", "Decisions so far", "Not yet specified", "Out of scope"]) {
    requireSection(sections, name, errors, { allowEmpty: true });
  }
}

function validateWayfinderChild(sections, labels, childLabelList, issue, parent, errors) {
  if (childLabelList.length !== 1 || labels.has("wayfinder:map")) {
    errors.push("Apply exactly one Wayfinder child label and do not combine it with `wayfinder:map`.");
  }
  requireSection(sections, "Question", errors);
  if (!issue.parent_issue_url && !sections.has("parent")) {
    errors.push("Link the Wayfinder child to its parent map using the native parent relationship or a `Parent` section.");
  } else if (parent && !(parent.labels ?? []).some((label) => (typeof label === "string" ? label : label.name) === "wayfinder:map")) {
    errors.push("Link the Wayfinder child to an issue labeled `wayfinder:map`.");
  }
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

function validateAgentBriefIfApplicable(labels, comments, expectedCategory, errors) {
  const brief = latestAgentBrief(comments);
  if (brief) {
    validateAgentBrief(brief.body, labels, errors, expectedCategory);
  } else if ([...labels].some((label) => readyLabels.has(label))) {
    errors.push("Add a reviewed Agent Brief before applying a readiness label to a triaged request.");
  }
}

function latestAgentBrief(comments) {
  return [...comments].reverse().find((comment) => /^#{1,6}[ \t]+agent brief[ \t]*$/im.test(comment.body ?? ""));
}

function validateAgentBrief(body, labels, errors, expectedCategory = null) {
  const preamble = body.split(/^#{1,6}[ \t]+agent brief[ \t]*$/im)[0].trim();
  if (preamble !== "> *This was generated by AI during triage.*") {
    errors.push("Start the Agent Brief comment with `> *This was generated by AI during triage.*`.");
  }
  const fields = parseBriefFields(body);
  for (const name of ["Category", "Summary", "Current behavior", "Desired behavior", "Key interfaces", "Acceptance criteria", "Out of scope"]) {
    if (!fields.has(normalize(name)) || isPlaceholder(fields.get(normalize(name)))) {
      errors.push(`Complete the Agent Brief \`${name}\` field.`);
    }
  }
  const category = normalize(fields.get("category") ?? "");
  if (category && !categoryLabels.has(category)) errors.push("Set the Agent Brief `Category` to `bug` or `enhancement`.");
  if (expectedCategory && category && category !== expectedCategory) errors.push(`Match the Agent Brief category to \`${expectedCategory}\`.`);
  if (category && !labels.has(category)) errors.push(`Apply the Agent Brief's \`${category}\` category label.`);
}

function parseBriefFields(body) {
  const matches = [...body.matchAll(/^\*\*([^*:\n]+):\*\*[ \t]*(.*)$/gim)];
  const fields = new Map();
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? body.length;
    fields.set(normalize(match[1]), `${match[2]}\n${body.slice(start, end)}`.trim());
  }
  return fields;
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
