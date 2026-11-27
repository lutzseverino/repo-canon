# Branch-update recovery

Enter for an authorized stopped-run continuation or merge exit `4`.
Follow the installed `github-repository-configuration` rules' Required-check
freshness section for update limits, overlap, keep-both resolution and owner
handoff. Count updates across this invocation, including stopped-run entry;
wait and merge retries do not reset the count.

1. Preserve committed, staged, unstaged and untracked work and PR review and
   handoff context. Keep the previously integrated full base and head SHAs;
   before the first update use the merge-base and current head, count `0`.
2. Fetch origin, resolve its default branch again, and run
   `node <this skill's directory>/branch-update.mjs <previous-base> <previous-head> <new-base> <updates-used>`.

   | Exit | Action |
   | --- | --- |
   | `0` | Update is permitted. |
   | `3` | Hand off to the owner with the printed reason. |
   | `1` | Resolve missing or invalid Git evidence before further updates. At count `0`, the unconditional first update remains permitted; no review carries. |

3. Rebase or replay only the PR's work onto the refreshed base. Preserve
   unrelated work separately. Apply the rule home's conflict classification;
   preserve work and hand off conflicts outside it or uncertain ownership,
   naming files and reasons. For resolved conflicts, post the conflict-resolution
   record under the comment rules' Delivery records before replacement review.
4. Run required local validation to a final successful exit. Before pushing,
   fetch origin and resolve its default branch again; inspect
   `git log --stat --patch -m origin/HEAD..HEAD` and
   `git diff origin/HEAD...HEAD`. Keep history and diff confined to this PR.
   Revalidate any reconstruction; push with an explicit lease when history
   changed. A permission refusal ends recovery under Credentials.
5. Rerun branch-update with the same four inputs and the replacement head as
   a fifth argument. Carry review only when both `nonOverlapping: true` and
   `patchUnchanged: true` are reported. Record carried internal outcomes on
   the current head, citing the prior review and proof SHAs; keep unresolved
   findings. Otherwise repeat internal and external review.
6. For verified unchanged updates, pass
   `--updated-from <previous-base>:<previous-head>:<new-base>` to request and
   wait. Across multiple updates, retain the reviewed pair for whole-advance
   proof and the immediately previous pair for overlap and update counting.
7. Renew designated owner approval for every replacement head. Run request
   and wait again under fresh trusted policy, then re-establish merge ownership.
   Complete this PR before refreshing the next waiting PR independently.

The commands' [exit actions](COMMANDS.md) apply throughout recovery.
