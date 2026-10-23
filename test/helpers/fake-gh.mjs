// Only version and current-token lookup remain GitHub CLI responsibilities.
import { readFileSync, writeFileSync } from "node:fs";
const statePath = process.env.FAKE_GH_STATE;
const state = JSON.parse(readFileSync(statePath, "utf8"));
const args = process.argv.slice(2);
state.ghCalls ??= [];
state.ghCalls.push(args);
const save = () => writeFileSync(statePath, `${JSON.stringify(state)}\n`);
save();
if (args[0] === "--version") {
  process.stdout.write(`${state.version ?? "gh version 2.80.0 (fixture)"}\n`);
} else if (args.join(" ") === "auth token --hostname github.com") {
  state.tokenArguments = args.slice(2);
  save();
  if (state.authenticated === false) {
    process.stderr.write(`${state.token ?? "not logged into github.com"}\n`);
    process.exitCode = 1;
  } else process.stdout.write(`${state.token ?? "fixture-current-token"}\n`);
} else {
  process.stderr.write("Unexpected gh command in remote-setup fixture.\n");
  process.exitCode = 2;
}
