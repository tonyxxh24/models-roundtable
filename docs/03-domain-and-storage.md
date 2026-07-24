# Domain model and local storage

## Aggregate boundaries

### Room aggregate

Owns room metadata, participants, canonical message/event ordering, workspace binding, and room policies. Commands that change a room must verify the caller and expected room version.

### Run aggregate

Owns one agent turn, provider session linkage, context snapshot, lifecycle, cancellation, output assembly, and errors. A run belongs to exactly one room and target agent.

### Workspace aggregate

Owns canonical path, access policy, trust state, and write leases. Paths are identities only after canonicalization.

### Skill aggregate

Owns canonical source, validation result, checksum, target projections, and divergence state.

## Entity summary

| Entity | Key fields | Notes |
|---|---|---|
| Room | id, title, workspace_id, next_sequence | Soft-archived, not silently deleted |
| Participant | id, room_id, handle, kind | Handle uniqueness is case-insensitive per room |
| Agent profile | id, adapter_id, persona, permission profile | Reusable; room participant references it |
| Message | id, room_id, author_id, body, reply_to | Immutable canonical content; revisions are events |
| Mention | message_id, participant_id, source span | Stores parsed and resolved target |
| Provider session | id, adapter_id, opaque_external_id | External ID treated as opaque, potentially sensitive metadata |
| Run | id, trigger_message_id, target_id, state | One target per run |
| Run event | id, run_id, type, payload | Normalized, ordered per run |
| Context snapshot | id, room_sequence, manifest | Explains inputs without storing hidden reasoning |
| Attachment | id, content_hash, media_type, storage path | Managed copy or validated reference |
| Workspace lease | workspace_id, run_id, mode, expiry | Exclusive for write; recoverable after crash |
| Skill | id, canonical_path, checksum | Projection state tracked separately |

## Invariants

1. Durable IDs are application-generated UUIDv7 values; database row IDs are never exposed separately.
2. A room sequence increases monotonically and is assigned in the same transaction as the event.
3. A message belongs to one room and its reply target, if any, belongs to the same room.
4. A run target is an enabled agent participant in the triggering room.
5. A run reaches exactly one terminal state: `completed`, `failed`, or `cancelled`.
6. A final agent message is authored by the target participant and linked to exactly one run.
7. A provider session belongs to one agent profile and workspace identity. It is never silently reused across different workspaces.
8. At most one active write lease exists per workspace.
9. An attachment exposed to a provider has passed path, size, type, and policy validation.
10. Credentials and complete process environments are forbidden data, not merely redacted fields.

## State machines

### Run

```text
queued -> starting -> running -> completed
   |         |          |  \
   |         |          |   -> waiting_approval -> running
   |         |          -> cancelling -> cancelled
   |         -> failed
   -> cancelled
running/waiting_approval/cancelling -> failed
```

Late provider events after a terminal state are logged as diagnostics and never reopen the run. Duplicate terminal events are idempotently ignored.

### Provider health

```text
unknown -> probing -> ready
                  -> missing
                  -> auth_required
                  -> incompatible
                  -> error
ready -> rate_limited -> ready
ready -> error -> probing
```

### Skill projection

```text
unprojected -> clean
clean -> source_changed -> clean
clean -> target_diverged -> conflict
conflict -> clean only after explicit resolution
```

## Persistence strategy

SQLite is both the command store and query store for the local release. This is not full event sourcing: current-state tables remain authoritative, while `room_events` and `run_events` provide ordered replay/audit information.

Configuration at connection startup:

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
```

Use one migration runner and numbered forward migrations. Never perform schema mutation implicitly from ORM model synchronization.

## Atomic command boundary

`SendMessage` must transact:

1. idempotency-key lookup;
2. room existence and expected version check;
3. participant/mention resolution snapshot;
4. user message insert;
5. room event and sequence assignment;
6. zero or more queued run inserts;
7. durable acknowledgement record.

Provider processes start only after commit. A failed commit therefore cannot consume provider usage.

## Streaming persistence

Text deltas are high volume. Broadcast each received delta but persist coalesced chunks by either 250 ms or 4 KiB, whichever occurs first. State transitions and approvals persist immediately. At completion, assemble and persist the canonical agent message in a transaction with the terminal run state.

After a crash, persisted partial chunks remain attached to the interrupted run and render with an incomplete marker.

## Search

Use SQLite FTS5 over canonical message bodies and room titles. Do not index raw provider events, tool outputs excluded by retention policy, attachment binary content, or diagnostic bundles. Search results must enforce room visibility before returning snippets.

## Attachments

Two storage modes:

- `managed`: copy content into the application data directory, named by content hash; preferred for pasted/uploaded files.
- `workspace_reference`: store canonical workspace-relative path plus observed hash/mtime; revalidate before every use.

Default limits are configuration, not scattered constants. Phase 2 sets conservative text/image limits. Binary executables, device paths, named pipes, and symlinks escaping allowed roots are rejected.

## Retention and deletion

- Archive hides a room but retains it.
- Delete creates a tombstone and schedules recoverable removal from the app's trash area.
- Managed attachment blobs are reference-counted and removed only when no retained entity references them.
- Provider-native session files are provider-owned and never deleted by Roundtable.
- Diagnostic raw events have a short configurable TTL and are opt-in.
- Exports are user-owned files; the app never deletes them automatically.

## Backup and restore

Backup uses SQLite's online backup mechanism or `VACUUM INTO` while the server coordinates writes. A backup manifest records schema version, app version, created time, and attachment inventory. Restore validates compatibility and restores into a new location before switching; never overwrite the only working database.

## Reference schema

`contracts/database.sql` is the normative target schema. Migrations may implement it incrementally, but a completed release must produce an equivalent schema and enforce all application-level invariants with tests.
