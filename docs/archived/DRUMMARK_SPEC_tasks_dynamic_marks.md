# DRUMMARK_SPEC_tasks_dynamic_marks.md

## Execution Plan: Explicit Dynamic Marks

### Task 1: Lexer and Parser Recognition
- [ ] **Status**: Pending
- **Scope**: `crates/drummark-core/src/lexer.rs`, `crates/drummark-core/src/parser.rs`, parser tests; TypeScript parser boundary only if still active for this syntax path
- **Commits**:
  - `feat(parser): recognize explicit dynamic mark directives`
- **Input/Output Contract**:
  - Input: source measure text containing `@ppp`, `@pp`, `@p`, `@mp`, `@mf`, `@f`, `@ff`, `@fff`, existing `@TRACK` routes, and existing navigation directives.
  - Output: AST measure expressions containing `MeasureExpr::Dynamic(DynamicLevel)` for supported dynamic directives; unchanged AST output for routes/navigation; parse errors for unsupported `@...` forms.
- **Acceptance Criteria**:
  - `npm run drummark -- <fixture> --format ast` shows zero-duration dynamic measure expressions for all supported spellings.
  - Bare `p` remains parsed through existing note-token rules.
  - `@fff` parses as one dynamic token.
  - `@ffff`, `@ffx`, `@sfz`, `@fp`, `@m`, `@pf`, and `@f:accent` fail with parser diagnostics.
  - `@f}`, `@f|`, and `@f }` parse as dynamic plus delimiter in contexts where the delimiter is otherwise legal.
  - Existing `@SD`, `@C`, `@BD2`, `@fine`, `@dc`, and `@dc-al-coda` behavior is unchanged.
- **Dependencies**: none

### Task 2: Dynamic Position Scanner
- [ ] **Status**: Pending
- **Scope**: new or existing normalization helper module under `crates/drummark-core/src/`; focused unit tests with hand-built measure expressions
- **Commits**:
  - `feat(normalize): add recursive dynamic position scanner`
- **Input/Output Contract**:
  - Input: a hand-built sequence of measure expressions plus measure divisions/group duration context.
  - Output: raw `DynamicIntent` candidates with exact measure-local fractions and source locations, before cross-track deduplication/conflict validation.
- **Acceptance Criteria**:
  - Start, mid-measure, and end-of-measure dynamic anchors resolve to `0/1`, the expected interior fraction, and `1/1`.
  - Dynamic marks consume no rhythmic duration.
  - Dynamic marks inside routed blocks anchor at the routed block's outer start plus internal scaled position.
  - Adjacent routed blocks are treated as simultaneous branches, with the surrounding cursor advancing by the maximum rendered routed-block duration.
  - Dynamic marks inside nested groups anchor after recursive group scaling.
  - Groups containing only zero-duration dynamics/hairpins are rejected by existing or updated validation.
  - Dynamic marks inside combined-hit operands are rejected.
- **Dependencies**: Task 1

### Task 3: Normalization Deduplication and Conflict Validation
- [ ] **Status**: Pending
- **Scope**: `crates/drummark-core/src/normalize.rs` or a dedicated dynamic normalization module; Rust normalization tests
- **Commits**:
  - `feat(normalize): collect and validate score-level dynamics`
- **Input/Output Contract**:
  - Input: per-track/per-routed-block dynamic candidates from Task 2 for a logical measure.
  - Output: `NormalizedMeasure.dynamics: Vec<DynamicIntent>` sorted by measure-local fraction, with same-position same-level duplicates collapsed and conflicting levels reported as hard errors.
- **Acceptance Criteria**:
  - Same-position same-level dynamics across tracks deduplicate to one entry.
  - Same-position same-level dynamics repeated in one track deduplicate to one entry.
  - Same-position same-level dynamics across adjacent routed blocks deduplicate to one entry.
  - Same-position different-level dynamics across tracks or routed blocks produce a hard normalization error.
  - Deduplication/conflict keys use logical measure index plus exact measure-local fraction before repeat playback expansion.
  - `npm run drummark -- <fixture> --format ir` includes `dynamics: []` for measures without dynamics and sorted dynamic arrays for measures with dynamics.
- **Dependencies**: Task 2

### Task 4: RenderScore, WASM, and TypeScript Schema Propagation
- [ ] **Status**: Pending
- **Scope**: `crates/drummark-core/src/render_score.rs`, `crates/drummark-layout/src/lib.rs`, WASM object construction under `src/wasm/**` or generated package inputs, `src/dsl/types.ts`, render/IR fixtures
- **Commits**:
  - `feat(render-score): propagate dynamic marks through render contract`
  - `test(render-score): cover dynamic serialization and versioning`
- **Input/Output Contract**:
  - Input: normalized measures with `DynamicIntent` arrays.
  - Output: render measures with explicit `dynamics` arrays using `drummark-layout` render-facing dynamic types and lowercase canonical serialized levels.
- **Acceptance Criteria**:
  - `RenderMeasure` in `drummark-layout` owns public `DynamicLevel` and `DynamicMark` types.
  - Core maps normalized dynamic levels into layout dynamic levels during `RenderScore` construction.
  - Serialized JSON/WASM objects use lowercase levels such as `"ff"` and explicit `dynamics` arrays.
  - `RENDER_SCORE_VERSION` is bumped or fixture loaders migrate missing `dynamics` to empty arrays at fixture boundaries.
  - TypeScript types expose `DynamicLevel` and `DynamicIntent`.
  - Existing parser/render WASM package boundaries remain intact.
