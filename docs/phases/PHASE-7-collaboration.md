# Phase 7 — Optional human collaboration

## Objective

Decide whether and how trusted humans can join rooms without sharing provider credentials/entitlements or exposing the host. A documented no-go is acceptable.

## Preconditions

- Personal Mode release candidate complete.
- Owner explicitly chooses to explore collaboration.
- Current provider terms/documentation reverified.

## Stage A: decision work (mandatory before code)

Produce:

- collaboration threat model and data-flow diagram;
- provider entitlement matrix for owner, guest, and per-user worker;
- authentication/authorization design;
- network design (private VPN or TLS, never plain public HTTP);
- privacy/retention/consent model;
- abuse/rate/quota design;
- ADR choosing one of the architectures below or no-go.

Candidate architectures:

1. **Human discussion only**: guests chat; only owner can invoke Personal adapters.
2. **Per-user worker**: each human operates a local companion with their own provider-approved authentication; room server never receives credentials.
3. **API-backed team adapters**: official API/business authentication and billing; outside original no-API requirement.

Do not implement “guests use host's Claude/ChatGPT subscription.”

## Stage B: implementation (only after accepted ADR)

Likely deliverables:

- non-loopback mode behind authenticated encrypted/private transport;
- invitations, named principals, session revocation, roles/capabilities;
- room membership and history authorization on every query/event;
- WebSocket authentication/replay isolation;
- guest-safe path/message/tool redaction;
- per-principal provider invocation rules and quotas;
- audit UI and security operations.

## Acceptance criteria

- [ ] Current provider policy and entitlement design documented with official sources.
- [ ] No guest can access owner credentials, provider session IDs, unauthorized rooms/files, diagnostics, or settings.
- [ ] No guest can raise workspace/provider permissions.
- [ ] Network uses authenticated encrypted/private transport and origin controls.
- [ ] Revocation takes effect for HTTP and existing WebSocket sessions.
- [ ] Cross-room replay/search/export authorization tests pass.
- [ ] Rate/abuse limits prevent unbounded provider invocation.
- [ ] Collaboration-specific penetration checklist and privacy review pass.
- [ ] Personal Mode remains loopback-only by default and unchanged.

## Stop conditions

Stop with a no-go if provider policy is unclear, guest entitlement would rely on owner subscription sharing, secure identity/networking is unavailable, or the feature would require weakening Personal Mode boundaries.
