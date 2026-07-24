# Architectural decision records

Accepted ADRs document durable decisions that later implementation agents must preserve.

## Process

- Never edit the decision or consequences of an accepted ADR to make history look current.
- To change a decision, add a new numbered ADR with `Supersedes: ADR-xxxx`, update affected design/contracts, and explain migration impact.
- Use states `Proposed`, `Accepted`, `Rejected`, or `Superseded`.
- Small implementation details that do not affect public behavior, boundaries, persistence, security, or future phases do not need an ADR.

## Accepted decisions

- ADR-0001 — Local modular monolith
- ADR-0002 — Provider-native authentication boundary
- ADR-0003 — Normalized provider events
- ADR-0004 — SQLite canonical store
- ADR-0005 — Explicit routing only
- ADR-0006 — Read-only and exclusive write lease
- ADR-0007 — Canonical skills with projections
- ADR-0008 — No hidden model calls
