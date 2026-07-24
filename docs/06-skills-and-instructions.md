# Skills and durable instructions

## Objectives

- Reuse one skill concept across Codex and Claude where the Agent Skills standard overlaps.
- Preserve provider-native features instead of pretending all frontmatter is portable.
- Keep always-on project rules separate from on-demand procedures.
- Make every generated file previewable, checksummed, and conflict-safe.

## Instruction layers

| Layer | Purpose | Examples |
|---|---|---|
| Thread/request | One turn or room-specific instruction | “Compare only, do not edit” |
| Shared room instructions | Applies to every agent in one room | Output language, project goal |
| Agent persona | Applies to one named agent | Security reviewer role |
| Repository durable rules | Native project conventions | `AGENTS.md`, `CLAUDE.md` |
| Skill | On-demand reusable workflow/knowledge | Release checklist |
| Provider configuration | Sandbox, model, MCP, hooks | Provider-owned config |

Do not move a rule into a broader layer merely for convenience.

## Canonical skill layout

```text
.roundtable/
  skills/
    <skill-name>/
      SKILL.md
      scripts/        optional
      references/     optional
      assets/         optional
  skill-projections.json
```

Minimum portable frontmatter:

```yaml
---
name: security-review
description: Review a proposed code change for concrete security risks.
---
```

Skill names use lowercase ASCII letters, digits, and hyphens. Descriptions explain positive triggers and important exclusions. Paths inside a skill cannot escape its root.

## Provider projections

- Codex target: `.agents/skills/<name>/`
- Claude target: `.claude/skills/<name>/`

Do not rely on Windows symlinks. Copy via a staging directory and atomic rename, then record source/target checksums and generator version.

Projection algorithm:

1. Validate canonical tree and total size.
2. Parse portable frontmatter and provider extension namespaces.
3. Build a target tree in a temporary directory.
4. Compare with the previous recorded target checksum.
5. If target changed independently, report `conflict` and stop.
6. Show a file-level preview.
7. On owner approval, replace the managed target atomically.
8. Update manifest and emit an audit event.

Never claim ownership of a pre-existing provider skill unless the owner explicitly imports it.

## Provider extensions

Portable content is the default. Provider-only data lives under explicit namespaced metadata or sidecar files, for example:

```yaml
x-roundtable:
  providers:
    claude:
      disable-model-invocation: true
    codex:
      dependencies: []
```

The projector translates only documented and tested fields. Unknown fields are preserved in canonical source but excluded from a target with a warning.

## Repository instructions

### Codex

Codex reads `AGENTS.md`/`AGENTS.override.md` from global and repository directory scopes, with closer files taking precedence. Roundtable should display discovered file paths and hashes; it does not merge them into one editable blob.

### Claude

Claude loads `CLAUDE.md`, `.claude/CLAUDE.md`, local files, and scoped rules according to its native behavior. It supports `@path` imports. Roundtable should display the native structure and avoid silently converting Codex precedence semantics.

### Shared instructions

Store room-level shared instructions in the database and inject them through the context builder. If the owner wants durable repository-wide common rules, keep a normal versioned file such as `PROJECT_RULES.md` and reference it from provider-native instruction files explicitly.

## UI requirements

The Skills/Instructions screen has separate tabs:

- Shared room instructions
- Agent personas
- Canonical skills
- Codex native instructions
- Claude native instructions
- Projection conflicts

Every effective run exposes instruction and skill hashes in Context Inspector. The UI must not imply that a file was loaded merely because it exists; provider capability/probe evidence determines status.

## Security rules

- Skill scripts are executable code and require the same trust as repository code.
- Import validates paths, rejects device files/symlink escapes, and limits size/count.
- Remote skill installation and marketplaces are out of scope for the local MVP.
- Skill descriptions and references are untrusted prompt content, not authorization.
- A skill cannot raise the run permission ceiling or bypass workspace leases.

## Testing

- Portable valid/invalid frontmatter fixtures.
- Nested references and path traversal attempts.
- Cross-platform path normalization.
- Clean projection, source update, target divergence, and conflict resolution.
- Byte-for-byte deterministic output from identical input.
- Provider extension warnings and round-trip preservation.
