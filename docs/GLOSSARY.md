# Glossary

- **Adapter**: Provider-specific code that starts a local process or supported SDK runtime and converts its output to normalized events.
- **Agent**: A named participant backed by a provider adapter plus configuration, permissions, and optional persona.
- **Canonical room history**: The local, provider-neutral sequence of human, agent, and system messages.
- **Context pack**: The bounded set of room facts and messages supplied when starting a provider session.
- **Owner**: The person operating the machine and provider subscriptions in Personal Mode.
- **Participant**: A human, agent, or system identity that can author messages.
- **Personal Mode**: Single-owner, local-only use of CLIs authenticated by that owner.
- **Provider session**: A provider-native conversation/thread identified by an opaque provider session ID.
- **Projection**: A generated provider-native representation of a canonical skill or instruction.
- **Room**: A persistent conversation with participants, workspace binding, and ordered messages.
- **Run**: One requested agent turn, from accepted command through completion/cancellation/failure.
- **Room sequence**: Monotonically increasing integer assigned to durable room events.
- **Subscription adapter**: A local adapter relying on a provider CLI's owner-authenticated subscription state; never a credential-sharing mechanism.
- **Tool event**: A normalized observation of a provider tool request or result.
- **Write lease**: Exclusive, time-bounded permission for one run to mutate a workspace.
- **Workspace**: A validated local project directory attached to a room.
