# Local HTTP and realtime protocol

## Principles

- Server is authoritative; the browser is a replaceable client.
- JSON payloads are schema-validated at ingress and egress in development/tests.
- Commands are idempotent; events are ordered and replayable.
- Provider-native payloads never cross this boundary.
- The protocol is versioned from its first implementation.

## Transport

- HTTP JSON for snapshots, settings, uploads, exports, and health.
- WebSocket for commands requiring immediate acknowledgement and realtime events.
- Production serves UI and API from the same loopback origin.
- Payload compression is optional; message size limits are mandatory.

## Envelope

Every server event follows `contracts/events.schema.json`:

```json
{
  "v": 1,
  "eventId": "019...",
  "type": "run.text_delta",
  "occurredAt": "2026-07-23T12:00:00.000Z",
  "roomId": "019...",
  "roomSequence": 42,
  "runId": "019...",
  "payload": {}
}
```

Transient text deltas may have no room sequence until coalesced persistence; they still have event ID and run-local sequence. Durable lifecycle/message events always have room sequence.

## Client command envelope

```json
{
  "v": 1,
  "commandId": "client-uuid",
  "idempotencyKey": "client-generated-uuid",
  "type": "message.send",
  "roomId": "019...",
  "expectedRoomVersion": 17,
  "payload": {}
}
```

Server responds with `command.accepted` containing canonical IDs or `command.rejected` containing a stable error code, safe message, and current room version when relevant.

## Core event names

```text
connection.ready
command.accepted
command.rejected
room.created
room.updated
room.archived
participant.updated
message.created
message.revised
message.tombstoned
run.queued
run.started
run.session_bound
run.text_delta
run.tool_started
run.tool_updated
run.tool_finished
run.approval_required
run.approval_resolved
run.warning
run.completed
run.failed
run.cancelled
provider.health_changed
workspace.lease_changed
skill.projection_changed
```

## Initial HTTP surface

```text
GET    /api/v1/health
GET    /api/v1/providers
POST   /api/v1/providers/:id/probe
GET    /api/v1/rooms
POST   /api/v1/rooms
GET    /api/v1/rooms/:roomId
PATCH  /api/v1/rooms/:roomId
GET    /api/v1/rooms/:roomId/messages?before=&limit=
POST   /api/v1/rooms/:roomId/export
POST   /api/v1/rooms/:roomId/attachments
GET    /api/v1/runs/:runId/context
POST   /api/v1/runs/:runId/cancel
GET    /api/v1/workspaces
POST   /api/v1/workspaces
GET    /api/v1/skills
POST   /api/v1/skills/validate
POST   /api/v1/skills/project
GET    /api/v1/diagnostics/preview
POST   /api/v1/backups
```

Exact request/response schemas are implemented in the contracts package during Phase 1. Do not generate a broad CRUD API when a task-specific command suffices.

## WebSocket commands

MVP:

```text
connection.resume { afterRoomSequences: { roomId: sequence } }
message.send { body, replyToMessageId?, attachmentIds?, inferredTargetIds? }
run.cancel { runId }
provider.probe { adapterId }
```

Phase 5:

```text
approval.resolve { runId, approvalId, decision, requestHash }
```

## Ordering

- Room sequence orders durable events in one room.
- Run-local sequence orders all events, including transient deltas, within one run.
- No global ordering is promised across rooms.
- A message is displayed canonically by room sequence, not client arrival time.
- `@all` output ordering follows event arrival while retaining independent run identities.

## Reconnection and replay

Client stores last rendered durable sequence in memory and may cache it locally for convenience, but server snapshot is authoritative.

On reconnect:

1. authenticate session and validate Origin;
2. client sends last sequence per open room;
3. server replays durable events in bounded pages;
4. server sends active run snapshots and latest run-local sequence;
5. live stream begins after a replay barrier;
6. client deduplicates by event ID.

If replay history is compacted or too large, server returns `snapshot_required`; client fetches room snapshot and resumes from its sequence.

## Backpressure

Per connection, maintain a bounded queue. Coalesce consecutive `run.text_delta` events for the same run. Never drop terminal, approval, error, message, or lease events. If a client cannot keep up, close with a retryable code and require snapshot/replay.

## Error format

```json
{
  "code": "provider_auth_required",
  "message": "Claude Code requires authentication in the owner's terminal.",
  "retryable": false,
  "requestId": "019...",
  "details": { "adapterId": "claude" }
}
```

Details use an allowlist and never contain raw exception objects, stack traces in production responses, environment data, or raw provider output.

## Compatibility

- Additive optional fields are backward compatible within protocol v1.
- Removing/renaming fields or changing semantics requires a new protocol version.
- Unknown event types are ignored with diagnostics by older clients.
- Server advertises minimum/maximum supported client protocol during bootstrap.
