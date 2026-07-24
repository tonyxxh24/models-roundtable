# ADR-0007: Canonical skills with provider projections

- Status: Accepted
- Date: 2026-07-23

## Context

Codex and Claude both use `SKILL.md` concepts but discover them in different directories and support different extensions. Windows symlinks are unreliable without elevated configuration.

## Decision

Store portable skills under `.roundtable/skills` and generate checksummed copies into provider-native directories. Preserve provider extensions explicitly, preview changes, and stop on target divergence. Keep `AGENTS.md` and `CLAUDE.md` native rather than flattening them.

## Consequences

Shared workflows are maintainable without erasing provider semantics. Projection needs manifests, conflict handling, and deterministic tests.
