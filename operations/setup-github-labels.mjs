import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const resultFormat = 'repo-standards/result/v1';
const maximumOutput = 1024 * 1024;
const canonicalLabels = [
  { name: 'needs-triage', color: 'fbca04', description: 'Requires review or renewed review' },
  { name: 'needs-info', color: 'd4c5f9', description: 'Waiting for information needed to evaluate the request' },
  { name: 'ready-for-agent', color: '0e8a16', description: 'Reviewed and sufficiently specified for agent implementation' },
  { name: 'ready-for-human', color: '1d76db', description: 'Reviewed and requires human implementation' },
  { name: 'wontfix', color: 'ffffff', description: 'Will not be actioned' },
  { name: 'bug', color: 'd73a4a', description: "Something isn't working" },
  { name: 'enhancement', color: 'a2eeef', description: 'New feature or request' },
  { name: 'wayfinder:map', color: '5319e7', description: 'Planning map for related work' },
  { name: 'wayfinder:research', color: 'bfd4f2', description: 'Research question in a planning map' },
  { name: 'wayfinder:prototype', color: 'bfd4f2', description: 'Prototype question in a planning map' },
  { name: 'wayfinder:grilling', color: 'bfd4f2', description: 'Design decision requiring discussion' },
  { name: 'wayfinder:task', color: 'bfd4f2', description: 'Task in a planning map' },
];

function failProcess(message) {
  throw new Error(message);
}

function readRequest() {
  let request;
  try {
    request = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    failProcess('GitHub label setup input must be one JSON object.');
  }
  if (request?.format !== 'repo-standards/operation/v1') {
    failProcess('GitHub label setup requires repo-standards/operation/v1 input.');
  }
  if (request.operation?.phase !== 'fixes') {
    failProcess('GitHub label setup must run as a fixes operation.');
  }
  const { paths, directories } = request.allowedTargets ?? {};
  if (!Array.isArray(paths) || paths.length !== 0
      || !Array.isArray(directories) || directories.length !== 0) {
    failProcess('GitHub label setup requires an empty project-content target scope.');
  }
  if (typeof request.projectRoot !== 'string' || request.projectRoot.length === 0) {
    failProcess('GitHub label setup input must identify the project root.');
  }
  return request;
}

function result(status, message) {
  process.stdout.write(`${JSON.stringify({ format: resultFormat, status, message })}\n`);
}

function run(executable, args, cwd) {
  const outcome = spawnSync(executable, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: maximumOutput,
  });
  if (outcome.error) {
    return { ok: false, unavailable: outcome.error.code === 'ENOENT', detail: outcome.error.code ?? 'spawn error' };
  }
  if (outcome.status !== 0) {
    const processState = outcome.signal ? `signal ${outcome.signal}` : `exit ${outcome.status}`;
    return { ok: false, unavailable: false, detail: processState };
  }
  return { ok: true, stdout: outcome.stdout };
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
  if (!outcome.ok) return { error: outcome.detail };
  try {
    return { value: JSON.parse(outcome.stdout) };
  } catch {
    return { error: 'invalid JSON response' };
  }
}

function githubApi(args, projectRoot) {
  return run('gh', ['api', '--hostname', 'github.com', ...args], projectRoot);
}

function apiEndpoint(identity, suffix = '') {
  const [owner, repository] = identity.split('/');
  return `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}${suffix}`;
}

function readLabels(identity, projectRoot) {
  const response = jsonFrom(githubApi(
    ['--paginate', '--slurp', `${apiEndpoint(identity, '/labels')}?per_page=100`],
    projectRoot,
  ));
  if (response.error) return response;
  if (!Array.isArray(response.value)) return { error: 'invalid labels response' };
  const labels = response.value.every(Array.isArray) ? response.value.flat() : response.value;
  if (!labels.every(label => label && typeof label.name === 'string')) {
    return { error: 'invalid labels response' };
  }
  return { value: labels };
}

function sameLabel(actual, expected) {
  return actual.name === expected.name
    && String(actual.color).toLowerCase() === expected.color
    && (actual.description ?? '') === expected.description;
}

function describeEffects(created, updated) {
  const effects = [];
  if (created.length === 1) effects.push(`created ${created[0]}`);
  else if (created.length > 1) effects.push(`created ${created.length} labels`);
  if (updated.length === 1) effects.push(`updated ${updated[0]}`);
  else if (updated.length > 1) effects.push(`updated ${updated.length} labels`);
  return effects.join(' and ');
}

function mutateLabel(identity, action, projectRoot) {
  const fields = [
    '-f', `color=${action.desired.color}`,
    '-f', `description=${action.desired.description}`,
  ];
  if (action.kind === 'create') {
    return githubApi([
      apiEndpoint(identity, '/labels'), '--method', 'POST',
      '-f', `name=${action.desired.name}`, ...fields,
    ], projectRoot);
  }
  return githubApi([
    apiEndpoint(identity, `/labels/${encodeURIComponent(action.actual.name)}`), '--method', 'PATCH',
    '-f', `new_name=${action.desired.name}`, ...fields,
  ], projectRoot);
}

