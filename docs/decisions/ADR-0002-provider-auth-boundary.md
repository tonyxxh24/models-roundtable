# ADR-0002: Provider-native authentication boundary

- Status: Accepted
- Date: 2026-07-23

## Context

The owner wants to use paid ChatGPT/Claude access without adding API keys. Credentials are high-risk, and Anthropic restricts third-party products from offering Claude.ai login/rate limits without approval.

## Decision

Personal Mode may spawn owner-installed, owner-authenticated official CLIs. Roundtable never collects, reads, copies, refreshes, exports, or proxies provider credentials. Claude subscription execution is Personal Mode only. Guest/hosted invocation must use a separately approved per-user/API design.

## Consequences

Login happens outside the app and provider availability can vary. The app cannot promise unattended hosted operation from consumer subscriptions. Provider status probes and clear instructions are required.
