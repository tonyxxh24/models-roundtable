# Codex CLI 0.145.0 fixture provenance

These fixtures come from an owner-interactive PowerShell probe in an empty
temporary workspace on Windows. The raw JSONL was never committed.

- `normal.sanitized.jsonl` and `resume.sanitized.jsonl` preserve the minimal
  observed event sequence. Session and item identifiers are placeholders; the
  fixed response token is intentionally retained.
- `invalid-session.stderr.txt` is a sanitized CLI diagnostic. It is stderr,
  not assistant content.
- `cancelled.sanitized.json` records an observed Ctrl+C result. No terminal
  provider event was captured, so the adapter must derive cancellation from its
  owned process lifecycle rather than inventing a provider event.
- `synthetic-unknown-event.jsonl` is intentionally invented to verify forward
  compatibility. It is not evidence of a Codex event type.

No credentials, account details, absolute paths, raw prompts, or real session
identifiers are present.
