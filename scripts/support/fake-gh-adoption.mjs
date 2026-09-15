#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';

const statePath = process.env.FAKE_GH_STATE;
if (!statePath) throw new Error('FAKE_GH_STATE is required.');

const state = JSON.parse(readFileSync(statePath, 'utf8'));
const save = () => writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
const args = process.argv.slice(2);

if (args[0] === '--version') {
  process.stdout.write(`${state.version ?? 'gh version 2.80.0 (Repo Canon adoption fixture)'}\n`);
  process.exit(0);
}
if (args[0] === 'auth' && args[1] === 'status') {
  process.stdout.write('logged into github.com\n');
  process.exit(0);
}
if (args[0] !== 'api') {
  process.stderr.write(`unsupported fixture command: ${args.join(' ')}\n`);
  process.exit(2);
}

const methodAt = args.indexOf('--method');
const method = methodAt < 0 ? 'GET' : args[methodAt + 1];
const endpoint = args.find(argument => argument.startsWith('repos/'));
let input = {};
if (args.includes('--input')) input = JSON.parse(readFileSync(0, 'utf8'));
const fields = {};
for (let index = 0; index < args.length; index += 1) {
  if (args[index] !== '-f') continue;
  const separator = args[index + 1].indexOf('=');
  fields[args[index + 1].slice(0, separator)] = args[index + 1].slice(separator + 1);
}

const repositoryEndpoint = /^repos\/[^/]+\/[^/?]+$/;
const labelsEndpoint = /\/labels(?:\?|$)/;
const labelEndpoint = /\/labels\/([^?]+)$/;
const protectionEndpoint = /\/branches\/[^/]+\/protection$/;
const contextsEndpoint = /\/branches\/[^/]+\/protection\/required_status_checks\/contexts$/;
const rulesetsEndpoint = /\/rulesets(?:\?.*)?$/;
const rulesetEndpoint = /\/rulesets\/(\d+)$/;

state.labels ??= [{ name: 'adopter-owned', color: '123456', description: 'Preserved unrelated label' }];
state.rulesets ??= [{
  id: 41,
  name: 'Adopter release policy',
  target: 'branch',
  enforcement: 'active',
  bypass_actors: [],
  conditions: { ref_name: { include: ['refs/heads/release/**'], exclude: [] } },
  rules: [{ type: 'deletion' }],
}];
state.settings ??= {
  allow_squash_merge: false,
  allow_merge_commit: true,
  allow_rebase_merge: true,
  squash_merge_commit_title: 'COMMIT_OR_PR_TITLE',
  squash_merge_commit_message: 'COMMIT_MESSAGES',
};

if (method === 'GET' && repositoryEndpoint.test(endpoint)) {
  process.stdout.write(`${JSON.stringify({
    full_name: state.repo,
    permissions: { admin: true, maintain: true, push: true, triage: true, pull: true },
    default_branch: 'main',
    ...state.settings,
  })}\n`);
  process.exit(0);
}
if (method === 'GET' && labelsEndpoint.test(endpoint)) {
  process.stdout.write(`${JSON.stringify(state.labels)}\n`);
  process.exit(0);
}
if (method === 'POST' && labelsEndpoint.test(endpoint)) {
  state.labels.push({ name: fields.name, color: fields.color, description: fields.description });
  save();
  process.stdout.write(`${JSON.stringify(state.labels.at(-1))}\n`);
  process.exit(0);
}
const labelMatch = endpoint.match(labelEndpoint);
if (method === 'PATCH' && labelMatch) {
  const label = state.labels.find(candidate => candidate.name.toLowerCase() === decodeURIComponent(labelMatch[1]).toLowerCase());
  Object.assign(label, { name: fields.new_name, color: fields.color, description: fields.description });
  save();
  process.stdout.write(`${JSON.stringify(label)}\n`);
  process.exit(0);
}
if (method === 'GET' && protectionEndpoint.test(endpoint)) {
  process.stderr.write('gh: Branch not protected (HTTP 404)\n');
  process.exit(1);
}
if (method === 'POST' && contextsEndpoint.test(endpoint)) {
  process.stderr.write('unexpected branch protection mutation\n');
  process.exit(2);
}
if (method === 'GET' && rulesetsEndpoint.test(endpoint)) {
  process.stdout.write(`${JSON.stringify(state.rulesets.map(({ id, name, target, enforcement }) => ({ id, name, target, enforcement })))}\n`);
  process.exit(0);
}
const rulesetMatch = endpoint.match(rulesetEndpoint);
if (method === 'GET' && rulesetMatch) {
  const ruleset = state.rulesets.find(candidate => candidate.id === Number(rulesetMatch[1]));
  process.stdout.write(`${JSON.stringify(ruleset)}\n`);
  process.exit(0);
}
if (method === 'POST' && rulesetsEndpoint.test(endpoint)) {
  const created = { id: Math.max(...state.rulesets.map(rule => rule.id), 99) + 1, ...input };
  state.rulesets.push(created);
  save();
  process.stdout.write(`${JSON.stringify(created)}\n`);
  process.exit(0);
}
if (method === 'PUT' && rulesetMatch) {
  const index = state.rulesets.findIndex(candidate => candidate.id === Number(rulesetMatch[1]));
  state.rulesets[index] = { id: Number(rulesetMatch[1]), ...input };
  save();
  process.stdout.write(`${JSON.stringify(state.rulesets[index])}\n`);
  process.exit(0);
}
if (method === 'PATCH' && repositoryEndpoint.test(endpoint)) {
  state.settings = { ...state.settings, ...input };
  save();
  process.stdout.write(`${JSON.stringify({ full_name: state.repo, ...state.settings })}\n`);
  process.exit(0);
}

process.stderr.write(`unsupported fixture API call: ${method} ${endpoint}\n`);
process.exit(2);
