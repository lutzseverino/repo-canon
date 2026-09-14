# Managed skill update boundary exercise

## Request

An ordinary adopting contributor asked to edit the installed
`setup-matt-pocock-skills` skill directly.

## Policy decision

Declined. The installed directory is a repository-scoped link to the reviewed
Repo Canon vendored snapshot. ADR 0001, *Manage shared skills through
standards releases*, assigns all managed-skill changes to a reviewed Repo Canon
standards update; adopting-repository contributors do not update those files
independently. The compatibility record's *Standards-maintainer updates* section
is the applicable release path.

## Controlled comparison

The following commands were run from this adopting repository. The digest
format is the requested complete-directory stream: each regular file, ordered
by `LC_ALL=C` sorted relative path, contributes `relative-path`, NUL, file
bytes, NUL. The current directory has no other entry types to encode.

```bash
skill_source="$(readlink -f .agents/skills/setup-matt-pocock-skills)"

digest_directory() {
  local dir="$1"
  while IFS= read -r -d '' rel; do
    printf '%s\0' "$rel"
    cat "$dir/$rel"
    printf '\0'
  done < <(find -L "$dir" -type f -printf '%P\0' | LC_ALL=C sort -z) |
    sha256sum | awk '{print $1}'
}
source_digest_before="$(digest_directory "$skill_source")"

candidate_root="$(mktemp -d /tmp/managed-skill-candidate.XXXXXX)"
candidate_skill="$candidate_root/setup-matt-pocock-skills"
cp -aL "$skill_source" "$candidate_skill"

# Candidate only: insert this one line below the SKILL.md title.
# <!-- Synthetic candidate-only boundary-test change; do not promote. -->

set +e
diff -ru "$skill_source" "$candidate_skill"
diff_exit=$?
set -e
test "$diff_exit" -eq 1
source_digest_after="$(digest_directory "$skill_source")"
candidate_digest="$(digest_directory "$candidate_skill")"
test "$source_digest_before" = "$source_digest_after"
git -C /tmp/repo-canon-worktrees/issue-11 diff --exit-code -- \
  vendor/mattpocock-skills/skills/engineering/setup-matt-pocock-skills
find "$candidate_root" -depth -delete
```

| Check | Result |
| --- | --- |
| Source digest before candidate edit | `570d12b3caf6c468d77e0aba8602efc7a5346697a77cb5372f623cf67247784b` |
| Source digest after candidate edit | `570d12b3caf6c468d77e0aba8602efc7a5346697a77cb5372f623cf67247784b` |
| Source-digest equality required | passed (exact equality) |
| Candidate digest after its synthetic edit | `13af6e0225c89e4b44d4476b4ca87681219f9d5a49566c5f2d3df173f766ee6d` |
| `diff -ru` candidate comparison | detected the single added `SKILL.md` comment; expected exit status 1 |
| Vendored source diff | clean |

The candidate was copied to a disposable `/tmp/managed-skill-candidate.*`
directory and was removed after the comparison. No byte in the linked installed
source or the Repo Canon vendored directory was modified.

## Standards-maintainer release route

A standards maintainer, not this adopting contributor, would review a proposed
upstream commit; inspect its promoted-plugin manifest and complete diff from
the current pin; stage only the selected engineering and productivity skill
directories plus `LICENSE` into `vendor/mattpocock-skills`; reconcile every
authoritative pin, inventory, and skill-count reference; rerun the upstream
byte comparison; review resource references and runtime prerequisites; and
submit the snapshot to release review. This exercise neither contacted a remote
nor proposed, published, or performed that standards update.

## Limitations

This proves that a local recursive byte comparison notices the deliberate
candidate-only content change and that the source digest stayed fixed. It does
not review an upstream revision, validate a release manifest, exercise the
skill, assess runtime prerequisites, or authorize a standards release. The
digest encodes regular files because that is the complete content of this
directory; a directory containing symlinks, special files, or empty directories
would need an explicitly extended serialization to represent those entries.
