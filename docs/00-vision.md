# Vision and non-negotiable boundaries

## North star

Models Roundtable gives one person a durable local conversation where humans and multiple coding agents can be addressed by name, retain separate provider sessions, inspect the same explicitly selected workspace, and produce auditable results without requiring the application to possess provider API keys.

The product should feel like a group chat, not a collection of terminal tabs. It must still preserve the safety properties of local coding agents: clear workspace scope, visible permissions, cancellable work, and no hidden credential handling.

## Primary user

A technically capable individual who already uses Codex CLI and Claude Code, wants to compare or sequence their reasoning, and values local history and workspace control.

## Product principles

1. **Local first**: application state, transcripts, indexes, and attachments remain on the owner's machine by default.
2. **Provider-native auth**: the provider CLI owns login and credentials. Roundtable records only status and opaque session identifiers.
3. **Explicit routing**: an `@mention` or explicit workflow starts a model run. Agent output alone never triggers another run.
4. **Provider isolation**: provider formats and quirks stop at adapters.
5. **Read-only first**: reading and discussion ship before file mutation.
6. **Inspectable execution**: users can see queued/running/tool/approval/completed states and stop owned processes.
7. **Bounded context**: room history is local truth; each provider receives a deliberate, explainable subset.
8. **Progressive capability**: collaboration and write access are optional layers, not assumptions in the core.

## In scope for the first local release

- One owner, one machine, loopback-only server.
- Rooms, messages, participant identities, and search.
- `@codex`, `@claude`, custom aliases, and `@all` fan-out.
- Streaming text and normalized lifecycle events.
- Provider session creation and continuation.
- Read-only workspace attachment.
- Local SQLite persistence and export.
- Shared instructions plus provider-native `AGENTS.md`, `CLAUDE.md`, and skills.
- Cancellation, diagnostics, and deterministic fake-provider tests.

## Explicitly out of scope for the first release

- A public hosted SaaS.
- Repackaging consumer subscriptions for other people.
- Browser automation against ChatGPT or Claude web apps.
- Silent autonomous agent-to-agent conversations.
- Simultaneous writes to one working tree.
- Mobile-native clients, voice, billing, organization administration, cloud sync, or marketplace distribution.
- A generalized LLM API gateway.

## Success criteria

- The owner can install and run the app locally without entering an API key.
- A room can address Codex and Claude independently and resume both after application restart.
- A crash or malformed provider event cannot corrupt canonical room history.
- No provider secret appears in SQLite, logs, exports, browser storage, or diagnostics.
- The app remains useful when one provider is missing, logged out, rate-limited, or changes an event field.
- An implementation agent can reproduce behavior from contracts and tests without reading provider-specific UI code.

## Product modes

### Personal Mode — committed

The owner runs the server locally and uses their own installed provider CLIs. Loopback binding is mandatory. Subscription-backed Claude use is treated as a personal experiment and not advertised as a distributable integration.

### Collaboration Mode — optional, separately gated

Humans may join over a trusted network. This requires authentication, TLS/private networking, authorization, privacy controls, and a provider-entitlement design. Guest prompts must not silently consume or expose the owner's subscription. Phase 7 may conclude that collaboration must use per-user workers or API-backed adapters.

### Hosted Mode — rejected for this architecture

A public service needs provider-approved authentication, tenant isolation, billing, abuse controls, and a different threat model. It is not an incremental configuration switch.
