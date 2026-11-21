#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { openSync, closeSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { connect } from "../postern/postern.mjs";

export function buildSandboxImage(base, head) {
  const paths = execFileSync(
    "git",
    ["diff", "--name-only", "--no-renames", "-z", `${base}...${head}`, "--"],
    { encoding: "utf8" },
  ).split("\0");
  if (
    !paths.some((path) =>
      [
        ".scriptorium/Dockerfile",
        ".github/workflows/sandbox-image.yml",
      ].includes(path),
    )
  ) {
    console.log("No toolchain image changes; skipping build.");
    return 0;
  }
  const input = openSync(".scriptorium/Dockerfile", "r");
  try {
    const result = spawnSync("docker", ["build", "-"], {
      stdio: [input, "inherit", "inherit"],
    });
    if (result.error) throw result.error;
    return result.status ?? 1;
  } finally {
    closeSync(input);
  }
}

export async function main(argv = process.argv.slice(2)) {
  const [base, head, repository] = argv;
  if (
    ![2, 3].includes(argv.length) ||
    ![base, head].every((sha) => /^[a-f0-9]{40}$/i.test(sha))
  )
    throw new Error(
      "Usage: node vendor/repo-canon/sandbox-image.mjs <base-sha> <head-sha> [owner/repo]",
    );
  const token = process.env.POSTERN_TOKEN;
  if (token && !repository)
    throw new Error("Posting Sandbox image requires an owner/repo repository.");
  const checkoutHead = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  if (checkoutHead.toLowerCase() !== head.toLowerCase())
    throw new Error("The checkout must be at the requested head SHA.");
  const connection = token
    ? connect(`https://github.com/${repository}`, { credential: token })
    : undefined;
  let status = 1;
  try {
    status = buildSandboxImage(base, head);
  } finally {
    if (connection)
      await connection.access.request({
        method: "POST",
        path: `/repos/${connection.repository.path}/statuses/${head}`,
        body: {
          context: "Sandbox image",
          state: status === 0 ? "success" : "failure",
        },
      });
  }
  return status;
}

if (
  import.meta.main ??
  (process.argv[1] &&
    realpathSync(process.argv[1]) === fileURLToPath(import.meta.url))
) {
  try {
    process.exitCode = await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
