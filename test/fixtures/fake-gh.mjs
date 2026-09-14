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

const fields = {};
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === '-f') {
    const [name, ...value] = args[index + 1].split('=');
    fields[name] = value.join('=');
  }
}

if (method === 'GET' && !endpoint.includes('/labels')) {
  process.stdout.write(`${JSON.stringify({
    full_name: state.repo,
    permissions: state.permissions ?? { admin: false, maintain: false, push: true, triage: true, pull: true },
  })}\n`);
  process.exit(0);
}

if (method === 'GET' && endpoint.includes('/labels')) {
  state.labelReads = (state.labelReads ?? 0) + 1;
  save();
  const labels = structuredClone(state.labels ?? []);
  if (state.readbackMismatch && state.labelReads > 1 && labels.length > 0) {
    labels[0].color = labels[0].color === '000000' ? 'ffffff' : '000000';
  }
  process.stdout.write(`${JSON.stringify(labels)}\n`);
  process.exit(0);
}

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
state.labels ??= [];
if (method === 'POST' && /\/labels(?:\?|$)/.test(endpoint)) {
  state.labels.push({ name: fields.name, color: fields.color, description: fields.description });
  save();
  process.stdout.write(`${JSON.stringify(state.labels.at(-1))}\n`);
  process.exit(0);
}
if (method === 'PATCH' && endpoint.includes('/labels/')) {
  const existingName = decodeURIComponent(endpoint.split('/labels/')[1].split('?')[0]);
  const existing = state.labels.find(label => label.name.toLowerCase() === existingName.toLowerCase());
  if (!existing) {
    process.stderr.write('fixture label was not found\n');
    process.exit(1);
  }
  Object.assign(existing, { name: fields.new_name, color: fields.color, description: fields.description });
  save();
  process.stdout.write(`${JSON.stringify(existing)}\n`);
  process.exit(0);
}

process.stderr.write(`unsupported fixture API call: ${method} ${endpoint}\n`);
process.exit(2);
