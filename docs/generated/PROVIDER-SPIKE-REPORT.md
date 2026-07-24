# Provider feasibility spike report

Date: 2026-07-23  
Phase: 0 — Provider feasibility spike  
Mode: Personal Mode only; no provider credentials were read, copied, or stored.

## Executive decision

| Adapter | Decision | Reason |
|---|---|---|
| Claude Code CLI | GO WITH LIMITATIONS | Streaming JSON, stdin, session capture/resume, validated `cwd`, plan-mode read-only behavior, and owned-child cleanup were observed on this machine. |
| Codex CLI | NO-GO IN CURRENT AGENT ENVIRONMENT | The executable was discovered through the installed desktop App package, but this execution account received Windows `Access is denied` for `codex --version`, including an elevated read-only probe. CLI functionality was not tested and must be re-probed from the owner's interactive terminal or a process identity that can execute that package. |

Phase 1 is permitted because one real provider is viable and the fake adapter remains mandatory. A two-provider Personal Mode release remains blocked on a successful Codex compatibility probe.

## Safe environment inventory

| Item | Observed value |
|---|---|
| Host OS | Windows NT 10.0.26200 (x64) |
| Shell used for probes | Windows PowerShell 5.1 |
| Node.js | v22.14.0 |
| Git | 2.43.0.windows.1 |
| Git Bash | Available |
| WSL launcher | Available |
| Claude Code | 2.1.217 |
| Codex CLI | Installed through the Codex desktop application package; executable version unavailable to this agent identity |

Absolute executable paths, user profile paths, provider session IDs, account information, full tool inventories, and raw provider events are deliberately omitted.

## Claude Code observations

### Invocation contract proven

The following properties were observed in an empty temporary workspace, with `--permission-mode plan`, no dangerous bypass flags, and prompts that requested no tools:

| Capability | Result | Evidence fixture |
|---|---|---|
| Non-interactive print mode | Yes | `normal.sanitized.jsonl` |
| Stream JSON | Yes, requires `--verbose` in this installed version | `normal.sanitized.jsonl` |
| Partial text deltas | Yes | `normal.sanitized.jsonl` |
| Provider session ID on init | Yes | `normal.sanitized.jsonl` (redacted) |
| Resume opaque session | Yes | `resume.sanitized.jsonl` |
| Prompt via stdin | Yes | `stdin.sanitized.jsonl` |
| Configured working directory visible to provider | Yes | `normal.sanitized.jsonl` (redacted workspace alias) |
| Read-only candidate | Yes: init reported `permissionMode: plan`; a write-request probe did not create a file | `permission-plan.sanitized.json` |
| Invalid session handling | Controlled error result | `invalid-session.sanitized.jsonl` |
| Owned child cleanup | Yes, forced termination of an owned child exited cleanly | `force-cleanup.sanitized.json` |
| Provider-level graceful cancel | Not verified | See limitation below |
| Structured tools / approvals | Not verified in safe probe | Not enabled for MVP |
| Image input | Not verified | Disabled until explicitly probed |

### Required command detail

For Claude Code 2.1.217, `--print` plus `--output-format stream-json` failed unless `--verbose` was also present. The adapter must require/probe this combination rather than assume documentation examples work unchanged.

Verified safe shape (illustrative; use argument arrays in code, not a shell string):

```text
claude -p --verbose --output-format stream-json --permission-mode plan --max-turns 1
```

The adapter should prefer stdin for the assembled prompt once the Phase 4 implementation validates its process runner behavior.

### Permission observation

`plan` was accepted and emitted as the effective permission mode. An attempt to request a file creation in the disposable workspace left no file behind. The provider ended due to `max_turns` during planning, so this is evidence for the safe MVP profile, not evidence for a full provider approval protocol. Phase 4 must keep Claude read-only and must not pass bypass flags.

### Cancellation observation

An application-owned Claude child was still alive after 1.5 seconds and exited after direct owned-process termination. This confirms the host can clean up a tracked process. It does **not** establish a provider-level graceful interrupt protocol on Windows; mark `gracefulCancel` false and implement forced owned-tree cleanup with a clear partial-result state.

## Codex observation

`Get-Command` located Codex as part of the installed desktop application. Both sandboxed and escalated invocations of the harmless `codex --version` command failed with Windows access denial before the CLI could emit output. No login, config, credential, session, prompt, or workspace operation was attempted.

This is a capability of the current automated execution identity, not a statement about the owner's normal terminal. Before Phase 3, repeat the probe in an owner-interactive terminal and capture sanitized version/help/JSONL/resume data. Do not work around the access issue by scraping web UI, reading app credentials, or changing package ACLs.

## Adapter implications

### Claude adapter (Phase 4)

- Implement CLI Personal Mode only.
- Use `-p`, `--verbose`, `--output-format stream-json`, stdin, verified `cwd`, `--permission-mode plan`, and a bounded max turns/timeout.
- Capture `system/init` session identifier as opaque provider state; do not expose it in UI/logs/export.
- Normalize `system/init`, `stream_event`, `assistant`, `result`, rate-limit, and error records.
- Treat unknown event types as diagnostics, not crashes.
- Map invalid resume to `provider_session_not_found` or `provider_process_error` only after inspecting sanitized fixture semantics.
- No tools, images, approvals, write access, or graceful cancel claim in first adapter implementation.

### Codex adapter (Phase 3)

- Remains blocked pending owner-terminal evidence.
- Use only flags discovered from the installed executable's help and Phase 0 fixtures.
- Do not couple core to Codex SDK/app-server until a dedicated ADR changes transport.

## Fixture and sanitization policy

Fixtures under `fixtures/providers/` are intentionally minimal. They preserve event ordering and fields required for parser/normalizer tests while replacing or omitting:

- provider session/message/request/trace IDs;
- model/account/organization details unless required for a capability assertion;
- absolute paths and user names;
- raw tool lists, MCP servers, plugins, skills, memories, prompts, and usage/cost fields;
- raw stderr and provider response bodies outside the fixed test tokens.

Synthetic malformed/chunk fixtures are marked as synthetic and never presented as provider observations.

## Phase 0 acceptance evidence

- [x] Exact executable versions and platform constraints recorded for runnable components; Codex access constraint recorded.
- [x] Streaming text can be incrementally parsed for the one GO provider (Claude).
- [x] Opaque provider session ID was captured and resumed for Claude; identifier is redacted from artifacts.
- [x] Read-only candidate behavior verified without bypass flags for Claude.
- [x] Authentication remained provider-owned; no credentials were inspected.
- [x] Sanitized happy-path, resume, stdin, invalid-session, permission, cleanup, warning/stderr, and synthetic parser fixtures exist.
- [x] Go/no-go decision and adapter recommendations are explicit.
- [x] No product framework/dependency scaffold was added.

## Remaining blockers

1. Codex needs an owner-terminal probe before Phase 3 can begin.
2. Claude graceful interrupt/tool/approval/image capabilities remain intentionally unverified and disabled.
3. Phase 4 must repeat a controlled smoke test after application process supervision exists.
