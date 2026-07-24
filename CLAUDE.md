# Claude Code instructions

@PROJECT_RULES.md

Also read `docs/INDEX.md`, `docs/STATUS.md`, and the active phase file before editing.

This project may invoke Claude Code as a local Personal Mode provider. Never design the distributed product around Claude.ai subscription authentication. Anthropic Agent SDK integrations for third-party products require API-key/provider authentication unless separately approved.

Do not bypass permissions, share subscription credentials, or let parallel agents edit one working tree. Keep Claude-specific parsing and process behavior inside the Claude adapter package.
