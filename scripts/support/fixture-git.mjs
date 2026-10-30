import { execFileSync, spawnSync } from "node:child_process";

// Hooks, rebase --exec and bisect can export repository/config redirections.
// Start fixture commands and fixture subprocess trees without inherited GIT_*
// state. Explicit overrides belong to the fixture (identity, transport, or a
// documented hostile-input test); unrelated environment, including PATH, stays.
/** @returns {NodeJS.ProcessEnv} */
export function fixtureGitEnvironment(overrides = {}) {
  return {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
    ),
    ...overrides,
  };
}

/** @param {string[]} args @param {Omit<import("node:child_process").ExecFileSyncOptions, "encoding"> & { encoding?: "utf8" }} [options] */
export function execFixtureGit(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    ...options,
    env: fixtureGitEnvironment(options.env),
  });
}

/** @param {string[]} args @param {Omit<import("node:child_process").SpawnSyncOptions, "encoding"> & { encoding?: "utf8" }} [options] */
export function spawnFixtureGit(args, options = {}) {
  return spawnSync("git", args, {
    encoding: "utf8",
    ...options,
    env: fixtureGitEnvironment(options.env),
  });
}
