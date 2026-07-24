# Product requirements

## Personas

### Owner

Installs the application and provider CLIs, selects workspaces, configures agents, controls permissions, and owns local data.

### Human participant

Posts and reads messages. In Personal Mode this is only the owner. Collaboration Mode may add guests with constrained capabilities.

### Agent participant

A named configuration backed by one adapter. Multiple aliases may use the same provider but maintain different sessions, personas, skills, or permissions.

## Core user stories

- As an owner, I can create a room attached to a workspace.
- I can type `@codex explain the architecture` and see a streamed, attributed response.
- I can ask `@claude review @codex's answer` by replying to or explicitly referencing a message.
- I can use `@all` and receive independent responses created from the same room snapshot.
- I can stop a running turn without stopping the server or corrupting the room.
- I can restart the app and resume provider sessions when the provider supports it.
- I can inspect which messages and instructions were included in a run's context pack.
- I can see that an agent is unavailable before sending work to it.
- I can search, archive, export, and recover local conversations.
- I can add a reusable skill and project instructions without pasting them into every prompt.

## Functional requirements

### FR-1 Rooms and messages

- Rooms have stable IDs, title, timestamps, optional workspace, and archive state.
- Messages are immutable after creation in the canonical log. Edits create revision events; deletion is a tombstone.
- Messages support Markdown text, reply reference, mentions, attachments, and author attribution.
- Every durable room event receives a monotonically increasing room sequence.

### FR-2 Participants and mentions

- Participant handles are unique per room, case-insensitive, and normalized without the leading `@`.
- Supported participant kinds are `human`, `agent`, and `system`.
- The parser ignores mentions inside fenced code, inline code, and escaped text.
- `@all`, `@models`, and `@humans` expand deterministically to authorized participants.
- Unknown mentions remain text and produce a non-blocking composer warning.

### FR-3 Runs

- Each target agent produces a separate run with its own status, provider session, context snapshot, and errors.
- Run states: `queued`, `starting`, `running`, `waiting_approval`, `cancelling`, `completed`, `failed`, `cancelled`.
- State transitions are validated and idempotent.
- A run may be retried as a new run linked by `retry_of_run_id`.
- A partial response remains visible and marked incomplete after failure/cancellation.

### FR-4 Provider lifecycle

- Detect command availability and version without mutating user configuration.
- Report `available`, `missing`, `auth_required`, `ready`, `rate_limited`, `incompatible`, or `error`.
- Stream normalized events and retain unknown raw event metadata only in opt-in debug mode.
- Resume a provider session when supported; otherwise start a new session with an explicit context pack.
- Never put provider credentials in commands, URLs, logs, database rows, browser storage, or exported transcripts.

### FR-5 Context

- Context construction is deterministic for a given room sequence and configuration.
- New sessions receive room brief, selected relevant messages, reply targets, shared instructions, and run request.
- Resumed sessions receive only the new turn plus explicit cross-agent references; do not replay the whole room.
- Context inspection shows source message IDs and truncation decisions, not hidden chain-of-thought.
- MVP performs no hidden summarization model calls.

### FR-6 Skills and instructions

- Shared skills use a canonical `SKILL.md` directory and project into provider-native locations.
- Projection is explicit, previewable, checksummed, and reversible.
- Shared room instructions, Codex `AGENTS.md`, and Claude `CLAUDE.md` remain distinguishable in the UI.
- Provider-native files are never overwritten if they diverged unless the owner approves a merge.

### FR-7 Workspace and permissions

- Workspace paths are canonicalized and validated before persistence.
- Read-only is default for every agent and room.
- Write access requires an owner action, a visible scope, and an exclusive lease.
- The app never requests or uses dangerous bypass flags by default.
- Attachments and file references cannot escape their allowed roots through traversal or symlinks.

### FR-8 Local persistence

- SQLite is the canonical application store with migrations and foreign keys enabled.
- WAL mode supports concurrent readers and one writer.
- FTS indexes searchable message text without indexing secrets intentionally excluded from storage.
- Export supports Markdown and versioned JSON.
- Backup and restore are documented and tested before release candidate.

### FR-9 UX and accessibility

- Keyboard-first composer with mention and skill autocomplete.
- Streaming content does not steal focus or force scroll when the user has scrolled upward.
- Status is never conveyed by color alone.
- Reduced-motion and screen-reader states are supported.
- Destructive or privilege-increasing actions require explicit confirmation.

## Non-functional requirements

- **Startup**: warm local startup target under 2 seconds excluding provider probes.
- **Streaming**: display text within 100 ms of receipt under normal local load.
- **Durability**: accepted user messages survive server crash once acknowledged.
- **Compatibility**: Windows is first-class; process code must also avoid unnecessary Windows-only assumptions.
- **Resilience**: one malformed JSONL line fails or degrades one run, not the room/server.
- **Privacy**: telemetry is off by default; diagnostic export is previewable and redacted.
- **Maintainability**: no imports from provider packages into web UI; core depends on contracts only.

## Acceptance scenarios

1. Send one message to Codex; restart; continue the same provider session.
2. Send `@all`; both runs use the same input room sequence and finish independently.
3. Cancel Claude mid-stream; partial text remains, process exits, next run works.
4. Feed fragmented, combined, unknown, and malformed JSONL fixtures; parser remains deterministic.
5. Remove one CLI; app starts and other agents remain usable.
6. Attempt `../` attachment traversal; request is rejected and audited.
7. Simulate two write requests; exactly one lease is granted.
8. Search and export a room; ordering and attribution match the canonical log.