function setupLabels(request) {
  const nodeVersion = versionFrom(process.versions.node);
  if (!nodeVersion || nodeVersion[0] !== 24) {
    result('blocked', 'GitHub label setup requires Node.js 24.');
    return;
  }

  const gitVersion = run('git', ['--version'], request.projectRoot);
  if (!gitVersion.ok) {
    result('blocked', 'Git is unavailable; install Git 2.18.0 or newer before GitHub label setup.');
    return;
  }
  const parsedGitVersion = versionFrom(gitVersion.stdout);
  if (!parsedGitVersion || !atLeast(parsedGitVersion, [2, 18, 0])) {
    result('blocked', 'GitHub label setup requires Git 2.18.0 or newer.');
    return;
  }

  const ghVersion = run('gh', ['--version'], request.projectRoot);
  if (!ghVersion.ok) {
    result('blocked', 'GitHub CLI (gh) is unavailable; install gh 2.48.0 or newer before GitHub label setup.');
    return;
  }
  const parsedGhVersion = versionFrom(ghVersion.stdout);
  if (!parsedGhVersion || !atLeast(parsedGhVersion, [2, 48, 0])) {
    result('blocked', 'GitHub label setup requires gh 2.48.0 or newer.');
    return;
  }

  const inferred = inferRepository(request.projectRoot);
  if (inferred.blocked) {
    result('blocked', inferred.blocked);
    return;
  }

  const authentication = run('gh', ['auth', 'status', '--hostname', 'github.com'], request.projectRoot);
  if (!authentication.ok) {
    result('blocked', 'GitHub label setup requires authenticated github.com access through gh.');
    return;
  }

  const repositoryResponse = jsonFrom(githubApi([apiEndpoint(inferred.identity)], request.projectRoot));
  if (repositoryResponse.error) {
    result('blocked', `GitHub label setup could not verify ${inferred.identity}; repository access is incomplete (${repositoryResponse.error}).`);
    return;
  }
  const repository = repositoryResponse.value;
  if (typeof repository.full_name !== 'string'
      || repository.full_name.toLowerCase() !== inferred.identity.toLowerCase()) {
    const resolved = typeof repository.full_name === 'string' ? repository.full_name : 'an unknown repository';
    result('blocked', `GitHub resolved ${inferred.identity} as ${resolved}; resolve the mismatched target before setup.`);
    return;
  }
  const permissions = repository.permissions ?? {};
  if (!permissions.push && !permissions.maintain && !permissions.admin) {
    result('blocked', `GitHub label setup requires write, maintain, or admin access to ${inferred.identity}.`);
    return;
  }

  const before = readLabels(inferred.identity, request.projectRoot);
  if (before.error) {
    result('blocked', `GitHub label setup could not inspect labels for ${inferred.identity} (${before.error}).`);
    return;
  }
  const existing = new Map(before.value.map(label => [label.name.toLowerCase(), label]));
  const actions = canonicalLabels.flatMap(desired => {
    const actual = existing.get(desired.name.toLowerCase());
    if (!actual) return [{ kind: 'create', desired }];
    return sameLabel(actual, desired) ? [] : [{ kind: 'update', actual, desired }];
  });

  const created = [];
  const updated = [];
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];
    const mutation = mutateLabel(inferred.identity, action, request.projectRoot);
    if (!mutation.ok) {
      const effects = describeEffects(created, updated);
      const effectMessage = effects ? ` Confirmed partial effects: ${effects}.` : ' No changes were confirmed.';
      const remaining = actions.length - index;
      result(
        'blocked',
        `GitHub label setup is incomplete for ${inferred.identity}; a GitHub API mutation failed (${mutation.detail}).${effectMessage} ${remaining} label${remaining === 1 ? '' : 's'} remain; inspect remote state and retry.`,
      );
      return;
    }
    (action.kind === 'create' ? created : updated).push(action.desired.name);
  }

  const after = readLabels(inferred.identity, request.projectRoot);
  const effects = describeEffects(created, updated);
  if (after.error) {
    const effectMessage = effects ? ` Applied changes: ${effects}.` : '';
    result('blocked', `GitHub label setup is incomplete for ${inferred.identity}; final readback failed (${after.error}).${effectMessage}`);
    return;
  }
  const verified = new Map(after.value.map(label => [label.name.toLowerCase(), label]));
  const mismatches = canonicalLabels.filter(desired => {
    const actual = verified.get(desired.name.toLowerCase());
    return !actual || !sameLabel(actual, desired);
  });
  if (mismatches.length > 0) {
    const effectMessage = effects ? ` Applied changes: ${effects}.` : ' No changes were applied.';
    result(
      'blocked',
      `GitHub label setup is incomplete for ${inferred.identity}; readback did not match ${mismatches.map(label => label.name).join(', ')}.${effectMessage}`,
    );
    return;
  }

  if (!effects) {
    result('unchanged', `GitHub labels already match the canonical configuration for ${inferred.identity}.`);
    return;
  }
  result('changed', `GitHub label setup changed ${inferred.identity}: ${effects}. Readback confirmed all 12 canonical labels; unrelated labels were preserved.`);
}

try {
  setupLabels(readRequest());
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
