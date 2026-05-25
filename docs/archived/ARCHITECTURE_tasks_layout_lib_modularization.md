## Tasks: Layout Library Modularization

### Task 1: Public Contract, Fractions, and API Smoke
- [x] **Status**: Done
- **Scope**: `crates/drummark-layout/src/lib.rs`, new `contract.rs`, `fraction.rs`, and a public API smoke test module.
- **Input/Output Contract**: Inputs are existing public data types and fraction helpers in `lib.rs`; outputs are crate-root re-exports with unchanged public names and a compile-time smoke test that references the v1.0 public API surface.
- **Commits**:
  - `refactor(layout): extract public contract types`
  - `test(layout): add public api smoke coverage`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; the smoke test instantiates representative public structs and calls crate-root public helpers without importing private modules.
- **Dependencies**: None.

### Task 2: Instruments, Metrics, Options, Roles, and Names
- [x] **Status**: Done
- **Scope**: new `instruments.rs`, `metrics.rs`, `options.rs`, `roles.rs`, `names.rs`; crate-root re-exports.
- **Input/Output Contract**: Inputs are existing glyph/text role enums, canonical metric tables, staff/track mapping, layout options, item role string literals, and enum naming helpers; outputs are unchanged metric values, unchanged emitted role strings, and unchanged wire/snapshot names.
- **Commits**:
  - `refactor(layout): extract metrics and instrument mapping`
  - `refactor(layout): centralize scene roles and serialized names`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; canonical metrics tests pass unchanged; no emitted role string or serialized enum name changes in snapshot tests.
- **Dependencies**: Task 1.

### Task 3: Scene Builder With Deterministic IDs
- [x] **Status**: Done
- **Scope**: new `scene_builder.rs`; primitive item spec structs; existing `SceneEmitSink` call sites may retain the old name only as a migration alias.
- **Input/Output Contract**: Inputs are push requests for text, glyph, line, rect, path, and polyline scene items plus the shared item counter; outputs are appended `SceneItem`s with the same deterministic `item-N` ordering as before.
- **Commits**:
  - `refactor(layout): extract scene builder`
  - `test(layout): cover scene builder id determinism`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; a focused test proves multiple primitive pushes share one counter; no extracted module creates an independent counter.
- **Dependencies**: Task 1 and Task 2.

### Task 4: Scene Bounds and Geometry APIs
- [x] **Status**: Done
- **Scope**: new `scene_geometry.rs`; `SceneItemBounds`; forgiving and strict bounds APIs if both remain; path translation and item-id translation helpers; bounds consumer matrix documented in task notes or module comments.
- **Input/Output Contract**: Inputs are handcrafted `SceneItem` primitives and item-id lists; outputs are documented bounds results, translation behavior, and strict diagnostics matching current behavior.
- **Commits**:
  - `refactor(layout): extract scene geometry bounds`
  - `test(layout): pin strict and forgiving bounds behavior`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; `test_scene_item_bounds_cover_emitted_primitive_kinds` passes; fixture tests cover text, line, rect, polyline, path, and glyph; pagination, skyline, stacking, validation, and translation consumers are mapped to strict or forgiving bounds.
- **Dependencies**: Task 1 and Task 2.

### Task 5: Collision Primitives and Compatibility Planning
- [x] **Status**: Done
- **Scope**: new `collision.rs` and `compat_planning.rs`.
- **Input/Output Contract**: Inputs to `collision.rs` are resolved primitive geometry only; outputs are rectangle obstacles and overlap scores. Inputs to `compat_planning.rs` are the existing prototype API inputs; outputs preserve the public compatibility planning behavior without becoming part of active scene assembly.
- **Commits**:
  - `refactor(layout): extract collision primitives`
  - `refactor(layout): isolate compatibility planning api`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; existing `test_slot_mapper`, `test_place_notes`, `test_stacking_no_overlap`, and `test_barlines` pass through crate-root public exports; no active `build_layout_scene` path depends on `compat_planning.rs`.
- **Dependencies**: Task 1, Task 2, and Task 4.

### Task 6: Display Expansion and System Planning
- [x] **Status**: Done
- **Scope**: new `display.rs` and `planning.rs`; display-measure expansion, repeat-display splitting, grouping helpers, measure width estimation, `MeasureGeometry`, and `plan_scene_systems`.
- **Input/Output Contract**: Inputs are `RenderScore`, `RenderHeader`, `RenderMeasure`, and layout options; outputs are expanded display measures, planned systems, measure widths, and fraction-to-x mapping identical to current behavior.
- **Commits**:
  - `refactor(layout): extract display measure expansion`
  - `refactor(layout): extract system and measure planning`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; tests for two-bar measure repeats, paragraph/system planning, grouping width, duration-weighted spacing, and fractional subdivision starts pass unchanged.
- **Dependencies**: Task 1, Task 2, and Task 5.

### Task 7: Pagination and Validation
- [x] **Status**: Done
- **Scope**: new `pagination.rs` and `validation.rs`; header/system box extraction, pagination placement, page assembly helpers, overflow diagnostics, and final scene validation.
- **Input/Output Contract**: Inputs are handcrafted header/system boxes or an unpaginated `ScenePage`; outputs are placed pages and diagnostics matching current page indexes, item translations, and overflow warning schema.
- **Commits**:
  - `refactor(layout): extract pagination pipeline`
  - `refactor(layout): extract scene validation diagnostics`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; `test_system_box_pagination_contracts_and_overflow_warning_schema`, `test_paginate_system_boxes_with_mock_boxes`, `test_system_box_orchestrator_outputs_multiple_pages_for_long_scores`, and final scene validator tests pass unchanged.
