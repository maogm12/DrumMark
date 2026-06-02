# Canonical V1 Spec Rewrite

## Status

complete - implementation reviewed and approved

Implementation gate: `Status: APPROVED_FOR_IMPLEMENTATION` must be recorded in `history.md` before Task 2, Task 3, or Task 4 edits. Chat approval alone is not sufficient for this rewrite.

## Problem

`docs/DRUMMARK_SPEC.md` is no longer a reliable canonical specification. The first half still describes older rules such as `divisions` as normative, while later addenda supersede those rules with `note 1/N`, Note Units, Rust/WASM parser ownership, routed blocks, dynamics, navigation refinements, and other accepted behavior.

This creates real release risk: a reviewer or implementer can read the wrong section and make a plausible but incorrect decision. The pickup plan review already exposed this failure mode when deprecated `divisions` language was treated as current truth.

## Goal

Create a clean v1 canonical language specification that:
- integrates accepted addenda into the main body,
- removes or clearly quarantines superseded rules,
- makes `note 1/N` and Note Units the normative rhythmic model,
- keeps deprecated compatibility behavior visible but secondary,
- preserves the old append-only artifact for historical archaeology,
- defines a sustainable maintenance process for future spec changes.

## Non-goals

- No parser, layout, MusicXML, WASM, UI, or CLI behavior changes.
- No new DrumMark syntax beyond already accepted or actively planned v1 features.
- No rewrite of `RENDER_LAYOUT_CONTRACT.md` except small cross-reference adjustments if the spec filename/section anchors require it.
- No migration of legacy proposal files under `docs/proposals/`.
- No attempt to resolve active feature plans that are not yet implemented or human-stamped.

## Current Plan

Rewrite `docs/DRUMMARK_SPEC.md` in place as the canonical v1 language spec, with explicit user approval for a non-append-only rewrite. Preserve the current file contents under an archival path before replacing the active spec body.

The canonical spec should read as today's truth, not as a chronological ledger. Historical rationale remains in:
- archived copy of the old addendum-based spec,
- `docs/changes/archive/...` change histories,
- active change folders for plans not yet implemented.

Proposed active spec structure:

```text
1. Status And Scope
2. Document Model And Compilation Pipeline
3. Header Grammar
4. Rhythmic Unit Model
5. Paragraphs, Tracks, Routing, And Auto-Fill
6. Measures, Barlines, And Validation
7. Tokens, Durations, Groups, And Tuplets
8. Instruments, Modifiers, Sticking, And Voices
9. Repeats, Voltas, Navigation, Measure Repeats, And Multi-Rests
10. Directives: Dynamics, Hairpins, Tempo, Comments
11. Normalized IR
12. MusicXML Export
13. Compatibility And Deprecated Syntax
14. Examples
15. Maintenance Policy
```

Active but not-yet-implemented feature plans (`@partial:<N>`, `@mark`, `@section`, modifier visual/export completion) should not be silently folded into the accepted canonical spec. They may be mentioned only in a short "Planned v1 changes" section that links to the active change folders and labels them as not yet part of accepted spec behavior.

## Spec Delta

This change intentionally rewrites an active append-only spec. The user request is the approval direction for starting a rewrite plan, but implementation still requires an explicit human stamp before editing `docs/DRUMMARK_SPEC.md`.

Normative changes to the active spec document:
- Replace the addendum-led document shape with an integrated canonical v1 spec.
- Make `note 1/N` and Note Units the primary rhythmic unit model.
- Move `divisions` to compatibility/deprecated syntax and define it only as backward-compatible input that maps to a derived `note 1/N` when possible.
- Replace older token-weight/divisions validation wording with exact musical-duration validation and equivalent Note Unit counts.
- Integrate accepted addenda for:
  - chained measure-repeat resolution,
  - multi-marker navigation measures,
  - positional navigation anchors and barline forcing,
  - implicit repeat-end behavior for intermediate voltas and later clarifications,
  - base rhythmic unit and paragraph overrides,
  - rhythmic group span measured in Note Units,
  - duration multiplication modifier semantics,
  - trailing modifiers and single-note group modifier attachment,
  - string quoting for text headers,
  - Rust/WASM parser backend ownership,
  - relaxed multi-measure rest spelling,
  - explicit routed block syntax,
  - crescendo/decrescendo hairpins,
  - volta-terminator plus repeat-start coalescing,
  - explicit dynamic marks.