- **Dependencies**: Task 3

### Task 5: Layout Scene Dynamic Placement
- [ ] **Status**: Pending
- **Scope**: `crates/drummark-layout/src/lib.rs`; layout unit tests and scene snapshot tests
- **Commits**:
  - `feat(layout): place dynamic marks in lower expression lane`
- **Input/Output Contract**:
  - Input: hand-built `RenderScore` / `RenderMeasure` values containing dynamic marks, notes with lower-side modifier occupancy, and hairpins.
  - Output: `LayoutScene` items with role `dynamic`, resolved text geometry, stable bounds, and lower-side placement below hairpins.
- **Acceptance Criteria**:
  - Dynamics render below the staff as semantic `dynamic` scene items.
  - Dynamic text is centered on anchor X.
  - Start/end dynamics shift inward only enough to remain within visible measure bounds plus `DYNAMIC_EDGE_PADDING_PT`.
  - Reserved bounds use canonical text metrics plus `DYNAMIC_TEXT_PADDING_X_PT` and `DYNAMIC_TEXT_PADDING_Y_PT`.
  - Lower-side pass order is modifiers/articulations, hairpins, dynamics.
  - Dynamics clear hairpin bounds by at least `LOWER_EXPRESSION_GAP_PT`.
  - Dynamics do not push hairpins in the same layout pass.
  - Scene bounds validation passes for dynamic items and affected systems.
- **Dependencies**: Task 4

### Task 6: SVG Adapter Rendering
- [ ] **Status**: Pending
- **Scope**: `src/renderer/svgRenderer.ts`, `src/renderer/svgRendererNode.ts`, adapter tests if needed
- **Commits**:
  - `feat(renderer): paint dynamic text scene items`
- **Input/Output Contract**:
  - Input: `LayoutScene` containing already-positioned `dynamic` text items.
  - Output: SVG text output that paints the resolved scene geometry without measuring or nudging dynamic marks.
- **Acceptance Criteria**:
  - SVG output includes visible dynamic text for `@p`, `@mp`, `@ff`, etc.
  - Adapter does not perform dynamic collision resolution, x positioning, or y lane assignment.
  - Existing scene adapter tests pass.
  - `npm run drummark -- <dynamic-fixture> --format svg` emits dynamic text under the staff.
- **Dependencies**: Task 5

### Task 7: MusicXML Dynamic Export
- [ ] **Status**: Pending
- **Scope**: MusicXML export path in `crates/drummark-core` and/or TypeScript XML exporter if still active; XML tests/fixtures
- **Commits**:
  - `feat(musicxml): export explicit dynamic directions`
- **Input/Output Contract**:
  - Input: normalized/render measure dynamics with exact measure-local fractions.
  - Output: one below-staff `<direction>` per dynamic per percussion part, using `<dynamics><level/></dynamics>` and `<offset>` for measure-local timing.
- **Acceptance Criteria**:
  - `@f` exports as `<direction placement="below"><direction-type><dynamics><f/></dynamics></direction-type>...`.
  - Mid-measure dynamics emit a positive `<offset>` computed from MusicXML divisions.
  - End-of-measure dynamics emit an offset equal to measure duration and remain in the current measure.
  - Two-voice drum measures emit each score-level dynamic once, not once per voice/track.
  - MusicXML export does not introduce a new forward/backup cursor strategy for dynamics.
  - `npm run drummark -- <dynamic-fixture> --format xml` produces expected dynamic directions.
- **Dependencies**: Task 3

### Task 8: End-to-End Fixtures and Regression Gates
- [ ] **Status**: Pending
- **Scope**: `docs/examples/`, parser/IR/SVG/XML fixtures, corpus scripts as appropriate
- **Commits**:
  - `test(dynamics): add end-to-end dynamic mark fixtures`
- **Input/Output Contract**:
  - Input: representative `.drum` fixtures covering supported dynamics, route/nav preservation, conflicts, groups, hairpins, layout, and export.
  - Output: checked test expectations for AST/IR/render scene/SVG/XML paths.
- **Acceptance Criteria**:
  - Fixtures cover all supported dynamic spellings.
  - Negative fixtures cover unsupported `@...` forms and same-position conflicts.
  - Positive fixtures cover `@p ... < ... @f`, nested group dynamics, simultaneous routed blocks, and two-voice MusicXML export.
  - Existing supported corpus gates pass.
- **Dependencies**: Tasks 1, 3, 5, 6, 7

### Task 9: Consolidate Approved Design Into Specification
- [ ] **Status**: Pending
- **Scope**: `docs/proposals/DRUMMARK_SPEC_proposal_dynamic_marks.md`, `docs/DRUMMARK_SPEC.md`
- **Commits**:
  - `docs(spec): consolidate explicit dynamic marks addendum`
- **Input/Output Contract**:
  - Input: approved proposal and completed implementation behavior.
  - Output: append-only `### Consolidated Changes` section in the proposal and a clean append-only addendum in `docs/DRUMMARK_SPEC.md`.
