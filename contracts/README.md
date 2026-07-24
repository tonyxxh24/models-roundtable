# Normative contracts

These files make the planning blueprint precise before application scaffolding exists.

- `provider-adapter.ts`: provider-neutral TypeScript contract.
- `events.schema.json`: version 1 realtime event envelope.
- `database.sql`: target SQLite schema.

## Rules

- Implementation packages may copy these into generated/runtime schemas during Phase 1, then make the package source canonical. Until then these files are normative.
- A breaking change requires a new contract version and ADR.
- Additive optional event fields are allowed within v1.
- Database changes occur through numbered migrations; update this target schema in the same change.
- Contracts must have automated validation tests once tooling exists.
- Do not add provider-native fields to shared contracts merely to avoid adapter mapping.
