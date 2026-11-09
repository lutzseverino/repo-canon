# Create a repository

Use `create-repository` to interview you, make a new repository and offer
standards adoption before shaping its vision. Use `create-adopted-repo` when
you already want adoption: it invokes the general skill with adoption on and
skips that question. Both are original Repo Canon skills, available standalone
in the release bundle and installed by the workbench profile only. Standard
and factory adoption install neither creation entry point.

## Install before starting

Run installation **outside every Git checkout**, at user scope, so the skills
are available before the new repository exists. Use macOS or Linux, stable
Node.js 24 or 26, npm and Git 2.32 or newer. Select your agent with `--agent`;
the examples use `codex`. The
[standalone installation guide](install-skills.md#install-from-a-release)
explains tagged installation, copying a complete skill directory when the
installer is unavailable, and how to update it.

Choose a **published Canon tag containing both creation skills** from the
[releases](https://github.com/lutzseverino/repo-canon/releases). They are being
added after v0.24.0; that earlier tag cannot install them. Replace the value
below with the published tag that ships this feature, rather than using a
branch or a private checkout:

```sh
canon_tag='<published-tag-containing-the-creation-skills>'
npx skills@1.5.25 add "https://github.com/lutzseverino/repo-canon/tree/$canon_tag/.agents/skills" \
  --global --agent codex --copy \
  --skill create-repository --skill create-adopted-repo
```

The wrapper requires `create-repository`; installing it alone is insufficient.
For the small vision route, install its complete skill closure from the same
tag:

```sh
npx skills@1.5.25 add "https://github.com/lutzseverino/repo-canon/tree/$canon_tag/.agents/skills" \
  --global --agent codex --copy \
  --skill grill-with-docs --skill grilling --skill domain-modeling
```

For the larger route, install Wayfinder and all the skills its charting and
decision methods invoke, including the small route:

```sh
npx skills@1.5.25 add "https://github.com/lutzseverino/repo-canon/tree/$canon_tag/.agents/skills" \
  --global --agent codex --copy \
  --skill wayfinder --skill grill-with-docs --skill grilling \
  --skill domain-modeling --skill research --skill prototype
```

Those route skills have no further invoked-skill dependency in the inspected
release baseline. Read the chosen tag's skill dependencies and install any
additional ones it names before use. Research uses installed documentation
rules when present and its placement fallback when absent; adoption supplies
the `repository-standards` rule-lookup skill. If you skip vision, neither
vision route is needed.

For adoption, install **Repository Standards' separate adoption entry point**
at its own published tag:

```sh
npx skills@1.5.25 add https://github.com/lutzseverino/repo-standards/tree/v10.0.1/skills/adopt-repository-standards \
  --skill adopt-repository-standards --global --agent codex --copy
```

Canon's bundled `repository-standards` looks up rules and updates in an
already adopted repository; it cannot replace `adopt-repository-standards`.
The latter starts `adopt`, which installs its runtime pin. See the
[product's tagged installation guide](https://github.com/lutzseverino/repo-standards/blob/v10.0.1/docs/usage/guides/install.md#install-the-adoption-skill).

Skills do not supply platform credentials, hosting tools or tracker/subagent
capabilities. Supply the hosting platform's authenticated tool if you want a
remote. Repository Standards acquires public GitHub standards sources only;
Canon's project remote setup supports github.com with its documented GitHub
CLI versions and permissions, even though repository creation itself assumes
no host. Standalone commands keep their existing limits: installing a skill
does not install the runtime imports for `babysit`, `triage` or `orchestrate`.
Use the fallbacks in their Reads sections and the
[standalone command limits](install-skills.md#what-a-skill-needs-on-its-own).

## Interview and founding commit

Start your agent outside a checkout and invoke either skill by name, for
example: “Use create-adopted-repo to start a repository for my field notes.”
The agent asks one question at a time, with proposals based on your answers:

1. Name and one-line purpose.
2. Hosting namespace and visibility, skipped for local-only work or missing
   hosting access.
3. Parent directory. The current directory is proposed only outside Git and
   only used after confirmation. A destination inside an existing work tree
   is refused.
4. License, including “none for now.”
5. Whether to adopt, skipped by the adoption wrapper.
6. Small, large or skipped vision. Confirm the proposed route using
   Wayfinder's test: does this need more than one agent session?

No new repository is created if the interview shows the work belongs
elsewhere. Otherwise, the founding commit on the default branch contains
only a README with the name and purpose. The license answer is retained for
adoption's contextual work; the non-adoption path creates no license.
With supplied hosting access, the platform's own tool creates an empty remote
using your namespace and visibility and the agent pushes that commit.

## Adoption and delivery

The creation skill invokes `adopt-repository-standards` in the clean founding
repository. It passes a source only if you named one; otherwise that skill's
Repo Canon default applies. `adopt` owns the profile questions: standard for
a repository no factory serves, factory for one served by a host-installed
factory, workbench for a workbench. Creation adds no selector of its own.

Follow the CLI's guidance and pinned-runtime completion/recovery steps. Save
the pinned runtime's `status --summary` and ready-to-commit verdict **before
committing** each completed run. Deliver one run per adoption PR under the
new contribution guide, with its complete adoption record, separate review
and squash merge. Standard has no configured PR reviewer by default; its
contribution-guide review still applies without factory reviewer configuration.
A workbench commits completed adoption directly to its default branch.

After remote delivery, run `adopt` again on the clean, updated default branch
without a source, following the
[remote-setup continuation](adopt-repo-canon.md#remote-setup). Inspect its actual
selection and diff: it can propose newer CLI/standards pins, rerun discovery
and contextual assessment, and write bookkeeping even with unchanged pins.
Complete that run too, applying available remote setup or preserving its
documented deferral. Save pre-commit evidence and deliver any changed files
as another adoption PR, or a direct workbench commit. Workbench installs no
project remote setup. A second `adopt` is not a remote-settings-only guarantee.

## Vision and local continuation

Vision happens in the new repository after creation/adoption. The small route
invokes `grill-with-docs`, using `grilling` and `domain-modeling`. It creates a
glossary or ADR only when warranted, on an owned branch/checkout, and delivers
the documents under the repository's contribution guide. Without one, the
method leaves its edits on its own branch.

The large route invokes Wayfinder's charting mode with the repository's
tracker, or local-markdown if none is supplied or the work is local-only.
Charting can stop earlier when no fog warrants a map. Otherwise, the handoff
names and links the map and explains how to resume Wayfinder with it; creation
does not work through the map. You can skip vision entirely.

Without a supplied hosting tool/credential, or when you choose local-only,
the repository remains local. A completed adoption stays committed on its
adoption branch, with saved pre-commit evidence ready for its later PR. Domain
edits stay on their deliverable branch with the pending adoption dependency
reported. To continue:

1. Create an empty remote with your chosen namespace and visibility, add its
   URL as a Git remote and push the founding default branch.
2. Push the adoption branch, open its adoption PR with the preserved record
   and finish contribution-guide review/merge. For a workbench, push its
   completed direct adoption commit instead.
3. On the updated default branch, run `adopt` without a source to continue
   remote setup and complete/deliver the actual run as above.
4. Push/open any remaining vision deliverable PR, or resume the local map.

The agent reports the local path, remote URL when created, branches and PRs,
deferred setup and remaining work, even when vision is skipped.
