// The shape of a record the CLI rendered for an adoption pull request:
// escaped inline markup in a message and an empty scope changes table.
export const renderedAdoptionRecord = `# Repository Standards adoption record

## Ready to commit

Ready to commit: yes.

## Selection

| Component | Value |
| --- | --- |
| CLI | \`8.0.0\` |
| Standards source | \`https://github.com/lutzseverino/repo-canon\` |
| Standards version | \`v0.16.0\` |
| Standards commit | \`7f16041b8626a8119281b2e872f539b782fd83b8\` |
| Profile | \`factory\` |

## Operations

| Phase | Declaration | Operation | Result | Message |
| --- | --- | --- | --- | --- |
| fixes | \`github-repository-configuration\` | \`pull-request-integration\` | unchanged | Requiring \\\`PR metadata\\\` is deferred because the default branch \\\`main\\\` does not carry the workflow yet. |
| checks | \`documentation\` | \`documentation-navigation\` | passed | Documentation navigation is valid. |

## Changed paths

| Path | Phases |
| --- | --- |
| \`.factory/Dockerfile\` | agent |
| \`.github/scripts/validate-pr-metadata.mjs\` | installation |

## Scope changes

| Declaration | Added | Removed |
| --- | --- | --- |

## Identities

| Record | Value |
| --- | --- |
| Run | \`23226a68-14d7-4654-be39-2b48bea73fe7\` |
| Inspection | \`sha256:d6a340538b4d8d97d0937132af1c2817f1b4839a2693dcfaf8d4d420777a091f\` |
| HEAD at start | \`64b725a80edf9e3f85f77307147dbde8b251086b\` |
| Completed at | 2026-10-19T03:51:52.933Z |
`;