- Add a maintenance policy stating that future accepted spec deltas must be integrated into the canonical sections during merge, while rationale and review history stay in change folders.

Historical preservation:
- Archive the pre-rewrite `docs/DRUMMARK_SPEC.md` content under `docs/archived/DRUMMARK_SPEC_addendum_ledger_2026-06-01.md`.
- The archived file must be read-only context and not an active spec.

## Affected Specs / Contracts

- `docs/DRUMMARK_SPEC.md`
- `.agents/skills/change-workflow/references/project-rules.md`

Potential cross-reference updates only if needed:
- `docs/RENDER_LAYOUT_CONTRACT.md`

## Tasks

### Task 1: Inventory Accepted And Planned Spec Material

Status: Done

Scope:
- `docs/DRUMMARK_SPEC.md`
- `docs/changes/active/*/plan.md`
- relevant archived change histories if needed for status

Action:
- Build a concise inventory of addenda and classify each as accepted/current, superseded, compatibility-only, future/planned, or implementation architecture note.
- Identify contradictions that must be resolved in the canonical body, especially `divisions` vs `note 1/N`.
- Identify active feature plans that must remain linked but not accepted into canonical behavior.

Input / Output Contract:
- No active spec rewrite yet.
- Inventory must be a durable review artifact, either in `history.md` under `## Spec Inventory / Disposition` or in a dedicated tracked file under this change folder.
- Do not use `## Consolidated Changes` as the inventory scratchpad; that section remains reserved for the final merge summary required by the workflow.
- Do not remove the inventory before merge.

Dependencies:
- Human stamp is not required for inventory, but no `DRUMMARK_SPEC.md` body rewrite starts before the stamp.

Acceptance:
- Every addendum in the old spec has an explicit disposition.
- Active planned features are not mixed with accepted behavior.
- The durable inventory remains available for implementation review and future archaeology.

Verification:
- `rg -n "^## Addendum|^## [0-9]+\\.|^## Appendix" docs/DRUMMARK_SPEC.md`
- Targeted reads of active change folders.

### Task 2: Archive The Legacy Addendum Ledger

Status: Done

Scope:
- `docs/archived/DRUMMARK_SPEC_addendum_ledger_2026-06-01.md`

Action:
- Copy the pre-rewrite `docs/DRUMMARK_SPEC.md` into the archived path.
- Add a short top notice marking it as historical context and pointing readers to the canonical active spec.

Input / Output Contract:
- The archive must preserve the old content for traceability.
- The archive is not an active spec or contract.

Dependencies:
- Human stamp for non-append-only rewrite.
- `Status: APPROVED_FOR_IMPLEMENTATION` recorded in `history.md`.

Acceptance:
- Old addenda remain discoverable after the active spec rewrite.

Verification:
- `test -f docs/archived/DRUMMARK_SPEC_addendum_ledger_2026-06-01.md`
- Manual spot check that old addendum headings are present in the archive.

### Task 3: Rewrite `DRUMMARK_SPEC.md` As Canonical V1

Status: Done

Scope:
- `docs/DRUMMARK_SPEC.md`

Action:
- Replace the addendum-led spec with the proposed canonical structure.
- Integrate accepted current behavior into the appropriate sections.
- Add explicit compatibility/deprecated syntax section for `divisions` and other retained legacy spellings.
- Add a short planned-v1 section linking active feature plans without treating them as accepted behavior.
- Add maintenance policy for future spec deltas.

Input / Output Contract:
- Canonical spec must be internally consistent.
- Normative language must describe current accepted behavior only.
- No review transcripts, rejected alternatives, or implementation chatter in the active spec.

Dependencies:
- Task 1 inventory.
- Task 2 archive.
- Human stamp for rewrite.
- `Status: APPROVED_FOR_IMPLEMENTATION` recorded in `history.md`.

Acceptance:
- No active spec section presents `divisions` as the primary required rhythmic header.
- `note 1/N` and Note Units are described before token/group validation.
- Accepted addenda are integrated into the main body rather than repeated as chronological addenda.
- Deprecated behavior is isolated under compatibility.
- Active planned features are clearly labeled as planned/not-yet-accepted.
- Planned features such as `@partial:<N>`, `@mark`, `@section`, and modifier visual/export completion do not appear in normative MUST/SHALL language outside the planned-v1 section until their implementation changes are accepted.

