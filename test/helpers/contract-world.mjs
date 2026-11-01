// One in-memory GitHub issue that the issue-contract validator's adapter and
// the `triage` readiness command both reach through Postern, so a test can run
// both programs on the same state. Each person's writes queue the event that
// GitHub would deliver to the workflow; `deliver` runs the validator for every
// queued event in order, as the workflow's per-issue serialization does. The
// validator's own writes queue nothing, as with `GITHUB_TOKEN`.
import { connect } from "../../vendor/postern/postern.mjs";
import { runIssueContractValidation } from "../../scripts/validate-issue-contract.mjs";

export const worldRepository = "owner/repo";
export const validatorLogin = "github-actions[bot]";
const page = (nodes) => ({
  nodes,
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
  labels = ["enhancement", "needs-triage"],
  roles = { maintainer: "admin" },
  factory = false,
  start = "2026-10-25T12:00:00Z",
} = {}) {
  let clock = Date.parse(start);
  let frozen = false;
  let pauses = 0;
  let nextId = 100;
  const pending = [];
  const issue = {
    body,
    labels: [...labels],
    createdAt: stamp(),
    lastEditedAt: null,
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
    const queue = login !== validatorLogin;
    return async (input, init = {}) => {
      const url = new URL(input);
      const path = url.pathname;
      const method = init.method ?? "GET";
      const request = init.body ? JSON.parse(init.body) : null;
      const repo = `/repos/${worldRepository}`;
      if (path === "/graphql") {
        const query = request.query;
        if (query.includes("TriageActingAccount"))
          return json({
            data: {
              viewer: isBot(login)
                ? {
                    __typename: "Bot",
                    login: login.slice(0, -5),
                    databaseId: 7,
                  }
                : { __typename: "User", login, databaseId: 7 },
            },
          });
        if (query.includes("TriageReadinessPolicy"))
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
        if (query.includes("TriageFactoryRules"))
          return json({
            data: {
              repository: {
                commit: { __typename: "Commit", oid: "b".repeat(40) },
                rules: factory ? { __typename: "Blob" } : null,
              },
            },
          });
        return json({
          data: {
            repository: {
              issue: {
                number: 42,
                fullDatabaseId: "42",
                id: "ISSUE_42",
                url: `https://github.com/${worldRepository}/issues/42`,
                state: "OPEN",
                title: "Fixture request",
                body: issue.body,
                createdAt: issue.createdAt,
                lastEditedAt: issue.lastEditedAt,
                author: { __typename: "User", login: "reporter" },
                labels: page(issue.labels.map((name) => ({ name }))),
                parent: null,
                subIssues: page([]),
                blockedBy: page([]),
                timelineItems: { nodes: [] },
              },
            },
          },
        });
      }
      if (path.startsWith("/users/")) {
        const name = decodeURIComponent(path.slice("/users/".length));
        return json({ ...account(name), id: 7 });
      }
      if (path === `${repo}/issues/42/comments` && method === "GET")
        return json(comments.map(restComment));
      if (path === `${repo}/issues/42/comments` && method === "POST")
        return json(restComment(comment(request.body, login, queue)), 201);
      if (path.startsWith(`${repo}/issues/comments/`) && method === "PATCH") {
        const target = comments.find(
          ({ id }) => id === Number(path.split("/").at(-1)),
        );
        target.body = request.body;
        target.updatedAt = at();
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
  const validator = connectionAs(validatorLogin);
  /** @type {any} */
  const noPause = async () => {};

  const world = {
    comments,
    events,
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
      target.body = text;
      target.updatedAt = time;
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
      issue.body = text;
      issue.lastEditedAt = at();
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