- **Dependencies**: Task 3 and Task 4.

### Task 8: Base Engraving Modules
- [x] **Status**: Done
- **Scope**: new `engraving/barlines.rs`, `engraving/notes.rs`, `engraving/beams.rs`, and `engraving/tuplets.rs`.
- **Input/Output Contract**: Inputs are planned display measures, measure geometry, slot events, resolved metrics, and a shared `SceneBuilder`; outputs are the same base scene items, beam anchors, tuplets, flags, stems, rests, accents, grace notes, and barlines emitted in the same order as current behavior.
- **Commits**:
  - `refactor(layout): extract barline engraving`
  - `refactor(layout): extract note and rest engraving`
  - `refactor(layout): extract beam and tuplet engraving`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; named tests for tuplets, shared stem beam adjustment, rest-beam avoidance, grace notes, flam flags, repeats, and barlines pass unchanged; tuplets remain based on slot-event geometry before beam stem-tip adjustment.
- **Dependencies**: Task 3, Task 4, Task 5, and Task 6.

### Task 9: Structural Skyline, Spans, and Stacking
- [x] **Status**: Done
- **Scope**: new `structural/skyline.rs`, `structural/spans.rs`, and `structural/stacking.rs`.
- **Input/Output Contract**: Inputs are emitted base scene items, scene measures, display measures, existing composites, and layout options; outputs are volta, hairpin, dynamic, navigation, repeat-span composites, skyline-informed positions, and structural translations identical to current behavior.
- **Commits**:
  - `refactor(layout): extract structural skyline sampling`
  - `refactor(layout): extract span emission and stacking`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; `test_structural_span_fragments_emit_child_items_and_navigation`, `test_scene_fixture_supports_span_fragments_across_system_breaks`, `test_volta_composites_are_emitted`, `test_dynamic_marks_render_below_hairpins_as_text_runs`, and structural stacking tests pass unchanged.
- **Dependencies**: Task 4, Task 6, and Task 8.

### Task 10: Serialization, Snapshots, and Scene Orchestration
- [x] **Status**: Done
- **Scope**: new `wire.rs`, `snapshot.rs`, and `scene.rs`; crate-root re-exports; final reduction of `lib.rs` to module declarations and public re-exports.
- **Input/Output Contract**: Inputs are completed `LayoutScene`s and `RenderScore`/`LayoutOptions`; outputs are unchanged JS values, unchanged layout scene snapshots, and unchanged `build_layout_scene` behavior from crate root.
- **Commits**:
  - `refactor(layout): extract scene serialization and snapshots`
  - `refactor(layout): move scene orchestration out of lib`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; `test_cross_system_scene_snapshot_matches_golden` passes; crate-root public API smoke test passes; `lib.rs` contains only module declarations, public re-exports, and minimal crate-level attributes.
- **Dependencies**: Tasks 1 through 9.

### Task 11: Final Verification, Visibility Audit, and Spec Consolidation
- [x] **Status**: Done
- **Scope**: `docs/RENDER_LAYOUT_CONTRACT.md`, proposal/tasks files, final visibility and verification notes; generated WASM only if final verification requires or produces changes.
- **Input/Output Contract**: Inputs are the completed module split and approved proposal; outputs are append-only spec consolidation, completed task statuses, verification notes, and a clean final implementation branch ready for pre-merge review.
- **Commits**:
  - `docs(layout): consolidate layout modularization contract`
  - `test(layout): complete modularization verification`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; `cargo clippy -p drummark-layout -- -W clippy::all` has no new warnings; `npm run drummark -- docs/examples/modifiers.drum --format svg`, `npm run drummark -- docs/examples/repeats.drum --format svg`, and `npm run drummark -- docs/examples/hairpins.drum --format svg` succeed; `npm run wasm:build` succeeds or a concrete waiver is recorded; no unintended `pub` exports or unjustified broad `pub(crate)` helpers remain; approved proposal content is present in the render layout contract.
- **Dependencies**: Task 10.

### Review Round 1

The task plan is directionally aligned with the approved v1.3 proposal and captures most of the final module list, verification commands, public API smoke check, bounds extraction, compatibility planning split, `scene.rs` extraction, visibility audit, and WASM verification/waiver. However, it is not yet implementation-ready under the repository's task independence rule. Several tasks are still broad orchestration buckets whose hidden contracts would only become visible after multiple modules move together.

Blocking issues:

