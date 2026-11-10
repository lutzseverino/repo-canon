import { decideIssueContract as decide } from "../../vendor/repo-canon/validate-issue-contract.mjs";

// Fixed public release identity; no fixture uses the wall clock or install date.
export const seamsBoundary = {
  tag: "v99.0.0",
  commit: "c".repeat(40),
  publishedAt: "2026-11-10T00:00:00Z",
};
export const resolveBoundary = async () => seamsBoundary;
export const decideIssueContract = (snapshot) =>
  decide({ seamsBoundary, ...snapshot });
