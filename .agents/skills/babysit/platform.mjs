import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { connect, PlatformError } from "../../../vendor/postern/postern.mjs";

// The only credential is the GitHub CLI's currently authenticated credential.
export function connectionFor(repository) {
  const remote = repository ?? process.env.GH_REPO ?? execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8", timeout: 15_000 }).trim();
  const credential = execFileSync("gh", ["auth", "token", "--hostname", "github.com"], { encoding: "utf8", timeout: 15_000, stdio: ["ignore", "pipe", "pipe"] }).trim();
  return connect(remote.includes(":") ? remote : `https://github.com/${remote}`, { credential, timeoutMs: 45_000 });
}

export async function requestData(connection, request) {
  return (await connection.access.request(request)).data;
}

export async function pages(connection, path) {
  return (await connection.access.requestPages({ path })).map((page) => page.data);
}

// CheckResult omits links, workflow identity and start time. Access retains
// those GitHub facts so the existing check/attempt ordering stays unchanged.
export async function checkRollup(connection, head) {
  const [owner, name] = connection.repository.path.split("/");
  const items = [];
  const seen = new Set();
  let after = null;
  for (;;) {
    const data = await requestData(connection, {
      method: "POST", path: "/graphql", body: {
        query: `query BabysitChecks($owner: String!, $name: String!, $head: String!, $after: String) {
          repository(owner: $owner, name: $name) { object(expression: $head) { ... on Commit { statusCheckRollup { contexts(first: 100, after: $after) {
            nodes { __typename ... on CheckRun { name status conclusion detailsUrl startedAt checkSuite { workflowRun { workflow { name } } } } ... on StatusContext { context state targetUrl } }
            pageInfo { hasNextPage endCursor }
          } } } } }
        }`, variables: { owner, name, head, after },
      },
    });
    if (data?.errors?.length) throw new PlatformError("invalidResponse", "Could not read pull request checks.");
    const rollup = data?.data?.repository?.object?.statusCheckRollup;
    if (rollup === null && after === null) return [];
    const page = rollup?.contexts;
    if (!Array.isArray(page?.nodes) || typeof page.pageInfo?.hasNextPage !== "boolean")
      throw new PlatformError("invalidResponse", "Could not read complete pull request checks.");
    for (const item of page.nodes) {
      if (item.__typename === "CheckRun" ? typeof item.name !== "string" || typeof item.status !== "string" : item.__typename !== "StatusContext" || typeof item.context !== "string" || typeof item.state !== "string")
        throw new PlatformError("invalidResponse", "Could not read a pull request check.");
      items.push({ ...item, workflowName: item.checkSuite?.workflowRun?.workflow?.name ?? item.workflowName });
    }
    if (!page.pageInfo.hasNextPage) return items;
    const cursor = page.pageInfo.endCursor;
    if (typeof cursor !== "string" || !cursor || seen.has(cursor))
      throw new PlatformError("invalidResponse", "Could not read complete pull request checks.");
    seen.add(cursor); after = cursor;
  }
}

export function executedAsScript(url) {
  return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(url));
}