- **Acceptance Criteria**:
  - Proposal file has an appended `### Consolidated Changes` section summarizing the approved v1.8 behavior and implementation result.
  - `docs/DRUMMARK_SPEC.md` contains a clean dynamic marks addendum without review noise.
  - Spec addendum includes syntax, delimiter behavior, timing, routed/group semantics, conflict rules, IR/render contracts, lower-staff layout priority, and MusicXML export.
- **Dependencies**: Tasks 1 through 8

### Review Round 1

The task plan is close, and it clearly tracks the major surfaces from approved Addendum v1.8: lexer/parser, recursive position scanning, global deduplication/conflict validation, RenderScore/WASM propagation, layout lanes, SVG painting, MusicXML export, fixtures, and spec consolidation. It is not yet approval-ready because several task boundaries would still allow an implementer to miss normative v1.8 requirements or violate the repository's required sequencing.

1. Task 9 is ordered incorrectly for this repository's design protocol. The project instructions require consolidation after proposal/tasks approval and explicit user stamp, before implementation begins: append `### Consolidated Changes` to the proposal, then append the clean addendum to `docs/DRUMMARK_SPEC.md`. This file instead makes consolidation the final implementation task after Tasks 1-8. That is not just documentation bookkeeping; it means implementation would proceed before the approved design is landed in the append-only spec. Fix by moving consolidation to a pre-implementation task, or by explicitly marking it as already completed before Task 1 if the user has stamped and consolidation has happened. The final task can still verify the spec is present, but it must not be the first consolidation.

2. Task 2 has hidden coupling around routed-block cluster duration. The v1.8 proposal says adjacent routed blocks at the same surrounding position are simultaneous and the surrounding stream cursor advances by the maximum rendered duration of the routed-block cluster. Task 2's output is only "raw `DynamicIntent` candidates" with positions. That is insufficient to isolate-test the scanner's full responsibility: it must either output enough cursor/cluster duration information for the caller, or its acceptance criteria must verify that the next ordinary token after a routed-block cluster lands after the cluster maximum. Otherwise the simultaneous routed-block rule can be tested only accidentally through downstream normalization.

3. Task 2 does not explicitly cover navigation coexistence at shared positions. Addendum v1.8 allows dynamics to share positions with barline-edge navigation and navigation marks, with layout kept independent. Task 1 preserves navigation lexing, but no normalization task verifies `@segno @p`, mid-measure `@to-coda @mf`, or measure-end `@f @fine` / `@ff @dc` anchors without conflict or cursor movement. This is a proposal requirement, not just an end-to-end fixture nicety.

4. Task 5 misses part of the LayoutScene text contract. v1.8 requires dynamic scene items to use `ScenePrimitive::TextRun`, role `dynamic`, canonical text, font family chosen by layout, italic style, owning measure plus measure-local fraction anchor, and accessible label `dynamic <level>`. The task acceptance covers role, centering, edge shifting, padded bounds, and lower-lane order, but it does not require the primitive type, italic style, metadata anchor preservation after edge shift, or accessibility label. Those are adapter-facing contract details and should be isolated in layout tests rather than left for SVG rendering.

5. Task 4's versioning criterion is too weak for the approved render contract. It says "`RENDER_SCORE_VERSION` is bumped or fixture loaders migrate missing `dynamics` to empty arrays." Addendum v1.8 requires a render-score version bump; fixture migration or fixture updates are compatibility work in addition to the bump, not a substitute for it. The task should require the bump unconditionally, then specify how old fixtures are handled.

6. Task 7's MusicXML contract slightly overstates `<offset>` as mandatory. Approved v1.8 says start-of-measure dynamics may omit `<offset>` or emit zero consistently with existing direction export style, while mid-measure dynamics emit a positive offset and measure-end dynamics emit measure duration. The acceptance criteria should reflect that start-of-measure exception so tests do not force a behavior the proposal intentionally leaves style-compatible.

7. Task 8 is too broad to be independently testable as written. It depends on Tasks 1, 3, 5, 6, and 7, but not Task 4 even though render scene/SVG fixtures require RenderScore/WASM/schema propagation. It also mixes parser negatives, IR conflict behavior, layout snapshots, SVG, XML, corpus gates, and examples into one catch-all task. As a regression gate this is fine, but the task's input/output contract should split fixture classes or name exact commands per path so failures can be attributed without relying on the whole feature stack.

8. Branch and commit suitability is underspecified. The plan lists commit messages per task, but it does not state the dedicated proposal branch required by the implementation workflow. Add a branch line such as `proposal/dynamic-marks` and make clear that tasks land there before the concentrated branch review and squash merge.

9. The task plan should explicitly include updates to `LEARNINGS.md` if implementation requires research into lexer behavior, normalization internals, layout skyline mechanics, WASM serialization, or MusicXML exporter cursor/offset behavior. The repository instructions require append-only learnings after research. This does not need to be its own large task, but it should be an acceptance criterion on the relevant tasks or a small documentation task, otherwise the implementation plan omits a mandatory project rule.

The main implementation split is otherwise sensible: parser recognition can be tested before normalization, scanner/conflict handling can be tested with hand-built structures, RenderScore propagation can precede layout, and MusicXML can be implemented from normalized dynamics without waiting for SVG. The above issues need correction before the tasks file can be considered approved.

STATUS: CHANGES_REQUESTED

### Author Response

Accepted. The original task split covered the main implementation surfaces but misplaced spec consolidation and left several v1.8 requirements as implicit downstream behavior. The revised plan below supersedes the initial plan where they differ.

