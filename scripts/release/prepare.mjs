#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { executedAsScript } from "../../vendor/repo-canon/validate.mjs";
import { fail, runScript, ReleaseCheckFailure } from "./support.mjs";

export const seamsValidatorPath =
  "vendor/repo-canon/validate-issue-contract.mjs";
const pin = /export const seamsReleaseTag = (null|"v\d+\.\d+\.\d+");/;

// Undefined identifies historical source without this feature; null is an
// unprepared candidate and can never pass the publication gate.
export function releaseSeamsTag(read) {
  let source;
  try {
    source = read(seamsValidatorPath);
  } catch (error) {
    if (
      error instanceof ReleaseCheckFailure &&
      /does not exist in|exists on disk, but not in/.test(error.message)
    )
      return undefined;
    throw error;
  }
  if (source === null) return undefined;
  const value = source.match(pin)?.[1];
  if (value === undefined) {
    if (
      source.includes("seamsReleaseTag") ||
      source.includes("seamsResultFormat")
    )
      fail("The Seams release pin is missing or malformed.");
    return undefined;
  }
  return JSON.parse(value);
}

export function prepareRelease(version, root = process.cwd()) {
  if (!/^v\d+\.\d+\.\d+$/.test(version))
    fail("Choose a stable release version such as v1.2.3.");
  const path = join(root, seamsValidatorPath);
  const source = readFileSync(path, "utf8");
  if (!pin.test(source)) fail("The Seams release pin is missing or malformed.");
  const current = releaseSeamsTag(() => source);
  if (current !== null) return current;
  writeFileSync(
    path,
    source.replace(
      pin,
      `export const seamsReleaseTag = ${JSON.stringify(version)};`,
    ),
  );
  return version;
}

if (executedAsScript(import.meta.url))
  await runScript(
    "release:prepare",
    "pnpm run release:prepare <version>",
    1,
    (version) =>
      console.log(
        `Release ${version}; first Seams release: ${prepareRelease(version)}.`,
      ),
  );
