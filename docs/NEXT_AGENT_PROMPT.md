# Prompt for the next implementation model

Copy the text below into the next coding-agent conversation.

---

You are continuing the Models Roundtable project from its repository blueprint. Do not redesign or implement the entire product in one pass.

Your first actions must be read-only:

1. Read `AGENTS.md` and `PROJECT_RULES.md` completely.
2. Read `docs/INDEX.md` and `docs/STATUS.md`.
3. Identify the single active phase and read that phase file completely, including every linked prerequisite.
4. Inspect the working tree and existing handoffs. Preserve unrelated/user changes.

Then execute exactly that one active phase. The current blueprint starts with `PHASE-0-spike`; do not scaffold the web application until Phase 0 has passed and `STATUS.md` activates Phase 1.

Hard boundaries:

- This is local-first Personal Mode. Provider credentials remain in official provider-owned stores.
- Never read/copy/log/export provider tokens, cookies, credential files, or full environments.
- Do not use browser automation against ChatGPT or Claude web apps.
- Do not add direct provider API usage to Personal Mode.
- Claude subscription use is owner-only/local-only; never expose it to guests.
- Keep provider execution read-only until the write-lease phase passes.
- Never use dangerous permission/sandbox bypass flags.
- Do not automatically route agent output into another agent call.
- Use argument arrays with `shell: false`; never compose browser input into shell commands.
- Contracts and accepted ADRs are authoritative. Add a new ADR for a durable change instead of silently diverging.

Work autonomously within the phase, but stop if completion would require credentials, unsafe permissions, account sharing, destructive operations, or a material scope expansion.

Before finishing:

1. Run all phase-required checks that exist.
2. Map concrete evidence to every acceptance criterion; do not claim unrun tests passed.
3. Update `docs/STATUS.md` truthfully.
4. Add `docs/handoffs/YYYY-MM-DD-phase-N.md` using `docs/templates/HANDOFF.md`.
5. Leave one exact next action for the following model.

Lead your final response with the actual outcome, tests, remaining risks, and active next phase.

---

## Owner note

For Phase 0, the next model may need the owner to complete provider-owned login or approve bounded execution of installed CLIs. It must not ask for passwords, tokens, cookie exports, or credential-file access.