Key corrections:

- Add a required proposal branch: `proposal/dynamic-marks`.
- Move design consolidation to the first post-stamp, pre-implementation task.
- Make the `RENDER_SCORE_VERSION` bump mandatory.
- Strengthen scanner tests around routed-block cluster cursor advancement and navigation coexistence.
- Strengthen layout tests around `TextRun`, italic style, metadata anchor, and accessibility label.
- Align MusicXML start-of-measure `<offset>` acceptance with the approved proposal.
- Split end-to-end gates by path so failures are attributable.
- Add append-only `LEARNINGS.md` requirements where implementation research is expected.

## Revised Execution Plan v2: Explicit Dynamic Marks

**Implementation Branch**: `proposal/dynamic-marks`

All implementation tasks land on this branch after proposal and tasks approval, explicit user stamp, and Task 1 consolidation. The branch receives one concentrated pre-merge review before squash merge to `main`.

### Task 1: Post-Stamp Design Consolidation
- [x] **Status**: Done
- **Scope**: `docs/proposals/DRUMMARK_SPEC_proposal_dynamic_marks.md`, `docs/DRUMMARK_SPEC.md`
- **Commits**:
  - `docs(spec): consolidate explicit dynamic marks design`
- **Input/Output Contract**:
  - Input: approved proposal, approved tasks file, and explicit user stamp.
  - Output: append-only proposal consolidation plus clean append-only spec addendum before implementation begins.
- **Acceptance Criteria**:
  - Proposal file has an appended `### Consolidated Changes` section summarizing approved v1.8 behavior.
  - `docs/DRUMMARK_SPEC.md` has a clean addendum covering syntax, directive delimiters, timing, routed/group semantics, duplicate/conflict rules, Rust/TS/render contracts, lower-staff layout priority, and MusicXML export.
  - No parser, normalizer, renderer, layout, or exporter implementation files are changed in this task.
- **Dependencies**: approved proposal, approved tasks file, explicit user stamp

### Task 2: Lexer and Parser Recognition
- [x] **Status**: Done
- **Scope**: `crates/drummark-core/src/lexer.rs`, `crates/drummark-core/src/parser.rs`, parser tests; TypeScript parser boundary only if still active for this syntax path
- **Commits**:
  - `feat(parser): recognize explicit dynamic mark directives`
- **Input/Output Contract**:
  - Input: source measure text containing supported dynamic directives, existing route directives, existing navigation directives, and unsupported `@...` forms.
  - Output: AST measure expressions containing `MeasureExpr::Dynamic(DynamicLevel)` for supported dynamics; unchanged AST output for routes/navigation; parser diagnostics for unsupported or malformed `@...` forms.
- **Acceptance Criteria**:
  - `npm run drummark -- <fixture> --format ast` shows dynamic measure expressions for `@ppp`, `@pp`, `@p`, `@mp`, `@mf`, `@f`, `@ff`, and `@fff`.
  - Bare `p` remains parsed through existing note-token rules.
  - Whole-token directive behavior is enforced: `@fff` parses as one dynamic; `@ffff`, `@ffx`, `@sfz`, `@fp`, `@m`, `@pf`, and `@f:accent` fail.
  - Delimiter behavior is covered: `@f}`, `@f|`, and `@f }` parse as dynamic plus delimiter where that delimiter is otherwise legal.
  - Existing `@SD`, `@C`, `@BD2`, `@fine`, `@dc`, and `@dc-al-coda` behavior is unchanged.
  - If lexer/parser research is needed to implement invalid-`@` catch behavior, findings are appended to `LEARNINGS.md`.
- **Dependencies**: Task 1

### Task 3: Recursive Dynamic Position Scanner
- [x] **Status**: Done
- **Scope**: dedicated normalization helper module or existing helper under `crates/drummark-core/src/`; focused unit tests with hand-built measure expressions
- **Commits**:
  - `feat(normalize): add recursive dynamic position scanner`
- **Input/Output Contract**:
  - Input: hand-built measure expression sequences plus exact duration/group context.
  - Output: raw dynamic candidates with level, exact measure-local fraction, source location, and enough cursor accounting to prove routed-block cluster duration advancement.
- **Acceptance Criteria**:
  - Start, mid-measure, and end-of-measure dynamic anchors resolve to `0/1`, expected interior fractions, and `1/1`.
  - Dynamics consume no rhythmic duration.
  - Adjacent routed blocks are simultaneous branches for dynamic anchors.
  - The surrounding cursor advances by the maximum rendered duration of a routed-block cluster; the next ordinary token after the cluster anchors after that maximum duration.
  - Dynamics inside routed blocks anchor at outer routed-block start plus internal scaled position.
  - Dynamics inside nested groups anchor after recursive group scaling.
  - Dynamics inside groups that contain routed blocks use the same recursive container formula.
  - Navigation coexistence is position-stable: `@segno @p`, `@to-coda @mf`, `@f @fine`, and `@ff @dc` do not move dynamic anchors or create false dynamic conflicts.
  - Groups containing only zero-duration dynamics/hairpins are rejected by existing or updated validation.
  - Dynamics inside combined-hit operands are rejected.
  - If normalization internals require research, findings are appended to `LEARNINGS.md`.
- **Dependencies**: Task 2

