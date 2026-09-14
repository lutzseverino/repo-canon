Implemented and committed the repeatable two-stage wizard.

- Added [setup-parcel-sandbox.sh](/tmp/repo-canon-skill-exercises-11/delivery/scripts/setup-parcel-sandbox.sh), with the template library copied unchanged above `STAGES`.
- Linked it from [sandbox-setup.md](/tmp/repo-canon-skill-exercises-11/delivery/docs/sandbox-setup.md).
- Static trace confirms `PARCEL_API_URL` → `vars.PARCEL_API_URL` and `PARCEL_API_TOKEN` → `secrets.PARCEL_API_TOKEN`.
- Commit: `ed02b83 feat(setup): add Parcel sandbox wizard`

Checks passed: `bash -n`, `git diff --check`, and `npm test`. `shellcheck` is not installed.

Prerequisites: run from repo root; GitHub CLI (`gh`) must be installed/authenticated to write the variable and secret. Limit: the wizard was not run—no browser, remote, GitHub variable, or secret was contacted or changed.