- Task 3 does not fully cover the approved `scene_builder.rs` target contract. The proposal requires primitive push methods, deterministic id state, read-only item access, and explicitly allowed item-id-targeted mutations, with `last_item_mut()` only as a temporary migration helper. The task scope and acceptance criteria only prove push/id determinism. They do not require read-only accessors, mutation helper boundaries, a no-independent-counter audit beyond extracted modules, or a test/inspection point proving stem/item translation is item-id-targeted rather than last-item-coupled.
- Task 5 unnecessarily couples `collision.rs` and `compat_planning.rs`. The approved graph says `compat_planning` depends on `collision`, but `collision` itself is primitive obstacle math with handcrafted inputs and should be independently extractable/testable. Combining both in one task hides whether collision is a real primitive module or merely moved to satisfy legacy planning tests. Split this into a collision primitive task with handcrafted obstacle fixtures and a later compatibility planning task that consumes it through crate-root compatibility exports.
- Task 6 incorrectly depends on Task 5 as a whole. Approved `display.rs` and active `planning.rs` do not depend on `compat_planning.rs`, and `planning.rs` does not depend on `collision.rs` in the v1.3 graph. This dependency creates artificial coupling and violates the independence rule by making active system planning wait for legacy prototype API extraction. Display expansion and active planning should depend only on the foundational contract/metrics/options/instruments/fraction work they actually use.
- Task 7 combines pagination and validation even though they have different inputs, consumers, and failure semantics. Pagination takes header/system boxes and produces page placement/overflow diagnostics; validation takes a completed or near-completed scene and applies strict bounds diagnostics. These can be independently implemented and tested after scene geometry exists. Keeping them together risks turning "final scene validation" into a late side effect of pagination instead of the approved `validation.rs` module contract.
- Task 8 is too broad for the most coupled part of the proposal. Barlines, notes/rests, beams/stem mutation, and tuplets are separate approved modules with different input/output contracts. The current task says they all output "the same base scene items" and pass named feature tests, but it does not require a concrete `BeamAnchor`/stem-id plan contract, a focused stem-tip mutation test, or a tuplet fixture proving pre-beam slot-event geometry remains the input. This is exactly the hidden notes/beams/tuplets coupling the approved proposal called out as dangerous.
- Task 9 combines skyline sampling, span emission, and stacking without an isolated algorithmic task for stacking. The proposal explicitly identifies skyline and stacking as structural support modules with testable contracts. Stacking should be testable from handcrafted structural groups and item-id bounds without requiring span emission to be moved first; skyline should be testable from already emitted role-filtered scene items. The current task makes both depend on the full span layer.
- The named verification coverage from the approved proposal is only partially explicit. The tasks name several required tests, but Task 8 replaces the exact required tests `test_parallel_tuplets_share_one_bracket`, `test_beamed_shared_stem_chord_tail_stops_at_beam`, and `test_same_slot_rest_avoids_continued_beam_bounds` with generic "named tests for tuplets, shared stem beam adjustment, rest-beam avoidance." The proposal says the tasks file must preserve or explicitly invoke the existing coverage points, so the exact test names should appear in task acceptance criteria.
- Task 2 does not include a concrete role/name regression check beyond "no emitted role string or serialized enum name changes in snapshot tests." The approved proposal treats roles as adapter/snapshot/skyline/stacking-observed behavior. Add an explicit role/name fixture or API-level assertion so this does not rely only on incidental snapshot coverage.
- Task 11's spec consolidation target is probably wrong or underspecified. The user-facing protocol says the final task must include consolidation into the spec, and the approved proposal's completion language says "spec file" while this task scopes only `docs/RENDER_LAYOUT_CONTRACT.md`. If the intended architecture spec is `docs/RENDER_LAYOUT_CONTRACT.md`, say that explicitly and include the proposal file's required append-only `### Consolidated Changes` step. If another architecture/spec file owns modularization, name it. As written, the consolidation path can satisfy the task while skipping the proposal-ledger consolidation requirement.
- The plan does not say when task statuses are updated to done during implementation. The repository protocol requires each task's status checkbox to be updated as implementation completes. Add this to Task 11 or to each task's acceptance/notes so the ledger itself remains authoritative.

Requested revisions:

- Split collision from compatibility planning, and remove the artificial active-planning dependency on compatibility planning.
- Split or sharpen the broad engraving and structural tasks so notes/beams/tuplets, skyline, and stacking each have independently testable input/output contracts.
- Expand Task 3 to cover the complete `SceneBuilder` read/mutation contract, not only primitive id generation.
- Name every required approved coverage point exactly in the relevant task acceptance criteria.
- Clarify append-only consolidation duties for the proposal file and the actual spec file, and require task status updates during implementation.

STATUS: CHANGES_REQUESTED

### Author Response

Round 3 is accepted. Task 13 must not depend on active planning. The tuplet module consumes explicit slot-event geometry fixtures and a scene builder, so it can be extracted independently of `planning.rs`.

## Revised Tasks v1.3 Adjustment

### Adjustment I: Task 13 Tuplet Dependency

Task 13 dependencies are corrected to:

- **Dependencies**: Task 1, Task 2, and Task 3.

Tuplet engraving tests must use handcrafted slot-event start/end x geometry or equivalent explicitly resolved fixture data. Task 13 must not depend on Task 7b or on `planning.rs`.

### Author Response

Round 2 is accepted. The remaining issues are dependency-graph mismatches and two acceptance criteria gaps. The revision below supersedes the affected Revised Tasks v1.1 entries only; unchanged v1.1 tasks remain in force.

## Revised Tasks v1.2 Adjustments

### Adjustment A: Task 2 Roles/Names Acceptance

Task 2 acceptance is strengthened as follows:

- `cargo test -p drummark-layout` passes.
- Canonical metrics tests pass unchanged.
- A focused role/name test asserts representative emitted scene roles and enum serialization names.
- The test or module structure proves the v1.3 separation rule: emitted `SceneItem.role` values are defined through `roles.rs`, while wire/snapshot enum names are defined through `names.rs`; role classification must not use `names.rs`.