### Task 4: Dynamic Deduplication and Conflict Validation
- [x] **Status**: Done
- **Scope**: `crates/drummark-core/src/normalize.rs` or a dedicated dynamic normalization module; Rust normalization tests
- **Commits**:
  - `feat(normalize): collect and validate score-level dynamics`
- **Input/Output Contract**:
  - Input: per-logical-measure dynamic candidates from Task 3.
  - Output: `NormalizedMeasure.dynamics: Vec<DynamicIntent>` sorted by exact measure-local fraction, with same-position same-level duplicates collapsed and conflicting levels reported as hard errors.
- **Acceptance Criteria**:
  - Same-position same-level dynamics across tracks deduplicate to one entry.
  - Same-position same-level dynamics repeated in one track deduplicate to one entry.
  - Same-position same-level dynamics across adjacent routed blocks deduplicate to one entry.
  - Same-position different-level dynamics across tracks or routed blocks produce a hard normalization error.
  - Deduplication/conflict keys use logical measure index plus exact measure-local fraction before repeat playback expansion.
  - `npm run drummark -- <fixture> --format ir` includes `dynamics: []` for measures without dynamics and sorted dynamic arrays for measures with dynamics.
- **Dependencies**: Task 3

### Task 5: RenderScore, WASM, and TypeScript Schema Propagation
- [x] **Status**: Done
- **Scope**: `crates/drummark-core/src/render_score.rs`, `crates/drummark-layout/src/lib.rs`, WASM object construction/generation inputs, `src/dsl/types.ts`, render/IR fixtures
- **Commits**:
  - `feat(render-score): propagate dynamic marks through render contract`
  - `test(render-score): cover dynamic serialization and versioning`
- **Input/Output Contract**:
  - Input: normalized measures with explicit `DynamicIntent` arrays.
  - Output: render measures with explicit `dynamics` arrays using `drummark-layout` render-facing dynamic types and lowercase canonical serialized levels.
- **Acceptance Criteria**:
  - `drummark-layout::RenderMeasure` owns public `DynamicLevel` and `DynamicMark` types.
  - Core maps normalized dynamic levels into layout dynamic levels during `RenderScore` construction.
  - Serialized JSON/WASM objects use lowercase levels such as `"ff"` and explicit `dynamics` arrays.
  - `RENDER_SCORE_VERSION` is bumped unconditionally for the new render field.
  - Old fixtures are updated or fixture-load boundaries migrate missing `dynamics` to empty arrays in addition to the version bump.
  - TypeScript types expose `DynamicLevel` and `DynamicIntent`.
  - Parser/render WASM package boundaries remain intact.
  - If WASM serialization or versioning behavior requires research, findings are appended to `LEARNINGS.md`.
- **Dependencies**: Task 4

### Task 6: Layout Scene Dynamic Placement
- [x] **Status**: Done
- **Scope**: `crates/drummark-layout/src/lib.rs`; layout unit tests and scene snapshot tests
- **Commits**:
  - `feat(layout): place dynamic marks in lower expression lane`
- **Input/Output Contract**:
  - Input: hand-built `RenderScore` / `RenderMeasure` values containing dynamics, hairpins, notes, and lower-side modifier occupancy.
  - Output: bounded `LayoutScene` items with role `dynamic`, `ScenePrimitive::TextRun`, canonical text geometry, metadata anchors, and lower-side placement below hairpins.
- **Acceptance Criteria**:
  - Dynamics emit semantic scene items with role `dynamic`.
  - Dynamic primitives are `ScenePrimitive::TextRun` using canonical dynamic text.
  - Text style is italic and uses the layout-owned dynamic font family.
  - Accessible label is `dynamic <level>`.
  - Item metadata preserves owning measure plus measure-local fraction anchor even when visual X shifts inward at measure edges.
  - Dynamic text is centered on anchor X except for minimum inward edge shifts at visible measure boundaries.
  - Reserved bounds use canonical text metrics plus `DYNAMIC_TEXT_PADDING_X_PT` and `DYNAMIC_TEXT_PADDING_Y_PT`.
  - Lower-side pass order is modifiers/articulations, hairpins, dynamics.
  - Dynamics clear hairpin bounds by at least `LOWER_EXPRESSION_GAP_PT`.
  - Dynamics do not push hairpins in the same layout pass.
  - Scene bounds validation passes for dynamic items and affected systems.
  - If skyline/text metric behavior requires research, findings are appended to `LEARNINGS.md`.
- **Dependencies**: Task 5

### Task 7: SVG Adapter Painting
- [x] **Status**: Done
- **Scope**: `src/renderer/svgRenderer.ts`, `src/renderer/svgRendererNode.ts`, adapter tests if needed
- **Commits**:
  - `feat(renderer): paint dynamic text scene items`
- **Input/Output Contract**:
  - Input: `LayoutScene` containing already-positioned `dynamic` text items.
  - Output: SVG text output that paints resolved scene geometry without measuring, nudging, or lane-assigning dynamic marks.
- **Acceptance Criteria**:
  - SVG output includes visible dynamic text for `@p`, `@mp`, `@ff`, and related levels.
  - Adapter does not perform dynamic collision resolution, x positioning, text measurement for layout, or y lane assignment.
  - Existing scene adapter tests pass.
  - `npm run drummark -- <dynamic-fixture> --format svg` emits dynamic text under the staff.
