# Codex owner-terminal update

Date: 2026-07-24  
Provider: Codex CLI `0.145.0`  
Scope: Personal Mode, owner-authenticated CLI only

## Decision

**GO WITH LIMITATIONS** for the Phase 3 read-only adapter.

The owner ran bounded probes in an empty temporary workspace. The automated
agent identity was not used and remains unable to execute the CLI; that access
limitation must not be worked around by reading configuration, credentials, or
changing ACLs.

## Observed safe transport

- `codex exec` accepts a prompt from stdin with `-`.
- `--json` emits JSONL. Observed native event types include `thread.started`,
  `turn.started`, and `item.completed` for an agent message.
- `--sandbox read-only` prevented a requested file write.
- `codex exec resume --last` continued the previous session.
- An unknown UUID failed with `no rollout found ... (code -32600)`.
- Ctrl+C returned the owned command to PowerShell with exit code `-1`; the
  temporary workspace remained empty.

## Required Phase 3 policy

Use stdin, `--json`, `--sandbox read-only`, and child-process `cwd`. Never use
either `dangerously-bypass-approvals-and-sandbox` or
`dangerously-bypass-hook-trust`. The app owns process cancellation and must
prove its Windows child-tree behavior through its opt-in smoke test.

Tools, approvals, images, workspace writes, and an explicit Codex cwd CLI flag
were not validated. The adapter must keep them disabled and tolerate unknown
events as sanitized diagnostics.
