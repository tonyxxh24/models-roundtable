# Provider fixture corpus

All fixtures are sanitized test data for parser and adapter contract tests. They are not transcripts and do not include real provider identifiers, user paths, account data, prompts, repository contents, raw tool inventories, usage/cost fields, or credentials.

## Conventions

- `*.sanitized.jsonl`: minimally transformed ordering/shape observed from a Phase 0 call.
- `*.sanitized.json`: an observed outcome summarized as safe fields.
- `synthetic-*`: invented malformed/chunk cases; never treated as provider behavior.
- `<SESSION_ID>`, `<TEMP_WORKSPACE>`, and similar values are placeholders.

The real event parser must handle incremental byte chunks. JSONL fixtures model records; `synthetic-chunks.json` models tricky transport chunk boundaries.

## Current corpus

- `claude/2.1.217`: observed safe probe outputs plus synthetic error/stderr case.
- `codex/0.145.0`: owner-interactive, read-only evidence for new session,
  resume, invalid-session handling, and Ctrl+C cancellation. The per-version
  README records provenance and placeholders.
- `codex/unavailable-in-agent-sandbox`: historical documentation of the
  automated-agent access block; it is not the owner-terminal result.
- `common`: provider-neutral malformed/fragmented input cases.
