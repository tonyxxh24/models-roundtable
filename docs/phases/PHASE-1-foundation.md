# Phase 1 — Repository foundation

## Objective

Create the minimal typed monorepo, contract package, database migration system, and loopback server/web shells without implementing real provider behavior.

## Preconditions

Phase 0 is complete with a capability report and at least one GO provider.

## Read first

- `docs/02-system-architecture.md`
- `docs/03-domain-and-storage.md`
- `docs/08-api-and-realtime.md`
- `docs/10-testing.md`
- ADR-0001, ADR-0003, ADR-0004

## Deliverables

- Root workspace/package metadata with pinned package manager and active-LTS runtime policy.
- `apps/server`, `apps/web`, and packages listed in architecture (empty packages may be deferred only with explanation).
- Strict shared TypeScript, lint, format, test, and build configuration.
- Runtime validation schemas generated/implemented from `contracts/`.
- SQLite connection, migration runner, initial migration, and temporary-test DB helper.
- Loopback-only server with `/api/v1/health` and authenticated bootstrap/session skeleton.
- Web shell that renders server readiness.
- Architecture boundary tests/lint rules.
- `.env.example` only for non-secret documented development values.

## Work items

### 1.1 Toolchain

- Select current stable compatible versions and pin them in manifest/lockfile.
- Use pnpm workspaces.
- Configure strict TypeScript, consistent module format, source maps, and project references if useful.
- One command each for dev, lint, typecheck, unit test, integration test, and build.

### 1.2 Contracts

- Move/copy planning contracts into `packages/contracts` as runtime types and schemas.
- Keep version 1 envelope and stable error codes.
- Add schema validation tests and generation drift check against root contract artifacts.

### 1.3 Database

- Implement explicit numbered migration `0001` equivalent to target DDL needed so far.
- Create repository interfaces; do not leak ORM rows to core/UI.
- Enable/check foreign keys, WAL, busy timeout.
- Test empty migration, reopen, rollback-on-failure behavior, and isolation from real app-data.

### 1.4 Server security shell

- Bind only `127.0.0.1` by default and reject non-loopback configuration in this phase.
- Add request IDs, body limits, Origin allowlist, strict CORS behavior, safe errors, and local bootstrap session design.
- No arbitrary command execution endpoint.

### 1.5 Web shell

- Same-origin API client with protocol version check.
- Accessible loading/ready/error states.
- No provider-specific imports or fake hard-coded secrets.

## Non-goals

Rooms, composer, WebSocket runs, provider spawning, skills, writes, collaboration, and packaging.

## Acceptance criteria

- [ ] Clean install from lockfile succeeds.
- [ ] `lint`, `typecheck`, `test`, and `build` pass.
- [ ] Server listens on loopback and health response validates.
- [ ] Cross-origin unauthorized request is rejected.
- [ ] Migration creates expected schema in temporary DB and never touches user DB in tests.
- [ ] Dependency-boundary test prevents UI/core from importing provider implementations.
- [ ] Web shell reports server/protocol status accessibly.
- [ ] No provider or app credentials are stored.

## Handoff

Record chosen versions, commands, package boundaries, migration checksum, and any deviation from target layout. Activate Phase 2.