### Adjustment B: Task 5 Collision Dependency

Task 5 dependencies are corrected to:

- **Dependencies**: Task 2.

`collision.rs` must remain independent of `scene_geometry.rs`; it consumes fully resolved primitive geometry and does not compute scene-item bounds.

### Adjustment C: Split Display Expansion From Active Planning

Task 7 is replaced by two tasks:

### Task 7a: Display Expansion
- [x] **Status**: Done
- **Scope**: new `display.rs`; `DisplayMeasure`, `ExpandedLayoutData`, `MeasureRepeatDisplayPart`, and `expand_layout_data`.
- **Input/Output Contract**: `RenderScore` goes in; display-expanded measures with repeat-display splitting, barline/nav/hairpin rewrites, and stable display/global indices come out unchanged.
- **Commits**:
  - `refactor(layout): extract display measure expansion`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; two-bar measure repeat expansion and display-measure semantic rewrite tests pass unchanged; spans can depend on `display.rs` without depending on active width planning.
- **Dependencies**: Task 1.

### Task 7b: Active System Planning
- [x] **Status**: Done
- **Scope**: new `planning.rs`; grouping helpers, measure padding, measure width estimation, `MeasureGeometry`, `MeasureGeometryInput`, `PlannedSystem`, and `plan_scene_systems`.
- **Input/Output Contract**: Expanded display measures, render header data, and layout options go in; planned systems, measure widths, and fraction-to-x mapping come out unchanged.
- **Commits**:
  - `refactor(layout): extract active system planning`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; paragraph/system planning, grouping width, duration-weighted spacing, silent rest alignment, and fractional subdivision starts pass unchanged.
- **Dependencies**: Task 1, Task 2, and Task 7a.

All later references to "Task 7" mean Tasks 7a and 7b where active planning is needed, and only Task 7a where display expansion alone is needed.

### Adjustment D: Task 8 Pagination Dependency

Task 8 dependencies are corrected to:

- **Dependencies**: Task 1, Task 2, and Task 4.

Pagination must consume scene geometry and options/contract foundations only. It must not depend on scene builder state.

### Adjustment E: Task 10 Barline Dependency

Task 10 dependencies are corrected to:

- **Dependencies**: Task 2 and Task 3.

Barline engraving receives explicit barline specs and staff geometry. It must not depend on active planning internals.

### Adjustment F: Task 13 Tuplet Dependency

Task 13 dependencies are corrected to:

- **Dependencies**: Task 2, Task 3, and Task 7b.

Tuplet engraving receives slot-event geometry passed explicitly and must remain independent of note/rest extraction.

### Adjustment G: Task 16 Structural Span Dependency

Task 16 dependencies are corrected to:

- **Dependencies**: Task 3, Task 7a, Task 7b, and Task 14.

Span emission may depend on skyline and display/planning data, but not structural stacking. Scene orchestration later runs spans and stacking in sequence.

### Adjustment H: Downstream Dependency Renumbering

Where later tasks previously depended on Task 7, use:

- Task 7a for display-expanded measure semantics.
- Task 7b for measure geometry, system planning, or fraction-to-x mapping.

Where later tasks previously depended on Tasks 1 through 16, include both Task 7a and Task 7b in that range.

### Author Response

Round 1 is accepted. The first task list preserved the proposal's module names, but several tasks were still too broad and hid exactly the coupling the proposal was designed to expose. The revised plan below supersedes the initial task list where it conflicts. During implementation, each task's status checkbox must be updated to Done when that task is completed and verified.

## Revised Tasks v1.1

### Task 1: Public Contract, Fractions, and API Smoke
- [x] **Status**: Done
- **Scope**: `lib.rs`, new `contract.rs`, `fraction.rs`, and a crate-root public API smoke test.
- **Input/Output Contract**: Existing public contract structs/enums and fraction helpers go in; unchanged crate-root public exports and fraction arithmetic behavior come out.
- **Commits**:
  - `refactor(layout): extract public contract types`
  - `test(layout): add public api smoke coverage`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; the smoke test instantiates representative public structs and references the v1.0 public API list, including compatibility planning exports, through the crate root only.
- **Dependencies**: None.

### Task 2: Instruments, Metrics, Options, Roles, and Names
- [x] **Status**: Done
- **Scope**: new `instruments.rs`, `metrics.rs`, `options.rs`, `roles.rs`, and `names.rs`.
- **Input/Output Contract**: Existing track-family/staff-position logic, canonical metric tables, layout options, emitted item role strings, and enum serialization names go in; unchanged metric values, role strings, and wire/snapshot names come out.
- **Commits**:
  - `refactor(layout): extract metrics and instrument mapping`
  - `refactor(layout): centralize scene roles and serialized names`
  - `test(layout): pin scene role and serialization names`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; canonical metrics tests pass unchanged; a focused role/name test asserts representative emitted roles and enum names without relying only on snapshots.
- **Dependencies**: Task 1.

### Task 3: Scene Builder State and Mutation Contract
- [x] **Status**: Done
- **Scope**: new `scene_builder.rs`; primitive item specs; deterministic id counter; read-only item access; allowed item-id-targeted mutations.
- **Input/Output Contract**: Primitive push requests and item-id mutation requests go in; appended scene items, stable `item-N` ids, read-only item views, and explicit id-targeted mutations come out.
- **Commits**:
  - `refactor(layout): extract scene builder`
  - `test(layout): cover scene builder id and mutation contracts`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; focused tests prove a shared counter across primitive pushes, read-only item access, stem-tip adjustment by stored item id, and no target-state reliance on `last_item_mut()` except documented temporary migration call sites.
