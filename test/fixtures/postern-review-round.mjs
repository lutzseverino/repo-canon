import { connect } from "../../vendor/postern/postern.mjs";

const repository = "/repos/example/repository";

// The published adapter runs against this in-memory pull request: its REST
// facts, the issues it closes, its reviews, and the writes `round.mjs` makes.
// Each review the fixture stores has GitHub's REST shape.
export function roundConnection(state, connectTo = connect) {
  const fetch = async (input, options = {}) => {
    const url = new URL(input);
    const method = options.method ?? "GET";
    const body = options.body ? JSON.parse(options.body) : null;
    state.requests = [...(state.requests ?? []), `${method} ${url.pathname}`];
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json" },
      });
    if (state.fail) return json({ message: "Server Error" }, 502);
    const pull = state.pull;
    if (url.pathname === `${repository}/pulls/${pull.number}`)
      return json({
        number: pull.number,
        node_id: "PR_node",
        state: pull.state ?? "open",
        draft: pull.draft,
        head: { sha: pull.head },
        labels: (pull.labels ?? []).map((name) => ({ name })),
      });
    if (url.pathname === `${repository}/pulls/${pull.number}/reviews`) {
      if (method === "GET") return json(state.reviews ?? []);
      const review = {
        id: (state.reviews ?? []).length + 1,
        user: { login: "reviewer", type: "User" },
        state: body.event === "COMMENT" ? "COMMENTED" : body.event,
        body: body.body,
        commit_id: body.commit_id,
        submitted_at: "2026-11-06T12:00:00Z",
      };
      state.reviews = [...(state.reviews ?? []), review];
      state.posted = [...(state.posted ?? []), body];
      return json({
        ...review,
        html_url: `https://github.com/example/repository/pull/${pull.number}#pullrequestreview-${review.id}`,
      });
    }
    const issue = /^\/repos\/example\/repository\/issues\/(\d+)$/.exec(
      url.pathname,
    );
    if (issue) {
      const labels = state.issues?.[issue[1]];
      if (!labels) return json({ message: "Not Found" }, 404);
      return json({
        number: Number(issue[1]),
        labels: labels.map((name) => ({ name })),
      });
    }
    if (
      url.pathname === "/graphql" &&
      /closingIssuesReferences/.test(body.query)
    )
      return json({
        data: {
          repository: {
            pullRequest: {
              closingIssuesReferences: {
                nodes: (pull.closes ?? []).map((number) => ({
                  number,
                  labels: {
                    nodes: (state.issues?.[number] ?? []).map((name) => ({
                      name,
                    })),
                    pageInfo: { hasNextPage: false },
                  },
                })),
                pageInfo: { hasNextPage: Boolean(state.moreIssues) },
              },
            },
          },
        },
      });
    if (
      url.pathname === "/graphql" &&
      /markPullRequestReadyForReview/.test(body.query)
    ) {
      assert(body.variables.id === "PR_node", "ready names the PR node");
      pull.draft = false;
      return json({
        data: {
          markPullRequestReadyForReview: { pullRequest: { isDraft: false } },
        },
      });
    }
    return json({ message: `Unexpected ${method} ${url.pathname}` }, 404);
  };
  return connectTo("https://github.com/example/repository", {
    credential: "fixture-credential",
    fetch,
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
