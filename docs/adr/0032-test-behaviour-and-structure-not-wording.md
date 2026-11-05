# Test behaviour and structure, not wording

Repo Canon's tests check what code does and how files are structured, such as
declarations, required sections, link targets, line or word caps, and a rule
phrase appearing only in its one home. They never pin the wording of rules,
skills or documents. Pins moved with their prose: 111 of the 112 commits that
touched the conformance test also changed the prose it pinned. The one lost
text on record, a license notice, was deleted together with its pin in the
same pull request. Wording is checked by pull request review and by the skill
exercises a release runs. License notices are the exception, because their
exact text is required: each one is compared byte for byte with its vendored
license. Keeping pins only for installed rules was rejected, because those pins
moved with their prose like the rest.