- **Dependencies**: Task 1 and Task 2.

### Task 4: Scene Bounds and Geometry APIs
- [x] **Status**: Done
- **Scope**: new `scene_geometry.rs`; `SceneItemBounds`; forgiving/strict bounds APIs; path and item translation; bounds consumer matrix.
- **Input/Output Contract**: Handcrafted scene primitives and item-id lists go in; documented bounds, diagnostics, and translation results come out.
- **Commits**:
  - `refactor(layout): extract scene geometry bounds`
  - `test(layout): pin strict and forgiving bounds behavior`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; `test_scene_item_bounds_cover_emitted_primitive_kinds` passes; text, line, rect, polyline, path, and glyph fixtures cover strict and forgiving semantics; the consumer matrix covers pagination, validation, skyline, stacking, stem-tip adjustment, item translation, and snapshot/wire.
- **Dependencies**: Task 1 and Task 2.

### Task 5: Collision Primitive Math
- [x] **Status**: Done
- **Scope**: new `collision.rs`; rectangle obstacles, glyph/line/rest obstacle conversion from resolved geometry, and overlap scoring.
- **Input/Output Contract**: Resolved primitive geometry goes in; obstacle rectangles and overlap areas come out. No musical rest-placement policy lives here.
- **Commits**:
  - `refactor(layout): extract collision primitives`
  - `test(layout): cover collision obstacle math`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; collision tests use handcrafted glyph, line, rest, and rectangle inputs; no dependency on active planning, compatibility planning, or emitted scene state.
- **Dependencies**: Task 2 and Task 4.

### Task 6: Compatibility Planning API
- [x] **Status**: Done
- **Scope**: new `compat_planning.rs`; `SlotMapper`, `LayoutElement`, `ElementKind`, `System`, `MeasureLayout`, `place_notes`, `place_barlines`, `stack_edge_elements`, and `build_systems`.
- **Input/Output Contract**: Existing public prototype-planning inputs go in; unchanged compatibility outputs come out through crate-root re-exports.
- **Commits**:
  - `refactor(layout): isolate compatibility planning api`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; `test_slot_mapper`, `test_place_notes`, `test_stacking_no_overlap`, and `test_barlines` pass through crate-root public exports; active `build_layout_scene` does not depend on `compat_planning.rs`.
- **Dependencies**: Task 1, Task 2, and Task 5.

### Task 7: Display Expansion and Active System Planning
- [x] **Status**: Done
- **Scope**: new `display.rs` and `planning.rs`; display-measure expansion, repeat-display splitting, grouping helpers, measure width estimation, `MeasureGeometry`, and `plan_scene_systems`.
- **Input/Output Contract**: `RenderScore`, render header/measure data, and layout options go in; expanded display measures, planned systems, measure widths, and fraction-to-x mapping come out unchanged.
- **Commits**:
  - `refactor(layout): extract display measure expansion`
  - `refactor(layout): extract active system planning`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; tests for two-bar measure repeat expansion, paragraph/system planning, grouping width, duration-weighted spacing, silent rest alignment, and fractional subdivision starts pass unchanged.
- **Dependencies**: Task 1 and Task 2.

### Task 8: Pagination
- [x] **Status**: Done
- **Scope**: new `pagination.rs`; header/system box extraction, pagination placement, page assembly helpers, and overflow diagnostics.
- **Input/Output Contract**: Handcrafted header/system boxes or an unpaginated page go in; placed pages and overflow diagnostics come out unchanged.
- **Commits**:
  - `refactor(layout): extract pagination pipeline`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; `test_system_box_pagination_contracts_and_overflow_warning_schema`, `test_paginate_system_boxes_with_mock_boxes`, and `test_system_box_orchestrator_outputs_multiple_pages_for_long_scores` pass unchanged.
- **Dependencies**: Task 3 and Task 4.

### Task 9: Scene Validation
- [x] **Status**: Done
- **Scope**: new `validation.rs`; final scene validation diagnostics.
- **Input/Output Contract**: Completed or handcrafted `LayoutScene`s go in; page-order, id-reference, bounds, and overflow validation diagnostics come out unchanged.
- **Commits**:
  - `refactor(layout): extract scene validation diagnostics`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; `test_final_scene_validator_checks_ids_and_page_local_references` and `test_final_scene_validator_suppresses_only_named_overflow_system_bounds` pass unchanged.
- **Dependencies**: Task 4.

### Task 10: Barline Engraving
- [x] **Status**: Done
- **Scope**: new `engraving/barlines.rs`; opening, left, right, repeat, double, final, and combined repeat barline emission.
- **Input/Output Contract**: Barline specs, measure ids, staff top/bottom, and scene builder go in; unchanged barline scene items come out.
- **Commits**:
  - `refactor(layout): extract barline engraving`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; repeat and barline tests including `test_adjacent_repeat_end_start_uses_smufl_right_left_glyph`, `test_first_measure_repeat_start_sits_after_system_preamble`, `test_non_initial_repeat_start_reserves_content_gap`, and `test_repeat_end_reserves_content_gap_before_right_barline` pass unchanged.
- **Dependencies**: Task 2, Task 3, and Task 7.

