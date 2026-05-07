# DRUMMARK_SPEC_tasks_crescendo_decrescendo.md

## Execution Plan: Crescendo & Decrescendo Hairpins

### Task 1: Grammar — Add hairpin tokens to Lezer grammar
- [x] **Status**: Done
- **Scope**: `src/dsl/drum_mark.grammar`
- **Commits**:
  - `feat(grammar): add CrescendoStart, DecrescendoStart, HairpinEnd tokens`
  - Add `<`, `>`, `!` as standalone `MeasureExpr` alternatives. Add them to `GroupItem` so they are valid inside `GroupExpr` as well. Remove the `GroupToken`/`MeasureToken` split — a single token list serves all contexts.
- **Acceptance Criteria**:
  - `npm run drummark` parses `<`, `>`, `!` inside measures and routing groups `{< d d}` without error.
  - `npm run drummark` parses `<` / `>` / `!` inside rhythmic groups `[2: < d d]` without error.
  - `npm run drummark` rejects hairpin-only groups `[2: < !]` (group must contain at least one duration-consuming item).
- **Dependencies**: none

### Task 2: IR Types — Add HairpinIntent type and NormalizedMeasure field
- [x] **Status**: Done
- **Scope**: `src/dsl/types.ts`
- **Commits**:
  - `feat(ir): add HairpinIntent type and hairpins field to NormalizedMeasure`
  - Define `HairpinIntent { type: "crescendo" | "decrescendo"; start: Fraction; end: Fraction }`.
  - Add `hairpins?: HairpinIntent[]` to `NormalizedMeasure`.
- **Acceptance Criteria**:
  - TypeScript compilation passes.
  - Types match the approved proposal schema.
- **Dependencies**: none (can run parallel to Task 1)

### Task 3: Lezer Skeleton — Wire hairpin tokens into parse tree
- [x] **Status**: Done
- **Scope**: `src/dsl/lezer_skeleton.ts`
- **Commits**:
  - `feat(parser): extract hairpin tokens from Lezer parse tree into AST`
  - In the skeleton converter, recognize `CrescendoStart`, `DecrescendoStart`, `HairpinEnd` nodes and map them to new AST node types.
- **Acceptance Criteria**:
  - `npm run drummark --format ir <file-with-hairpins>` shows hairpin AST nodes in the raw IR.
- **Dependencies**: Task 1

### Task 4: Normalization — Implement cross-measure carry-forward algorithm
- [x] **Status**: Done
- **Scope**: `src/dsl/normalize.ts`, `src/dsl/types.ts`
- **Commits**:
  - `feat(normalize): implement hairpin carry-forward and HairpinIntent emission`
  - Track `carryForwardType` per-score. Per-measure loop: inherit, process tokens, close at measure end, carry forward.
  - Zero-length guards in both Start and End token branches.
  - **No** carry-forward reset at paragraph boundaries (per Post-Approval Amendment 2026-05-04).
  - Group-level hairpin extraction: during `GroupExpr` normalization, hairpin tokens inside the group participate in the same `activeStart`/`activeType` state machine. Absolute positions: `currentStart` (already absolute in musical time). Hairpins extracted to measure-level `hairpins` array. Hairpin tokens do not advance `currentStart`.
  - Add `kind === "crescendo_start" | "decrescendo_start" | "hairpin_end"` cases to `calculateTokenWeightAsFraction` in `logic.ts` returning `{ numerator: 0, denominator: 1 }`. Required for `totalWeight` pre-computation in group normalization (zero-weight tokens must not distort duration distribution).
  - Cross-track merge: same type + position → collapse; different type → error; different positions → error.
- **Acceptance Criteria**:
  - `npm run drummark --format ir` on Example 1-7 from the proposal produces matching IR output.
  - Cross-measure pattern: `<` in measure N, `>` in measure N+1 produces correct non-overlapping HairpinIntents (no zero-length artifacts).
  - `!` terminates at correct Fraction position.
  - Group-level hairpins: `[2: < d d d !]` produces hairpin with correct absolute positions (groupStart + subPosition).
  - Cross-track errors are caught during normalization.
