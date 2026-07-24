# Models Roundtable

Models Roundtable is a local-first web application for placing a human and
multiple coding-agent participants in one persistent chat room. The intended
experience is a message such as `@codex review this repository` or
`@claude challenge the previous answer`, routed to a named local provider
process and recorded in a local SQLite database.

## Current demo status

Phase 2 is complete. The repository currently provides a demo-ready local chat
MVP using a deterministic in-process fake provider. It does **not** invoke
Codex CLI or Claude Code yet.

The demo supports:

- local rooms and persistent SQLite history;
- `@fakeA`, `@fakeB`, and `@all` fan-out;
- streamed output, cancellation, partial responses, and retry;
- reconnect replay, context inspection, FTS search, and JSON/Markdown export;
- loopback-only HTTP/WebSocket communication.

The next gated work is the Codex Personal Mode adapter. See
[project status](docs/STATUS.md) and [the Phase 3 specification](docs/phases/PHASE-3-codex.md).

## Install, validate, and run the demo

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

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The API server binds only
to `127.0.0.1:4317`; Vite proxies `/api` requests during development. Press
`Ctrl+C` in the terminal to stop both processes.

Runtime data is stored outside the repository by default at
`~/.roundtable-data`. To choose a different local directory, set
`MODELS_ROUNDTABLE_DATA_DIR` before starting the server; do not point it at the
repository. See [.env.example](.env.example).

### Opt in to the read-only Codex agent

Codex is never added to rooms by default. Start the app from PowerShell with an
absolute, owner-selected workspace:

~~~powershell
$env:MODELS_ROUNDTABLE_CODEX_WORKSPACE = 'C:\path\to\a\project'
pnpm dev
~~~

After the readiness panel reports Codex as ready, use **Add @codex to this
room**. New Codex turns use the verified read-only sandbox. Resume remains
disabled until the installed CLI exposes a verified read-only resume
invocation. Never configure a filesystem root or use a `dangerously-*` flag.

## Product boundary

- Personal Mode may wrap official Codex CLI and Claude Code CLI installations
  already authenticated by the machine owner.
- Provider credentials remain in provider-owned credential stores and are never
  copied into the application database.
- Codex CLI 0.145.0 is GO WITH LIMITATIONS for explicit, owner-only read-only
  sessions; the app performs no provider login and stores no credentials.
- Skills, `AGENTS.md`/`CLAUDE.md` projection, and workspace permissions are
  Phase 5 work; release hardening is Phase 6; human collaboration is Phase 7.
- The product remains local-only, read-only by default, and single-owner until
  those later gates are completed.

## Implementation workflow

1. Read [PROJECT_RULES.md](PROJECT_RULES.md).
2. Read [docs/INDEX.md](docs/INDEX.md).
3. Check [docs/STATUS.md](docs/STATUS.md) for the active phase and blockers.
4. Use [docs/NEXT_AGENT_PROMPT.md](docs/NEXT_AGENT_PROMPT.md) as the next-agent brief.
5. Execute exactly one phase from [docs/phases/](docs/phases/).
6. Record decisions and a handoff before stopping.

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
- Risks/policy: `docs/13-risks-and-policy.md`