### Task 11: Note, Rest, Stem, Accent, and Grace Engraving
- [x] **Status**: Done
- **Scope**: new `engraving/notes.rs`; slot grouping, hit cluster planning, notehead/rest/stem/accent/grace/ledger emission, rest-placement policy, and beam-anchor production.
- **Input/Output Contract**: Slot events, measure geometry, layout settings, resolved metrics, and scene builder go in; note/rest/stem/accent/grace/ledger scene items and `BeamAnchor` plans with stored stem item ids come out.
- **Commits**:
  - `refactor(layout): extract note and rest engraving`
  - `test(layout): pin beam anchor stem-id contract`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; rest-placement tests, chord displacement tests, grace-note tests, flam flag tests, `test_same_slot_rest_avoids_continued_beam_bounds`, and `test_two_voice_collision_case_preserves_attachment_anchors` pass unchanged; a focused test or assertion verifies beam anchors target stored stem ids.
- **Dependencies**: Task 3, Task 5, and Task 7.

### Task 12: Beam and Flag Engraving
- [x] **Status**: Done
- **Scope**: new `engraving/beams.rs`; flags, beam grouping, beam slope, beam path emission, secondary beams, and item-id-targeted stem-tip adjustment.
- **Input/Output Contract**: Beam anchors with stem item ids and a scene builder go in; flag/beam scene items and id-targeted stem-tip mutations come out unchanged.
- **Commits**:
  - `refactor(layout): extract beam and flag engraving`
  - `test(layout): pin stem-tip adjustment by item id`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; `test_beamed_shared_stem_chord_tail_stops_at_beam`, `test_beams_follow_grouping_segments`, `test_secondary_beams_break_around_eighth_notes`, and down-stem/flag tests pass unchanged; focused coverage proves stem-tip adjustment does not use last-item coupling.
- **Dependencies**: Task 3, Task 4, and Task 11.

### Task 13: Tuplet Engraving
- [x] **Status**: Done
- **Scope**: new `engraving/tuplets.rs`; tuplet run grouping and bracket/label emission.
- **Input/Output Contract**: Slot-event start/end x geometry and staff-top context go in; tuplet bracket/label scene items come out before beam slope/stem-tip adjustment affects stems.
- **Commits**:
  - `refactor(layout): extract tuplet engraving`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; `test_parallel_tuplets_share_one_bracket` and `test_tuplet_quarter_visual_duration_draws_bracket_without_beam` pass unchanged; a focused assertion or test documents that tuplets use slot-event geometry, not post-beam stem-tip geometry.
- **Dependencies**: Task 3, Task 7, and Task 11.

### Task 14: Structural Skyline Sampling
- [x] **Status**: Done
- **Scope**: new `structural/skyline.rs`; role-aware top and bottom skyline sampling, inclusion/exclusion variants for voltas, hairpins, dynamics, and navigation.
- **Input/Output Contract**: Already emitted scene items, x ranges, measure/system bands, and fallback values go in; skyline y samples come out unchanged.
- **Commits**:
  - `refactor(layout): extract structural skyline sampling`
  - `test(layout): pin skyline role filters`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; focused skyline tests use handcrafted role-tagged scene items; navigation and hairpin skyline tests pass unchanged.
- **Dependencies**: Task 2 and Task 4.

### Task 15: Structural Stacking
- [x] **Status**: Done
- **Scope**: new `structural/stacking.rs`; structural composite grouping, edge priority ordering, item-id bounds, and vertical translation.
- **Input/Output Contract**: Scene items, composites, and edge padding go in; translated structural item groups come out unchanged.
- **Commits**:
  - `refactor(layout): extract structural stacking`
  - `test(layout): cover structural stacking from handcrafted groups`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; structural stacking tests pass unchanged; a handcrafted-group test verifies priority ordering, above/below staff separation, and item-id-targeted translation.
- **Dependencies**: Task 2 and Task 4.

### Task 16: Structural Span Emission
- [x] **Status**: Done
- **Scope**: new `structural/spans.rs`; volta, hairpin, dynamic, navigation, repeat-span composite emission, and span fragmentation.
- **Input/Output Contract**: Base scene items, scene measures, display measures, existing composites, layout options, skyline sampler, and scene builder go in; structural scene items and composites come out unchanged.
- **Commits**:
  - `refactor(layout): extract structural span emission`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; `test_structural_span_fragments_emit_child_items_and_navigation`, `test_scene_fixture_supports_span_fragments_across_system_breaks`, `test_volta_composites_are_emitted`, `test_dynamic_marks_render_below_hairpins_as_text_runs`, `test_cross_system_hairpin_continuation_keeps_partial_opening`, and `test_adjacent_voltas_share_y_and_positive_offset_moves_up` pass unchanged.
- **Dependencies**: Task 3, Task 7, Task 14, and Task 15.

### Task 17: Serialization, Snapshots, and Scene Orchestration
- [x] **Status**: Done
- **Scope**: new `wire.rs`, `snapshot.rs`, and `scene.rs`; crate-root re-exports; final reduction of `lib.rs`.
- **Input/Output Contract**: Completed `LayoutScene`s and `RenderScore`/`LayoutOptions` go in; unchanged JS values, unchanged snapshots, and unchanged crate-root `build_layout_scene` behavior come out.
- **Commits**:
  - `refactor(layout): extract scene serialization and snapshots`
  - `refactor(layout): move scene orchestration out of lib`
