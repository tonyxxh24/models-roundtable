# Phase execution rules

Each phase is a self-contained work package for a future model. Execute only the phase named active in `docs/STATUS.md`.

## Before editing

1. Read root instructions and all linked design documents.
2. Mark the phase `In progress` with date/agent in `STATUS.md`.
3. Inspect the working tree and preserve unrelated changes.
4. Resolve ambiguities from existing evidence; create an ADR for durable design changes.
5. Do not begin if predecessor evidence is absent.

## While working

- Stay inside scope and explicit deliverables.
- Prefer small vertical slices and tests.
- Never fabricate provider test results.
- Real provider commands require the owner's existing installation/authentication and must be bounded/read-only.
- Record sanitized fixtures only.
- Do not commit or push unless the user separately requests it.

## Finishing

1. Run every available phase check.
2. Map evidence to each acceptance criterion.
3. Create `docs/handoffs/YYYY-MM-DD-phase-N.md` from the template.
4. Mark `Needs review` for criteria that require owner/manual validation.
5. Mark `Complete` and activate the next phase only when all criteria pass.

Stop instead of improvising when a provider requires credential extraction, dangerous bypass flags, broad filesystem access, or behavior contrary to `13-risks-and-policy.md`.
