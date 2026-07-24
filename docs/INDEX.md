# Documentation index

This index is the navigation and precedence guide for implementation agents.

## Read order

1. [Status](STATUS.md) — current phase and known blockers.
2. [Vision](00-vision.md) — product identity and fixed boundaries.
3. [Product requirements](01-product-requirements.md) — users, use cases, functional requirements.
4. [System architecture](02-system-architecture.md) — modules, deployment, execution paths.
5. The document relevant to the task.
6. The active [phase package](phases/).

## Design documents

| Document | Owns |
|---|---|
| [03 Domain and storage](03-domain-and-storage.md) | Entities, invariants, retention, database behavior |
| [04 Provider adapters](04-provider-adapters.md) | Codex/Claude process integration and normalization |
| [05 Routing and context](05-routing-and-context.md) | Mentions, fan-out, sessions, context assembly |
| [06 Skills and instructions](06-skills-and-instructions.md) | Shared skills, AGENTS.md, CLAUDE.md, projection |
| [07 Security and permissions](07-security-and-permissions.md) | Trust boundaries, workspace access, approval model |
| [08 API and realtime](08-api-and-realtime.md) | HTTP/WebSocket protocol, sequencing, idempotency |
| [09 Frontend UX](09-frontend-ux.md) | Screens, states, accessibility, interaction contracts |
| [10 Testing](10-testing.md) | Test pyramid, fixtures, provider smoke tests, gates |
| [11 Operations](11-operations.md) | Startup, diagnostics, migrations, backup, recovery |
| [12 Roadmap](12-roadmap.md) | Phase ordering and release milestones |
| [13 Risks and policy](13-risks-and-policy.md) | Product, technical, privacy, and provider-policy risks |
| [Glossary](GLOSSARY.md) | Stable terminology |
| [References](REFERENCES.md) | Official provider sources and verification date |

## Normative contracts

- `contracts/provider-adapter.ts` — adapter interface and normalized event types.
- `contracts/events.schema.json` — wire-event JSON Schema.
- `contracts/database.sql` — target SQLite schema and invariants.
- `contracts/README.md` — contract versioning rules.

## Execution material

- [Next agent prompt](NEXT_AGENT_PROMPT.md) — pasteable starting brief for the next model.
- `docs/phases/PHASE-0-spike.md` through `PHASE-7-collaboration.md`
- `docs/templates/HANDOFF.md`
- `docs/handoffs/` — implementation agents add timestamped handoffs here.
- `docs/decisions/` — immutable architectural decision records.

## Change discipline

Planning documents describe intent. Contracts and accepted ADRs are authoritative. A later implementation may expose a missing assumption; capture it in a new ADR and update affected documents in the same change.
