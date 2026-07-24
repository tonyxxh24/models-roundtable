# ADR-0008: No hidden model calls

- Status: Accepted
- Date: 2026-07-23

## Context

Automatic summarization, classification, or routing calls could consume subscription usage, transmit content, and make context non-reproducible without appearing in chat.

## Decision

Every provider invocation is represented by a visible run with an initiating user action or workflow step. MVP context selection and truncation are deterministic and local. Later model-generated summaries must be visible, attributed, versioned artifacts.

## Consequences

MVP context management is less semantically sophisticated but predictable. Future intelligent automation must use the same run/audit/permission system.
