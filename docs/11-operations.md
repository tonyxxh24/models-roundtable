# Local operations, diagnostics, and recovery

## Installation model

MVP is a source/developer installation until Phase 6 decides packaging. Requirements:

- pinned active-LTS Node runtime;
- pinned package manager via `packageManager` metadata;
- provider CLIs installed separately by the owner;
- Git optional for read-only chat, required for future worktree mode.

Do not install or update provider CLIs automatically. Detect and explain missing/incompatible versions.

## Runtime directories

Source tree and runtime data are separate. Resolve OS app-data directory through a tested library. Runtime layout:

```text
<app-data>/models-roundtable/
  roundtable.sqlite
  attachments/<sha256>
  backups/
  logs/
  diagnostics/
  instance.json
```

Provider credentials and provider-native session directories are outside this tree.

Development and tests must support an explicit temporary app-data path. Never let tests use the real user database.

## Startup sequence

1. Resolve and permission-check app-data.
2. Acquire single-instance lock for database ownership.
3. Open SQLite, enable pragmas, check integrity/version.
4. Run explicit pending migrations with backup policy.
5. Recover interrupted runs and stale leases.
6. Start HTTP/WebSocket on loopback with an ephemeral or configured safe port.
7. Publish readiness.
8. Probe providers asynchronously; provider delays do not block history UI.

Shutdown stops accepting commands, closes WebSockets after notice, cancels or detaches runs according to policy, waits bounded time, checkpoints WAL, closes database, and releases instance lock.

## Configuration

Precedence:

```text
safe compiled defaults
< local config file
< documented environment variables
< explicit CLI flags
```

Browser requests cannot change process-level bind/data-directory settings. Configuration schema rejects unknown security-sensitive keys and validates bounds. No config value may contain provider credentials.

## Logging

Structured JSON logs locally with human-readable development transport. Common fields: timestamp, level, component, request ID, room/run aliases, event type, duration, safe error code. IDs shown in logs may be shortened aliases; full IDs are acceptable if not provider session IDs.

Default retention is bounded by age and total size. Rotation failure must not crash chat but surfaces a health warning. Prompt/message content logging is disabled by default.

## Health

Health snapshot includes:

- server version/uptime/protocol version;
- database connectivity/schema/integrity timestamp;
- app-data writability and free-space warning;
- WebSocket connection and active/queued run counts;
- adapter status/version/last probe/capability hash;
- stale lease or interrupted-run count;
- projection conflicts.

No secrets, absolute sensitive paths, or transcript text.

## Diagnostics workflow

1. User opens Diagnostics and sees a preview inventory.
2. App runs non-mutating probes with timeouts.
3. Redactor scans structured data and text.
4. Bundle is written locally only after confirmation.
5. UI links to the local file; it is never uploaded automatically.

Bundle may contain app/provider versions, OS/runtime summary, schema version, sanitized config, capability matrix, recent safe error logs, migration history, and integrity results.

## Migrations

- Numbered, checksum-verified, forward-only in release builds.
- Backup before destructive/table-rebuild migrations.
- Migration transaction where SQLite permits.
- Failure leaves prior database usable or clearly enters recovery mode.
- App refuses to open a database from a newer unsupported schema for writes.
- Migration tests cover empty database and every supported prior release fixture.

## Crash recovery

On startup:

- Runs in nonterminal states become `failed` with `interrupted` reason unless a future detached-run mechanism can prove ownership/liveness.
- Partial output remains.
- Stale process records are checked without killing unknown processes.
- Write leases are released only after owned process absence is established.
- Pending projection staging directories are removed only after verifying they are managed temporary paths.
- Idempotency records prevent duplicate accepted messages.

## Backup/restore

- Backup can include database only or database plus managed attachments.
- Manifest has hashes and versions.
- Restore validates into a new data directory and performs integrity check before activation.
- Current data is moved to recoverable backup, never recursively deleted.
- Provider sessions may no longer exist after restore; affected links show `resume unavailable` and support starting a new context session.

## Updates

Application self-update is out of MVP. Show installed app/provider versions and official update guidance. An adapter protocol change is handled as incompatibility rather than attempting an unapproved provider downgrade/update.

## Common runbooks

### Provider is missing

Confirm configured path, `PATH`, version probe, platform installation requirements, then show official install docs. Other providers remain available.

### Authentication required

Do not inspect credential files. Ask owner to complete provider-owned login in a terminal, then re-probe.

### Provider output changed

Capture a sanitized opt-in fixture, compare with contract fixtures, preserve unknown event tolerance, update adapter/parser/tests, and record capability hash/version.

### Database locked

Check single-instance lock and other process, wait bounded busy timeout, offer read-only recovery/diagnostics. Never delete WAL/SHM files while database may be active.

### Corrupt database

Stop writes, copy all SQLite files to recovery area, run integrity diagnostics on the copy, restore latest verified backup or export recoverable data. Never overwrite the only copy.