- **Dependencies**: Task 6

### Task 8: MusicXML Dynamic Export
- [x] **Status**: Done
- **Scope**: active MusicXML export path in `crates/drummark-core` and/or TypeScript XML exporter if still active; XML tests/fixtures
- **Commits**:
  - `feat(musicxml): export explicit dynamic directions`
- **Input/Output Contract**:
  - Input: normalized/render measure dynamics with exact measure-local fractions.
  - Output: one below-staff `<direction>` per dynamic per percussion part, using `<dynamics><level/></dynamics>` and `<offset>` for non-start measure-local timing.
- **Acceptance Criteria**:
  - `@f` exports as `<direction placement="below"><direction-type><dynamics><f/></dynamics></direction-type>...`.
  - Start-of-measure dynamics either omit `<offset>` or emit zero offset consistently with the existing direction export style.
  - Mid-measure dynamics emit a positive `<offset>` computed from MusicXML divisions.
  - End-of-measure dynamics emit an offset equal to measure duration and remain in the current measure.
  - Two-voice drum measures emit each score-level dynamic once, not once per voice/track.
  - MusicXML export uses direction offsets for dynamics and does not introduce a new forward/backup cursor strategy.
  - `npm run drummark -- <dynamic-fixture> --format xml` produces expected dynamic directions.
  - If exporter offset behavior requires research, findings are appended to `LEARNINGS.md`.
- **Dependencies**: Task 4

### Task 9: Path-Specific Regression Fixtures
- [x] **Status**: Done
- **Scope**: parser fixtures, IR fixtures, layout scene snapshots, SVG/XML fixtures, `docs/examples/` only where useful
- **Commits**:
  - `test(dynamics): add parser and IR dynamic fixtures`
  - `test(dynamics): add layout and export dynamic fixtures`
- **Input/Output Contract**:
  - Input: representative `.drum` fixtures separated by verification path.
  - Output: checked expectations for parser/AST, IR normalization, render scene/layout, SVG output, XML output, and corpus gates.
- **Acceptance Criteria**:
  - Parser fixture class covers all supported spellings, delimiter behavior, unknown `@...` failures, route preservation, and navigation preservation.
  - IR fixture class covers deduplication, conflicts, nested group scaling, simultaneous routed blocks, navigation coexistence, and explicit empty `dynamics` arrays.
  - Layout fixture class covers `@p ... < ... @f`, lower-lane ordering, edge-shifted start/end dynamics, and dynamic item bounds.
  - SVG fixture class verifies visible dynamic text while preserving thin-adapter rules.
  - XML fixture class covers start, mid-measure, end-measure, and two-voice score-level dynamic export.
  - RenderScore/WASM schema expectations from Task 5 are included in render scene or serialization fixtures.
  - Existing supported corpus gates pass.
- **Dependencies**: Tasks 2, 4, 5, 6, 7, 8

### Task 10: Final Spec Presence Check and Branch Review Preparation
- [x] **Status**: Done
- **Scope**: `docs/DRUMMARK_SPEC.md`, proposal/tasks files, branch review checklist
- **Commits**:
  - `docs(dynamics): verify dynamic marks spec coverage`
- **Input/Output Contract**:
  - Input: completed implementation and already-consolidated spec addendum from Task 1.
  - Output: verified proposal/spec consistency before concentrated branch review.
- **Acceptance Criteria**:
  - `docs/DRUMMARK_SPEC.md` still contains the clean dynamic marks addendum from Task 1.
  - Implemented behavior matches the approved and consolidated spec.
  - Proposal/tasks files remain in `docs/proposals/` until post-merge archival.
  - Any implementation-time research not already captured has been appended to `LEARNINGS.md`.
  - Branch is ready for the required concentrated pre-merge review.
- **Dependencies**: Tasks 2 through 9

### Review Round 2

Revised Execution Plan v2 addresses the Round 1 objections and is now adequate for implementation under the project protocol. I checked it against the approved dynamic-marks proposal and the branch/review workflow rather than only against the previous task text.

1. Consolidation timing is now correct. Task 1 is explicitly post-stamp and pre-implementation, appends `### Consolidated Changes` to the proposal, and appends the clean approved addendum to `docs/DRUMMARK_SPEC.md` before parser, normalization, layout, or exporter code changes begin. That fixes the earlier protocol violation where spec consolidation appeared at the end of implementation.

2. The implementation branch workflow is explicit enough. The plan names `proposal/dynamic-marks`, says all implementation tasks land there after approval, stamp, and consolidation, and preserves the required concentrated pre-merge review before squash merge to `main`. Task 10 also keeps proposal artifacts active until post-merge archival, which matches the repository protocol.

3. Task ordering is coherent. Parser recognition feeds the scanner; the scanner feeds deduplication/conflict validation; RenderScore/WASM propagation follows normalized dynamics; layout consumes render data; SVG consumes resolved scene data; MusicXML depends only on normalized/rendered dynamic timing rather than on layout. The regression task comes after all producing paths, and the final spec/branch review task is last.

4. Task independence is substantially improved. Task 3 is testable with hand-built measure expressions and explicit duration/group context, Task 4 is testable from candidate lists, Task 6 is testable from hand-built `RenderScore` values, and Task 8 is testable from normalized/render measure dynamics. The plan avoids the hidden-coupling failure mode by giving each core algorithm an input/output contract before orchestration and broad fixtures.

