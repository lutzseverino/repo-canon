---
name: release
description: Run a repository's release from its planning issue under the repository's own release procedure, pinning the default branch and holding on open blockers. Use when a release is due or a release planning issue is handed over.
---

A prompt or brief naming this skill is its invocation.

Your only input is the release's planning issue. The repository's release
procedure owns the version, every gate and the publication; this skill adds
only the **pin**, the **holds**, the questions and the records around it, and
restates none of the procedure. Host limits, such as container availability,
package-registry quota, scheduling and temporary-directory conventions, come
from the host's own instructions.

1. **Read the release.** Read the planning issue whole, with its comments and
   its native blocked-by links, then the contribution guide and the release
   procedure. Done when you know which release the issue plans and every step
   the procedure gives it.
2. **Pin the default branch.** Fetch the remote, resolve its default branch
   and record that branch's full head SHA as the pin before any release step.
   Every later step works from the pin. Done when the pin is recorded.
3. **Check the holds.** Each open native blocked-by link on the planning issue
   is a hold. While any hold is open, publish nothing: post a stop note on the
   planning issue naming each open blocker, and stop. Done when no blocker is
   open.
4. **Follow the procedure** from the pin, step by step, as it is written. When
   the procedure and the contribution guide leave something open, such as a
   disposition they do not settle, ask on the planning issue under the guide's
   owner-question route and stop; settle nothing they leave to the owner. Done
   when only the procedure's publication remains.
5. **Recheck before publication.** Fetch again. The default branch's head must
   be the pin, or the merge of the release's own pull request directly onto
   the pin. When it moved any other way, publish nothing: post a stop note on
   the planning issue naming the pin and the new head, and stop. Check the
   holds again as step 3 says. Then publish and verify as the procedure says.
   Done when the procedure's publication and verification are complete.
6. **Record the outcome.** Stop notes and questions stay on the planning issue
   as above; a completed release keeps the records the procedure names on its
   release pull request. Link every finding as the guide's Findings section
   says: from a comment on the release pull request, or from the planning
   issue when the run opened none. Read `.repo-standards/rules/comments.md`
   before each post. Done when every outcome and finding is recorded there.

A later run starts again at step 1 with a fresh pin, after the hold, question
or move that stopped this one is resolved.

## Reads

Paths are relative to the repository root.

- The planning issue: the release it plans, its discussion and its native
  blocked-by links. When it is missing or names no release, stop and ask for
  the planning issue, publishing nothing.
- `docs/development/release.md`, or the release procedure that
  `docs/development/README.md` or `CONTRIBUTING.md` names: the version, gates
  and publication. When it is missing, ask on the planning issue for the
  repository's release rules and stop without publishing.
- `CONTRIBUTING.md`: the Findings section, the owner-question route and the
  Credentials section. When it is missing, ask and record findings on the
  planning issue, and stop at any refused write.
- `.repo-standards/rules/comments.md`: the shape of stop notes, owner
  questions and findings links. When it is missing, post each as one comment.
- `docs/agents/issue-tracker.md`: how the tracker reads native blocking links.
  When it is missing, read the platform's native issue dependencies directly;
  a blocker written only in text holds nothing.
