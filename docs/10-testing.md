# Testing and quality strategy

## Goals

Tests must make the application reliable without paid provider calls in CI. Real-provider tests are opt-in smoke tests and never the primary correctness signal.

## Test layers

### Unit

- Mention tokenizer/resolution including Markdown exclusions and Unicode.
- Run/provider-health/lease state machines.
- Context prioritization and deterministic truncation.
- JSONL incremental decoder and provider event mapping.
- Path canonicalization and containment.
- Redaction and error mapping.
- Skill validation/projection/checksums.

### Contract

- Validate every normalized event fixture against JSON Schema.
- Adapter contract suite runs unchanged against fake, Codex fixture parser, and Claude fixture parser.
- Database migration output matches schema invariants.
- WebSocket client/server compatibility and unknown additive fields.

### Integration

- SQLite repositories with real temporary database.
- Atomic message/mention/run creation and idempotent retries.
- Server WebSocket replay and reconnect barriers.
- Run supervisor with fake child processes.
- Cancellation races, timeouts, crash recovery, and backpressure.
- Skill projection into temporary repository trees.
- Attachment upload/reference/traversal behavior.

### UI component

- Composer mentions/skills/keyboard behavior.
- Streaming coalescence and partial terminal states.
- Provider readiness and error cards.
- Context/run inspector.
- Approval card stale/deny/approve flows.
- Accessibility checks with automated tooling plus keyboard tests.

### End-to-end

Default E2E uses fake provider and temporary app-data/workspace directories. Cover first run, room create, `@all`, reload/replay, cancel, search, export, and provider failure.

### Real-provider smoke

Explicitly opt in with environment flags and owner confirmation. Never run in normal CI. Tests use a temporary read-only fixture workspace and cheap bounded prompts. They verify only installation/auth/capability/protocol compatibility, not model answer quality.

## Provider fixtures

Phase 0 captures sanitized fixtures for:

- normal session start/text/completion;
- resume;
- tool activity if observable;
- stderr warning with success;
- auth failure;
- invalid session;
- rate/usage limit if safely reproducible or manually redacted;
- unknown event.

Add synthetic fixtures for chunk fragmentation at every byte boundary, multiple lines per chunk, CRLF, multibyte Unicode split, oversized line, truncated final line, invalid JSON, and schema drift.

Never commit prompts/outputs containing user code, paths, email, account IDs, or tokens.

## Determinism

- Inject clock, ID generator, process runner, filesystem roots, and concurrency scheduler.
- Use fake timers only where they improve clarity; test real event-loop ordering in integration cases.
- Snapshot tests are allowed for stable schemas/rendering, not as a substitute for behavioral assertions.
- Context builder output is byte-for-byte deterministic for fixed inputs.

## Security tests

- Localhost Origin/CSRF/session-token attacks.
- CORS and WebSocket unauthorized connections.
- Shell metacharacters in prompts, paths, handles, model settings, and session IDs.
- Path traversal, alternate separators, case differences, junctions/symlinks, device names.
- Malicious Markdown/HTML/URLs and ANSI sequences.
- Secret-like strings through logs, DB, exports, and diagnostic bundle.
- Oversized JSONL/events/messages/attachments and backpressure.
- Approval replay/hash mismatch.
- Stale PID and lease recovery.

## Performance tests

Targets are measured on a documented reference machine:

- 100k-message database pagination/search remains interactive.
- 20 concurrent fake read-only runs do not block WebSocket heartbeats.
- 1 MB streamed response stays bounded in memory and UI remains responsive.
- Reconnect replay of 10k durable events uses pagination/snapshot fallback.
- Text delta persistence respects coalescing limits.

## Quality gates

Every phase defines additional acceptance. General merge gate after Phase 1:

```text
format/lint clean
strict typecheck clean
unit and contract tests pass
integration tests pass for changed boundaries
production build succeeds
no committed local database, provider fixture secret, or credential
documentation/contract changes included where behavior changed
```

Release candidate additionally requires E2E on Windows, backup/restore drill, crash recovery drill, security checklist, and opt-in provider smoke results recorded by version.

## Test failure discipline

Do not weaken assertions or delete fixtures to accommodate unexplained provider drift. Record the new raw shape safely, update capability mapping, add backward-compatible fixture coverage, and explain the change in a handoff/ADR when semantic.