- **Dependencies**: Task 2, Task 3

### Task 5: VexFlow Rendering — Two-pass hairpin wedge overlay
- [x] **Status**: Done
- **Scope**: `src/vexflow/renderer.ts`
- **Commits**:
  - `feat(renderer): two-pass hairpin wedge rendering with skyline integration`
  - Post-format pass: scan `hairpins` across all formatted measures, identify mergeable spans (consecutive same-type position-0 hairpins, no paragraph break, no time/note changes).
  - Draw SVG `<polygon>` wedges below staff (crescendo: narrow → wide; decrescendo: wide → narrow).
  - Register wedges in skyline to avoid annotation collisions.
  - Rendering params: 10px below staff, 1px line, 8-24px aperture.
- **Acceptance Criteria**:
  - `npm run drummark --format svg` on hairpin examples produces visible wedge graphics.
  - Multi-measure crescendo renders as one continuous wedge.
  - Wedges don't overlap with sticking or other annotations.
  - `npm run drummark` confirms no regressions on existing test files.
- **Dependencies**: Task 4

### Task 6: MusicXML Export — Add wedge elements
- [x] **Status**: Done
- **Scope**: `src/dsl/musicxml.ts`
- **Commits**:
  - `feat(musicxml): export hairpins as MusicXML wedge elements`
  - Single-measure: `<wedge type="crescendo">` + `<wedge type="stop">`.
  - Multi-measure: `crescendo/diminuendo` → `continue` → `stop` pattern.
  - `placement="below"`, correct `<offset>` values.
- **Acceptance Criteria**:
  - `npm run drummark --format xml` on hairpin examples produces valid MusicXML with `<wedge>` elements.
  - Multi-measure output passes MusicXML validation (continue/stop pattern).
- **Dependencies**: Task 4

### Task 7: Syntax Highlighting — Add hairpin token colors
- [x] **Status**: Done
- **Scope**: `src/drummark.ts` (or relevant editor/highlighting module)
- **Commits**:
  - `feat(highlight): add syntax highlighting for < > ! hairpin tokens`
- **Acceptance Criteria**:
  - `<`, `>`, `!` tokens are visually distinct in the editor/highlighter.
- **Dependencies**: Task 1

### Task 8: Consolidate into SPEC
- [x] **Status**: Done
- **Scope**: `docs/DRUMMARK_SPEC.md`
- **Commits**:
  - `docs(spec): consolidate crescendo/decrescendo addendum into DRUMMARK_SPEC.md`
  - Append clean Addendum to spec file (no review noise).
- **Acceptance Criteria**:
  - DRUMMARK_SPEC.md contains the final approved hairpin syntax, IR schema, grammar rules, rendering spec, and MusicXML spec.
- **Dependencies**: Task 4 (core feature working)


## Post-Approval Amendment 2026-05-06: Allow Hairpins Inside Rhythmic Groups

### Task Amendment Summary

Per proposal amendment 2026-05-06 (approval of hairpins inside rhythmic groups), the following task changes apply:

- **Task 1**: `GroupItem` now includes `CrescendoStart`, `DecrescendoStart`, `HairpinEnd`. The `GroupToken`/`MeasureToken` split is removed. Hairpin-only groups (`[2: < !]`) are rejected.
- **Task 4**: Group normalization loop integrates hairpin tokens into the measure-level `activeStart`/`activeType` state machine. Hairpins extracted with absolute positions (`currentStart`, already absolute in musical time). Hairpin tokens excluded from trailing modifier propagation (implicit via token kind matching). `calculateTokenWeightAsFraction` updated with zero-weight cases for hairpin token kinds.

### Review Round 1 (Tasks Amendment)

**Date:** 2026-05-06

Review of the tasks file amendments for hairpin-in-group support.

