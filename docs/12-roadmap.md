# Roadmap and execution order

## Why phases are strict

Provider CLI integration has both compatibility and policy uncertainty. The project therefore proves external assumptions before scaffolding, builds core behavior with a fake provider, and enables risky capabilities last.

## Phase graph

```mermaid
flowchart LR
  P0["0 Provider spike"] --> P1["1 Foundation"]
  P1 --> P2["2 Local chat + fake"]
  P2 --> P3["3 Codex adapter"]
  P3 --> P4["4 Claude Personal adapter"]
  P4 --> P5["5 Skills + permissions"]
  P5 --> P6["6 Reliability RC"]
  P6 --> P7["7 Optional collaboration"]
```

Phases 3 and 4 are conceptually independent after Phase 2, but execute sequentially in this repository so lessons from Codex harden the adapter base before Claude integration.

## Milestones

### M0 Feasibility proven

Phase 0 produces capability matrix, sanitized fixtures, policy boundary, and go/no-go. No product UI.

### M1 Deterministic local core

Phases 1–2 produce a fully usable fake-provider chat with persistence, replay, routing, and cancellation. Architecture can be tested without paid calls.

### M2 Two-provider Personal Mode

Phases 3–4 provide real Codex and Claude local adapters with versioned smoke evidence. This is the first product-value milestone, still read-only.

### M3 Safe configurable local release

Phases 5–6 add skills/instructions, workspace permissions, diagnostics, backup/recovery, performance/security checks, and packaging decision.

### M4 Collaboration decision

Phase 7 is optional. It may deliver secure collaboration, choose per-user workers/API adapters, or reject collaboration under subscription constraints. “No-go” is a valid outcome.

## Global definition of done

- All phase criteria passed with evidence.
- No unresolved critical/high security issue.
- Provider behavior is version-recorded and unknown events are tolerated.
- Credentials absent from tests, DB, logs, exports, and diagnostics.
- Windows E2E passes.
- Backup and restore drill passes.
- User-facing policy limitations are explicit.
- Documentation, contracts, and runtime behavior agree.

## Dependency policy

Pin dependencies using a lockfile. Prefer small, maintained packages for cross-platform process trees, SQLite, schema validation, and security-sensitive parsing. Every dependency with install scripts/native binaries receives explicit review. Avoid Redis, message brokers, containers, cloud services, and microservices in local MVP.

## Versioning

Before release candidate:

- application semantic version;
- database schema version;
- wire protocol major version;
- normalized adapter contract version;
- skill projector version;
- per-provider capability hash.

Do not use app semantic version as a substitute for schema/protocol compatibility checks.

## Handoff discipline

Each phase agent:

1. marks phase `In progress` in `STATUS.md`;
2. works only within phase scope;
3. adds ADRs for changed durable decisions;
4. runs required checks;
5. adds a timestamped handoff;
6. marks `Needs review` if any criterion awaits human/real-provider validation;
7. marks `Complete` only with evidence and activates the next phase.
