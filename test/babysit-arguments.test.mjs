import assert from "node:assert/strict";
import test from "node:test";
import { main as wait } from "../.agents/skills/babysit/wait.mjs";
import { main as request } from "../.agents/skills/babysit/request.mjs";
import { main as merge } from "../.agents/skills/babysit/merge.mjs";

const head = "a".repeat(40);
const commands = [
  { name: "wait", main: wait, options: [] },
  { name: "request", main: request, options: [] },
  { name: "merge", main: merge, options: [head] },
];

function platformSpy(t) {
  const stop = async () => {
    throw new Error("Platform operation reached");
  };
  const read = t.mock.fn(stop);
  const pullRequest = t.mock.fn(stop);
  return {
    connection: {
      repository: { path: "example/repository" },
      access: { request: read },
      pullRequests: { pullRequest },
    },
    calls: () => read.mock.callCount() + pullRequest.mock.callCount(),
  };
}

// Mirror merge's CLI error handling; wait and request return their exit codes.
async function invoke(main, args, connection) {
  try {
    return await main(args, connection);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
}

for (const command of commands) {
  for (const number of [
    undefined,
    "0",
    "00",
    "01",
    "-1",
    "+1",
    "1.5",
    " 1",
    "1 ",
    "1\n",
    "abc",
    "١",
    "",
  ]) {
    test(`${command.name} rejects ${JSON.stringify(number) ?? "a missing number"} before platform operations`, async (t) => {
      const stderr = t.mock.method(process.stderr, "write", () => true);
      const platform = platformSpy(t);
      const args = number === undefined ? [] : [number, ...command.options];
      const code = await invoke(command.main, args, platform.connection);
      assert.equal(code, 1);
      assert.match(
        stderr.mock.calls.map((call) => call.arguments[0]).join(""),
        /usage:/i,
      );
      assert.equal(platform.calls(), 0);
    });
  }
}

for (const command of [
  ...commands,
  {
    name: "wait with options",
    main: wait,
    options: [
      "--repo",
      "example/repository",
      "--limit",
      "1",
      "--interval",
      "0.1",
    ],
  },
  {
    name: "request with options",
    main: request,
    options: ["--fixes-review", "--repo", "example/repository"],
  },
]) {
  for (const number of ["1", "42", "100"]) {
    test(`${command.name} accepts ${number} and reaches the platform`, async (t) => {
      const stderr = t.mock.method(process.stderr, "write", () => true);
      const platform = platformSpy(t);
      const code = await invoke(
        command.main,
        [number, ...command.options],
        platform.connection,
      );
      // The spy stops at the first operation so these tests never poll or merge.
      assert.equal(code, 1);
      assert.equal(platform.calls(), 1);
      const diagnostic = stderr.mock.calls
        .map((call) => call.arguments[0])
        .join("");
      assert.match(diagnostic, /Platform operation reached/);
      assert.doesNotMatch(diagnostic, /usage:/i);
    });
  }
}
