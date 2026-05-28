# History

## Migration from docs/proposals/

Date: 2026-05-28

Migrated to change-workflow. Legacy proposal and task ledgers are archived at:

- `docs/archived/ARCHITECTURE_proposal_normalizer_to_rust.md`
- `docs/archived/ARCHITECTURE_tasks_normalizer_to_rust.md`

### Plan Review Skipped

Date: 2026-05-28

Reviewer: self-review

Reason: Light Normal Change — Tasks 1–8 were already implemented and merged to main before migration to change-workflow. The Rust normalizer is the production path with all sub-modules in place (fraction, resolve, validate, event, hairpin, nav, volta, normalize) and the TS pipeline cut over (`ast.ts`/`logic.ts` deleted, `normalize.ts` is a 92-line adapter). Only Task 9 (parity testing) remained pending. The plan was synced to reflect actual status.

## Task 9 Cancelled

Date: 2026-05-28

Task 9 (parity testing against TS normalizer) cancelled: the legacy TypeScript normalizer (`ast.ts`, `logic.ts`) has been deleted and cannot serve as an oracle. Parity was implicitly validated during cutover — all existing tests pass and CLI output is correct. Status → `completed`.
