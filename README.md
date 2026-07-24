# Models Roundtable

Models Roundtable is a local-first web application for placing human participants and multiple coding-agent CLIs in one persistent chat room. A message such as `@codex review this repository` or `@claude challenge the previous answer` is routed to the named local provider process, streamed into the room, and recorded in a local SQLite database.

Phase 1 provides the local application foundation: a React/Vite web readiness
shell, a Fastify loopback server, shared runtime contracts, and SQLite
migrations. Persistent rooms, provider processes, skills, and collaboration are
implemented only in their later gated phases.

## Install and validate

Requirements: Node.js 22.14 or newer within the 22.x line, and pnpm 11.9.0.

~~~powershell
corepack enable
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm dev
~~~

The application binds its server only to 127.0.0.1. The Phase 1 UI reports
whether the local server is ready; it is not a chat UI yet. Runtime data is
created only when the server runs, outside the repository by default, or at the
non-secret directory selected with MODELS_ROUNDTABLE_DATA_DIR.

## Implementation workflow

1. Read [PROJECT_RULES.md](PROJECT_RULES.md).
2. Read [docs/INDEX.md](docs/INDEX.md).
3. Check [docs/STATUS.md](docs/STATUS.md) for the active phase.
4. Give the next model [docs/NEXT_AGENT_PROMPT.md](docs/NEXT_AGENT_PROMPT.md), or use it as the task brief.
5. Execute exactly one phase from [docs/phases/](docs/phases/).
6. Record decisions and handoff notes before stopping.

## Product boundary

- Personal Mode may wrap official Codex CLI and Claude Code CLI installations already authenticated by the machine owner.
- Provider credentials remain in provider-owned credential stores and are never copied into the application database.
- Claude subscription authentication is not a supported distribution mechanism for a third-party product. The Claude subscription adapter is a personal/local experiment only unless Anthropic provides approval.
- The first release is local-only, read-only by default, and single-owner.
- Human collaboration, LAN access, write access, and Git worktree isolation arrive only in later gated phases.

## Blueprint map

- Product: `docs/00-vision.md`, `docs/01-product-requirements.md`
- Architecture: `docs/02-system-architecture.md`
- Data: `docs/03-domain-and-storage.md`, `contracts/database.sql`
- Providers: `docs/04-provider-adapters.md`, `contracts/provider-adapter.ts`
- Routing/context: `docs/05-routing-and-context.md`
- Skills/instructions: `docs/06-skills-and-instructions.md`
- Security: `docs/07-security-and-permissions.md`
- Protocol: `docs/08-api-and-realtime.md`, `contracts/events.schema.json`
- UX: `docs/09-frontend-ux.md`
- Quality/operations: `docs/10-testing.md`, `docs/11-operations.md`
- Execution: `docs/12-roadmap.md`, `docs/phases/`
- Risks/legal: `docs/13-risks-and-policy.md`
- Architectural decisions: `docs/decisions/`

## Status

Planning is complete and Phase 1 is implemented. Continue only from the active
phase recorded in [docs/STATUS.md](docs/STATUS.md).
