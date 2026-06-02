# Canonical V1 Spec Rewrite History

## 2026-06-01

### Draft Created

Plan file: `docs/changes/active/2026-06-01-canonical-v1-spec-rewrite/plan.md`

Status: pending plan review and human stamp before implementation.

Context:
- User requested a spec rewrite that integrates addenda into a maintainable canonical spec.
- Current `DRUMMARK_SPEC.md` is normally append-only, so the implementation will require explicit approval for a non-append-only rewrite.

### Plan Review Round 1

Reviewer: subagent `019e81d2-9231-7a20-8b2c-56f3f70ed8bb`

Status: CHANGES_REQUESTED

Findings:
- Medium: Task 1 inventory could be treated as temporary scratch and might not leave a durable disposition record for every old addendum.
- Medium: `.agents/skills/change-workflow/references/project-rules.md` was described as an optional cross-reference even though the plan requires updating workflow rules.
- Low: Human-stamp gate should mechanically require `Status: APPROVED_FOR_IMPLEMENTATION` in `history.md` before rewrite edits.
- Low: Active/planned feature boundary needed harder verification so planned features do not appear as accepted normative behavior.

Resolution:
- Required a durable `## Spec Inventory / Disposition` record in `history.md` or a tracked change artifact; prohibited using `## Consolidated Changes` as inventory scratch.
- Listed `.agents/skills/change-workflow/references/project-rules.md` as an affected process artifact.
- Added an implementation gate requiring `Status: APPROVED_FOR_IMPLEMENTATION` in `history.md` before Task 2, Task 3, or Task 4 edits.
- Added acceptance and `rg` checks for planned features and non-normative wording.

### Plan Review Round 2

Reviewer: subagent `019e81d2-9231-7a20-8b2c-56f3f70ed8bb`

Status: APPROVED

Summary:
- Durable inventory record requirement is now explicit.
- `.agents/skills/change-workflow/references/project-rules.md` is now a required affected artifact.
- Human-stamp gate now mechanically requires `Status: APPROVED_FOR_IMPLEMENTATION` in `history.md` before Task 2/3/4 edits.
- Planned-feature boundary now has explicit acceptance and verification checks.

### Approved Plan

Approved file: `docs/changes/active/2026-06-01-canonical-v1-spec-rewrite/plan.md`
Approved summary:
- Rewrite `docs/DRUMMARK_SPEC.md` into a canonical v1 spec only after archiving the old addendum ledger.
- Preserve durable addendum disposition inventory.
- Update workflow project rules so future spec deltas integrate into canonical sections instead of appending chronological addenda by default.

Open conditions:
- Human stamp required before implementation: `Status: APPROVED_FOR_IMPLEMENTATION` must be recorded in this history file before Task 2, Task 3, or Task 4 edits.

## Human Stamp

Date: 2026-06-01
Approved by: user
Approved plan: `docs/changes/active/2026-06-01-canonical-v1-spec-rewrite/plan.md`
Approved plan commit: `3e73189`
Scope: Rewrite `docs/DRUMMARK_SPEC.md` into a canonical v1 spec, archive the old addendum ledger, and update workflow maintenance rules for future spec changes.

Approval text:

> stamp了，把这个做了吧

Conditions:
- Keep active planned features (`@partial:<N>`, `@mark`, `@section`, modifier visual/export completion) out of accepted normative sections.
- Preserve a durable inventory of old addendum disposition.

Status: APPROVED_FOR_IMPLEMENTATION

## Spec Inventory / Disposition

Source:
- `docs/DRUMMARK_SPEC.md`

