// Runs only the preparation that the GitHub operations share, the way they
// call it, so its outcomes can be tested once rather than through each
// operation.
import {
  prepareGithubRepository,
  readFixesRequest,
  writeOperationResult,
} from "../../operations/lib/github-operation.mjs";

const operationName = "GitHub operation fixture";

try {
  const prepared = prepareGithubRepository(
    readFixesRequest(operationName),
    operationName,
  );
  if (prepared.blocked) writeOperationResult("blocked", prepared.blocked);
  else writeOperationResult("unchanged", `Prepared ${prepared.identity}.`);
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
