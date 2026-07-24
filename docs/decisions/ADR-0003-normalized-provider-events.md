# ADR-0003: Normalize provider events at adapters

- Status: Accepted
- Date: 2026-07-23

## Context

Codex and Claude expose different JSONL shapes, tool events, exit behavior, and session semantics. Direct UI/core dependencies would make every provider update cross-cutting.

## Decision

Adapters implement `contracts/provider-adapter.ts` and emit only normalized, versioned events. Core/UI never consume provider-native payloads. Unknown native events are tolerated and available only in opt-in sanitized diagnostics.

## Consequences

Adapters require comprehensive fixtures and explicit mapping. Some provider detail may be intentionally omitted. Adding a provider does not change room orchestration when the normalized contract suffices.