- **Task 1 scope:** Correct. Grammar change is accurately described: remove `GroupToken` split, expand `GroupItem`. Acceptance criteria now test both positive (parse succeeds) and negative (hairpin-only group rejected) cases.
- **Task 4 scope:** Correct. Describes group-level hairpin extraction via the existing state machine. The "no carry-forward reset at paragraph boundaries" note reflects the 2026-05-04 Post-Approval Amendment correctly. `calculateTokenWeightAsFraction` zero-weight cases are documented — this prevents `totalWeight` pre-computation crashes in group normalization, measure-level rest-padding, and braced-block weight checks.
- **No new tasks needed:** The grammar change is a simplification (fewer token categories), and the normalization change is additive (extraction loop + three `case` clauses in weight function). The renderer (Task 5) and MusicXML (Task 6) are unaffected — they operate on `HairpinIntent` at the measure level, which remains unchanged.
- **Acceptance criteria:** Now cover boundary-spanning hairpins (e.g., `d < [2: d d ! d]` where `<` is outside and `!` is inside) and group-level hairpin position correctness.
- **Minor:** No dependency change — Task 4 still depends on Tasks 2 and 3. The group extraction logic is part of the same normalization loop.

STATUS: APPROVED

## Post-Approval Amendment 2026-05-06-B: Execution Order And Rendering Alignment

### Task Amendment Summary

This amendment supersedes parts of Tasks 3, 5, and 8 to match the approved implementation constraints and the current codebase.

- **Spec gate before implementation:** Spec consolidation is not an end-of-plan implementation task. After proposal/tasks approval and user stamp, append the clean addendum to `docs/DRUMMARK_SPEC.md` before starting Task 1. Task 8 is therefore reclassified as a pre-implementation gate and removed from the executable task sequence.
- **Task 3 verification correction:** Replace the acceptance criterion "`npm run drummark --format ir <file-with-hairpins>` shows hairpin AST nodes in the raw IR" with parser-level verification through tests or direct skeleton/AST entry points. The CLI strips `ast` from IR output.
- **Task 5 rendering correction:** Replace "Draw SVG `<polygon>` wedges" with "Render wedges through VexFlow `StaveHairpin` segments." Cross-system spans are split into one segment per rendered system. No custom SVG overlay implementation is permitted.

### Effective Task Reinterpretation

#### Gate 0: Consolidate Into SPEC

- **Status**: Required before Task 1
- **Scope**: `docs/DRUMMARK_SPEC.md`
- **Action**: Append the clean, approved hairpin addendum after user stamp.

#### Task 3: Lezer Skeleton

Updated acceptance criteria:

- Skeleton / AST tests confirm `CrescendoStart`, `DecrescendoStart`, and `HairpinEnd` lower into the expected token shapes.
- Normalized CLI IR confirms `hairpins` in the normalized output, not raw AST visibility.

#### Task 5: VexFlow Rendering

Updated implementation notes:

- Use VexFlow `StaveHairpin` for rendered wedges.
- Merge consecutive compatible measures only within the same rendered system.
- Split multi-measure spans at system boundaries into separate VexFlow hairpin segments.
- Do not add manual SVG `<polygon>` or other non-VexFlow score drawing code.

### Review Round 2 (Tasks Amendment)

**Date:** 2026-05-06

Review of the execution-order and rendering-alignment amendment.

- **Execution order:** Correct. Reclassifying spec consolidation as Gate 0 brings the task plan back into compliance with `AGENTS.md`.
- **Task 3 acceptance:** Correct. The prior CLI-based AST assertion was impossible because `src/cli.ts` removes `ast` before serializing IR.
- **Task 5 rendering scope:** Correct. The repository permits VexFlow-driven score rendering only; using `StaveHairpin` is consistent with that rule and with the installed VexFlow surface.
- **No missing scope introduced:** The amendment changes validation and rendering mechanics, not DSL behavior, normalization semantics, or MusicXML shape.

STATUS: APPROVED
