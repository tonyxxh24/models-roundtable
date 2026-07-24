# Risk register and provider-policy boundary

This is engineering guidance, not legal advice. Provider terms and product behavior change; re-verify official sources before distribution or collaboration release.

## Critical product boundary

The app is feasible as a single-owner local wrapper around provider CLIs. It is not automatically feasible as a service that lets other people consume the owner's subscriptions.

Anthropic's official Agent SDK documentation states that, absent prior approval, third-party developers may not offer Claude.ai login or rate limits and should use API-key/provider authentication. Accordingly, the Claude subscription adapter is Personal Mode only. Collaboration/hosted modes require a separate approved design.

OpenAI documents subscription access to Codex and programmatic Codex SDK/CLI surfaces. Phase 0 must verify installed behavior. Before distribution, review the then-current terms and avoid credential/account sharing, circumvention of usage limits, or representing subscription access as a general API entitlement.

## Risk register

| ID | Risk | Likelihood | Impact | Mitigation / gate |
|---|---|---:|---:|---|
| R-01 | Provider CLI event schema changes | High | High | Capability probes, fixtures, tolerant parser, version diagnostics |
| R-02 | Subscription integration violates provider policy in multi-user use | Medium | Critical | Personal-only boundary; Phase 7 policy review; API/per-user alternative |
| R-03 | Provider process edits/deletes unintended files | Medium | Critical | Read-only default, validated workspace, leases, no bypass flags |
| R-04 | Localhost endpoint attacked by malicious website | Medium | High | Loopback, Origin checks, HttpOnly bootstrap session, strict CORS/CSP |
| R-05 | Credentials leak to logs/DB/export | Low | Critical | Forbidden-data design, redaction, automated leakage tests |
| R-06 | Agent-to-agent loop consumes usage | Medium | High | No output-triggered routing; bounded explicit workflows |
| R-07 | Concurrent agents corrupt workspace | Medium | High | One write lease; later isolated worktrees |
| R-08 | SQLite/history corruption | Low | High | Transactions, WAL, integrity checks, verified backups, recovery runbook |
| R-09 | Context mismatch yields misleading comparison | High | Medium | Same room snapshot for fan-out, visible context manifests |
| R-10 | Provider session cannot resume after update/cleanup | Medium | Medium | Explicit fallback, canonical local history, no silent reset |
| R-11 | Malicious Markdown/tool output compromises browser | Medium | High | Sanitize, disable raw HTML, CSP, safe links |
| R-12 | Windows process cancellation leaves children | Medium | Medium | Owned process-tree supervisor and platform integration tests |
| R-13 | Skill projection overwrites user files | Medium | High | Manifest/checksums, conflict stop, preview, atomic replace |
| R-14 | Hidden model calls create unexpected usage | Medium | Medium | No hidden summarization; every run visible and attributed |
| R-15 | App becomes over-engineered before feasibility | Medium | Medium | Phase 0 before scaffold; fake provider before real adapters |

## Go/no-go decisions

### Personal local MVP

Go if Phase 0 proves both providers can stream, expose session identity, resume, respect read-only constraints, and operate without Roundtable handling credentials. If one fails, ship with one real provider plus fake adapter rather than unsafe workarounds.

### Workspace writes

Go only if provider permission ceiling is verified, traversal tests pass, write lease is implemented, cancellation/recovery is safe, and UI shows exact scope. Otherwise remain read-only.

### Collaboration

Go only if:

- binding uses authenticated encrypted/private transport;
- roles and revocation exist;
- provider entitlement per human is policy-compliant;
- guest prompts cannot access unauthorized workspace/history;
- audit and abuse/rate controls exist;
- a collaboration-specific threat model is accepted.

### Hosted service

No-go under the Personal Mode architecture. Re-plan around official APIs/business terms, tenant isolation, billing, secrets management, and abuse prevention.

## Reverification triggers

Recheck official provider documentation/terms when:

- adding a new auth method or SDK;
- enabling guests or non-loopback access;
- distributing binaries publicly;
- using a subscription-backed adapter beyond the owner;
- a CLI changes login/session/rate behavior;
- adding marketplace/plugin installation;
- marketing claims mention “included usage,” privacy, or compliance.
