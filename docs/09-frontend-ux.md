# Frontend and interaction specification

## Information architecture

Desktop-first three-region layout:

```text
┌──────────────┬─────────────────────────────────┬──────────────────────┐
│ Rooms        │ Room header + message timeline  │ Inspector            │
│ Agents       │                                 │ Run / context / tool │
│ Search       │ Composer                        │ Skills / permissions │
└──────────────┴─────────────────────────────────┴──────────────────────┘
```

On narrow screens the sidebar and inspector become drawers. The chat timeline remains the primary landmark.

## Required screens

### First-run readiness

- Explain local storage and that provider prompts still go to provider services.
- Show server loopback address and data directory alias.
- Probe Codex and Claude independently.
- For each provider show installed version, capability status, authentication readiness, and safe next action.
- Allow continuing with fake provider or one available provider.

Never embed provider login credentials. An authentication action shows official terminal instructions or launches a visible provider-owned terminal flow.

### Room list

- Create, rename, archive, restore, search, and export.
- Show workspace alias, last activity, active run count, and unread failures/approvals.
- Provider outage must not block opening history.

### Room

Header shows room title, workspace, effective permission, participant chips, provider health, and active-run stop control.

Timeline message types:

- Human message with mentions/reply/attachments.
- Agent message with agent/provider label and run status.
- Partial agent message with live cursor and cancellable state.
- Compact tool activity disclosure.
- Approval card.
- System/audit notice.
- Failure card with safe retry path and diagnostic reference.

### Provider settings

- Executable path: auto-detected or owner-selected.
- Version and last probe time.
- Capability matrix.
- Authentication state without token details.
- Adapter enable/disable.
- Concurrency and timeout settings within safe bounds.
- Sanitized probe log download.

### Skills and instructions

Specified in `06-skills-and-instructions.md`, including source/target diff and conflicts.

### Data and diagnostics

- Database/app-data location alias.
- Backup, restore, export, retention, telemetry state.
- Preview diagnostic bundle contents before creation.

## Composer behavior

- `@` opens authorized participant/group autocomplete.
- `$` opens available skill autocomplete.
- Up/down selects; Enter accepts; Escape closes.
- Enter sends and Shift+Enter inserts newline, configurable.
- Pasted large text becomes an attachment after confirmation.
- Drag/drop validates before upload.
- Reply chip shows message author and excerpt.
- Inferred reply target is rendered as a removable target chip and submitted explicitly.
- Send button is disabled only for invalid input, not because one unrelated provider is unavailable.

Mention spans are server-resolved after send. The optimistic UI may highlight candidates but must reconcile with canonical resolved targets.

## Streaming behavior

- Append text without rerendering the whole Markdown tree on every token; batch UI updates to animation frames or short intervals.
- Preserve selection and focus.
- Auto-scroll only if the user is near the bottom; otherwise show “new content” affordance.
- Tool events collapse by default and never expose raw unsafe HTML.
- Completion replaces transient stream representation with canonical message while preserving visual position.
- Cancellation keeps partial text and labels it “Cancelled — partial response.”

## Run inspector

Shows:

- run and agent identity;
- lifecycle timeline;
- queue/start/end times;
- provider version and opaque session alias (not full ID by default);
- permission profile and workspace;
- context manifest and referenced message links;
- tool summaries and approvals;
- normalized error and diagnostic reference;
- retry/fork actions when safe.

Do not display or claim access to hidden chain-of-thought.

## Context inspector

Users can answer “what did this agent see?” It lists source messages, instruction/skill names and hashes, attachments, truncations, context mode, and captured room sequence. It may show the assembled user-visible prompt in a redacted preview, but never provider credentials or private reasoning.

## Approval UX

- Modal/drawer cannot be confused with a normal chat message.
- State exact action and scope in plain language.
- Default focus is safe; keyboard shortcut cannot accidentally approve.
- Approve once, deny, and optionally inspect details.
- Expired/stale request cannot be approved.
- Permission escalation explains duration and workspace scope.

## Accessibility

- Semantic landmarks, headings, lists, buttons, and live regions.
- Streaming uses polite announcements aggregated into meaningful chunks, not token-by-token speech.
- All actions are keyboard reachable with visible focus.
- Color contrast meets WCAG AA; status includes icon and text.
- Respect reduced motion.
- Composer suggestions expose combobox/listbox semantics.
- Tool disclosures and code blocks have accessible names and copy controls.

## Empty/loading/error states

Design explicit states for no rooms, no workspace, provider missing, auth required, usage limit, offline server, database migration, replay, empty search, skill conflict, attachment rejection, and interrupted run. Errors preserve typed drafts when possible.

## UI non-goals

- No fake token/price estimates unless provider supplies reliable usage.
- No model picker populated from hard-coded “latest” names in MVP.
- No dark-pattern permission prompts.
- No automatic external links or file opening from provider output.
