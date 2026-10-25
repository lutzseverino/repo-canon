# Release procedure

This procedure prepares, publishes, and verifies a Repo Canon release in one
pull request. [Release versioning](../usage/versioning.md) decides the version
number, and the notes it describes are written here.

## Released bytes and reviewed diff

The source inputs are `standards.yaml` and every path its declarations select:
exact files, guidance, rules, discovery, operation scripts and resources, and the
complete directories of skill declarations. The Repository README is a
contextual target, not an input. Documentation, tests, fixtures, and CI are
not inputs either.

The commit of the annotated release tag identifies the released bytes. No
separate closure file records them. The reviewed diff is the diff from the
previous release tag over the source inputs. Install the public CLI at the
required minimum version outside the checkout, as the
[source profile](source-profile.md#executable-prerequisites) describes, and
point `REPO_STANDARDS_PREFIX` at its prefix. With the release tags fetched,
list the inputs and show the diff from the previous release tag:

```sh
export REPO_STANDARDS_PREFIX="$cli_prefix"
previous_tag=$(git describe --tags --abbrev=0 --match 'v[0-9]*' HEAD)
npm run release:inputs -- "$previous_tag"
```

`release:inputs` validates the checked-out commit and the previous tag with
`source validate --json`, then lists the paths that the resolved declarations
of every profile select. The list comes from the release candidate, so commit
the candidate first. The script also lists the inputs that the previous tag
selected and the candidate no longer does, and includes them in the diff stat;
review those removed paths too.

## When selected bytes change

Any change to a source input creates a new source identity. When the reviewed
diff is not empty, the release requires all of the following:

- Whole-source review. Review covers the whole source, every source input, not
  only the diff.
- Validation of every profile. The public CLI at the required minimum version
  runs `source validate` without filtering and returns `valid: true` with no
  errors.
- Refreshed fixture results. A changed operation or operation resource has its
  operation fixtures updated and passing. A changed skill, vendored or Repo
  Canon's own, is exercised again through the
  [skill exercise procedure](skill-exercises.md). The skill
  fixture builders copy the shared guidance, so a change to it keeps their
  tests passing.

Changes outside the source inputs do not require this, because they do not
change what adopters receive.

## Prepare the release pull request

Each release is one pull request into `main`, and nothing is committed for the
release after it merges. It carries the changes the release itself needs, such
as documents that name a moved required CLI version, and it closes the issue
that plans the release. The Repository README and the
[adoption guide](../usage/adopt-repo-canon.md) name no Repo Canon version,
because `adopt` offers the published releases, so a release needs no change to
them. The version-agreement test in `npm test` fails when either names a Repo
Canon version or the Repository README names a CLI version, and until the CLI
version named in the adoption guide, CI, the [development guide](README.md), the
[source profile](source-profile.md), and the
[authoring notes](../../authoring-notes.md), plus the toolchain image's
`.factory/Dockerfile`, equals the floor of the `requires` minimum in
`standards.yaml`.

Title it `<type>: release vX.Y.Z`. The type follows the release's
classification under [release versioning](../usage/versioning.md). Use the
first that applies:

- `feat!` when the release carries a breaking standards change. As with every
  breaking change, the body explains its impact and migration, which the draft
  release notes do.
- `feat` when it carries a compatible feature.
- `fix` when it carries a compatible fix.
- `chore` when it only raises the required CLI version.

Before requesting review, run the checks the
[development guide](README.md#setup-and-validation) requires and the all-profile
`source validate`.

The pull request body carries the review and validation summary:

- the release version and the previous release tag;
- the reviewed diff, as the changed source input paths from the previous tag
  that `release:inputs` reports;
- the outcomes of the whole-source review, or that the diff is empty;
- the CLI version and result of `source validate`, with the profile and
  declaration counts;
- the test results, and any refreshed fixture results; and
- the draft release notes.

## Write the release notes

The GitHub release carries the notes; the repository keeps no copy. Draft them
in the release pull request so that they are reviewed with it. Open the draft
with the expected adopter-action line: the CLI's one-line statement of the
update class, contextual work needed, and pending remote setup. After
`release:verify` passes, open the verified notes with the derived adopter-action
line it printed. If the profiles produce different lines, put both first,
labelled with their profiles. Next to each line, name the scope and remote
setup questions that the update check reported, so adopters know which
answers they will need to validate and submit.

Set the optional top-level `adopter-action` field in `standards.yaml` only when
a release needs an action outside adoption. Write one nonempty line of plain
text; keep contextual work and remote setup in the CLI's derived line. Include
that author-written action after the derived line in the notes. The first
release that sets the field raises `requires.repo-standards` to the first CLI
that accepts it. Raising the CLI minimum is a compatible change, as the
[versioning guide](../usage/versioning.md#the-required-cli-version) explains.

- Summarize what changed for adopting repositories.
- State the required CLI version, and when it moved, the new minimum and why.
- Link repository documents with absolute URLs pinned to the new tag, such as
  `https://github.com/lutzseverino/repo-canon/blob/vX.Y.Z/docs/usage/adopt-repo-canon.md`,
  so that the links keep describing the released bytes.

Mark each breaking standards change with **Breaking standards change.** and
explain its migration in two parts, each starting with its `Impact:` or
`Migration:` label, which the pull request metadata check looks for:

- Impact: which previously conforming repositories stop conforming, or which
  workflow changes, and what stays conforming on the earlier release.
- Migration: the ordered steps an adopting repository takes, what each step
  changes, and how the adopter confirms the result. When both the CLI and the
  standards version move, one confirmed run can move both pins: the candidate
  CLI selects the new standards version that requires it. Say which release an
  adopter that cannot migrate stays on.

## Publish and verify

After the pull request merges, publish from its merge commit on `main`. In an
up-to-date checkout of `main`, with `REPO_STANDARDS_PREFIX` set as for
[the reviewed diff](#released-bytes-and-reviewed-diff), set `version` to the
release tag, such as `v1.2.3`, and `pull_request` to the release pull request's
number. Read the reviewed head and the merge commit from the pull request, and
fetch them:

```sh
reviewed_head=$(gh pr view "$pull_request" --json headRefOid --template '{{.headRefOid}}')
release_commit=$(gh pr view "$pull_request" --json mergeCommit --template '{{.mergeCommit.oid}}')
git fetch origin main "$reviewed_head"
```

Then confirm the merge commit and publish. Each command runs only when the one
before it succeeds:

```sh
npm run release:check-merge -- "$reviewed_head" "$release_commit" &&
  git tag --annotate "$version" "$release_commit" --message "Repo Canon $version" &&
  git push origin "$version" &&
  gh release create "$version" --verify-tag --title "$version" \
    --notes-file /path/to/release-notes.md
```

`release:check-merge` confirms that the merge commit carries exactly the
reviewed inputs, over the inputs either commit selects. If it fails, another
change reached them, and the release needs review again. Publish an ordinary
release; a draft or prerelease cannot be selected for adoption.

Before running `release:verify`, export `GH_TOKEN` from credentials already
authorized for this run. When the current `gh` login is that authorized
identity, use:

```sh
export GH_TOKEN="$(gh auth token)"
```

The public Repository Standards CLI reads `GH_TOKEN` (or `GITHUB_TOKEN` as a
fallback) for its GitHub API requests; an authenticated `gh` login alone does
not supply that environment variable. Verification's public CLI subprocesses
inherit the exported token, including the inspections, fixture adoptions and
previous-release updates for both profiles. These requests can exhaust the
anonymous API quota. Keep the token value out of logs and release notes.

Then verify the publication, and only when it verifies, replace the notes with
the version that opens with the printed adopter-action line and carries the
verification paragraph:

```sh
npm run release:verify -- "$version" "$release_commit" &&
  gh release edit "$version" --notes-file /path/to/verified-release-notes.md
```

`release:verify` reports each of its checks and fails if any fails:

1. The annotated tag on `origin` peels to the release commit.
2. The GitHub release is neither a draft nor a prerelease.
3. In a disposable Git repository, the public CLI at the required minimum
   version inspects the release with each profile, `standard` and `factory`,
   through `inspect`. Each report resolves the release commit and its profile.
4. With each profile, the same CLI adopts the release into a fixture
   repository through `adopt` with an answers file, as an agent does without a
   terminal. The fixture is a disposable Git repository with one commit, built
   from `scripts/release/adoption-fixture.mjs`, whose files already satisfy the
   rules of the contextual declarations. It has no Git remote, so the GitHub
   remote setup probes report not ready. The check fills `version` and
   `profile`, accepts the drafts of both discovery scripts as given, the
   documentation drafter's scope and the typescript-node stack drafter's no
   scope, answers the other scopes for the fixture, answers `remote-setup` with `defer`, names the
   printed `inspection`, and submits each contextual declaration's assessment,
   until the outcome is `complete`. `status` must then report the run ready to
   commit and list both GitHub remote setup fixes as deferred. A blocker, a
   remote setup not offered for deferral, a failed check, or a run that does not
   complete fails the check. The check never confirms a confirmation-required
   change, so one appearing fails it too. `npm test` checks the fixture against
   both drafters and the contextual checks before a release, because `adopt`
   acquires only published stable tags.
5. With each profile, adopt the previous release, the newest published stable
   tag before the verified version, into the same disposable fixture using that
   release's required minimum CLI, then commit the completed adoption. Run the
   newest published CLI as `adopt --json`, initially with no answers file and
   no edits. The check installs these two public CLIs outside the checkout;
   npm registry access and the previous release tag fetched locally are needed.
   It answers the update's scope questions with their prefilled answers unchanged,
   including a new declaration's discovery draft. A declaration without a draft
   gets the same fixture scope answer as check 4. It answers `remote-setup` with
   `defer` and submits the fixture's contextual assessments for any declaration
   the run asks about, reusing check 4's answers and assessments. The run must
   reach `complete` with exit 0, and `status` must report it ready to commit,
   with both GitHub remote setup fixes deferred and selection of the verified
   release commit and profile. A blocker, confirmation-required change, failed
   check, question of any other kind, rejected scope answer, or further stop
   after submitting an answer fails. The check prints both CLI versions, every
   question asked (kind and declaration), the outcome, and the derived
   adopter-action line. With no previous published stable release, it fails
   rather than claiming an update was verified.
6. The Repository README and the adoption guide at the release commit name no
   Repo Canon version, the Repository README names no CLI version, and every
   CLI version that the adoption guide, the development guide, the source
   profile, and the authoring notes there name is the required minimum.

The verification paragraph appended to the release notes names the release
commit and the release pull request, confirms the tag and release state, and
reports the CLI version with the inspection, fixture adoption, and update-from-previous-release results that
`release:verify` prints. The release scripts change no repository or GitHub
state: the fixture adoption runs in a temporary directory and has no remote to
change. The tag, the release, and its notes are published only by the commands
written out above.

A published tag is never moved, deleted, or retargeted. A correction receives
a new version. Earlier releases keep their notes.
