#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';

const statePath = process.env.FAKE_GH_STATE;
if (!statePath) throw new Error('FAKE_GH_STATE is required.');

const state = JSON.parse(readFileSync(statePath, 'utf8'));
const save = () => writeFileSync(statePath, `${JSON.stringify(state)}\n`);
const args = process.argv.slice(2);

if (args[0] === '--version') {
  process.stdout.write(`${state.version ?? 'gh version 2.80.0 (fixture)'}\n`);
  process.exit(0);
}

if (args[0] === 'auth' && args[1] === 'status') {
  state.authStatusArguments = args.slice(2);
  save();
  if (state.authenticated === false
      || (state.inactiveAuthInvalid && !args.includes('--active'))) {
    process.stderr.write('not logged into github.com\n');
    process.exit(1);
  }
  process.stdout.write('logged into github.com\n');
  process.exit(0);
}

if (args[0] !== 'api') {
  process.stderr.write(`unsupported fixture command: ${args.join(' ')}\n`);
  process.exit(2);
}

const hostnameIndex = args.indexOf('--hostname');
state.apiHosts ??= [];
state.apiHosts.push(hostnameIndex >= 0 ? args[hostnameIndex + 1] : process.env.GH_HOST ?? 'github.com');
save();

const methodIndex = args.indexOf('--method');
const method = methodIndex >= 0 ? args[methodIndex + 1] : 'GET';
const endpoint = args.find(argument => /^repos\//.test(argument));
if (!endpoint) {
  process.stderr.write('fixture expected a repos/... endpoint\n');
  process.exit(2);
}

let input = {};
if (args.includes('--input')) {
  input = JSON.parse(readFileSync(0, 'utf8'));
}

function mutate(action) {
  const mutation = (state.mutations ?? 0) + 1;
  if (state.interruptAtMutation === mutation) {
    state.interruptAtMutation = null;
    save();
    process.kill(process.ppid, 'SIGKILL');
    process.exit(1);
  }
  if (state.failAtMutation === mutation) {
    state.failAtMutation = null;
    save();
    process.stderr.write('simulated GitHub API failure\n');
    process.exit(1);
  }
  state.mutations = mutation;
  state.mutationLog ??= [];
  state.mutationLog.push(action);
}

const repositoryEndpoint = /^repos\/[^/]+\/[^/?]+$/;
const statusChecksEndpoint = /\/branches\/[^/]+\/protection\/required_status_checks$/;
const contextsEndpoint = /\/branches\/[^/]+\/protection\/required_status_checks\/contexts$/;
const rulesetsEndpoint = /\/rulesets(?:\?.*)?$/;
const rulesetEndpoint = /\/rulesets\/(\d+)$/;

if (method === 'GET' && repositoryEndpoint.test(endpoint)) {
  state.repositoryReads = (state.repositoryReads ?? 0) + 1;
  save();
  const settings = structuredClone(state.settings ?? {});
  if (state.readbackMismatch === 'settings' && state.repositoryReads > 1) {
    settings.allow_squash_merge = false;
  }
  process.stdout.write(`${JSON.stringify({
    full_name: state.repo,
    permissions: state.permissions ?? { admin: true, maintain: true, push: true, triage: true, pull: true },
    default_branch: state.defaultBranch ?? 'main',
    ...settings,
  })}\n`);
  process.exit(0);
}

if (method === 'GET' && statusChecksEndpoint.test(endpoint)) {
  state.branchReads = (state.branchReads ?? 0) + 1;
  save();
  if (state.branchStatusChecks === null || state.branchStatusChecks === undefined) {
    process.stderr.write('gh: Branch not protected (HTTP 404)\n');
    process.exit(1);
  }
  const checks = structuredClone(state.branchStatusChecks);
  if (state.readbackMismatch === 'branch' && state.branchReads > 1) {
    checks.contexts = (checks.contexts ?? []).filter(context => context !== 'PR metadata');
    checks.checks = (checks.checks ?? []).filter(check => check.context !== 'PR metadata');
  }
  process.stdout.write(`${JSON.stringify(checks)}\n`);
  process.exit(0);
}

if (method === 'POST' && contextsEndpoint.test(endpoint)) {
  mutate('add branch status check');
  state.branchStatusChecks.contexts ??= [];
  for (const context of input.contexts ?? []) {
    if (!state.branchStatusChecks.contexts.includes(context)) {
      state.branchStatusChecks.contexts.push(context);
    }
  }
  save();
  process.stdout.write(`${JSON.stringify(state.branchStatusChecks.contexts)}\n`);
  process.exit(0);
}

if (method === 'GET' && rulesetsEndpoint.test(endpoint)) {
  if (state.failRulesetInspection) {
    process.stderr.write('simulated ruleset inspection failure\n');
    process.exit(1);
  }
  process.stdout.write(`${JSON.stringify((state.rulesets ?? []).map(({ id, name, target, enforcement }) => ({
    id, name, target, enforcement,
  })))}\n`);
  process.exit(0);
}

const rulesetMatch = endpoint.match(rulesetEndpoint);
if (method === 'GET' && rulesetMatch) {
  const ruleset = (state.rulesets ?? []).find(candidate => candidate.id === Number(rulesetMatch[1]));
  if (!ruleset) {
    process.stderr.write('gh: Not Found (HTTP 404)\n');
    process.exit(1);
  }
  process.stdout.write(`${JSON.stringify(ruleset)}\n`);
  process.exit(0);
}

if (method === 'POST' && rulesetsEndpoint.test(endpoint)) {
  mutate('create required-check ruleset');
  state.rulesets ??= [];
  const created = { id: state.nextRulesetId ?? 100, ...input };
  state.nextRulesetId = created.id + 1;
  state.rulesets.push(created);
  save();
  process.stdout.write(`${JSON.stringify(created)}\n`);
  process.exit(0);
}

if (method === 'PUT' && rulesetMatch) {
  mutate('update required-check ruleset');
  const index = (state.rulesets ?? []).findIndex(candidate => candidate.id === Number(rulesetMatch[1]));
  if (index < 0) {
    process.stderr.write('gh: Not Found (HTTP 404)\n');
    process.exit(1);
  }
  state.rulesets[index] = { id: Number(rulesetMatch[1]), ...input };
  save();
  process.stdout.write(`${JSON.stringify(state.rulesets[index])}\n`);
  process.exit(0);
}

if (method === 'PATCH' && repositoryEndpoint.test(endpoint)) {
  mutate('update squash settings');
  state.settings = { ...(state.settings ?? {}), ...input };
  save();
  process.stdout.write(`${JSON.stringify({ full_name: state.repo, ...state.settings })}\n`);
  process.exit(0);
}

process.stderr.write(`unsupported fixture API call: ${method} ${endpoint}\n`);
process.exit(2);
