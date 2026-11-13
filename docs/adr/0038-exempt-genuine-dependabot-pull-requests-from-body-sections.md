# Exempt genuine Dependabot pull requests from the body sections

The shared pull-request metadata validator skips the four template body
sections (Summary, Evidence, Merge Danger and Related issue) only when the
trusted platform facts name `dependabot[bot]` as the pull request's author.
Its title, breaking-change and attribution checks still apply to Dependabot,
and every other author, other bots included, keeps the ordinary rules.
Dependabot writes its own body and rewrites it on every rebase, so on
2026-10-31 the installed validator rejected minecraft-stream-guard-site#8 on
exactly those four sections, and any manual fix would be undone by the bot's
next update. The author fact comes from the trusted trigger's platform event,
never from body text or from the account that triggered a later event, so a
person copying a Dependabot body is still checked in full. The owner chose
this in the 2026-11-12 grill of #782: "Agreed."

## Considered options

- Keep the validator and document manual handling: rejected, because
  Dependabot's rewrites make the manual sections recurring work.
- Rewrite bot bodies automatically: rejected, because it needs write access
  and coordination with the bot's own rewrites, a larger capability than the
  request.
- A general bot allowlist or a full metadata bypass: rejected until another
  bot's real case exists; only Dependabot's is established.
