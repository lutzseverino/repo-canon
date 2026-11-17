# Show one-way changes as animatics in the pull request body

Status: accepted (2026-11-14).

A pull request whose change is a one-way change carries an animatic in its
body. The author's session makes it, the factory's implement run included, with
the `animatic` skill, which Repo Canon will carry as an owned skill once
upstream releases it. The video is for people, not for agents (owner,
2026-11-13: "The videos would be for any human. Cause agents don't really need
it." and "I agree this should only be used for some PRs"). The Merge Danger
door the author already writes decides which pull requests get one (owner,
2026-11-13: "One way changes maybe?"), and any person may still ask for one on
another pull request. A pull request metadata check enforces the video on
one-way changes, following the owner's 2026-10-11 rule to lead with fixes code
or CI can check. The video goes in the body, where an uploaded video plays
inline (owner, 2026-11-13: "I expected the PR body so my public projects get
videos on their PRs"). It belongs to the shared workflow rather than one
person's setup (owner, 2026-11-13: "I'd want this to be tied to the workflow
and the factory being able to follow it without many changes except from maybe
permissions for file uploads").

The skill's voice and settings stay at upstream's keyless defaults, so Repo
Canon makes no choice that belongs to one person's machine (owner, 2026-10-29:
"No arbitrary choices around my own setup leaking into RS or RC"). Each
repository owns the pronunciation list for its own terms. Uploading the video
needs a user credential, because GitHub plays only uploaded attachments inline
and its attachment upload accepts user tokens, not the installation token a
factory run holds. Whoever runs the work supplies that credential; Repo Canon
names none.

## Considered options

- Every pull request, as upstream's own draft rule has it: rejected, because
  dependency bumps, adoptions and releases give a person no map to follow, and
  each video costs a model's time and about two minutes of voicing.
- A pull request comment: rejected, because the comment rules allow no such
  occasion, and the owner expected the body.
- A link to a video kept on a pull request asset branch, or a release asset:
  rejected, because GitHub shows these as plain links, not a player.
- A Scriptorium run step that makes the video: rejected, because Scriptorium
  names no skill content and the projects would then be coupled.
- Owning a copy of upstream's unreleased draft now: rejected, because the
  in-progress bucket stays outside the promoted set and the draft still
  changes daily. The fixes found in trials go upstream first and remain owned
  edits if upstream does not take them.

## Consequences

- The `pr` skill and the pull request metadata check gain the animatic rule
  only once `animatic` is installed, so they wait on upstream's release.
- A sandbox image that runs the skill needs ffmpeg and Chromium's system
  libraries, and these count as delivery runtime under the sandbox-image
  rules. The run downloads the rest only when a video is due.
- A one-way pull request cannot pass its metadata check without an uploaded
  video in its body. A factory repository enforces the check only after its
  sandbox image carries the toolchain and a live upload with the supplied
  credential has worked, so the factory never stalls on a rule it cannot meet.
