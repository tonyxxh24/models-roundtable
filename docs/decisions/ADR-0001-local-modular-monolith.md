# ADR-0001: Local modular monolith

- Status: Accepted
- Date: 2026-07-23

## Context

The product needs a browser UI, durable local storage, realtime streaming, and ownership of local provider child processes. Cloud services and distributed operations add no MVP value.

## Decision

Build a local modular monolith: React/Vite client plus Node.js server, shared TypeScript contracts, SQLite, and provider packages. Production serves the client and API from one loopback origin. Module dependency rules are enforced, but there are no microservices, Redis, broker, or container requirement.

## Consequences

Deployment and privacy remain simple; adapters can fail independently inside one process boundary. The server is a local security boundary and must still validate browser input. A future hosted product requires a new architecture decision.
