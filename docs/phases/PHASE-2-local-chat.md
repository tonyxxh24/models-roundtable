# Phase 2 — Local chat with deterministic fake provider

## Objective

Deliver the complete provider-neutral chat loop—rooms, participants, mentions, runs, streaming, persistence, replay, cancellation, search, and export—using only the fake adapter.

## Preconditions

Phase 1 quality gates pass.

## Read first

- Product requirements FR-1 through FR-5 and FR-8/9.
- `docs/05-routing-and-context.md`
- `docs/08-api-and-realtime.md`
- `docs/09-frontend-ux.md`
- ADR-0005 and ADR-0008

## Deliverables

- Domain state machines and application services.
- Markdown-aware mention parser.
- Fake adapter and run supervisor.
- HTTP/WebSocket v1 message/run/replay protocol.
- Room list, room timeline, composer, streaming message, stop/retry, run/context inspector.
- SQLite repositories, FTS search, versioned JSON/Markdown export.
- Crash/reconnect/idempotency behavior using fake processes.

## Work items

### 2.1 Domain and persistence

Implement rooms, participants, messages, mentions, context snapshots, runs, room/run events, idempotency, and provider session records. `message.send` transaction creates message and queued runs before acknowledgement.

### 2.2 Router/context

- Tokenize Markdown exclusions.
- Resolve aliases/groups deterministically.
- Capture one room sequence for fan-out.
- Implement deterministic new/resume context manifests and truncation.
- No hidden summarizer or output-triggered routing.

### 2.3 Fake adapter/supervisor

- Scripted streaming, sessions/resume, tools, approvals placeholder, failures, hangs, cancellation.
- Per-session serialization and global concurrency limit.
- Persist coalesced deltas; final canonical message once.
- Startup recovery marks interrupted runs and keeps partial output.

### 2.4 Protocol

- WebSocket authentication, accepted/rejected command replies, event IDs/sequences.
- Reconnect replay barrier, deduplication, active run snapshot.
- Bounded connection queues and delta coalescing.

### 2.5 UI

- First-run fake-provider path.
- Rooms and participant chips.
- Mention/skill-ready composer (`$` may show empty state).
- Correct scroll/focus behavior during streaming.
- Status/error/partial states and accessible live regions.
- Context inspector with exact manifest sources.

### 2.6 Search/export

- FTS room-scoped search with snippets.
- Markdown export and versioned JSON export preserving IDs/order/attribution.
- Exclude secrets/raw diagnostics by design.

## Acceptance criteria

- [ ] End-to-end fake-provider scenarios in product requirements pass.
- [ ] `@all` creates independent runs with identical input room sequence.
- [ ] Agent output cannot create another run.
- [ ] Duplicate command returns original entities and creates no duplicate run.
- [ ] Restart/reconnect preserves room and reconstructs active/interrupted state.
- [ ] Cancellation keeps partial response and next run succeeds.
- [ ] Parser fragmentation/malformed fixtures cannot crash server.
- [ ] Search/export order and attribution match canonical history.
- [ ] Keyboard and automated accessibility checks pass for core flow.
- [ ] Full lint/typecheck/test/build gate passes without real provider access.

## Non-goals

Real provider CLIs, skills projection, workspace writes, approvals, LAN access.

## Handoff

Attach E2E evidence and protocol examples. Activate Phase 3 only when real adapters can plug in without UI/core changes.
