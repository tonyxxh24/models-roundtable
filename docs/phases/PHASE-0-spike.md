# Phase 0 — Provider feasibility spike

## Objective

Prove the exact installed Codex and Claude Code capabilities needed by Personal Mode before choosing implementation details or installing the application stack.

## Read first

- `docs/04-provider-adapters.md`
- `docs/07-security-and-permissions.md`
- `docs/13-risks-and-policy.md`
- `docs/REFERENCES.md`
- ADR-0002 and ADR-0003

## Scope

- Non-mutating executable/version/help discovery.
- Owner-confirmed, bounded, read-only calls in a disposable fixture workspace.
- JSONL capture, sanitization, and protocol analysis.
- Session start/resume and cancellation experiments.
- Compatibility and policy conclusions.

Do not scaffold React/server/database packages. Do not install/update provider CLIs, change login state, read credential files, or use a real user repository as the test workspace.

## Deliverables

```text
docs/generated/PROVIDER-SPIKE-REPORT.md
docs/generated/provider-capabilities.json
fixtures/providers/codex/<version>/*.jsonl
fixtures/providers/claude/<version>/*.jsonl
spikes/provider-probe/README.md
spikes/provider-probe/            minimal scripts only if needed
```

Fixtures must replace usernames, absolute paths, account IDs, session IDs, and content with stable placeholders. Keep a manifest explaining every replacement.

## Work items

### 0.1 Environment inventory

- Record OS/shell/runtime architecture.
- Resolve each executable path without printing credential/config file content.
- Record version output and executable source.
- Record whether Windows native, Git Bash, or WSL is required.

### 0.2 Capability probes

For each provider, inspect current help and test:

- non-interactive invocation;
- JSON/JSONL streaming;
- prompt over stdin;
- working-directory selection;
- explicit read-only permission ceiling;
- session ID discovery;
- resume with follow-up;
- graceful cancellation and child cleanup;
- stderr versus stdout behavior;
- successful/failed exit codes;
- unknown event tolerance assumptions;
- tool and approval events if safely triggerable read-only.

Current documentation suggests `codex exec --json`/`codex exec resume` and Claude print mode with `--output-format stream-json`/`--resume`; treat installed help as the executable truth and record differences.

### 0.3 Authentication boundary

- Determine readiness through provider-supported status/harmless invocation, never credential-file inspection.
- Confirm the app can rely on externally completed owner login.
- Document whether Codex SDK and CLI share the needed subscription authentication only if tested safely.
- Restate Claude Personal Mode restriction; do not test guest/shared access.

### 0.4 Parser corpus

Capture at least normal start, streamed text, completion, resume, warning/stderr, invalid session, and cancellation for each provider where observable. Add synthetic invalid JSON, truncated line, combined records, fragmented multibyte UTF-8, and unknown event samples.

### 0.5 Decision

For each adapter conclude `GO`, `GO WITH LIMITATIONS`, or `NO-GO`, including required minimum capabilities and fallback. A one-provider MVP is acceptable. Browser automation, credential copying, and dangerous permissions are not fallbacks.

## Required checks

- Every fixture parses as intended or is explicitly labeled malformed.
- Repository secret scan finds no credentials, personal paths, emails, or real session IDs.
- Commands and results in the report are reproducible.
- Capability JSON validates against its documented structure.
- Cancellation leaves no owned test child alive.

## Acceptance criteria

- [ ] Exact installed versions and platform constraints recorded.
- [ ] Streaming text can be incrementally parsed for every GO provider.
- [ ] Opaque provider session ID can be captured and resumed, or limitation explicitly changes MVP scope.
- [ ] Read-only ceiling is verified without bypass flags.
- [ ] Authentication remains provider-owned.
- [ ] Sanitized fixture corpus covers happy path and failures.
- [ ] Go/no-go decision and adapter recommendation are explicit.
- [ ] No product framework/dependency scaffold was added.

## Handoff

Activate Phase 1 only if at least one real provider is GO and the fake-provider plan remains viable. List exact event mappings Phase 3/4 must implement.