5. Parser and scanner acceptance now cover the dangerous cases from Round 1. Whole-token dynamic behavior, invalid dynamic-like forms, delimiter cases, route preservation, navigation preservation, simultaneous routed-block cluster advancement, nested group scaling, zero-duration group rejection, and combined-hit rejection are all present. Navigation coexistence is also tested at start, mid-measure, and measure-end anchors, so dynamics cannot accidentally steal cursor movement or collide with navigation marks.

6. Render contract coverage is adequate. Task 5 requires layout-owned public dynamic types, core-to-layout mapping, lowercase serialized levels, explicit `dynamics` arrays, TypeScript exposure, intact WASM package boundaries, and an unconditional `RENDER_SCORE_VERSION` bump. Fixture migration is correctly framed as additional compatibility work, not a substitute for the version bump.

7. LayoutScene acceptance is now contract-level rather than visual-only. Task 6 requires role `dynamic`, `ScenePrimitive::TextRun`, canonical text, italic style, layout-owned dynamic font family, accessible label, metadata anchor preservation after edge shifting, padded bounds, lower-lane ordering, hairpin clearance, and no hairpin pushing in the same pass. That is enough to keep adapters thin and prevent SVG-side engraving patches.

8. MusicXML export is aligned with the approved proposal. Task 8 uses direction offsets rather than a new forward/backup cursor strategy, allows the approved start-of-measure offset omission or zero style, requires positive mid-measure offsets and measure-duration end offsets, and verifies score-level dynamics are emitted once for two-voice drum measures.

9. Regression gates are split by path with attributable failure surfaces. Task 9 names parser, IR, layout, SVG, XML, RenderScore/WASM serialization, and corpus expectations separately. That is acceptable as a final integration gate because the independently testable implementation tasks precede it.

10. The append-only research requirement is represented. Relevant tasks require `LEARNINGS.md` updates if implementation research is needed for lexer/parser behavior, normalization internals, WASM/versioning, layout metrics/skyline behavior, or exporter offsets, and Task 10 catches any remaining implementation-time research before branch review.

I do not see remaining blockers in task ordering, independence, acceptance criteria, branch workflow, consolidation timing, or coverage. Minor implementation choices may still surface during coding, but they are bounded by the approved proposal and have a place to be verified in the task plan.

STATUS: APPROVED

### Branch Review Round 1

I reviewed `proposal/dynamic-marks` against `main` with `git diff main...HEAD`, the approved proposal, the revised task plan, and the consolidated spec addendum. The implementation covers the core parser, normalization, RenderScore/WASM serialization, layout, SVG, MusicXML, tests, and `LEARNINGS.md` surfaces, but I found one contract blocker before merge.

1. `crates/drummark-layout/src/lib.rs:374` defines `SceneItem` metadata as only `measure_id` and `anchor_item_id`, and dynamic emission at `crates/drummark-layout/src/lib.rs:7497` only calls `push_text_item` with `measure_id`. `push_text_item` then hardcodes `anchor_item_id: None` at `crates/drummark-layout/src/lib.rs:8105`, while the JS wire conversion at `crates/drummark-layout/src/lib.rs:8308` and `crates/drummark-layout/src/lib.rs:8739` exports no measure-local fraction or dynamic anchor metadata. This violates Task 6's required acceptance criterion in `docs/proposals/DRUMMARK_SPEC_tasks_dynamic_marks.md:305` that item metadata preserve the owning measure plus measure-local fraction anchor even when visual X shifts inward, and the spec text in `docs/DRUMMARK_SPEC.md` requiring the dynamic item to preserve its owning measure and measure-local fraction anchor. The current scene exposes only the painted `xPt`, so a start/end dynamic that was clamped inward loses the original musical anchor in the LayoutScene contract.

2. The remaining implementation surfaces looked consistent in targeted review: Rust lexer/parser recognize the supported `@ppp` through `@fff` forms with delimiter rejection; normalization deduplicates/conflicts same-position dynamics; `RENDER_SCORE_VERSION` is bumped to `"2"`; WASM serialization emits explicit lowercase `dynamics`; SVG paints the resolved text without lane logic; MusicXML uses direction offsets; `LEARNINGS.md` has append-only dynamic scanner and MusicXML notes. I did not see a second implementation blocker in these paths.

Verification run:

- `npm test -- --run src/dsl/spec-c23-dynamics.test.ts src/dsl/musicxml.test.ts src/renderer/svgParity.test.ts src/renderer/svgSceneAdapter.test.ts` passed.
- `npm test -- --run src/dsl/normalize_parity.test.ts` passed.
- `cargo test -p drummark-core dynamic` passed.
- `cargo test -p drummark-layout dynamic` passed.
- `npm run drummark -- /tmp/dynamics_ok.drum --format ast`, `--format ir`, and `--format xml` completed; XML was written to `/tmp/dynamics_ok.xml`.

STATUS: CHANGES_REQUESTED

### Author Response to Branch Review Round 1

Addressed the metadata blocker. `SceneItem` now carries optional `measure_local_fraction` metadata, dynamic layout emission stores the original measure-local `DynamicMark.at` fraction on each dynamic item, and the WASM/JS scene export exposes it as `measureLocalFraction`. The SVG adapter translates that resolved scene metadata into `data-measure-local-fraction="n/d"` without using it for layout, preserving thin-adapter behavior.

