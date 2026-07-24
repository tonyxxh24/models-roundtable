# Project status

Last updated: 2026-07-24

## Current state

- Lifecycle: Phase 2 complete; the provider-neutral local chat MVP passes its full gate.
- Active phase: `PHASE-3-codex` (in progress).
- Active branch: not established.
- Latest completed phase: Phase 2 - Local chat with deterministic fake provider.
- Blocking issues: None for Phase 3. Real Codex smoke tests remain owner-terminal-only because the automated Windows identity cannot execute the CLI.

## Phase ledger

| Phase | State | Gate owner | Notes |
|---|---|---|---|
| 0 - Provider feasibility spike | Complete | Codex | Claude GO with limitations; Codex blocked by current agent execution ACL |
| 1 - Repository foundation | Complete | Codex | Frozen install, all gates, migration, and loopback evidence are in the 2026-07-24 Phase 1 handoff |
| 2 - Local chat with fake provider | Complete | Codex | Durable multi-agent fake chat, replay/stream/cancel/retry, search/export, context inspection, recovery, accessibility, and all gates pass |
| 3 - Codex Personal Mode adapter | In progress | Codex | Provider-aware routing, readiness/UI, fixtures, new-session adapter, opt-in participant, and guarded owner smoke runner pass gates; owner real-provider smoke remains |
| 4 - Claude Personal Mode adapter | Blocked | - | Personal/local boundary only |
| 5 - Skills, instructions, workspace permissions | Blocked | - | Requires both adapters stable |
| 6 - Reliability and release candidate | Blocked | - | Local single-owner release |
| 7 - Optional human collaboration | Blocked | - | Separate threat-model and policy gate |

Allowed state values: `Blocked`, `Ready`, `In progress`, `Needs review`, `Complete`.

## How to update

An implementation agent may move only the active phase. Mark it `Complete` only when every acceptance criterion is evidenced in a handoff. Then set the next phase to `Ready` and make it the active phase. Record deviations as ADRs. If the next phase preconditions are not met, make it active but keep it `Blocked` and record the exact unblock condition.
