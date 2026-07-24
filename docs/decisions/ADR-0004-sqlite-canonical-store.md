# ADR-0004: SQLite is the canonical local store

- Status: Accepted
- Date: 2026-07-23

## Context

The application needs durable rooms, messages, runs, replay, search, migrations, and backup without an external database.

## Decision

Use SQLite with WAL, foreign keys, explicit migrations, current-state tables, durable room/run event logs, and FTS5. Browser storage is never authoritative. Provider-owned session storage remains external.

## Consequences

Single-machine use is excellent and backups are portable. Writes require short transactions and single-instance coordination. Hosted multi-node use would require a different persistence ADR.
