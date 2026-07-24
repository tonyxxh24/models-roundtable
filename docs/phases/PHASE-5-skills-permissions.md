# Phase 5 — Skills, instructions, workspace permissions

## Objective

Add canonical skills/provider projections, effective-instruction inspection, validated workspaces, approval handling where supported, and carefully gated write access.

## Preconditions

Both Personal Mode adapters are stable and read-only tests pass.

## Read first

- `docs/06-skills-and-instructions.md`
- `docs/07-security-and-permissions.md`
- ADR-0006 and ADR-0007

## Deliverables

- Canonical skill discovery/validation/import/projector with conflicts.
- Skills/Instructions UI and effective hashes in context inspector.
- Workspace registration/canonicalization/containment service.
- Normalized permission profiles.
- Exclusive write lease and crash recovery.
- Approval request/resolve flow only for verified adapter support.
- Security test suite for paths, projections, approvals, and leases.

## Work items

### Skills

- Validate canonical `SKILL.md`, paths, sizes, and deterministic tree hash.
- Preview and atomically project to `.agents/skills` and `.claude/skills`.
- Detect pre-existing/diverged target; stop for explicit resolution.
- Show native `AGENTS.md`/`CLAUDE.md` structures separately.

### Workspace

- Owner-only registration and trust state.
- Cross-platform real-path containment including symlink/junction tests.
- Reject broad roots, profile/app-data, devices, and traversal.
- Use stable workspace IDs and display aliases.

### Permissions/write lease

- Implement chat/read/write profiles without unrestricted profile.
- Verify each adapter mapping against current capability matrix.
- Transactionally acquire one write lease; heartbeat/release/recover safely.
- If provider cannot enforce ceiling, reject mutable run.

### Approvals

- Implement only where a provider exposes a supported approval protocol.
- Bind single-use response to request hash/run/scope/expiry.
- Deny stale/replayed/disconnected requests.
- No blanket approval or bypass option.

## Acceptance criteria

- [ ] Identical canonical skill produces deterministic provider projections.
- [ ] Diverged provider file is never overwritten without explicit resolution.
- [ ] Path traversal/symlink/junction/device/broad-root security tests pass on Windows.
- [ ] Exactly one concurrent write lease can exist per workspace.
- [ ] Crash/cancel releases lease only after owned child is absent.
- [ ] Read-only agent/skill cannot raise its own permission.
- [ ] Approval replay/hash mismatch is rejected and audited.
- [ ] Context inspector reports effective skill/instruction hashes.
- [ ] Full regression and security suites pass.

## Stop condition

If either provider cannot enforce a safe write ceiling, keep that adapter read-only. Phase completion does not require unsafe parity.

## Handoff

Record provider-specific permissions actually supported and activate Phase 6.
