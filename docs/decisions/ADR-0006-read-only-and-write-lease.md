# ADR-0006: Read-only default and exclusive write lease

- Status: Accepted
- Date: 2026-07-23

## Context

Multiple coding agents may act on the same workspace. Concurrent or overly broad writes risk data loss.

## Decision

All agents start read-only. A mutable run requires owner-approved workspace-write policy and an exclusive lease bound to run and owned process identity. No unrestricted/bypass profile exists. Parallel mutable work later uses isolated Git worktrees.

## Consequences

Early releases provide analysis rather than edits. Write UX and recovery are more involved, but collisions and ambiguous authority are prevented.