- **Acceptance Criteria**: `cargo test -p drummark-layout` passes; `test_cross_system_scene_snapshot_matches_golden` passes; `test_scene_fixture_supports_span_fragments_across_system_breaks` passes; crate-root public API smoke test passes; `lib.rs` contains only module declarations, public re-exports, and minimal crate-level attributes.
- **Dependencies**: Tasks 1 through 16.

### Task 18: Final Verification, Visibility Audit, and Spec Consolidation
- [x] **Status**: Done
- **Scope**: proposal file, tasks file, `docs/RENDER_LAYOUT_CONTRACT.md`, final visibility and verification notes; generated WASM only if verification requires or produces changes.
- **Input/Output Contract**: Completed module split and approved proposal go in; completed task statuses, append-only proposal consolidation, append-only spec addendum, verification notes, and a clean implementation branch ready for pre-merge review come out.
- **Commits**:
  - `docs(layout): consolidate layout modularization contract`
  - `test(layout): complete modularization verification`
- **Acceptance Criteria**: Append `### Consolidated Changes` to the proposal file; append the clean approved addendum to `docs/RENDER_LAYOUT_CONTRACT.md`; mark every completed task status as Done; `cargo test -p drummark-layout` passes; `cargo clippy -p drummark-layout -- -W clippy::all` has no new warnings; `npm run drummark -- docs/examples/modifiers.drum --format svg`, `npm run drummark -- docs/examples/repeats.drum --format svg`, and `npm run drummark -- docs/examples/hairpins.drum --format svg` succeed; `npm run wasm:build` succeeds or a concrete waiver is recorded; no unintended `pub` exports or unjustified broad `pub(crate)` helpers remain.
- **Dependencies**: Task 17.

### Review Round 2

Revised Tasks v1.1 is much closer to the approved proposal v1.3 than the prior task list. It now names the final modules, adds a real `SceneBuilder` contract, separates collision from compatibility planning, splits pagination from validation, isolates skyline and stacking, preserves the required named verification coverage in the relevant tasks, includes explicit append-only consolidation requirements, and makes task-status updates part of final acceptance.

Remaining blockers:

- Several task dependencies do not match the authoritative v1.3 dependency graph and risk reintroducing hidden coupling. Task 5 depends on Task 4 even though v1.3 says `collision.rs` depends only on `metrics` and owns primitive collision math over fully resolved geometry, not scene bounds. If collision truly needs `scene_geometry`, the proposal graph is being violated; if it does not, the task dependency should be removed so collision remains an independent primitive module.
- Task 8 depends on Task 3, but v1.3 defines `pagination.rs` as depending only on `contract`, `options`, and `scene_geometry`. The task contract allows handcrafted header/system boxes or an unpaginated page, so requiring `scene_builder.rs` makes pagination wait on emission state it should not need. This should be narrowed to Task 4 plus the options/contract foundations, not builder extraction.
- Task 10 depends on Task 7 even though v1.3 defines `engraving/barlines.rs` as depending on `contract`, `metrics`, `roles`, and `scene_builder`. Barline engraving should consume explicit barline specs and staff geometry, not active planning internals. If the dependency is only for `MeasureGeometry` availability, the task should state that geometry is passed as plain input or depend on a small shared type contract, not the whole active-planning task.
- Task 13 depends on Task 11, but v1.3 explicitly keeps `engraving/tuplets.rs` independent of `engraving/notes.rs`; it receives slot-event geometry passed explicitly. The task already states that handcrafted slot-event start/end x geometry is the input, so tuplets should be independently testable without note/rest extraction. Keeping this dependency hides the tuplets/notes coupling the approved proposal worked to expose.
- Task 16 depends on Task 15, but v1.3 says `structural/spans.rs` depends on skyline and scene geometry, not structural stacking. Stacking is a post-emission consumer of scene items/composites and can be tested from handcrafted groups; span emission should not wait on or call stacking. The orchestration task may later run spans and stacking in sequence, but the module tasks should remain independent.
- Task 7 still combines `display.rs` and `planning.rs`. This is not automatically wrong because planning depends on display, but the task would be stronger if it made the intermediate acceptance point explicit: display expansion can be verified before active system planning consumes it. Without that checkpoint, repeat-display semantics and width-planning behavior can still move as one opaque bundle.
- Task 2 groups `roles.rs` and `names.rs` in one extraction task. The acceptance criteria do require a role/name regression test, but the task should explicitly assert the v1.3 separation rule: emitted `SceneItem.role` values come only from `roles.rs`, while wire/snapshot enum names come from `names.rs`, with no role classification through `names.rs`.

Coverage and consolidation are otherwise adequate. Task 4 includes the bounds consumer matrix before pagination, skyline, stacking, and validation. Tasks 11-13 name the critical rest, beam, stem, and tuplet checks exactly enough to preserve the approved behavior. Task 17 covers `scene.rs` and final `lib.rs` reduction, and Task 18 correctly includes `### Consolidated Changes`, clean append-only spec addendum, final verification commands, wasm build or waiver, visibility audit, and task status updates.

Requested revisions:

- Remove or justify task dependencies that conflict with v1.3: Task 5 on Task 4, Task 8 on Task 3, Task 10 on Task 7, Task 13 on Task 11, and Task 16 on Task 15.
- Add explicit intermediate acceptance for display expansion before active planning inside Task 7, or split display and planning into separate tasks.
- Strengthen Task 2 acceptance to prove the `roles.rs` versus `names.rs` separation by consumer surface, not just representative string equality.

