# Release procedure

This procedure prepares, publishes, and verifies a Repo Canon release in one
pull request. [Release versioning](../usage/versioning.md) decides the version
number, and the notes it describes are written here.

## Released bytes and reviewed diff

The source inputs are `standards.yaml` and every path its declarations select:
exact files, guidance, discovery, operation scripts and resources, and the
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
review those removed paths too. It changes no repository or GitHub state.

## When selected bytes change

Any change to a source input creates a new source identity. When the reviewed
diff is not empty, the release requires all of the following:

- Whole-source review. Independent reviews, one against the repository's
  standards and one against the release's issue, cover the whole source, not
  only the diff: the profile, every reference, ownership, retained operation
  resources, notices, and the policy each declaration carries.
- Validation of every profile. The public CLI at the required minimum version
  runs `source validate` without filtering and returns `valid: true` with no
  errors.
- Refreshed fixture results. A changed operation or operation resource has its
  operation fixtures updated and passing. A changed vendored skill is exercised
  again through the [skill exercise procedure](skill-exercises.md). The skill
  fixture builders copy the shared guidance, so a change to it keeps their
  tests passing.

Changes outside the source inputs do not require this, because they do not
change what adopters receive.

## Prepare the release pull request

Each release is one pull request into `main`, and nothing is committed for the
release after it merges. It carries the changes the release itself needs, such
as documents that name the latest release or its required CLI version, and
it closes the issue that plans the release. The version-agreement test in
`npm test` fails until the Repository README and the
[adoption guide](../usage/adopt-repo-canon.md) name one Repo Canon version, and
until the CLI version they and CI name equals the floor of the `requires`
minimum in `standards.yaml`.

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

Integrate the pull request only after its reviews are resolved and its required
checks pass.

## Write the release notes

The GitHub release carries the notes; the repository keeps no copy. Draft them
in the release pull request so that they are reviewed with it.

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

Then verify the publication, and only when it verifies, replace the notes with
the version that carries the verification paragraph:

```sh
npm run release:verify -- "$version" "$release_commit" &&
  gh release edit "$version" --notes-file /path/to/verified-release-notes.md
```

`release:verify` reports each of its checks and fails if any fails:

1. The annotated tag on `origin` peels to the release commit.
2. The GitHub release is neither a draft nor a prerelease.
3. In a disposable Git repository, the public CLI at the required minimum
   version inspects the release with the `complete` profile, as
   [Adopt Repo Canon](../usage/adopt-repo-canon.md#inspect-the-published-source)
   describes. The report resolves the release commit and profile.
4. The Repository README and the adoption guide at the release commit name the
   version being verified.

The verification paragraph appended to the release notes names the release
commit and the release pull request, confirms the tag and release state, and
reports the CLI version and inspection result that `release:verify` prints.
The release scripts change no repository or GitHub state; the tag, the release,
and its notes are published only by the commands written out above.

A published tag is never moved, deleted, or retargeted. A correction receives
a new version. Earlier releases keep their notes.
