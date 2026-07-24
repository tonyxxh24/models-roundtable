# Provider probe runbook

This folder holds only safe Phase 0 instructions. It is not application code and must not become a credential wrapper.

## Guardrails

- Use an empty disposable workspace, never a user repository.
- Do not install/update a provider, change login state, inspect provider configuration, or export credentials.
- Use read-only/plan permission controls and no bypass flags.
- Use fixed harmless responses such as `PHASE0_OK`.
- Sanitize all captured output before it enters the repository.
- Destroy temporary raw output outside the repository after manually verifying sanitization.

## Claude Code 2.1.217 observed shape

The observed version requires `--verbose` for `-p` with `--output-format stream-json`.

```powershell
'Reply with exactly PHASE0_STDIN_OK. Do not use tools or modify files.' |
  claude -p --verbose --output-format stream-json --permission-mode plan --max-turns 1
```

Use the init event's session ID only in-memory to test resume. Replace it with `<SESSION_ID>` before saving a fixture.

## Codex re-probe requirement

Run this section only from the owner's interactive terminal once `codex --version` succeeds. Inspect the installed `codex exec --help` output first and use only flags it confirms. Record new-session JSONL, resume, controlled error, read-only behavior, and cancellation as sanitized fixtures.

Do not solve an access-denied error by changing ACLs, using a browser, or reading another application's login state.
