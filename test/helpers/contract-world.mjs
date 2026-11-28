// One in-memory GitHub issue that the issue-contract validator's adapter and
// the `triage` readiness command both reach through Postern, so a test can run
// both programs on the same state. Each person's writes queue the event that
// GitHub would deliver to the workflow; `deliver` runs the validator for every
// queued event in order, as the workflow's per-issue serialization does. The
// validator's own writes queue nothing, as with `GITHUB_TOKEN`. `others` are
// further issues of the repository, `{ number, body, state, comments }`, that
// a specification's supersession reads; their comments are `{ author, body }`.
import { connect } from "../../vendor/postern/postern.mjs";
import { runIssueContractValidation } from "../../vendor/repo-canon/validate-issue-contract.mjs";

import { resolveBoundary } from "./contract-decision.mjs";

export const worldRepository = "owner/repo";
export const validatorLogin = "github-actions[bot]";
const page = (nodes) => ({
  nodes,
  totalCount: nodes.length,
  pageInfo: { hasNextPage: false, endCursor: null },
});
const isBot = (login) => login.endsWith("[bot]");
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

/**
 * @param {Record<string, any>} [options]
 */
export function contractWorld({
  body = "Intake context.",
  labels = ["type:enhancement", "state:triage"],
  roles = { maintainer: "admin" },
  factory = false,
  triageResult = null,
  start = "2026-10-25T12:00:00Z",
  others = [],
  validatorLogin: resultLogin = validatorLogin,
  runnerAccount = null,
  variableFailure = 404,
  sourceConfiguration = { mode: "prepared" },
} = {}) {
  const requests = [];
  const files = new Map();
  if (sourceConfiguration.mode === "body")
    files.set("cutoff.json", {
      sha: "receipt",
      value: {
        format: "repo-canon/issue-contract-cutoff/v1",
        repository: worldRepository,
        release: "v1",
        sha: "b".repeat(40),
        epoch: start,
        complete: true,
        publicationFrozen: true,
        issues: [],
      },
    });
  let clock = Date.parse(start);
  let frozen = false;
  let pauses = 0;
  let nextId = 100;
  let nextEditId = 1;
  const pending = [];
  const issue = {
    body,
    labels: [...labels],
    createdAt: stamp(),
    lastEditedAt: null,
    edits: [],
  };
  const comments = [];
  // The issue was opened with its labels.
  const events = labels.map((name) => ({
    id: nextId++,
    event: "labeled",
    name,
    login: "reporter",
    at: issue.createdAt,
  }));
  clock += 1000;

  function stamp() {
    return new Date(clock).toISOString().replace(".000Z", "Z");
  }
  // Every write takes the current second, then the clock moves one second on,
  // except while writes happen together.
  function at() {
    const value = stamp();
    if (!frozen) clock += 1000;
    return value;
  }
  function editContent(target, text, editedAt) {
    target.body = text;
    target.updatedAt = target.lastEditedAt = editedAt;
    (target.edits ??= []).unshift({
      id: `EDIT_${nextEditId++}`,
      editedAt,
      deletedAt: null,
      diff: text,
    });
  }
  const account = (login) => ({ login, type: isBot(login) ? "Bot" : "User" });
  const neutral = (kind, login, fields = {}) => ({
    platform: "github",
    repository: worldRepository,
    issue: 42,
    kind,
    actor: { login, bot: isBot(login) },
    label: null,
    openingLabels: null,
    bodyChanged: null,
    comment: null,
    ...fields,
  });
  const restComment = (comment) => ({
    id: comment.id,
    node_id: `COMMENT_${comment.id}`,
    html_url: `https://github.com/${worldRepository}/issues/42#issuecomment-${comment.id}`,
    user: account(comment.author),
    body: comment.body,
    created_at: comment.createdAt,
    updated_at: comment.updatedAt,
  });

  function addLabel(name, login, queue) {
    if (issue.labels.includes(name)) return;
    issue.labels.push(name);
    events.push({ id: nextId++, event: "labeled", name, login, at: at() });
    if (queue) pending.push(neutral("labeled", login, { label: name }));
  }
  function removeLabel(name, login, queue) {
    if (!issue.labels.includes(name)) return;
    issue.labels.splice(issue.labels.indexOf(name), 1);
    events.push({ id: nextId++, event: "unlabeled", name, login, at: at() });
    if (queue) pending.push(neutral("unlabeled", login, { label: name }));
  }
  function comment(text, login, queue, time = at()) {
    const created = {
      id: nextId++,
      author: login,
      body: text,
      createdAt: time,
      updatedAt: time,
      edits: [],
    };
    comments.push(created);
    if (queue)
      pending.push(
        neutral("commentCreated", login, {
          comment: {
            id: created.id,
            nodeId: `COMMENT_${created.id}`,
            body: text,
          },
        }),
      );
    return created;
  }

  // The transport for one account's credential.
  function fetchAs(login) {
    const queue = login !== resultLogin;
    return async (input, init = {}) => {
      const url = new URL(input);
      const path = url.pathname;
      const method = init.method ?? "GET";
      const request = init.body ? JSON.parse(init.body) : null;
      const repo = `/repos/${worldRepository}`;
      requests.push({ method, path, body: request, login });
      if (path === `${repo}/actions/variables/REPO_CANON_RUNNER_ACCOUNT`)
        return runnerAccount === null
          ? json({ message: "Variable unavailable" }, variableFailure)
          : json({ name: "REPO_CANON_RUNNER_ACCOUNT", value: runnerAccount });
      if (path === repo) return json({ default_branch: "main" });
      if (path === `${repo}/git/ref/heads/main`)
        return json({ object: { sha: "b".repeat(40) } });
      if (path.includes("/contents/")) {
        const name = path.split("/contents/")[1];
        if (method === "PUT") {
          const sha = `file-${nextId++}`;
          files.set(name, {
            sha,
            value: JSON.parse(
              Buffer.from(request.content, "base64").toString(),
            ),
          });
          return json({ content: { sha } });
        }
        const found =
          name === ".github/issue-contracts.json"
            ? { sha: "configuration", value: sourceConfiguration }
            : files.get(name);
        if (!found) return json({ message: "Not found" }, 404);
        const content = Buffer.from(JSON.stringify(found.value));
        return json({
          type: "file",
          encoding: "base64",
          sha: found.sha,
          size: content.length,
          content: content.toString("base64"),
        });
      }
      if (path === "/graphql") {
        const query = request.query;
        if (query.includes("TriageActingAccount"))
          return json({
            data: {
              viewer: isBot(login)
                ? { __typename: "Bot", login: login.slice(0, -5) }
                : { __typename: "User", login },
            },
          });
        if (query.includes("ContractSourceEdits"))
          return json({
            data: {
              nodes: request.variables.ids.map((id) => {
                const target =
                  id === "ISSUE_42"
                    ? issue
                    : comments.find((entry) => `COMMENT_${entry.id}` === id);
                const editedAt = target?.lastEditedAt ?? null;
                return target
                  ? {
                      id,
                      lastEditedAt: editedAt,
                      userContentEdits: {
                        nodes: target.edits?.slice(0, 1) ?? [],
                      },
                    }
                  : null;
              }),
            },
          });
        if (query.includes("ContractSourceHistory")) {
          const id = request.variables.id;
          const target =
            id === "ISSUE_42"
              ? issue
              : comments.find((entry) => `COMMENT_${entry.id}` === id);
          return json({
            data: {
              node: target
                ? {
                    id,
                    lastEditedAt: target.lastEditedAt ?? null,
                    userContentEdits: page(target.edits ?? []),
                  }
                : null,
            },
          });
        }
        if (query.includes("PinnedFilesRevision"))
          return json({
            data: {
              repository: {
                nameWithOwner: worldRepository,
                defaultBranchRef: {
                  name: "main",
                  target: { __typename: "Commit", oid: "b".repeat(40) },
                },
              },
            },
          });
        if (query.includes("query PinnedFiles("))
          return json({
            data: {
              repository: {
                commit: { __typename: "Commit", oid: "b".repeat(40) },
                rules: factory
                  ? {
                      __typename: "Blob",
                      text: "factory rules",
                      isTruncated: false,
                    }
                  : null,
                configuration: factory
                  ? {
                      __typename: "Blob",
                      text: JSON.stringify({
                        labels: { ready: "state:ready" },
                        modelLabelPrefix: "model:",
                      }),
                      isTruncated: false,
                    }
                  : null,
              },
            },
          });
        const node = (number, { body, state = "open", labels = [] }) => ({
          number,
          fullDatabaseId: String(number),
          id: `ISSUE_${number}`,
          url: `https://github.com/${worldRepository}/issues/${number}`,
          state: state.toUpperCase(),
          title: "Fixture request",
          body,
          createdAt: issue.createdAt,
          lastEditedAt: number === 42 ? issue.lastEditedAt : null,
          author: { __typename: "User", login: "reporter" },
          labels: page(labels.map((name) => ({ name }))),
          parent: null,
          subIssues: page([]),
          blockedBy: page([]),
          timelineItems: { nodes: [] },
        });
        if (query.includes("query PosternIssues("))
          return json({
            data: {
              repository: {
                issues: page([
                  node(42, issue),
                  ...others
                    .filter(({ state = "open" }) => state === "open")
                    .map((other) => node(other.number, other)),
                ]),
              },
            },
          });
        const other = others.find(
          ({ number }) => number === request.variables?.number,
        );
        return json({
          data: {
            repository: {
              issue: other ? node(other.number, other) : node(42, issue),
            },
          },
        });
      }
      const commented = others.find(
        ({ number }) => path === `${repo}/issues/${number}/comments`,
      );
      if (commented && method === "GET")
        return json(
          (commented.comments ?? []).map((entry, index) =>
            restComment({
              id: 9000 + index,
              author: entry.author,
              body: entry.body,
              createdAt: issue.createdAt,
              updatedAt: issue.createdAt,
            }),
          ),
        );
      if (path === `${repo}/issues/42/comments` && method === "GET")
        return json(comments.map(restComment));
      if (path === `${repo}/issues/42/comments` && method === "POST")
        return json(restComment(comment(request.body, login, queue)), 201);
      if (path.startsWith(`${repo}/issues/comments/`) && method === "PATCH") {
        const target = comments.find(
          ({ id }) => id === Number(path.split("/").at(-1)),
        );
        editContent(target, request.body, at());
        return json(restComment(target));
      }
      if (path === `${repo}/issues/42/events`)
        return json(
          events.map((entry) => ({
            id: entry.id,
            event: entry.event,
            label: { name: entry.name },
            actor: account(entry.login),
            created_at: entry.at,
          })),
        );
      if (path.endsWith("/permission")) {
        const name = decodeURIComponent(path.split("/").at(-2));
        return roles[name]
          ? json({ permission: roles[name], role_name: roles[name] })
          : json({ permission: "none", role_name: "none" });
      }
      if (path === `${repo}/issues/42/labels` && method === "POST") {
        for (const name of request.labels) addLabel(name, login, queue);
        return json(issue.labels.map((name) => ({ name })));
      }
      if (path.startsWith(`${repo}/issues/42/labels/`) && method === "DELETE") {
        removeLabel(decodeURIComponent(path.split("/").at(-1)), login, queue);
        return new Response(null, { status: 204 });
      }
      if (path === `${repo}/labels` && method === "GET") return json([]);
      throw new Error(`Unexpected world request ${method} ${path}`);
    };
  }

  const connectionAs = (login) =>
    connect(`https://github.com/${worldRepository}`, {
      // Postern redacts its credential from responses, so it never equals a
      // login the responses carry.
      credential: `fixture-${Buffer.from(login).toString("hex")}`,
      fetch: fetchAs(login),
    });
  const validator = connectionAs(resultLogin);
  /** @type {any} */
  const noPause = async () => {};

  const world = {
    comments,
    events,
    requests,
    files,
    issue,
    pending,
    // Called by `pause` before it delivers the queued events.
    beforeDeliver: null,
    connectionAs,
    now: () => clock,
    // Runs the validator for every queued event, in delivery order, and
    // returns the exit codes.
    async deliver() {
      const codes = [];
      while (pending.length) {
        const event = pending.shift();
        const output = [];
        const log = console.log;
        const error = console.error;
        console.log = console.error = (message) => output.push(message);
        try {
          codes.push(
            await runIssueContractValidation(
              event,
              validator,
              async () => null,
              noPause,
              () => clock,
              triageResult,
              sourceConfiguration,
              resolveBoundary,
              undefined,
              resultLogin,
            ),
          );
        } finally {
          console.log = log;
          console.error = error;
        }
      }
      return codes;
    },
    // Moves the clock on, as a person's pause between actions does.
    wait(seconds = 2) {
      clock += seconds * 1000;
    },
    // Runs `actions` with every write in the same second.
    async together(actions) {
      frozen = true;
      try {
        await actions();
      } finally {
        frozen = false;
        clock += 1000;
      }
    },
    // A person's comment, or edit, at `time` when given: the second of an
    // earlier write it shares.
    comment: (text, login, time) => comment(text, login, true, time),
    editComment(target, text, login, time = at()) {
      editContent(target, text, time);
      pending.push(
        neutral("commentEdited", login, {
          comment: {
            id: target.id,
            nodeId: `COMMENT_${target.id}`,
            body: text,
          },
        }),
      );
    },
    deleteComment(target, login) {
      comments.splice(comments.indexOf(target), 1);
      at();
      pending.push(
        neutral("commentDeleted", login, {
          comment: {
            id: target.id,
            nodeId: `COMMENT_${target.id}`,
            body: target.body,
          },
        }),
      );
    },
    editBody(text, login) {
      editContent(issue, text, at());
      pending.push(neutral("edited", login, { bodyChanged: true }));
    },
    label: (name, login) => addLabel(name, login, true),
    unlabel: (name, login) => removeLabel(name, login, true),
    // A pause for the readiness command: it delivers the queued events, so
    // the validator answers the command's own label event, then moves on.
    pause: async () => {
      if (++pauses > 20)
        throw new Error("The readiness command did not settle in the world.");
      const hook = world.beforeDeliver;
      world.beforeDeliver = null;
      await hook?.();
      await world.deliver();
      world.wait();
    },
  };
  return world;
}