Disposition summary:
- `Addendum 2026-04-30: Chained Measure Repeat Resolution` -> integrate into canonical measure-repeat rules.
- `Addendum 2026-04-30: Multi-Marker Navigation Measures` -> integrate into canonical navigation and measure metadata rules.
- `Addendum 2026-04-30B: Multi-Marker Canonical Representation Clarification` -> integrate into canonical IR/navigation schema.
- `Addendum 2026-04-30C: Positional Navigation Anchors and Barline Forcing` -> integrate into navigation placement, barline forcing, and canonical schema.
- `Addendum 2026-04-30D: Positional Navigation Canonical Schema Clarification` -> integrate into canonical navigation schema and legality rules.
- `Addendum 2026-04-30E: Tagged Navigation Union Refinement` -> integrate into canonical IR/navigation schema.
- `Addendum 2026-04-30F: Pure Navigation Measure Default Anchors` -> integrate into pure-navigation measure rules.
- `Addendum 2026-04-30G: Implicit Repeat-End for Intermediate Voltas` -> integrate into volta/repeat semantics.
- `Addendum 2026-04-30H: Clarification of Addendum G` -> integrate into volta/repeat semantics; stale standalone addendum heading removed from active spec.
- `Addendum 2026-05-02: Base Rhythmic Unit and Paragraph Overrides` -> integrate as the primary rhythmic model.
- `Addendum 2026-05-02-B: Clarification of Rhythmic Units in Groups` -> integrate into rhythmic-group and validation sections.
- `Addendum 2026-05-02-C: Duration Multiplication Modifier` -> integrate into canonical duration-modifier rules; stale `Proposed` label removed because current implementation already supports `*`.
- `Addendum v1.4: Trailing Modifiers and Single-Note Group Modifier Attachment` -> integrate into token/group syntax.
- `Addendum 2026-05-04: String Quoting for Text Headers` -> superseded by `Addendum 2026-05-06`; preserve only in archived ledger.
- `Addendum 2026-05-06: Lezer Grammar Formalization and Free-Text Header Restoration` -> integrate as current header/routing/grammar-boundary behavior, but describe parser ownership in current Rust/WASM terms.
- `Addendum: Relaxed Multi-Measure Rest Spelling` -> integrate into multi-rest syntax and validation rules.
- `Addendum: Explicit @TRACK { ... } Routed Block Syntax` -> integrate into routed-block syntax and track registration rules.
- `Addendum 2026-05-06-D: Crescendo / Decrescendo Hairpins` -> integrate into directives, normalized IR, layout, and MusicXML sections.
- `Addendum 2026-05-07: Future Feature Lane Classification` -> do not copy verbatim; replace with a short planned-v1 section that links current active change folders without promoting them to accepted behavior.
- `Addendum 2026-05-08: Volta-Terminator + Repeat-Start Coalescing (|:.)` -> integrate into barline syntax and repeat/volta semantics; stale `Proposed` label removed because current implementation already carries dedicated barline support.
- `Addendum v1.6: Rust/WASM Parser Backend` -> integrate into document model / compilation pipeline ownership, without retaining size-reporting minutiae in normative sections.
- `Addendum 2026-05-20: Explicit Dynamic Marks` -> integrate into directive syntax, normalized IR, render contract summary, layout semantics, and MusicXML export.

## Consolidated Changes

Source:
- `plan.md` > `## Spec Delta`

Affected specs/contracts:
- `docs/DRUMMARK_SPEC.md`
- `.agents/skills/change-workflow/references/project-rules.md`

Summary:
- Rewrote `docs/DRUMMARK_SPEC.md` into a canonical-integrated v1 spec and moved the historical addendum ledger to `docs/archived/DRUMMARK_SPEC_addendum_ledger_2026-06-01.md`.
- Integrated accepted addenda into canonical sections covering rhythmic units, routing, groups, navigation, multi-rests, hairpins, dynamics, IR, and MusicXML export.
- Moved `divisions` to deprecated compatibility status while keeping it documented as a current compatibility input and derived IR field.
- Added a planned-v1 section that links active pickup, rehearsal/section marks, and modifier-completion changes without promoting them to accepted behavior.
- Updated workflow project rules so future canonical-integrated specs merge accepted deltas back into the active spec body instead of appending chronological addenda by default.

Final integration location:
- Integrated into `docs/DRUMMARK_SPEC.md` sections:
  - `## 1. Scope`
  - `## 2. Document Model And Ownership`
  - `## 3. Headers`
  - `## 4. Rhythmic Unit Model`
  - `## 5. Tracks, Routing, And Auto-Fill`
  - `## 6. Measure Content`
  - `## 7. Structural Syntax`
  - `## 8. Expressive Directives`
  - `## 9. Validation Rules`
  - `## 10. Canonical Normalized IR`
  - `## 11. MusicXML Export`
  - `## 12. Compatibility And Deprecated Syntax`
  - `## 13. Planned V1 Changes`
  - `## 14. Maintenance Policy`
- Integrated into `.agents/skills/change-workflow/references/project-rules.md`:
  - `## Spec Merge Protocol`

## Implementation Review

### Round 1 - Implementation Review

Reviewer: subagent `019e84d7-1bbd-76e0-9152-d34097934666`

### Comments

1. Canonical spec overstated current header parsing behavior by claiming comment-aware quoted/unquoted header semantics that the parser does not implement.
2. Change record was not closed: plan status still read as draft, Task 5 remained pending, and no implementation-review result had been recorded.
3. Archived ledger header could be misread because the preserved body still contained historical "authoritative source of truth" language.

### Checks

- Tasks complete: not yet
- Tests pass: `npm run build` passed before review
- Spec/contract updated if required: yes
- GitHub Issues updated if applicable: N/A
- ADRs respected: yes
- Scope creep: none

### Agent Response

- Corrected `docs/DRUMMARK_SPEC.md` so header text parsing matches current parser reality: raw remainder-of-line, literal quotes, and literal `#`.
- Strengthened the archive notice to explicitly warn that preserved body status text is intentionally stale historical content.
- Reopened the change record for a second implementation review round and will close plan/history only after approval.

STATUS: CHANGES_REQUESTED

### Round 2 - Implementation Review

Reviewer: subagent `019e84d7-1bbd-76e0-9152-d34097934666`

### Comments

- No findings.

### Checks

- Tasks complete: yes
- Tests pass: `npm run build`
- Spec/contract updated if required: yes
- GitHub Issues updated if applicable: N/A
- ADRs respected: yes
- Scope creep: none

### Agent Response

- Header text semantics in `docs/DRUMMARK_SPEC.md` now match the current parser.
- Archive warning now clearly explains that stale "authoritative source of truth" language is preserved as historical snapshot text.
- Plan and history are ready for close-out.

STATUS: APPROVED
