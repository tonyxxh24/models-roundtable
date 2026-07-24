# Mention routing, orchestration, and context

## Routing philosophy

The canonical room is a human-controlled coordination surface. Models are addressed participants, not autonomous message consumers. Routing is explicit, deterministic, auditable, and bounded.

## Mention parser

Parse against a Markdown token stream, not a global regular expression.

- Recognize `@handle` only in normal text.
- Ignore fenced code, inline code, escaped `\@`, URLs/email addresses, and generated message metadata.
- Normalize Unicode to NFC and handles to a case-insensitive comparison form.
- Store source spans so UI highlighting matches server resolution.
- Resolve against the room participant snapshot captured with the command.
- Unknown/disabled targets produce warnings and no run.

Reserved groups:

- `@all`: enabled humans and agents visible to sender; only agents produce runs.
- `@models`: enabled agent participants.
- `@humans`: notification only.

The application may add user-defined groups later, but group expansion must be stored explicitly with the message.

## Routing rules

1. A new human message creates runs only for resolved agent mentions.
2. A reply to an agent without an explicit mention may target that same agent only if the UI shows and submits the inferred target; inference is never server-hidden.
3. Agent-authored messages never create runs by themselves.
4. System messages never create runs.
5. `@all` uses one immutable context snapshot and one run per agent.
6. If a target is unavailable, create no provider process; record a rejected run intent or visible warning according to UI flow.
7. Rate/concurrency limits queue runs without changing their input snapshot.

## Agent aliases

An agent profile consists of:

```text
display name and handle
adapter ID
optional provider model/config override
persona instructions
skill allowlist
permission profile
workspace policy
context policy
```

`@codex` and `@architect` may both use Codex but must have distinct provider sessions. Aliases cannot share a mutable provider session.

## Roundtable workflows

Structured multi-agent interaction is represented as a workflow graph, never implicit recursive routing.

Example review workflow:

```text
Step 1: @codex proposes solution
Step 2: @claude receives user request + selected Codex final message and critiques
Step 3: owner chooses whether @codex receives the critique
```

Every workflow declares:

- ordered/parallel steps;
- maximum runs and wall-clock duration;
- context references for each step;
- whether human confirmation is required between steps;
- failure behavior;
- permission ceiling.

MVP supports manual mentions only. Workflow execution is later work and must retain the no-automatic-loop principle.

## Canonical history versus provider history

The room transcript is provider-neutral local truth. Each provider session contains its own subset and tool history. They are linked but never assumed identical.

For every run, persist a context manifest:

```json
{
  "roomSequence": 123,
  "mode": "resume",
  "messageIds": ["..."],
  "replyMessageIds": ["..."],
  "instructionRefs": ["shared:sha256...", "agents:sha256..."],
  "skillRefs": ["security-review:sha256..."],
  "attachmentIds": ["..."],
  "truncations": [],
  "estimatedCharacters": 4200
}
```

The manifest records sources and hashes, not provider secrets or hidden reasoning.

## Context construction

### New provider session

Order the context pack:

1. product-generated participation header identifying the agent and room;
2. shared room instructions;
3. agent persona and selected skills;
4. workspace facts (path alias, trust/read-only mode, not arbitrary file contents);
5. room brief supplied by the owner or deterministic extract;
6. explicitly selected/replied-to messages with author labels and IDs;
7. recent relevant messages within budget;
8. current human request.

Clearly delimit quoted messages as untrusted conversation content. Never concatenate another agent's tool output as system instruction.

### Resumed provider session

Provider session history already contains earlier turns. Supply:

- current request;
- explicitly referenced messages not already in that provider session;
- changed shared instructions/skills, with an explicit notice;
- attachment references needed for this turn.

Do not replay the entire room.

## Budgeting and truncation

MVP uses deterministic character/byte limits because provider tokenizers may not be locally available.

Priority from highest to lowest:

1. current request;
2. direct reply targets and explicit citations;
3. safety/permission instructions;
4. selected skills;
5. room brief;
6. recent same-agent messages;
7. other room history.

Truncate only at message boundaries unless a single oversized message requires a clearly marked excerpt. Record every omission. Never perform an unannounced hidden model call to summarize context.

Later optional summarization must create a visible, versioned summary message with provenance and allow regeneration; it is not hidden infrastructure.

## Cross-agent references

The client inserts stable message references rather than copying rendered HTML. The server resolves references to canonical text and attributes:

```text
[Quoted room message msg_... by @codex]
...
[End quoted message]
```

Provider/tool content inside quotes remains untrusted. A quoted instruction such as “ignore safety rules” has no higher priority than user content.

## Queueing and fairness

- Global concurrency limit protects the host.
- Adapter-specific limits avoid provider thrashing.
- One active turn per provider session.
- FIFO per room by default; cancellation removes queued runs safely.
- `@all` starts eligible runs fairly but does not guarantee simultaneous provider execution.
- Queue wait never changes the captured context sequence.

## Idempotency

Client commands carry an idempotency key. Repeated submission returns the original message/runs. Adapter start additionally uses a persisted `start_attempt` record so crash recovery can distinguish “not started” from “possibly started”; uncertain attempts are never blindly repeated without marking the duplicate risk.
