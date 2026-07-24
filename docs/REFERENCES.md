# Official references

Verified for this blueprint on 2026-07-23. Re-verify before implementing provider-specific flags or distributing the application.

## OpenAI / Codex

- [Codex developer commands / CLI reference](https://developers.openai.com/codex/cli/reference/) — non-interactive `exec`, JSONL output, resume, sandbox and app-server command surface.
- [Codex SDK](https://developers.openai.com/codex/sdk/) — start, continue, and resume threads while keeping SDK details inside the adapter.
- [Custom instructions with AGENTS.md](https://developers.openai.com/codex/guides/agents-md/) — global/project discovery and nested precedence.
- [Build skills](https://developers.openai.com/codex/skills/) — `SKILL.md` structure, discovery, and explicit/implicit invocation.
- [Using Codex with a ChatGPT plan](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan) — subscription access surfaces and programmatic control statement.

## Anthropic / Claude Code

- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-usage) — print mode, stream JSON, resume, permission flags.
- [Claude Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview) — sessions and explicit restriction on third-party Claude.ai login/rate limits without approval.
- [Claude Code legal and compliance](https://code.claude.com/docs/en/legal-and-compliance) — consumer versus commercial terms by user category.
- [Claude Code skills](https://code.claude.com/docs/en/slash-commands) — Agent Skills structure and `.claude/skills` discovery.
- [Claude Code memory / CLAUDE.md](https://code.claude.com/docs/en/memory) — project/user instructions, imports, and scoped rules.

## Interpretation rules

- Documentation describes current public behavior; the installed CLI remains the executable compatibility target.
- Phase 0 records exact installed versions and sanitized observed fixtures.
- Do not infer that subscription UI access creates a general-purpose third-party API entitlement.
- Where provider documentation and observed behavior differ, disable the affected capability and document the mismatch rather than improvising.
