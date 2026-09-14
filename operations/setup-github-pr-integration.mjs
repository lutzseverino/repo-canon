import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const resultFormat = 'repo-standards/result/v1';
const maximumOutput = 1024 * 1024;
const operationName = 'GitHub PR integration setup';
const checkName = 'PR metadata';
const rulesetName = 'Repo Canon required PR checks';
const mergeSettings = {
  allow_squash_merge: true,
  allow_merge_commit: false,
  allow_rebase_merge: false,
  squash_merge_commit_title: 'PR_TITLE',
  squash_merge_commit_message: 'PR_BODY',
};

function failProcess(message) {
  throw new Error(message);
}

function readRequest() {
  let request;
  try {
    request = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    failProcess(`${operationName} input must be one JSON object.`);
  }
  if (request?.format !== 'repo-standards/operation/v1') {
    failProcess(`${operationName} requires repo-standards/operation/v1 input.`);
  }
  if (request.operation?.phase !== 'fixes') {
    failProcess(`${operationName} must run as a fixes operation.`);
  }
  const { paths, directories } = request.allowedTargets ?? {};
  if (!Array.isArray(paths) || paths.length !== 0
      || !Array.isArray(directories) || directories.length !== 0) {
    failProcess(`${operationName} requires an empty project-content target scope.`);
  }
  if (typeof request.projectRoot !== 'string' || request.projectRoot.length === 0) {
    failProcess(`${operationName} input must identify the project root.`);
  }
  return request;
}

function result(status, message) {
  process.stdout.write(`${JSON.stringify({ format: resultFormat, status, message })}\n`);
}

function run(executable, args, cwd, input) {
  const outcome = spawnSync(executable, args, {
    cwd,
    encoding: 'utf8',
    input,
    maxBuffer: maximumOutput,
  });
  if (outcome.error) {
    return {
      ok: false,
      unavailable: outcome.error.code === 'ENOENT',
      detail: outcome.error.code ?? 'spawn error',
      stderr: '',
    };
  }
  if (outcome.status !== 0) {
    const processState = outcome.signal ? `signal ${outcome.signal}` : `exit ${outcome.status}`;
    return { ok: false, unavailable: false, detail: processState, stderr: outcome.stderr };
  }
  return { ok: true, stdout: outcome.stdout, stderr: outcome.stderr };
}

function versionFrom(output) {
  const match = output.match(/(?:^|[^0-9])v?(\d+)\.(\d+)\.(\d+)(?:[^0-9]|$)/m);
  return match ? match.slice(1).map(Number) : null;
}

function atLeast(actual, minimum) {
  return actual.some((part, index) => part > minimum[index]
    && actual.slice(0, index).every((earlier, earlierIndex) => earlier === minimum[earlierIndex]))
    || actual.every((part, index) => part === minimum[index]);
}

