// Run the published Postern adapter against stateful GitHub HTTP responses.
// No request is allowed to escape to the network, including authentication.
import { readFileSync, writeFileSync } from "node:fs";

const statePath = process.env.FAKE_GH_STATE;
globalThis.fetch = async (input, options = {}) => {
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  const save = () => writeFileSync(statePath, `${JSON.stringify(state)}\n`);
  const url = new URL(input);
  if (url.origin !== "https://api.github.com")
    throw new Error("Unexpected API host in remote-setup fixture.");
  if (
    new Headers(options.headers).get("authorization") !==
    `Bearer ${state.token ?? "fixture-current-token"}`
  )
    throw new Error(
      "The request did not use the current GitHub CLI credential.",
    );
  const endpoint = `${url.pathname.slice(1)}${url.search}`;
  const method = options.method ?? "GET";
  const body = options.body
    ? JSON.parse(/** @type {string} */ (options.body))
    : {};
  state.apiHosts ??= [];
  state.apiHosts.push("github.com");
  state.requests ??= [];
  state.requests.push(`${method} ${endpoint}`);
  save();
  const json = (value, status = 200, headers = {}) =>
    new Response(JSON.stringify(value), { status, headers });
  const error = (status, message) => json({ message }, status);
  // Preserve the old scenarios while supplying actual response facts rather
  // than using CLI error text in the production implementation.
  const legacyError = (text) => {
    const match = /^gh: (.*) \(HTTP (\d{3})\)/m.exec(text);
    if (match) return error(Number(match[2]), match[1]);
    throw new Error(text);
  };
  const repositoryEndpoint = /^repos\/[^/]+\/[^/?]+$/;
  const protectionEndpoint = /\/branches\/[^/]+\/protection$/;
  const contextsEndpoint = /\/protection\/required_status_checks\/contexts$/;
  const rulesetsEndpoint = /\/rulesets(?:\?.*)?$/;
  const rulesetMatch = /\/rulesets\/(\d+)$/.exec(endpoint);
  const workflowEndpoint =
    /\/contents\/\.github\/workflows\/pr-metadata\.yml\?ref=[^&]+$/;
  const page = (items) => {
    const size = state.pageSize ?? (items.length || 1);
    const number = Number(url.searchParams.get("page") ?? 1);
    const headers =
      number * size < items.length
        ? {
            link: `<${url.origin}${url.pathname}?${new URLSearchParams({ ...Object.fromEntries(url.searchParams), page: String(number + 1) })}>; rel="next"`,
          }
        : {};
    return json(items.slice((number - 1) * size, number * size), 200, headers);
  };
  const fail = state.failure;
  if (
    fail &&
    (fail.at === "account"
      ? endpoint === "user"
      : fail.at === "repository"
        ? repositoryEndpoint.test(endpoint)
        : fail.at === "read"
          ? method === "GET" &&
            !repositoryEndpoint.test(endpoint) &&
            endpoint !== "user"
          : method !== "GET")
  ) {
    if (fail.timeout)
      throw new DOMException("fixture request timed out", "TimeoutError");
    if (fail.transport)
      throw new Error(fail.message ?? "transport fixture failure");
    if (fail.invalid) return new Response("invalid JSON");
    return error(fail.status, fail.message ?? "fixture failure");
  }
  if (endpoint === "user") {
    if (state.anonymous) return json(null);
    if (state.accountError) return legacyError(state.accountError);
    return json({ login: "fixture-account", type: "User" });
  }
  if (method === "GET" && repositoryEndpoint.test(endpoint)) {
    if (state.repositoryError !== undefined)
      return legacyError(state.repositoryError);
    if (state.repositoryResponse !== undefined)
      return new Response(state.repositoryResponse);
    state.repositoryReads = (state.repositoryReads ?? 0) + 1;
    save();
    if (state.failRepositoryReadback && state.repositoryReads > 1)
      return error(500, "Server Error");
    const settings = structuredClone(state.settings ?? {});
    if (state.readbackMismatch === "settings" && state.repositoryReads > 1)
      settings.allow_squash_merge = false;
    return json({
      full_name: state.repo,
      role_name: state.roleName ?? "custom-repository-role",
      permissions: state.permissions ?? {
        admin: process.env.FAKE_GITHUB_OPERATION === "pull-request-integration",
        maintain: false,
        push: true,
        triage: true,
        pull: true,
      },
      default_branch: state.defaultBranch ?? "main",
      private: state.private ?? false,
      ...settings,
    });
  }
  if (method === "GET" && endpoint.includes("/labels")) {
    if (state.failLabelInspection)
      return error(403, "Resource not accessible by integration");
    // Count logical reads, not their continuation pages.
    if (!url.searchParams.has("page"))
      state.labelReads = (state.labelReads ?? 0) + 1;
    save();
    const labels = structuredClone(state.labels ?? []);
    if (state.readbackMismatch && state.labelReads > 1 && labels.length)
      labels[0].color = labels[0].color === "000000" ? "ffffff" : "000000";
    return page(labels);
  }
  if (method === "GET" && workflowEndpoint.test(endpoint)) {
    if (state.workflow === "absent") return error(404, "Not Found");
    if (state.workflow === "failed") return error(500, "Server Error");
    return json({
      type: "file",
      path: ".github/workflows/pr-metadata.yml",
      encoding: "base64",
      content: Buffer.from("name: PR metadata validation\n").toString("base64"),
    });
  }
  if (method === "GET" && protectionEndpoint.test(endpoint)) {
    state.branchReads = (state.branchReads ?? 0) + 1;
    save();
    if (state.forbidden?.protection)
      return error(403, state.forbidden.protection);
    if (
      state.failBranchInspection ||
      (state.failBranchReadback && state.branchReads > 1)
    )
      return error(404, "Not Found");
    if (state.branchProtection == null)
      return error(404, "Branch not protected");
    const protection = structuredClone(state.branchProtection);
    if (
      state.readbackMismatch === "branch" &&
      state.branchReads > 1 &&
      protection.required_status_checks
    ) {
      const checks = protection.required_status_checks;
      checks.contexts = (checks.contexts ?? []).filter(
        (context) => context !== "PR metadata",
      );
      checks.checks = (checks.checks ?? []).filter(
        (check) => check.context !== "PR metadata",
      );
    }
    if (state.readbackMismatch === "branch freshness" && state.branchReads > 1)
      protection.required_status_checks.strict = false;
    return json(protection);
  }
  if (method === "GET" && rulesetsEndpoint.test(endpoint)) {
    if (state.forbidden?.rulesets) return error(403, state.forbidden.rulesets);
    if (state.failRulesetInspection)
      throw new Error("simulated ruleset inspection failure");
    return page(
      (state.rulesets ?? []).map(({ id, name, target, enforcement }) => ({
        id,
        name,
        target,
        enforcement,
      })),
    );
  }
  if (method === "GET" && rulesetMatch) {
    const ruleset = (state.rulesets ?? []).find(
      ({ id }) => id === Number(rulesetMatch[1]),
    );
    if (!ruleset) return error(404, "Not Found");
    const value = structuredClone(ruleset);
    if (state.readbackMismatch === "ruleset" && (state.mutations ?? 0) > 0)
      value.enforcement = "evaluate";
    if (
      state.readbackMismatch === "ruleset freshness" &&
      (state.mutations ?? 0) > 0
    )
      value.rules.find(
        (rule) => rule.type === "required_status_checks",
      ).parameters.strict_required_status_checks_policy = false;
    return json(value);
  }
  if (method !== "GET") {
    const mutation = (state.mutations ?? 0) + 1;
    if (state.interruptAtMutation === mutation) {
      state.interruptAtMutation = null;
      save();
      process.kill(process.pid, "SIGKILL");
    }
    if (state.failAtMutation === mutation) {
      state.failAtMutation = null;
      save();
      throw new Error("simulated GitHub API failure");
    }
    const record = (action) => {
      state.mutations = mutation;
      state.mutationLog ??= [];
      state.mutationLog.push(action);
    };
    if (method === "POST" && /\/labels(?:\?|$)/.test(endpoint)) {
      record("create label");
      state.labels ??= [];
      state.labels.push(body);
      save();
      return json(body);
    }
    if (method === "PATCH" && endpoint.includes("/labels/")) {
      const name = decodeURIComponent(url.pathname.split("/labels/")[1]);
      const label = state.labels.find(
        (value) => value.name.toLowerCase() === name.toLowerCase(),
      );
      if (!label) return error(404, "Not Found");
      record("update label");
      Object.assign(label, {
        name: body.new_name,
        color: body.color,
        description: body.description,
      });
      save();
      return json(label);
    }
    if (
      method === "PATCH" &&
      endpoint.endsWith("/protection/required_status_checks")
    ) {
      record("enable branch freshness");
      Object.assign(state.branchProtection.required_status_checks, body);
      save();
      return json(state.branchProtection.required_status_checks);
    }
    if (method === "POST" && contextsEndpoint.test(endpoint)) {
      record("add branch status check");
      const checks = state.branchProtection.required_status_checks;
      checks.contexts ??= [];
      for (const context of body.contexts ?? [])
        if (!checks.contexts.includes(context)) checks.contexts.push(context);
      save();
      return json(checks.contexts);
    }
    if (method === "POST" && rulesetsEndpoint.test(endpoint)) {
      record("create required-check ruleset");
      state.rulesets ??= [];
      const created = { id: state.nextRulesetId ?? 100, ...body };
      state.nextRulesetId = created.id + 1;
      state.rulesets.push(created);
      save();
      return json(created);
    }
    if (method === "PUT" && rulesetMatch) {
      const index = (state.rulesets ?? []).findIndex(
        ({ id }) => id === Number(rulesetMatch[1]),
      );
      if (index < 0) return error(404, "Not Found");
      record("update required-check ruleset");
      state.rulesets[index] = { id: Number(rulesetMatch[1]), ...body };
      save();
      return json(state.rulesets[index]);
    }
    if (method === "PATCH" && repositoryEndpoint.test(endpoint)) {
      record("update squash settings");
      state.settings = { ...state.settings, ...body };
      save();
      return json({ full_name: state.repo, ...state.settings });
    }
  }
  throw new Error(`Unsupported fixture request: ${method} ${endpoint}`);
};