Regression coverage was added at both contract boundaries:

1. `crates/drummark-layout/src/lib.rs` asserts dynamic `SceneItem.measure_local_fraction` remains the original anchor even though the text may be visually shifted for edge padding.
2. `src/renderer/svgSceneAdapter.test.ts` verifies precomputed scene metadata is painted as an SVG data attribute.
3. `src/renderer/svgParity.test.ts` verifies source-built dynamic scene items expose `measureLocalFraction` for start and end anchors and that SVG preserves `0/1` and `1/1`.

Verification after the fix:

- `cargo test -p drummark-layout --lib` passed.
- `npm run test -- src/renderer/svgParity.test.ts src/renderer/svgSceneAdapter.test.ts` passed.
- `npm run typecheck:test` passed.
- `npm run drummark -- /tmp/drummark_dynamic_anchor_svg.drum --format svg` emitted dynamic SVG text with `data-measure-local-fraction="0/1"` and `data-measure-local-fraction="1/1"`.

### Branch Review Round 2

I re-reviewed `proposal/dynamic-marks` at `58476f7 fix(layout): preserve dynamic measure fraction anchors`, focusing on the Branch Review Round 1 blocker and the fix commit's touched surfaces.

1. The Round 1 implementation blocker is resolved. `crates/drummark-layout/src/lib.rs:374` now adds `SceneItem.measure_local_fraction`, `crates/drummark-layout/src/lib.rs:7503` stores the original `DynamicMark.at` on each emitted dynamic item after visual edge clamping, `crates/drummark-layout/src/lib.rs:8328` carries the field into the wire scene, and `crates/drummark-layout/src/lib.rs:8778` exports it to JS as `measureLocalFraction`. The layout regression at `crates/drummark-layout/src/lib.rs:2085` asserts the dynamic scene item preserves the original `1/2` musical anchor. This satisfies Task 6's requirement that dynamic metadata preserve owning measure plus measure-local fraction even when visual X shifts inward.

2. The SVG adapter remains thin for this fix. `src/renderer/svgRenderer.ts:71` adds the optional scene metadata field to the local scene type, and `src/renderer/svgRenderer.ts:162` renders it only as `data-measure-local-fraction="n/d"`. It does not use that value for positioning, measuring, collision handling, or lane assignment. `src/renderer/svgParity.test.ts:203` and `src/renderer/svgSceneAdapter.test.ts:108` cover source-built and hand-built scene metadata respectively.

3. I found one new branch-readiness issue in the fix commit's ledger update. `58476f7` inserted `### Author Response to Branch Review Round 1` earlier in `docs/proposals/DRUMMARK_SPEC_tasks_dynamic_marks.md`, above existing `### Author Response`, `## Revised Execution Plan v2`, and `### Branch Review Round 1` content, instead of appending it after the existing end of the file. That violates this repository's Linear Ledger Protocol for proposal/task review files, which requires strict physical append and prohibits inserting content above existing headers. Because proposal artifacts are part of the merge contract for this branch, the branch is not ready to merge until that ledger ordering issue is resolved without losing history.

Verification run:

- `cargo test -p drummark-layout dynamic` passed.
- `npm test -- --run src/renderer/svgParity.test.ts src/renderer/svgSceneAdapter.test.ts` passed.
- `npm run typecheck:test` passed.
- `npm run drummark -- /tmp/drummark_dynamic_anchor_svg.drum --format svg` completed and the generated `/tmp/drummark_dynamic_anchor_svg.svg` contains dynamic items with `data-measure-local-fraction="0/1"` and `data-measure-local-fraction="1/1"`.

STATUS: CHANGES_REQUESTED

### Author Response to Branch Review Round 2

Accepted. The Round 1 metadata blocker was resolved, but the response and Round 2 review text had been physically inserted above existing ledger content. I corrected the current file ordering by moving the Branch Review Round 1 response and Branch Review Round 2 notes to the end of this tasks ledger, after the existing implementation tasks and Branch Review Round 1 section. No implementation code changed in this correction.

The remaining requested change is therefore limited to ledger ordering. The file now preserves the intended final physical order: task-plan review history, revised execution plan, completed implementation tasks, Branch Review Round 1, Author Response to Branch Review Round 1, Branch Review Round 2, and this response.

### Branch Review Round 3

I performed the requested narrow re-review after `d47af6a docs(dynamics): correct branch review ledger order`, limited to the Branch Review Round 2 ledger-order blocker and the acceptability of the branch review ledger.

The ledger-order blocker is resolved. The current physical order in `docs/proposals/DRUMMARK_SPEC_tasks_dynamic_marks.md` is chronological for the branch review portion: `### Branch Review Round 1`, `### Author Response to Branch Review Round 1`, `### Branch Review Round 2`, and `### Author Response to Branch Review Round 2` now all appear after the completed task plan and earlier task-plan review history. I did not find the Round 1 response or Round 2 review text inserted above later existing ledger sections anymore.

The branch review ledger is now acceptable for this narrow criterion. The Round 2 author response is append-only relative to the corrected branch-review sequence and clearly documents that the remaining change was limited to ledger ordering. I did not review implementation correctness beyond confirming that the previously identified ledger-order blocker has been addressed.

STATUS: APPROVED
