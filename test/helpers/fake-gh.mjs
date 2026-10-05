// The shared head of the stateful GitHub CLI fixtures: it loads the state
// file, answers `--version` and `auth status`, records each API host, and
// parses the API method and endpoint. A fixture imports it first and then
// answers the endpoints of its own operation.
import { readFileSync, writeFileSync } from "node:fs";

const statePath = process.env.FAKE_GH_STATE;
if (!statePath) throw new Error("FAKE_GH_STATE is required.");

export const state = JSON.parse(readFileSync(statePath, "utf8"));
export const save = () =>
  writeFileSync(statePath, `${JSON.stringify(state)}\n`);
export const args = process.argv.slice(2);

if (args[0] === "--version") {
  process.stdout.write(`${state.version ?? "gh version 2.80.0 (fixture)"}\n`);
  process.exit(0);
}

if (args[0] === "auth" && args[1] === "status") {
  state.authStatusArguments = args.slice(2);
  save();
  if (
    state.authenticated === false ||
    (state.inactiveAuthInvalid && !args.includes("--active"))
  ) {
    process.stderr.write("not logged into github.com\n");
    process.exit(1);
  }
  process.stdout.write("logged into github.com\n");
  process.exit(0);
}

if (args[0] !== "api") {
  process.stderr.write(`unsupported fixture command: ${args.join(" ")}\n`);
  process.exit(2);
}

const hostnameIndex = args.indexOf("--hostname");
state.apiHosts ??= [];
state.apiHosts.push(
  hostnameIndex >= 0
    ? args[hostnameIndex + 1]
    : (process.env.GH_HOST ?? "github.com"),
);
save();

const methodIndex = args.indexOf("--method");
export const method = methodIndex >= 0 ? args[methodIndex + 1] : "GET";
export const endpoint = args.find((argument) => argument.startsWith("repos/"));
if (!endpoint) {
  process.stderr.write("fixture expected a repos/... endpoint\n");
  process.exit(2);
}
