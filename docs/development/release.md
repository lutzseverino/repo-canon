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
previous release tag over the source inputs. List the inputs with the public CLI
at the required minimum version, installed outside the checkout as the
[source profile](source-profile.md#executable-prerequisites) describes, and
show the diff. The listing also needs `jq`:

```sh
previous_tag=REPLACE_WITH_PREVIOUS_RELEASE_TAG
"$cli_prefix/node_modules/.bin/repo-standards" source validate "$PWD" --json \
  > "$cli_prefix/validation.json"
inputs=$(jq -r '["standards.yaml"] + [.profiles[].declarations[]
  | (.exact, .guidance, .discovery, .source,
     ((.checks + .fixes)[].run | .script, .resources[]))]
  | map(select(. != null)) | unique[]' "$cli_prefix/validation.json")
git diff --stat "$previous_tag" HEAD -- $inputs
```

The command reads the resolved declarations that `source validate --json`
reports under each profile. The list comes from the release candidate. An input
that the candidate no longer selects leaves the list, and its removal shows in
the diff of `standards.yaml`; review the removed paths too.

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
it closes the issue that plans the release.

Title it `<type>: release vX.Y.Z`. The type follows the release's
classification under [release versioning](../usage/versioning.md):

- `feat!` when the release carries a breaking standards change. As with every
  breaking change, the body explains its impact and migration, which the draft
  release notes do.
- `feat` when its most significant change is a compatible feature.
- `fix` when it carries only compatible fixes.
- `chore` when it only raises the required CLI version.

Before requesting review, run the checks the
[development guide](README.md#current-validation) requires and the all-profile
`source validate`.

The pull request body carries the review and validation summary:

- the release version and the previous release tag;
- the reviewed diff, as the changed source input paths from the previous tag;
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
explain its migration in two parts:

- Impact: which previously conforming repositories stop conforming, or which
  workflow changes, and what stays conforming on the earlier release.
- Migration: the ordered steps an adopting repository takes, what each step
  changes, and how the adopter confirms the result. When both the CLI and the
  standards version move, update one pin at a time, and say which release an
  adopter that cannot migrate stays on.

## Publish and verify

After the pull request merges, publish from its merge commit on `main`, with
`inputs` listed as in [the reviewed diff](#released-bytes-and-reviewed-diff):

```sh
version=vX.Y.Z
reviewed_head=REPLACE_WITH_REVIEWED_PULL_REQUEST_HEAD
release_commit=REPLACE_WITH_MERGE_COMMIT
git fetch origin main "$reviewed_head"
git diff --quiet "$reviewed_head" "$release_commit" -- $inputs
git tag --annotate "$version" "$release_commit" --message "Repo Canon $version"
git push origin "$version"
gh release create "$version" --verify-tag --title "$version" \
  --notes-file /path/to/release-notes.md
```

The `git diff --quiet` step confirms that the merge commit carries exactly the
reviewed inputs; if it fails, another change reached them, and the release needs
review again. Publish an ordinary release; a draft or prerelease cannot be
selected for adoption.

Then verify the publication:

1. `git ls-remote origin "refs/tags/$version^{}"` reports the release commit.
2. `gh release view "$version" --json isDraft,isPrerelease` reports `false` for
   both.
3. In a disposable Git repository, the public CLI at the required minimum
   version inspects the release with the `complete` profile, as
   [Adopt Repo Canon](../usage/adopt-repo-canon.md#inspect-the-published-source)
   describes. The report resolves the release commit and profile.

Append a short verification paragraph to the release notes. It names the
release commit and the release pull request, confirms the tag and release
state, and reports the CLI version and inspection result.

A published tag is never moved, deleted, or retargeted. A correction receives
a new version. Earlier releases keep their notes.
