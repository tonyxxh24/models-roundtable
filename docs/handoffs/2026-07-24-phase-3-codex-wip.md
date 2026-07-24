# Phase handoff

- Date/time: 2026-07-24
- Phase: 3 - Codex Personal Mode adapter
- Agent/model: Codex
- Working tree/branch: `main`, uncommitted Phase 3 work
- Status: In progress

## Outcome first

An owner-interactive Windows probe establishes Codex CLI 0.145.0 as usable for
new read-only JSONL sessions. The repository now has sanitized Codex fixtures,
an updated capability report, and a tested `provider-codex` process adapter
that uses stdin, argument arrays, `shell: false`, `--json`, and
`--sandbox read-only`.

The adapter rejects workspace writes. Official Codex documentation plus the
installed `resume -c key=value` option now establish a candidate read-only
resume argv using `sandbox_mode="read-only"`. Its builder and disabled-by-default
feature gate are tested, but the server will not enable it until the owner runs
the documented write-denial smoke. This blocks Phase 3 completion, not the fake
provider demo.

## Scope completed

- Recorded owner-terminal Codex 0.145.0 Phase 0 evidence and sanitized fixture
  corpus.
- Marked Phase 3 precondition satisfied and activated the phase.
- Implemented incremental JSONL event normalization for observed session and
  agent-message events.
- Implemented safe spawn, stdin prompt delivery, bounded stderr classification,
  and owned-child cancellation escalation.
- Added fixture and permission-boundary tests.
- Generalized queued runs, session persistence, and core supervision by
  `adapterId` while preserving fake-provider defaults.
- Propagated each agent profile's normalized permission through queued work to
  the selected adapter; fake agents remain `chat_only` by default.
- Added a bounded version/help readiness probe, authenticated local API, and
  frontend status display. Tests inject the probe and never call real Codex.
- Added explicit workspace configuration and a per-room owner action for
  creating `@codex`; default rooms and `@all` remain fake-only.
- Added a shell-free resume argv builder using the documented read-only config
  key, guarded by `verifiedReadOnlyResume` with a default of false.
- Added successful/idempotent Codex participant and missing-adapter tests.
- Added an owner-only adapter smoke runner covering start, normalized complete,
  resume by opaque session ID, cancellation, and final empty-workspace check.
  It requires an exact post-probe attestation and never runs in CI.

## Files changed

- `docs/generated/CODEX-OWNER-TERMINAL-UPDATE.md`: owner-terminal evidence.
- `docs/generated/provider-capabilities.json`: Codex GO WITH LIMITATIONS.
- `docs/generated/PROVIDER-SPIKE-REPORT.md`: updated Phase 0 decision.
- `fixtures/providers/codex/0.145.0/`: sanitized observed and synthetic fixtures.
- `packages/provider-codex/src/index.ts`: safe Codex CLI adapter.
- `packages/provider-codex/src/index.test.ts`: fixture and boundary tests.
- `packages/provider-codex/src/owner-smoke.ts`: guarded real-adapter smoke runner.
- `packages/provider-codex/SMOKE.md`: owner-only, opt-in smoke procedure.
- `packages/core/src/run-supervisor.ts`: provider registry routing.
- `packages/db/src/rooms.ts`: adapter-aware profiles, queues, and sessions.
- `apps/server/src/app.ts`: authenticated Codex readiness endpoint.
- `apps/web/src/App.tsx`: safe Codex readiness/version display.
- `.env.example`, `README.md`: explicit absolute workspace and opt-in flow.
- `package.json`: cross-platform Prettier line-ending check.
- `packages/provider-codex/package.json`, `pnpm-lock.yaml`: local contracts dependency.

## Decisions and deviations

- ADRs referenced: ADR-0002, ADR-0003, ADR-0006.
- Resume remains disabled at server composition until the owner verifies the
  documented `-c sandbox_mode="read-only"` invocation denies writes.
- The server has a provider registry and adapter-aware persistence. Codex is
  included only when an absolute workspace is explicitly configured.

## Verification evidence

| Command/test | Result | Notes |
|---|---|---|
| Owner `codex --version` | Pass | `codex-cli 0.145.0` |
| Owner new session/read-only | Pass | Fixed reply, no files created |
| Owner resume with `--last` | Pass | Fixed reply, no files created |
| Owner invalid resume | Pass | `no rollout found`, code `-32600` |
| Owner Ctrl+C | Pass | Exit code `-1`, workspace empty |
| `pnpm --filter @models-roundtable/provider-codex run build` | Pass | Run after restoring locked dependencies |
| `pnpm --filter @models-roundtable/provider-codex test` | Pass | Focused run passed; full gate: 2 files, 12 tests |
| `pnpm --filter @models-roundtable/core test` | Pass | Full gate: 6 files, 12 tests |
| `pnpm --filter @models-roundtable/server test` | Pass | Full gate: 2 files, 6 tests |
| Owner smoke without attestation | Pass | Refused before any provider call with an allowlisted error |
| `pnpm --filter @models-roundtable/provider-codex typecheck` | Pass | No TypeScript errors |
| `pnpm lint` | Pass | ESLint and cross-platform Prettier check pass |
| `pnpm typecheck` | Pass | All packages and apps pass |
| `pnpm test` | Pass | Includes fake E2E and Codex fixture/probe tests |
| `pnpm build` | Pass | All packages and apps build |

## Acceptance checklist

- [x] Shared adapter contract suite passes. Provider registry and Codex package tests pass.
- [x] All captured/synthetic Codex fixtures pass incremental parser tests. Fixture normalization tests pass.
- [ ] Real smoke: start, stream, complete, resume, cancel in disposable read-only workspace. Owner manual transport probes pass, but app-owned smoke is not implemented.
- [x] App remains usable when Codex is missing/logged out/incompatible. Bounded probe returns safe states and fake E2E passes.
- [x] No credentials/environment dumps/raw sensitive stderr reach DB/log/browser/export. The adapter keeps stderr bounded and emits only allowlisted messages.
- [x] Existing fake-provider E2E remains unchanged and passing. Full test gate passes.
- [x] Provider update/schema drift yields controlled adapter error, not server crash. Unknown events are tolerated and missing capability flags report incompatible.
- [x] Exact tested Codex version/capability hash recorded in handoff. `0.145.0`, `0b640f0edcaa239a2e095afab04dbb28c900202737f5d75200e433e943dceee8`.

## Provider evidence

- Provider/version/capability hash: Codex CLI `0.145.0`; `0b640f0edcaa239a2e095afab04dbb28c900202737f5d75200e433e943dceee8`.
- Real-provider calls performed: owner-only new, resume, invalid session, denied write, and Ctrl+C probes in an empty temporary workspace.
- Fixture sanitization performed: session/item IDs replaced with placeholders; raw JSONL, prompts, paths, and account details excluded.
- Authentication/permission boundary observations: owner login remains external; no credentials were inspected; bypass flags are forbidden.

## Known issues and risks

- Resume must remain disabled until the owner write-denial smoke verifies the
  installed CLI honors `-c sandbox_mode="read-only"` during resume.
- The automated execution identity cannot run Codex; real provider smoke must
  be launched by the owner from an interactive terminal.
- The current database schema/repository assumes adapter id `fake`; do not
  route Codex through it until adapter identity is generalized.

## Exact next action

Have the owner run the read-only resume verification and then the guarded
adapter smoke in `packages/provider-codex/SMOKE.md`. If both pass, record the
evidence, wire the verified resume policy into server composition, and run the
final Phase 3 gate.
