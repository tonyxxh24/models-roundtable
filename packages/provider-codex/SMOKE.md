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

## Read-only resume verification

The official Codex configuration reference documents `sandbox_mode` and the
`read-only` value. Codex CLI 0.145.0 exposes `-c key=value` on `exec resume`, so
the candidate invocation below supplies the sandbox as an explicit config
override. The application keeps resume disabled until the owner completes this
test. Never add a `dangerously-*` option.

Run this write-denial probe in the same disposable directory after a successful
new session:

```powershell
Set-Location C:\tmp\models-roundtable-codex-smoke
$probeFile = Join-Path (Get-Location) 'phase3-resume-write-probe.txt'
if (Test-Path -LiteralPath $probeFile) { throw 'Probe file already exists; refusing to continue.' }
$prompt = 'Create a file named phase3-resume-write-probe.txt containing exactly WRITE_PROBE. This is a permission probe.'
$prompt | codex exec resume -c 'sandbox_mode="read-only"' --last --json --skip-git-repo-check -
[pscustomobject]@{ exitCode = $LASTEXITCODE; probeFileExists = (Test-Path -LiteralPath $probeFile) }
```

Required result: `probeFileExists` is `False`. The provider may report that the
write was denied; that is expected. Then verify ordinary resumed output:

```powershell
$prompt = 'Reply with exactly ROUNDTRIP_RESUME_OK. Do not use tools, read files, or modify anything.'
$prompt | codex exec resume -c 'sandbox_mode="read-only"' --last --json --skip-git-repo-check -
$LASTEXITCODE
Get-ChildItem -Force
```

Report only the exit codes, whether the probe file exists, and whether
`ROUNDTRIP_RESUME_OK` appeared. Do not report the thread ID or raw JSONL.

Reference: <https://learn.chatgpt.com/docs/config-file/config-reference>

## App-owned adapter smoke

Only after both resume checks above pass, use a new empty directory and run the
adapter-level start, resume, and cancellation smoke:

```powershell
New-Item -ItemType Directory -Force -Path C:\tmp\models-roundtable-codex-app-smoke | Out-Null
$env:MODELS_ROUNDTABLE_CODEX_WORKSPACE = 'C:\tmp\models-roundtable-codex-app-smoke'
$env:MODELS_ROUNDTABLE_CODEX_RESUME_SMOKE = 'I_HAVE_VERIFIED_READ_ONLY_RESUME'
pnpm --filter @models-roundtable/provider-codex smoke:owner
Remove-Item Env:\MODELS_ROUNDTABLE_CODEX_RESUME_SMOKE
Remove-Item Env:\MODELS_ROUNDTABLE_CODEX_WORKSPACE
```

Required fixed output is `APP_START_OK`, `APP_RESUME_OK`, `APP_CANCEL_OK`, and
`APP_WORKSPACE_EMPTY_OK`. The runner refuses a non-empty workspace, keeps the
session identifier in memory, prints only allowlisted results, and is never
called by the automated test suite.
