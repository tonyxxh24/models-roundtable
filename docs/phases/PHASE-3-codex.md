# Phase 3 — Codex Personal Mode adapter

## Objective

Integrate owner-authenticated Codex through the verified Phase 0 transport while preserving provider-neutral core behavior and read-only safety.

## Preconditions

- Phase 2 complete.
- Codex is GO/GO WITH LIMITATIONS in capability report.
- Sanitized Codex fixtures exist.

## Read first

- `docs/04-provider-adapters.md`
- `docs/07-security-and-permissions.md`
- Phase 0 Codex findings
- ADR-0002, ADR-0003, ADR-0006

## Deliverables

- `provider-codex` adapter implementing shared contract.
- Executable discovery/configuration and bounded probe.
- Incremental JSONL parser with fixture coverage.
- New session, resume, streamed output, normalized errors, cancellation.
- Provider readiness UI and diagnostics.
- Opt-in real-provider smoke command documented.

## Work items

1. Implement command builder using argument arrays, `shell: false`, validated cwd, and verified installed flags.
2. Keep prompt off command line when verified stdin works.
3. Map every Phase 0 fixture; tolerate documented unknown events.
4. Capture opaque session ID and persist binding only after valid event.
5. Enforce per-session serialization and read-only profile.
6. Map stderr/exit/timeouts/auth/session failures to stable errors.
7. Implement graceful then owned-tree cancellation across Windows target environment.
8. Add settings/status UI with version/capability hash and no credential fields.
9. Add opt-in smoke tests using disposable read-only workspace.

Do not introduce direct OpenAI API calls, browser automation, app-server dependence without a new ADR, SDK types in core, or bypass flags.

## Acceptance criteria

- [ ] Shared adapter contract suite passes.
- [ ] All captured/synthetic Codex fixtures pass incremental parser tests.
- [ ] Real smoke: start, stream, complete, resume, cancel in disposable read-only workspace.
- [ ] App remains usable when Codex is missing/logged out/incompatible.
- [ ] No credentials/environment dumps/raw sensitive stderr reach DB/log/browser/export.
- [ ] Existing fake-provider E2E remains unchanged and passing.
- [ ] Provider update/schema drift yields controlled adapter error, not server crash.
- [ ] Exact tested Codex version/capability hash recorded in handoff.

## Handoff

Activate Phase 4. Document reusable adapter-base/process lessons before Claude work.
