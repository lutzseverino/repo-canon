// Repository-owned exemption, evaluated before reviewer requests and waits.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const target = ".github/factory-review-policy.json";

export const readReviewPolicy = (root = process.cwd()) => {
  let text;
  try {
    text = readFileSync(join(root, target), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  try {
    const policy = JSON.parse(text);
    if (!policy || typeof policy !== "object" || Array.isArray(policy))
      throw new Error("must be an object");
    for (const key of Object.keys(policy))
      if (!["version", "author"].includes(key))
        throw new Error(`unknown field: ${key}`);
    if (policy.version !== 1) throw new Error("version must be 1");
    if (
      typeof policy.author !== "string" ||
      !policy.author.trim() ||
      policy.author !== policy.author.trim()
    )
      throw new Error("author must be a nonempty, trimmed login");
    return policy;
  } catch (error) {
    throw new Error(`${target}: ${error.message}`, { cause: error });
  }
};

const normalize = (login) =>
  login
    .toLowerCase()
    .replace(/^app\//, "")
    .replace(/\[bot\]$/, "");

export const skipsExternalReview = (policy, author) =>
  Boolean(
    policy &&
    typeof author === "string" &&
    author &&
    normalize(author) === normalize(policy.author),
  );
