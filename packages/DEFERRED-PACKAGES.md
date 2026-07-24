# Deferred package interfaces

Phase 1 creates the named architectural package boundaries without implementing
their Phase 2+ behaviour. Each package is independently buildable and intentionally
exports only a marker. This avoids prematurely coupling the server to provider
process logic, fake runs, skill projection, or workspace writes.

| Package                         | Deferred until                                           |
| ------------------------------- | -------------------------------------------------------- |
| provider-base and provider-fake | Phase 2 local fake-provider chat                         |
| provider-codex                  | Phase 3 Codex Personal Mode adapter                      |
| provider-claude                 | Phase 4 Claude Personal Mode adapter                     |
| skills and workspace            | Phase 5 skills, instructions, and leases                 |
| test-support                    | Expanded with deterministic provider fixtures in Phase 2 |

These packages must retain the dependency direction in
docs/02-system-architecture.md; provider packages must never import one
another, the database, or the web UI.
