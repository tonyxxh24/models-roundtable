# ADR-0005: Explicit routing and bounded workflows

- Status: Accepted
- Date: 2026-07-23

## Context

Automatically feeding agent responses to other agents can create usage loops, amplify prompt injection, and obscure who requested work.

## Decision

Only human commands with resolved mentions or a visible predeclared bounded workflow create runs. Agent/system messages never trigger runs. `@all` fans out from one immutable room snapshot.

## Consequences

The product remains predictable and auditable. Multi-agent debates require explicit workflow definitions, budgets, and optional human gates rather than conversational recursion.
