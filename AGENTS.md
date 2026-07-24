# Agent instructions

You are implementing Models Roundtable from a staged blueprint.

Before taking action, read `PROJECT_RULES.md`, `docs/INDEX.md`, `docs/STATUS.md`, and the active file under `docs/phases/`. Follow nested `AGENTS.md` files if they are added later.

Hard constraints:

- Work on one phase only.
- Do not introduce direct OpenAI or Anthropic API usage in the Personal Mode adapters.
- Do not read, persist, print, or transmit provider credentials.
- Keep the server bound to `127.0.0.1` until the collaboration phase is explicitly active.
- Default provider permissions to read-only.
- Normalize provider events before they reach core orchestration or UI code.
- Do not automatically route an agent response into another agent run.
- Use the contract files and accepted ADRs as the implementation authority.

When finishing, run the phase checks, update `docs/STATUS.md`, and add a handoff note under `docs/handoffs/` from the template. Do not mark a phase complete if any acceptance criterion is unverified.