Verification:
- `rg -n "divisions|Addendum|Supersession|Proposed|deprecated|note 1/" docs/DRUMMARK_SPEC.md`
- `rg -n "@partial|@mark|@section|modifier visual|not accepted|not implemented|planned" docs/DRUMMARK_SPEC.md`
- Manual review of all section headings.

### Task 4: Update Cross-References And Workflow Rules

Status: Done

Scope:
- `docs/RENDER_LAYOUT_CONTRACT.md` only if it points to obsolete spec sections.
- `.agents/skills/change-workflow/references/project-rules.md`

Action:
- Update references that become stale because of the canonical rewrite.
- Update the change workflow project rules so future Spec / Contract Changes integrate accepted spec deltas into the canonical spec sections during merge, rather than appending chronological addenda by default.
- The rule should still allow append-only behavior for specs that have not been explicitly converted to canonical-integrated maintenance.

Input / Output Contract:
- Do not rewrite layout contract behavior as part of this change.
- Process rules belong in the workflow skill/project-rules, not in `LEARNINGS.md`.

Dependencies:
- Task 3.
- `Status: APPROVED_FOR_IMPLEMENTATION` recorded in `history.md`.

Acceptance:
- References to the old addendum-led spec do not mislead future agents.
- Future agents following the change workflow can see the new canonical-spec maintenance rule before planning another spec change.

Verification:
- `rg -n "DRUMMARK_SPEC|addendum|canonical|append-only|Spec Merge Protocol" .agents/skills/change-workflow/references/project-rules.md docs/RENDER_LAYOUT_CONTRACT.md`

### Task 5: Review And Verification

Status: Done

Scope:
- Spec docs and archival artifact.

Action:
- Run focused text checks.
- Run project docs/build checks if available and low-cost.
- Request implementation review after the rewrite is complete.

Input / Output Contract:
- No source behavior changes expected.

Dependencies:
- Tasks 1-4.

Acceptance:
- Implementation review reaches `STATUS: APPROVED`.

Verification:
- `npm run build` if docs build is coupled to the Vite build and practical.
- Otherwise document why build was skipped and run focused `rg`/manual consistency checks.

## Test Plan

- `rg -n "^## Addendum|Supersession|Proposed" docs/DRUMMARK_SPEC.md`
- `rg -n "divisions|note 1/|Note Unit|ExpectedSlots" docs/DRUMMARK_SPEC.md`
- `rg -n "2026-06-01-first-measure-pickup|2026-06-01-rehearsal-section-marks|2026-06-01-modifier-visual-export-completion" docs/DRUMMARK_SPEC.md`
- `rg -n "@partial|@mark|@section|modifier visual|not accepted|not implemented|planned" docs/DRUMMARK_SPEC.md`
- `test -f docs/archived/DRUMMARK_SPEC_addendum_ledger_2026-06-01.md`
- `rg -n "DRUMMARK_SPEC|addendum|canonical|append-only|Spec Merge Protocol" .agents/skills/change-workflow/references/project-rules.md`
- `npm run build` if practical; otherwise record a skip reason because this is a docs-only rewrite.

## Risks / Notes

- Biggest risk is accidentally promoting planned-but-unimplemented features into accepted spec. Keep active feature plans linked but clearly marked as planned.
- Second risk is losing historical rationale. Archive the old spec before rewriting.
- Because active specs are normally append-only, this change requires explicit human approval for a rewrite.
- The rewrite may expose unresolved contradictions; if so, pause and record them in `history.md` instead of guessing.
- This change should probably be reviewed more strictly than a normal docs edit because it becomes the source of truth for v1.

## Linked Items

- GitHub Issue: N/A
- Bug: v1 release readiness / spec maintainability
- ADR: N/A
- PR: N/A

## Revision Log

| Round | Date | Summary of changes |
|-------|------|--------------------|
| 1 | 2026-06-01 | Initial draft |
| 2 | 2026-06-01 | Addressed plan review: made inventory durable, made workflow-rule update required, hardened human-stamp gate, and added planned-feature verification. |
