# Phase 6 — Reliability and local release candidate

## Objective

Turn the feature-complete Personal Mode application into a recoverable, diagnosable, performant, and clearly documented local release candidate.

## Read first

- `docs/10-testing.md`
- `docs/11-operations.md`
- `docs/13-risks-and-policy.md`

## Deliverables

- Single-instance startup/shutdown/recovery.
- Backup/restore with manifests and integrity checks.
- Search/performance/backpressure hardening.
- Redacted diagnostic bundle and provider compatibility report.
- Data/privacy/settings UI and user documentation.
- Windows release E2E and packaging decision ADR.
- Upgrade/migration test fixtures.

## Work items

1. Implement runtime app-data layout and safe configuration precedence.
2. Add structured redacted logs with bounded retention.
3. Complete health snapshot and diagnostics preview/export.
4. Implement database/attachment backup and restore-to-new-location.
5. Test crash during message commit, run stream, lease, projection, and migration.
6. Benchmark required workloads and fix unbounded memory/queues.
7. Run secret leakage suite across DB/log/export/diagnostics/browser state.
8. Validate accessibility and keyboard workflows manually/automatically.
9. Decide source install versus signed desktop/package distribution; document, do not improvise auto-update.
10. Produce owner guide for install, provider login, data location, backup, limitations, and uninstall without data loss.

## Release acceptance

- [ ] Clean Windows installation/start and loopback-only verification.
- [ ] All automated gates pass from clean lockfile install.
- [ ] Opt-in Codex/Claude smoke tests pass on recorded versions or known limitation is visible.
- [ ] 100k-message search/pagination and 1 MB stream remain responsive/bounded.
- [ ] Backup, destructive simulation on a copy, and restore drill pass with hashes.
- [ ] Crash recovery preserves acknowledged messages/partial output and clears safe stale state.
- [ ] Diagnostic bundle preview contains no transcript/secret unless explicitly selected.
- [ ] No critical/high security issue remains.
- [ ] User-facing privacy and provider-policy boundaries are explicit.
- [ ] Schema/protocol/app/projector versions are recorded.

## Handoff

Mark a Personal Mode release candidate. Do not activate Phase 7 automatically; collaboration requires owner decision and a fresh policy/threat-model review.
