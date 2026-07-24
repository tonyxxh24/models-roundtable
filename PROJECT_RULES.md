# Shared project rules

These rules apply to every human or model changing this repository.

## Source of truth

1. `docs/STATUS.md` names the only active phase.
2. The matching file in `docs/phases/` defines allowed scope and acceptance criteria.
3. Accepted ADRs in `docs/decisions/` override older prose.
4. Contracts in `contracts/` are normative. Documentation examples are illustrative.
5. When two documents conflict, stop and resolve the conflict with an ADR; do not silently choose.

## Working method

- Read the active phase completely before editing.
- Do not implement work from a later phase “while nearby.”
- Preserve the local-first and no-provider-secret-storage boundaries.
- Use strict TypeScript. Avoid `any`; validate untrusted runtime data.
- Keep provider-specific formats inside provider packages. Core and UI consume normalized contracts only.
- Add or update tests with every behavior change.
- Update `docs/STATUS.md` and create a handoff record using `docs/templates/HANDOFF.md` before ending incomplete work.
- Add an ADR for a durable architectural change; do not rewrite history in an accepted ADR.
- Never enable dangerous provider flags by default.
- Never expose the server beyond loopback until the collaboration phase security gate passes.

## Required quality checks

Once the relevant scripts exist, run the narrowest applicable checks and then the phase gate:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Record exact commands and results in the handoff. If a command does not yet exist, say so; do not claim it passed.

## Git and workspace safety

- Treat unrelated changes as user-owned.
- Do not reset, clean, delete, force-push, or rewrite history without explicit authorization.
- Provider write access requires a workspace lease. Until that subsystem exists, adapters run read-only.
- Two provider processes must never edit the same working tree concurrently.
- Terminate only child processes started and tracked by this application.

## Documentation language

Architecture and contracts use English identifiers so code and schemas remain unambiguous. Explanatory prose may use English or Traditional Chinese, but a document should be internally consistent.
