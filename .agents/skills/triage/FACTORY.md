# Factory triage run

The factory starts this run for one issue, read-only, and the installed factory workflow rules' Triage run section sets its limits. There is no orchestrating agent, research run, grill or workbench to hand anything to: you research, write and review the brief yourself, and everything you produce goes into one run result, which the factory posts and turns into labels.

1. **Gather context** as [Gather context](SKILL.md#gather-context) says, and run its two checks first, yourself. Read the repository's ADRs, its glossary, and the issues the request links, with their decisions: the records the Triage run section lets you cite.
2. **Sort** the request as [Sort by uncertainty](SKILL.md#sort-by-uncertainty) says. Answer each intent question the inference test lets you answer from those records, and list it with the record and its date under **Inferred intent** in the triage notes.
3. **Choose the outcome** the Triage run section names, with the labels it lists, and write its body. A stop's body names the exact next state that answers it, as Questions and stops says:
   - `state:ready`: write the Agent Brief and its triage notes as [AGENT-BRIEF.md](AGENT-BRIEF.md) says, review them as the [contract review](REVIEW.md) says, and correct them until they hold. Choose the `model:` label under the installed Model selection rule, within the host capabilities the factory supplies, and record its reason in the triage notes.
   - `state:reporter`: the [reporter template](SKILL.md#reporter-template).
   - `state:owner`: the question and what you found.
   - `state:grill`: the facts gathered (current behavior, constraints, the records you read, the options and what each would cost) and the open questions, numbered.
   - `state:carried`: the carrier the Triage run section names, linked, and how it settles the request.

   A directly authored specification or implementation ticket, recognized from its body content regardless of category labels, takes this branch instead: write no Agent Brief and ask for no `type:` label in any outcome. Read the revision in the validator's current notice; without one, stop in `state:owner` and say the notice is missing, as [Accept mode](ACCEPT.md#accept-mode)'s step 1 does, naming `state:triage` for when it arrives. Otherwise review that revision as Accept mode's step 2 says for a direct contract, and choose:
   - **The body holds**: ask the host to accept the exact `sha256:` revision from the validator's notice you reviewed, in the format its run-result interface defines, with `state:ready` and the companion labels readiness needs: one `model:` label you choose under the installed Model selection rule, with its reason, any `factory:skip` Skipped work requires, and a `priority:` label. Record your findings, one bullet each with its evidence. If this run wrote the issue, refuse acceptance instead: stop in `state:owner`, naming `state:triage` for an independent run to review it.
   - **The body needs correction**: `state:owner`, naming each correction, which a separate writer makes before the issue returns to `state:triage`, as the planning rules' Owner questions section says.
   - **An open intent question**: `state:grill`, as above.

4. **Write the run result** to the path the factory gives, in the format its run-result interface defines: the state and labels you ask for, and the body, starting with its lead line and carrying no footer or disclaimer, as `.repo-standards/rules/comments.md#disclaimers` says. When you cannot finish, write a failed result with the reason.
5. **Write nothing else**, as the Triage run section says, even where a credential would allow it: a reproduction stays in your sandbox, and `ready.mjs` never runs.
