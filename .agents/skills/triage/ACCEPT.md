# Acceptance

## Accept mode

1. **Read the revision** in the validator's current notice; without one, stop as [Accept a brief that holds](#accept-a-brief-that-holds) step 1 says. If this session published it, refuse: post nothing, and report that another session must review it.
2. **Review it** as the [contract review](REVIEW.md) says, or the [intent-bound path](ORCHESTRATING.md#intent-bound-path)'s step 6 for a direct contract, running each read-only check of live facts the contract names.
3. **Post one verdict comment**: `**Verdict:**` holds or does not hold, `**Revision:**` the exact `sha256:` reviewed, and `**Findings:**`, one bullet each with its evidence, live checks' results included. Its lead line states the verdict, and it ends with the triage disclosure footer, as `.repo-standards/rules/comments.md#disclaimers` says. A failing verdict is the writer's correction list.
4. **Accept** a holding revision as [Accept a brief that holds](#accept-a-brief-that-holds) says.

## Accept a brief that holds

1. **Wait for the revision notice** for the brief revision you reviewed, as the planning rules' Readiness section says. If the brief changed after your review, review the new revision. If no notice arrives, leave readiness to the owner and tell them the notice is missing.
2. **Choose the state** the installed rules give the work:
   - `state:owner` for work only the owner can do. It is not readiness: apply it with the tracker's own client and a note naming what the owner must supply, and skip the readiness command.
   - `state:ready` with `factory:skip` for agent work the installed factory rules say the factory must not pick up. Without those rules there is no skip label.
   - `state:ready` alone for any other work.

   When owner review before merge is reserved, even when that reason first arises here, verify the brief designates it as contract behavior and its triage notes retain the dated decision source. If either is missing or unclear, return the brief to its writer with the reservation and source, review the corrected brief from the top, and return to step 1 for its new revision notice.

3. **Choose the model**, when the installed rules ask for a `model:` label: apply their Model selection rule to the triage notes' suggestion and the work, pick one label yourself, and give the guidance-based reason. Keep a matching model already on the issue, or remove a conflicting one before applying readiness.
4. **Apply and confirm readiness** with the bundled command, using the `sha256:` revision from the notice you reviewed and the companion labels you chose:

   ```sh
   node <this skill's directory>/ready.mjs <issue> <sha256:reviewed-revision> <model-label>
   ```

   The command applies `state:ready`. Omit the model label when the installed rules ask for none. Additional companion labels, such as `factory:skip`, follow the revision; `--repo owner/name` selects another repository. Run it in the foreground with Node.js 24 or 26, bounded by your command timeout; it uses the current `gh` credential and needs no install. Exit zero confirms the validator approved that revision by your account; a nonzero exit explains the refusal or rejection. Review a changed revision again before retrying. To supply missing companions on an already approved revision, run the same command.

5. **Record blockers.** Add a native blocker for each issue whose work must land first.
6. **Tell the owner** what you accepted, with links to each brief, the labels you applied, the blockers you added, and every answer you inferred, so they can veto it.

When your credentials cannot apply readiness, or the destination's factory workflow rules say its factory starts no work on your account's readiness, stop at acceptance: tell the owner or another authorized person, with links, which revision holds, the readiness, model and skip labels you chose, and the blockers to record, and report that factory work has not started.
