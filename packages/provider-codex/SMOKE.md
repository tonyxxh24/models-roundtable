# Owner-only Codex smoke procedure

This is an opt-in Personal Mode verification procedure. Run it only from the
owner's interactive PowerShell after completing the official Codex login. Do
not run it from CI, the server process, or an automated agent identity.

## Safety boundary

- Use a new empty directory under `C:\tmp`.
- Use `--sandbox read-only` and never use a `dangerously-*` option.
- Do not paste JSONL into an issue, chat, or repository. It can contain opaque
  thread identifiers.
- Delete any unsanitized capture outside the repository after verification.

## New read-only session

```powershell
New-Item -ItemType Directory -Force -Path C:\tmp\models-roundtable-codex-smoke
Set-Location C:\tmp\models-roundtable-codex-smoke
$prompt = 'Reply with exactly ROUNDTRIP_NEW_OK. Do not use tools, read files, or modify anything.'
$prompt | codex exec --sandbox read-only --json --skip-git-repo-check -
```

Verify the fixed token appears and `Get-ChildItem -Force` returns no files.

## Cancellation

Run a harmless long wait under the same options, then press Ctrl+C after the
turn starts. Verify PowerShell regains its prompt, the workspace is empty, and
record only the exit code and sanitized event types.

## Resume limitation

Codex CLI 0.145.0 proves `codex exec resume --last`, but its observed help does
not expose a read-only sandbox option. The application adapter intentionally
rejects resume until an installed-help-supported, read-only invocation is
verified. Do not bypass that guard for this smoke procedure.
