# Phase 4 — Claude Personal Mode adapter

## Objective

Integrate owner-authenticated Claude Code CLI for single-owner local use, with an explicit guard preventing guest/hosted use.

## Preconditions

- Phase 3 complete and adapter base stable.
- Claude is GO/GO WITH LIMITATIONS in Phase 0.
- Sanitized Claude fixtures exist.

## Deliverables

- `provider-claude` adapter implementing the shared contract.
- Print/stream JSON parser, session capture/resume, errors, cancellation.
- Personal Mode policy guard in server/domain configuration.
- Readiness UI with policy disclosure.
- Opt-in smoke command and documented platform shell requirements.

## Work items

1. Use verified Phase 0 command/flags only; argument arrays and validated cwd.
2. Parse streaming system/assistant/result/tool events into normalized contract.
3. Capture/resume opaque session ID; invalid session requires explicit new-session path.
4. Enforce read-only permission ceiling and reject unsupported safe mode.
5. Never use dangerous permission bypass.
6. Add `personalOnly` adapter capability/policy enforced server-side, not merely UI text.
7. Ensure future guest principals cannot invoke this adapter.
8. Add missing/auth/limit/incompatible UI and safe diagnostics.
9. Run opt-in read-only smoke tests and record exact version.

Do not use Claude Agent SDK with Claude.ai login in a third-party product, collect OAuth credentials, share owner rate limits, or hide the Personal Mode limitation.

## Acceptance criteria

- [ ] Shared adapter contract and Claude fixture suites pass.
- [ ] Real smoke: start, stream, complete, resume, cancel read-only.
- [ ] `@all` can run Codex and Claude from the same room snapshot.
- [ ] One provider failing does not affect the other.
- [ ] Server rejects Claude Personal adapter for any non-owner principal fixture.
- [ ] No dangerous flag or credential field exists in command/config/log/DB/UI.
- [ ] First-run/settings explain policy boundary clearly.
- [ ] Exact version/capability hash and remaining limitations recorded.

## Handoff

Activate Phase 5 only when two-provider flows and all prior E2E tests pass.