function githubIdentity(remoteUrl) {
  let owner;
  let repository;
  const scp = remoteUrl.match(/^(?:[^@/]+@)?github\.com:([^/]+)\/(.+)$/i);
  if (scp) {
    [, owner, repository] = scp;
  } else {
    try {
      const parsed = new URL(remoteUrl);
      if (parsed.hostname.toLowerCase() !== 'github.com') return null;
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length !== 2) return null;
      [owner, repository] = parts.map(part => decodeURIComponent(part));
    } catch {
      return null;
    }
  }
  repository = repository.replace(/\.git$/i, '').replace(/\/$/, '');
  if (!owner || !repository || /[\s/?#]/.test(owner) || /[\s/?#]/.test(repository)) return null;
  return `${owner}/${repository}`;
}

function inferRepository(projectRoot) {
  const remotes = run(
    'git',
    ['-C', projectRoot, 'config', '--local', '--get-regexp', '^remote\\..*\\.(url|pushurl)$'],
    projectRoot,
  );
  if (!remotes.ok) return { blocked: 'No unambiguous github.com repository was found in Git remotes.' };
  const identities = new Map();
  for (const line of remotes.stdout.split(/\r?\n/)) {
    const separator = line.search(/\s/);
    if (separator < 0) continue;
    const identity = githubIdentity(line.slice(separator).trim());
    if (identity) identities.set(identity.toLowerCase(), identity);
  }
  if (identities.size === 0) {
    return { blocked: 'No unambiguous github.com repository was found in Git remotes.' };
  }
  if (identities.size > 1) {
    return {
      blocked: `Multiple github.com repositories were found in Git remotes (${[...identities.values()].sort().join(', ')}); resolve the target before setup.`,
    };
  }
  return { identity: identities.values().next().value };
}

function jsonFrom(outcome) {
  if (!outcome.ok) return { error: outcome.detail, outcome };
  try {
    return { value: JSON.parse(outcome.stdout) };
  } catch {
    return { error: 'invalid JSON response', outcome };
  }
}

function githubApi(args, projectRoot, input) {
  return run(
    'gh',
    ['api', '--hostname', 'github.com', ...args],
    projectRoot,
    input === undefined ? undefined : `${JSON.stringify(input)}\n`,
  );
}

function apiEndpoint(identity, suffix = '') {
  const [owner, repository] = identity.split('/');
  return `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}${suffix}`;
}

function matchingMergeSettings(repository) {
  return Object.entries(mergeSettings).every(([name, value]) => repository[name] === value);
}

function readBranchStatusChecks(identity, defaultBranch, projectRoot) {
  const endpoint = apiEndpoint(
    identity,
    `/branches/${encodeURIComponent(defaultBranch)}/protection/required_status_checks`,
  );
  const response = githubApi([endpoint], projectRoot);
  if (!response.ok && /(?:HTTP 404|Branch not protected|Not Found)/i.test(response.stderr ?? '')) {
    return { value: null };
  }
  const parsed = jsonFrom(response);
  if (parsed.error) return parsed;
  const value = parsed.value;
  if (!value || !Array.isArray(value.contexts) || !Array.isArray(value.checks)) {
    return { error: 'invalid required status checks response' };
  }
  if (!value.contexts.every(context => typeof context === 'string')
      || !value.checks.every(check => check && typeof check.context === 'string')) {
    return { error: 'invalid required status checks response' };
  }
  return { value };
}

function hasRequiredCheck(statusChecks) {
  return statusChecks !== null
    && (statusChecks.contexts.includes(checkName)
      || statusChecks.checks.some(check => check.context === checkName));
}

function flattenPages(value) {
  return Array.isArray(value) && value.every(Array.isArray) ? value.flat() : value;
}

function readRulesets(identity, projectRoot) {
  const list = jsonFrom(githubApi([
    '--paginate',
    '--slurp',
    `${apiEndpoint(identity, '/rulesets')}?includes_parents=false&per_page=100`,
  ], projectRoot));
  if (list.error) return list;
  const summaries = flattenPages(list.value);
  if (!Array.isArray(summaries)
      || !summaries.every(ruleset => ruleset && Number.isInteger(ruleset.id))) {
    return { error: 'invalid repository rulesets response' };
  }

  const rulesets = [];
  for (const summary of summaries) {
    const detail = jsonFrom(githubApi([
      apiEndpoint(identity, `/rulesets/${summary.id}`),
    ], projectRoot));
    if (detail.error) return { error: `could not inspect ruleset ${summary.id} (${detail.error})` };
    if (!detail.value || detail.value.id !== summary.id || typeof detail.value.name !== 'string') {
      return { error: `invalid repository ruleset ${summary.id} response` };
    }
    rulesets.push(detail.value);
  }
  return { value: rulesets };
}

function canonicalRuleset() {
  return {
    name: rulesetName,
    target: 'branch',
    enforcement: 'active',
    bypass_actors: [],
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
    rules: [{
      type: 'required_status_checks',
      parameters: {
        strict_required_status_checks_policy: false,
        required_status_checks: [{ context: checkName }],
      },
    }],
  };
}

function managedRulesetPlan(rulesets) {
  const matches = rulesets.filter(ruleset => ruleset.name.toLowerCase() === rulesetName.toLowerCase());
  if (matches.length > 1) {
    return { error: `multiple rulesets are named ${rulesetName}; resolve the ambiguous managed rule before setup` };
  }
  if (matches.length === 0) return { kind: 'create', payload: canonicalRuleset() };

  const existing = matches[0];
  if (existing.target !== 'branch') {
    return { error: `${rulesetName} targets ${existing.target ?? 'an unknown resource'} instead of branches` };
  }
  const conditions = structuredClone(existing.conditions ?? {});
  const refName = conditions.ref_name;
  if (!refName || !Array.isArray(refName.include) || !Array.isArray(refName.exclude)) {
    return { error: `${rulesetName} has invalid branch conditions` };
  }
  const rules = structuredClone(existing.rules ?? []);
  if (!Array.isArray(rules) || !rules.every(rule => rule && typeof rule.type === 'string')) {
    return { error: `${rulesetName} has invalid rules` };
  }
  const statusRules = rules.filter(rule => rule.type === 'required_status_checks');
  if (statusRules.length > 1) {
    return { error: `${rulesetName} has multiple required status check rules` };
  }

  let changed = existing.enforcement !== 'active';
  if (!refName.include.includes('~DEFAULT_BRANCH')) {
    refName.include.push('~DEFAULT_BRANCH');
    changed = true;
  }
  if (refName.exclude.includes('~DEFAULT_BRANCH')) {
    refName.exclude = refName.exclude.filter(pattern => pattern !== '~DEFAULT_BRANCH');
    conditions.ref_name = refName;
    changed = true;
  }

  if (statusRules.length === 0) {
    rules.push(canonicalRuleset().rules[0]);
    changed = true;
  } else {
    const parameters = statusRules[0].parameters;
    if (!parameters || !Array.isArray(parameters.required_status_checks)
        || !parameters.required_status_checks.every(check => check && typeof check.context === 'string')) {
      return { error: `${rulesetName} has invalid required status checks` };
    }
    if (!parameters.required_status_checks.some(check => check.context === checkName)) {
      parameters.required_status_checks.push({ context: checkName });
      changed = true;
    }
  }

  const payload = {
    name: existing.name,
    target: existing.target,
    enforcement: 'active',
    bypass_actors: structuredClone(existing.bypass_actors ?? []),
    conditions,
    rules,
  };
  return changed ? { kind: 'update', id: existing.id, payload } : { kind: 'none', id: existing.id };
}

function rulesetMatches(rulesets, id) {
  const existing = rulesets.find(ruleset => ruleset.id === id);
  if (!existing || existing.enforcement !== 'active' || existing.target !== 'branch') return false;
  const refName = existing.conditions?.ref_name;
  if (!refName?.include?.includes('~DEFAULT_BRANCH') || refName.exclude?.includes('~DEFAULT_BRANCH')) return false;
  return existing.rules?.some(rule => rule.type === 'required_status_checks'
    && rule.parameters?.required_status_checks?.some(check => check.context === checkName));
}

function effectSummary(effects) {
  if (effects.length === 0) return 'No changes were confirmed.';
  return `Confirmed partial effects: ${effects.join(' and ')}.`;
}

function setupIntegration(request) {
  const nodeVersion = versionFrom(process.versions.node);
  if (!nodeVersion || nodeVersion[0] !== 24) {
    result('blocked', `${operationName} requires Node.js 24.`);
    return;
  }

  const gitVersion = run('git', ['--version'], request.projectRoot);
  if (!gitVersion.ok) {
    result('blocked', `Git is unavailable; install Git 2.18.0 or newer before ${operationName}.`);
    return;
  }
  const parsedGitVersion = versionFrom(gitVersion.stdout);
  if (!parsedGitVersion || !atLeast(parsedGitVersion, [2, 18, 0])) {
    result('blocked', `${operationName} requires Git 2.18.0 or newer.`);
    return;
  }

  const ghVersion = run('gh', ['--version'], request.projectRoot);
  if (!ghVersion.ok) {
    result('blocked', `GitHub CLI (gh) is unavailable; install gh 2.57.0 or newer before ${operationName}.`);
    return;
  }
  const parsedGhVersion = versionFrom(ghVersion.stdout);
  if (!parsedGhVersion || !atLeast(parsedGhVersion, [2, 57, 0])) {
    result('blocked', `${operationName} requires gh 2.57.0 or newer.`);
    return;
  }

  const inferred = inferRepository(request.projectRoot);
  if (inferred.blocked) {
    result('blocked', inferred.blocked);
    return;
  }

  const authentication = run(
    'gh',
    ['auth', 'status', '--hostname', 'github.com', '--active'],
    request.projectRoot,
  );
  if (!authentication.ok) {
    result('blocked', `${operationName} requires authenticated github.com access through gh.`);
    return;
  }

  const repositoryResponse = jsonFrom(githubApi([apiEndpoint(inferred.identity)], request.projectRoot));
  if (repositoryResponse.error) {
    result('blocked', `${operationName} could not verify ${inferred.identity}; repository access is incomplete (${repositoryResponse.error}).`);
    return;
  }
  const repository = repositoryResponse.value;
  if (typeof repository.full_name !== 'string'
      || repository.full_name.toLowerCase() !== inferred.identity.toLowerCase()) {
    const resolved = typeof repository.full_name === 'string' ? repository.full_name : 'an unknown repository';
    result('blocked', `GitHub resolved ${inferred.identity} as ${resolved}; resolve the mismatched target before setup.`);
    return;
  }
  if (!repository.permissions?.admin) {
    result('blocked', `${operationName} requires admin access to ${inferred.identity} to manage repository rules and merge settings.`);
    return;
  }
  if (typeof repository.default_branch !== 'string' || repository.default_branch.length === 0) {
    result('blocked', `${operationName} could not identify the default branch for ${inferred.identity}.`);
    return;
  }

  const branchBefore = readBranchStatusChecks(
    inferred.identity,
    repository.default_branch,
    request.projectRoot,
  );
  if (branchBefore.error) {
    result('blocked', `${operationName} could not inspect required checks on ${repository.default_branch} (${branchBefore.error}).`);
    return;
  }
  const rulesetsBefore = readRulesets(inferred.identity, request.projectRoot);
  if (rulesetsBefore.error) {
    result('blocked', `${operationName} could not inspect repository rulesets for ${inferred.identity} (${rulesetsBefore.error}).`);
    return;
  }

  let checkAction;
  let checkLocation;
  let managedRulesetId;
  if (branchBefore.value !== null) {
    checkLocation = 'branch';
    if (!hasRequiredCheck(branchBefore.value)) checkAction = { type: 'branch' };
  } else {
    const plan = managedRulesetPlan(rulesetsBefore.value);
    if (plan.error) {
      result('blocked', `${operationName} cannot reconcile required checks for ${inferred.identity}: ${plan.error}.`);
      return;
    }
    checkLocation = 'ruleset';
    managedRulesetId = plan.id;
    if (plan.kind !== 'none') checkAction = { type: 'ruleset', plan };
  }
  const settingsNeedUpdate = !matchingMergeSettings(repository);
  const effects = [];

  if (checkAction?.type === 'branch') {
    const endpoint = apiEndpoint(
      inferred.identity,
      `/branches/${encodeURIComponent(repository.default_branch)}/protection/required_status_checks/contexts`,
    );
    const mutation = githubApi([endpoint, '--method', 'POST', '--input', '-'], request.projectRoot, {
      contexts: [checkName],
    });
    if (!mutation.ok) {
      result('blocked', `${operationName} is incomplete for ${inferred.identity}; adding ${checkName} to ${repository.default_branch} branch protection failed (${mutation.detail}). ${effectSummary(effects)} Required-check enforcement${settingsNeedUpdate ? ' and squash merge settings remain' : ' remains'}; inspect remote state and retry.`);
      return;
    }
    effects.push(`required ${checkName} through ${repository.default_branch} branch protection`);
  }

  if (checkAction?.type === 'ruleset') {
    const suffix = checkAction.plan.id
      ? `/rulesets/${checkAction.plan.id}`
      : '/rulesets';
    const method = checkAction.plan.id ? 'PUT' : 'POST';
    const mutation = githubApi(
      [apiEndpoint(inferred.identity, suffix), '--method', method, '--input', '-'],
      request.projectRoot,
      checkAction.plan.payload,
    );
    if (!mutation.ok) {
      result('blocked', `${operationName} is incomplete for ${inferred.identity}; the required-check ruleset mutation failed (${mutation.detail}). ${effectSummary(effects)} Required-check enforcement${settingsNeedUpdate ? ' and squash merge settings remain' : ' remains'}; inspect remote state and retry.`);
      return;
    }
    const parsed = jsonFrom(mutation);
    if (parsed.error || !Number.isInteger(parsed.value?.id)) {
      result('blocked', `${operationName} is incomplete for ${inferred.identity}; the required-check ruleset mutation returned an invalid response. ${effectSummary(effects)} Inspect remote state and retry.`);
      return;
    }
    checkAction.rulesetId = parsed.value.id;
    managedRulesetId = parsed.value.id;
    effects.push(method === 'POST'
      ? 'created required-check ruleset'
      : 'updated required-check ruleset');
  }

  if (settingsNeedUpdate) {
    const mutation = githubApi(
      [apiEndpoint(inferred.identity), '--method', 'PATCH', '--input', '-'],
      request.projectRoot,
      mergeSettings,
    );
    if (!mutation.ok) {
      result('blocked', `${operationName} is incomplete for ${inferred.identity}; the squash merge settings mutation failed (${mutation.detail}). ${effectSummary(effects)} Squash merge settings remain; inspect remote state and retry.`);
      return;
    }
    effects.push('updated squash merge settings');
  }

  const repositoryAfter = jsonFrom(githubApi([apiEndpoint(inferred.identity)], request.projectRoot));
  const branchAfter = readBranchStatusChecks(
    inferred.identity,
    repository.default_branch,
    request.projectRoot,
  );
  const rulesetsAfter = readRulesets(inferred.identity, request.projectRoot);
  const mismatches = [];
  if (repositoryAfter.error || !matchingMergeSettings(repositoryAfter.value)) {
    mismatches.push('squash merge settings');
  }
  if (checkLocation === 'ruleset') {
    if (rulesetsAfter.error || !rulesetMatches(rulesetsAfter.value, managedRulesetId)) {
      mismatches.push(`${checkName} ruleset enforcement`);
    }
  } else if (branchAfter.error || !hasRequiredCheck(branchAfter.value)) {
    mismatches.push(`${checkName} branch enforcement`);
  }
  if (rulesetsAfter.error && checkLocation !== 'ruleset') {
    mismatches.push('repository ruleset readback');
  }
  if (mismatches.length > 0) {
    const applied = effects.length > 0 ? ` Applied changes: ${effects.join(' and ')}.` : ' No changes were applied.';
    result('blocked', `${operationName} is incomplete for ${inferred.identity}; final readback did not match ${mismatches.join(' and ')}.${applied}`);
    return;
  }

  if (effects.length === 0) {
    result('unchanged', `GitHub PR integration already matches the canonical configuration for ${inferred.identity}.`);
    return;
  }
  result('changed', `${operationName} changed ${inferred.identity}: ${effects.join(' and ')}. Final readback confirmed ${checkName}, squash-only integration, PR-title subjects, and PR-body messages; unrelated settings and rules were preserved.`);
}

try {
  setupIntegration(readRequest());
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
