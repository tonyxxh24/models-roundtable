# Provider adapter implementation

## Goal

Wrap provider-native local execution behind one versioned interface. Provider-specific flags, event shapes, session IDs, stderr conventions, and exit codes must never leak into core or UI code.

The normative TypeScript shape is `contracts/provider-adapter.ts`.

## Adapter responsibilities

- Resolve an executable from explicit configuration or `PATH` without downloading software.
- Probe version and supported capabilities without changing provider config.
- Report authentication readiness without reading credential files.
- Start a new provider session in a validated working directory.
- Continue an opaque session when supported.
- Stream normalized events with bounded buffering.
- Request only the configured permission level.
- Cancel and terminate only owned child process trees.
- Redact command display and diagnostics.
- Map provider failures into stable error codes.

## Non-responsibilities

- Login UI, OAuth callback interception, credential storage, or account sharing.
- Parsing room mentions or building cross-provider context.
- Database access.
- Choosing which agent should answer.
- Executing arbitrary shell command strings supplied by the browser.

## Capability discovery

Phase 0 must record actual command version and observed behavior on the target machine. Never infer support solely from a version string.

Probe sequence:

1. Resolve configured executable path.
2. Run a bounded version command.
3. Inspect bounded help output for required flags/subcommands.
4. Run a harmless read-only fixture against a temporary workspace after the owner confirms login.
5. Record capability booleans and fixture samples in `docs/generated/provider-capabilities.json` and sanitized JSONL fixtures.

Capabilities include:

```text
streaming_json
session_id_event
resume_session
cwd_argument
read_only_mode
approval_events
structured_tool_events
image_input
graceful_cancel
```

If a required capability is absent, the adapter returns `incompatible` with a user-actionable explanation. It must not guess an alternate flag.

## Process supervision

Spawn with an argument array and `shell: false`. The validated workspace is the child `cwd`. Do not concatenate prompt, path, model, or session ID into a shell string.

- stdin carries the prompt when supported, avoiding command-line history and length limits.
- stdout is provider protocol data.
- stderr is diagnostic text and never interpreted as assistant content.
- Buffer individual unterminated lines up to a fixed maximum; reject oversized records.
- Decode UTF-8 incrementally so multibyte characters split across chunks survive.
- Handle CRLF and LF.
- A parser accepts multiple records per chunk and records spanning chunks.

Each child is registered before I/O begins. The registry contains PID, spawn token, run ID, start time, and cancellation state. Cleanup removes it exactly once.

Cancellation:

1. mark `cancelling` and stop accepting new input;
2. send graceful interrupt supported by the platform/provider;
3. wait a short configured grace period;
4. terminate the tracked process tree if still alive;
5. mark `cancelled` unless a provider failure was already authoritative.

Never search for processes by executable name and never terminate an untracked PID.

## Codex Personal Mode adapter

### Preferred MVP transport

Use official non-interactive CLI behavior validated in Phase 0. Current official documentation describes:

```text
codex exec --json <prompt-or-stdin>
codex exec resume <session-id> <follow-up>
```

The JSON option produces newline-delimited events, and resume accepts an opaque session ID. Exact argument order, stdin support, sandbox options, and event shapes must come from the installed CLI's Phase 0 fixtures.

### Future transport

The official Codex SDK supports starting and resuming threads and may replace raw CLI parsing after the CLI implementation is stable. Treat this as an adapter-internal transport change. Do not couple core contracts to SDK classes. `codex app-server` is not the MVP dependency because its documented maturity may change and it expands the protocol surface.

### Authentication

The owner authenticates using official Codex UX outside Roundtable. Roundtable reports readiness and instructions only. SDK/CLI subscription interoperability is a Phase 0 verification item, not an assumption.

### Permissions

- Phases 0–4 use read-only/sandboxed behavior.
- Never pass approval/sandbox bypass flags.
- Later write mode maps the normalized permission profile to a verified supported Codex setting and requires a workspace lease.

## Claude Personal Mode adapter

### MVP transport

Use Claude Code non-interactive streaming validated in Phase 0. Current official documentation describes print mode, `stream-json`, and resume behavior, conceptually:

```text
claude -p <prompt> --output-format stream-json
claude -p --resume <session-id> <follow-up> --output-format stream-json
```

Use stdin where the installed version supports it. Capture session ID from the initialization/system event. Preserve provider result/error metadata only through normalized fields.

### Authentication and policy boundary

The Claude Code CLI may be logged into an owner's Claude plan for that owner's local use. Anthropic's Agent SDK documentation states that third-party developers may not offer Claude.ai login or rate limits in their products without prior approval and should use API-key/provider authentication. Therefore:

- this adapter is enabled only in Personal Mode;
- Roundtable never displays a Claude login form or transports Claude credentials;
- it must not be used to serve guest prompts or a hosted product;
- Collaboration Mode must disable it for guests or adopt a separately approved/per-user/API design.

### Permissions

Do not use `--dangerously-skip-permissions`. MVP runs must be read-only using verified permission flags/settings. Approval forwarding through supported tools may be designed in Phase 5 only.

## Fake adapter

The fake provider is a production-quality test dependency, not a throwaway mock. It supports scripted:

- delayed and fragmented text;
- tool events;
- approvals;
- session start/resume;
- malformed/unknown events;
- rate limits, nonzero exits, hangs, and cancellation races.

It makes CI deterministic and lets UI development proceed without provider accounts.

## Error taxonomy

Adapters map failures to:

```text
provider_missing
provider_auth_required
provider_incompatible
provider_rate_limited
provider_usage_limit
provider_permission_denied
provider_session_not_found
provider_protocol_error
provider_timeout
provider_cancelled
provider_process_error
workspace_unavailable
unknown_provider_error
```

Include a safe user message, retryability, provider name/version, and a redacted diagnostic reference. Never surface raw stderr wholesale to normal chat.

## Session handling

- Store opaque provider IDs exactly, without semantic parsing.
- Associate a session with adapter, agent profile, and canonical workspace ID.
- Serialize turns per session.
- If resume says session-not-found, require an explicit new-session fallback; do not silently lose context.
- A user can fork an agent by creating a new provider session from a selected context snapshot.
- Application room deletion does not delete provider-owned session files.

## Event normalization

Common events are session start, text delta, reasoning summary (only if provider explicitly exposes a safe summary), tool start/update/finish, approval request/resolution, usage, warning, completion, and failure.

Do not expose private chain-of-thought. Provider fields resembling internal reasoning are ignored unless official public output semantics explicitly classify them as user-visible summaries.

Unknown events increment a metric and may be saved in opt-in sanitized diagnostics. They do not crash a run unless a required terminal/session invariant can no longer be satisfied.