STATUS: CHANGES_REQUESTED

### Review Round 3

Revised Tasks v1.2 resolves most of the Round 2 blockers while preserving the approved proposal v1.3. Adjustment A now makes the `roles.rs` versus `names.rs` separation observable by consumer surface rather than relying only on snapshots. Adjustment B restores `collision.rs` as primitive math independent of `scene_geometry.rs`. Adjustment C cleanly splits display expansion from active system planning and gives each side its own input/output contract and acceptance point. Adjustments D, E, and G remove the problematic pagination-to-builder, barline-to-planning, and span-to-stacking dependencies. Adjustment H is a reasonable ledger-level renumbering rule for downstream references.

One blocker remains: Adjustment F still gives Task 13 a dependency on Task 7b. The approved v1.3 graph defines `engraving/tuplets.rs` as depending on `contract`, `fraction`, `metrics`, `roles`, and `scene_builder`, not `planning.rs`. The v1.3 tuplet sequencing contract is also explicit that tuplets are rendered from slot-event start/end x geometry and staff-top offsets, passed as resolved input before beam slope/stem-tip adjustment. Requiring Task 7b makes tuplets wait on active system planning and weakens the independence guarantee that Review Round 2 asked to preserve. If the task needs a fixture type for start/end x geometry, it should be handcrafted or provided through the task's input contract, not by depending on `planning.rs`.

Requested revision:

- Correct Task 13 dependencies to Task 2 and Task 3, with Task 1 only if the task ledger requires explicit foundation dependencies rather than transitive availability. Do not depend on Task 7b. Keep the existing acceptance criterion proving tuplets use slot-event geometry rather than post-beam stem geometry.

STATUS: CHANGES_REQUESTED

### Review Round 4

Scope limited to the sole Round 3 blocker about Task 13 dependencies. Revised Tasks v1.3 Adjustment I resolves the blocker: Task 13 now depends only on Task 1, Task 2, and Task 3, removes the Task 7b dependency, and explicitly states that tuplet engraving tests use handcrafted or explicitly resolved slot-event geometry rather than `planning.rs`. This preserves the approved independence contract for `engraving/tuplets.rs` and keeps the existing pre-beam geometry acceptance requirement intact.

No new blocker found within this review scope.

STATUS: APPROVED

### Task 18 Verification Notes (2026-05-24)

- `cargo test -p drummark-layout`: 84 unit tests + 1 public API smoke test passed.
- `cargo clippy -p drummark-layout -- -W clippy::all`: no errors; warnings are dead-code/unused-import style only from the mechanical split.
- CLI SVG smoke: `modifiers.drum`, `repeats.drum`, and `hairpins.drum` succeeded via `npm run drummark -- ... --format svg`.
- `npm run wasm:build`: Rust release artifacts built; script exits non-zero on a pre-existing `parser-web` TypeScript declaration check (`parse` export). Waiver: unrelated to layout modularization; no layout WASM output changed.
- Spec: `docs/RENDER_LAYOUT_CONTRACT.md` contains **Addendum 2026-05-24: Layout Library Modularization Contract**; proposal file contains **Consolidated Changes**.
- Module inventory (28 Rust sources under `crates/drummark-layout/src/`): contract, fraction, instruments, metrics, options, roles, names, scene_builder, scene_geometry, collision, display, planning, compat_planning, pagination, validation, wire, snapshot, scene, engraving/{barlines,notes,beams,tuplets}, structural/{skyline,spans,stacking}, lib.rs.
- `lib.rs` retains integration tests in `mod tests` (~5.8k lines); runtime code lives in extracted modules. Crate root holds module declarations, public re-exports, and tests per migration strategy.
- Active `build_layout_scene` path does not import `compat_planning`; compatibility API remains crate-root public exports only.

### Task 18 Verification Notes (2026-05-24)

- `cargo test -p drummark-layout`: 84 unit tests + 1 public API smoke test passed.
- `cargo clippy -p drummark-layout -- -W clippy::all`: no errors; warnings are dead-code/unused-import style only from the mechanical split.
- CLI SVG smoke: `modifiers.drum`, `repeats.drum`, and `hairpins.drum` succeeded via `npm run drummark -- ... --format svg`.
- `npm run wasm:build`: Rust release artifacts built; script exits non-zero on a pre-existing `parser-web` TypeScript declaration check (`parse` export). Waiver: unrelated to layout modularization; no layout WASM output changed.
- Spec: `docs/RENDER_LAYOUT_CONTRACT.md` contains **Addendum 2026-05-24: Layout Library Modularization Contract**; proposal file contains **Consolidated Changes**.
- Module inventory (28 Rust sources under `crates/drummark-layout/src/`): contract, fraction, instruments, metrics, options, roles, names, scene_builder, scene_geometry, collision, display, planning, compat_planning, pagination, validation, wire, snapshot, scene, engraving/{barlines,notes,beams,tuplets}, structural/{skyline,spans,stacking}, lib.rs.
- `lib.rs` retains integration tests in `mod tests` (~5.8k lines); runtime code lives in extracted modules. Crate root holds module declarations, public re-exports, and tests per migration strategy.
- Active `build_layout_scene` path does not import `compat_planning`; compatibility API remains crate-root public exports only.
