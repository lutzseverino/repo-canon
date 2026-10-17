// Replace only GitHub's HTTP boundary in the public CLI process. Git fetches
// use a temporary Git URL rewrite to the same fixture source's real objects.
import { readFileSync } from "node:fs";

const responses = JSON.parse(
  readFileSync(process.env.FIXTURE_GITHUB_RESPONSES, "utf8"),
);
globalThis.fetch = async (url) => {
  const key = String(url);
  if (!Object.hasOwn(responses, key))
    throw new Error(`Unexpected fixture HTTP request: ${key}`);
  return Response.json(responses[key]);
};
