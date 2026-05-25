## Addendum v1.0: Layout Library Modularization

### Problem Statement

`crates/drummark-layout/src/lib.rs` has grown into a single mixed-responsibility module of more than 14,000 lines. It currently owns the public render contract, canonical metrics, pagination, scene emission, measure geometry, note/rest/stem/beam engraving, structural spans, collision/stacking, JavaScript serialization, and most layout unit tests in one compilation unit.

This shape slows safe layout work because local changes cannot be reasoned about against a small module boundary. It also hides several separate contracts behind private helper ordering inside `lib.rs`, making behavior-preserving refactors harder than necessary.

### Goals

- Preserve the public `drummark-layout` API during the first modularization phase.
- Preserve current `RenderScore -> LayoutScene` behavior exactly, except for mechanical warning cleanup explicitly covered by tests.
- Split `lib.rs` into responsibility-focused modules with small, testable input/output contracts.
- Keep layout decisions in `drummark-layout`; adapters remain thin translators of `LayoutScene`.
- Make future engraving changes easier to review by isolating pure geometry, scene emission, and feature-specific engraving code.

### Non-Goals

- Do not redesign `RenderScore`, `LayoutScene`, or canonical metric semantics in this proposal.
- Do not change layout geometry, score spacing, pagination behavior, or SVG output as part of the mechanical split.
- Do not move layout behavior into TypeScript adapters or generated WASM glue.
- Do not introduce a new rendering backend or rendering dependency.

### Target Module Boundaries

The first pass should leave `src/lib.rs` as a thin crate root that declares modules and re-exports the existing public API.

Proposed modules:

- `contract.rs`: public input/output data structures and version constants, including `RenderScore`, `RenderHeader`, `RenderMeasure`, `RenderEvent`, `LayoutScene`, `ScenePage`, `SceneSystem`, `SceneMeasure`, `SceneItem`, scene primitive types, and semantic composite types.
- `fraction.rs`: local `Fraction` arithmetic and ordering helpers used by layout. This remains layout-local unless a later proposal unifies it with `drummark-core`.
- `metrics.rs`: `GlyphRole`, `TextRole`, `GlyphPoint`, `CanonicalGlyphMetric`, `CanonicalTextMetric`, canonical glyph/text lookup, role name helpers, notehead/rest glyph selection, and canonical flag paths.
- `options.rs`: `LayoutOptions`, `StaffSpace`, track family and staff-position mapping.
- `geometry.rs`: layout-neutral geometry helpers such as item bounds, path bounds, path translation, glyph bbox conversion, rectangle obstacles, and overlap math.
- `pagination.rs`: `SystemLayoutBox`, `HeaderLayoutBox`, `PlacedSystemBox`, pagination warnings, page cursor logic, and system-box placement.
- `planning.rs`: display-measure expansion, repeat-display splitting, measure width estimation, system planning, measure padding, grouping helpers, and measure-local `MeasureGeometry`.
- `emit.rs`: `SceneEmitSink` and item spec structs for emitting scene primitives with stable ids.
- `engraving/barlines.rs`: opening, left, right, repeat, double, and final barline emission.
- `engraving/notes.rs`: slot-group rendering, hit clusters, rest placement, stems, accents, grace notes, ledger lines, and notehead displacement.
- `engraving/beams.rs`: beam grouping, beam slope, secondary beam segmentation, beam path construction, flags, and stem-tip adjustment.
- `engraving/spans.rs`: voltas, hairpins, dynamics, navigation markers, skylines, span fragments, and structural stacking.
- `wire.rs`: wire-format conversion and `layout_scene_to_js`.
- `snapshot.rs`: `layout_scene_snapshot`.

### Public API Compatibility

All currently public functions and types must remain available from the crate root unless a later proposal explicitly deprecates them. At minimum this includes:

- `RENDER_SCORE_VERSION`
- `LAYOUT_SCENE_VERSION`
- `CANONICAL_METRICS_VERSION`
- `RenderScore` and related render input types
- `LayoutScene` and related scene output types
- `LayoutOptions`
- `StaffSpace`
- `track_family`
- `staff_y_for_track`
- `glyph_metrics`
- `canonical_glyph_metric`
- `canonical_text_metric`
- `canonical_flag_path`
- `notehead_glyph`
- `rest_glyph_for_fraction`
- `rest_glyph`
- `build_layout_scene`
- `layout_scene_snapshot`
- `layout_scene_to_js`

The existing public prototype/planning API in the middle of `lib.rs` must be handled conservatively:

- `SlotMapper`
- `LayoutElement`
- `ElementKind`
- `place_notes`
- `place_barlines`
- `stack_edge_elements`
- `System`
- `MeasureLayout`
- `build_systems`

For this proposal, these items stay public and are moved as a compatibility surface, not deleted. A later cleanup proposal may decide whether they become supported planning APIs, crate-private test helpers, or deprecated exports.

### Migration Strategy

The migration must be mechanical and behavior-preserving:

1. Extract public contract and simple pure helpers first, with crate-root re-exports.
2. Move tests only when their target module is stable enough to own them; otherwise keep tests in `lib.rs` until the module split is complete.
3. Move feature-specific engraving code after shared support modules compile.
4. Run `cargo test -p drummark-layout` after each meaningful extraction.
5. Run `npm run drummark -- docs/examples/modifiers.drum --format svg` or the closest existing example command after the engraving modules move, to confirm the CLI/WASM-facing path still emits score output.
6. Rebuild WASM only if Rust output changes or the final task explicitly updates generated WASM packages.

### Dependency Direction

The module graph should be acyclic and boring:

- `contract`, `fraction`, and `metrics` are foundational.
- `options` may depend on `metrics` only where needed for staff/track semantics.
- `geometry` may depend on `contract`, `metrics`, and `fraction`.
- `emit` may depend on `contract` and `fraction`.
- `pagination` may depend on `contract`, `options`, and `geometry`.
- `planning` may depend on `contract`, `fraction`, `metrics`, and `options`.
- `engraving/*` may depend on foundational modules, `geometry`, `planning`, and `emit`.
- `wire` and `snapshot` may depend on `contract`, `metrics`, and naming helpers.
- `lib.rs` orchestrates `build_layout_scene` until a later task extracts the orchestrator into `scene.rs`.

No module may depend on generated WASM packages or TypeScript source.

### Testing and Acceptance

The refactor is accepted when:

- `cargo test -p drummark-layout` passes.
- `cargo clippy -p drummark-layout -- -W clippy::all` reports no new warnings beyond explicitly documented existing warnings, or cleans up existing trivial warnings without behavior changes.
- `npm run drummark -- docs/examples/modifiers.drum --format svg` succeeds and produces valid SVG output.
- Existing scene snapshot tests still pass without golden churn unless a mechanical path/name change is intentionally reflected in snapshots.
- The crate root still exposes the public API listed above.

### Risks

- Moving code may accidentally expose private helpers or create circular module dependencies. This is mitigated by extracting foundational modules first and keeping re-exports centralized in `lib.rs`.
- Tests embedded in `lib.rs` may rely on private helper visibility. The migration should move tests together with helpers only when needed, or use `pub(crate)` helpers temporarily.
- The prototype planning API may be mistaken for the active `build_layout_scene` path. This proposal keeps it as a compatibility surface but explicitly avoids treating it as the main architecture.
- WASM package churn is possible if generated artifacts are rebuilt unnecessarily. The migration should avoid generated updates until behavior or exported Rust/WASM shape actually changes.

### Completion State

This proposal is complete when `crates/drummark-layout/src/lib.rs` is reduced to a crate root plus orchestration glue, the listed modules own their responsibilities, all acceptance checks pass, and no public API listed in this proposal has been removed.

### Review Round 1

The proposal has the right high-level intent, but it is not yet implementation-ready. The module boundaries are plausible as labels, yet several of them cut across actual data ownership in `lib.rs` in ways that can create circular dependencies or force broad `pub(crate)` leakage during the split.

Blocking issues:

- `contract.rs` and `fraction.rs` are described as peer foundational modules, but the public contract embeds `Fraction` directly in `RenderEvent`, `DynamicMark`, `HairpinSpan`, `SceneItem::measure_local_fraction`, and related structures. The dependency direction must state whether `contract` depends on `fraction`, whether `Fraction` remains in `contract` and `fraction.rs` only owns helper arithmetic, or whether a third primitive module owns shared scalar types. As written, this is an immediate dependency ambiguity at the first extraction step.
- `metrics.rs` is assigned `notehead_glyph`, but `notehead_glyph` currently depends on `track_family`, while `track_family` is listed as part of `options.rs` alongside staff-position mapping. Either metrics must depend on options, options must depend on metrics, or track family/staff mapping needs a separate `instruments.rs`-style module. The current dependency graph says `options` may depend on `metrics`, but does not permit `metrics -> options`, so the proposed split deadlocks.
- `geometry.rs` is described as layout-neutral, but the concrete helpers include both generic primitive bounds (`item_bounds`, `path_bounds`, path translation) and engraving/collision domain types (`RectObstacle`, `GlyphObstacle`, `RestPlacement`, `LineObstacle`, skyline sampling that filters decoration roles and measure/system bands). The proposal needs a sharper boundary between scene primitive geometry and engraving collision/skylines, otherwise `geometry` becomes the new mini-`lib.rs` with dependencies back into spans, notes, and role naming.
- The `engraving/notes.rs` and `engraving/beams.rs` boundary is underspecified. Current rendering collects `BeamAnchor`s inside slot-group/note rendering, emits stems before beams, emits beams afterward, and then adjusts stem tips by mutating already-emitted `SceneItem`s. If beams move separately, the proposal needs an explicit input/output contract for `StemRenderPlan`, `BeamAnchorPlan`, emitted stem ids, and who is allowed to mutate scene items. Without that, notes and beams remain secretly coupled through `SceneEmitSink` side effects.
- `engraving/spans.rs` bundles voltas, hairpins, dynamics, navigation, skylines, fragmenting, and structural stacking. Those are not independent responsibilities in the current code: skylines sample already-emitted note/barline/header items, structural stacking translates emitted item ids, and navigation/hairpin/dynamic vertical placement share bottom/top clearance rules. The proposal should either define this module as an orchestrated structural-layer pass with explicit inputs from base engraving, or split stacking/skylines into a separate support module with a testable contract.
- The compatibility planning API (`SlotMapper`, `LayoutElement`, `place_notes`, `place_barlines`, `stack_edge_elements`, `System`, `MeasureLayout`, `build_systems`) is listed as "moved as a compatibility surface", but no module owns it. It is not the active scene-building path and has different simplified assumptions. The proposal must name its destination module and tests, and make clear that active planning helpers like `DisplayMeasure`, `MeasureGeometry`, `ExpandedLayoutData`, and `plan_scene_systems` are a separate concern.
- `emit.rs` owning `SceneEmitSink` is reasonable, but the proposal does not address stable id determinism across module extraction. Since `SceneEmitSink` increments a shared counter and many tests depend on snapshots/composites referencing child item ids, acceptance criteria should include an id-order invariant or snapshot comparison covering non-trivial spans, beams, accents, and pagination.
- `wire.rs` and `snapshot.rs` are allowed to depend on "naming helpers", but those helpers currently cover scene item kind, glyph role, text role, composite kind, and span fragment kind. The proposal must state where naming helpers live and ensure they do not pull in all of `metrics` or engraving modules. Otherwise wire serialization can accidentally become dependent on layout behavior modules.
- The migration strategy says "Run `cargo test -p drummark-layout` after each meaningful extraction", but the future tasks file needs independently testable task boundaries. Several proposed modules cannot be validated in isolation unless the proposal defines seam tests: e.g. `pagination` with handcrafted `SystemLayoutBox`es, `emit` with deterministic item id tests, `geometry` with primitive/path bounds tests, and notes/beams with handcrafted `RenderMeasureEventsInput`-like fixtures.
- Acceptance criteria are too weak for a behavior-preserving refactor of a 14k-line layout file. One example SVG command is not enough to catch ordering, composite, pagination, and collision regressions. Add at least one AST/IR-independent scene snapshot or XML/SVG smoke for examples that exercise repeat bars, spans, tuplets/beams, rests, and pagination, or explicitly require existing golden/snapshot tests to cover those features by name.
- The proposal does not state whether module extraction may change visibility from private to `pub(crate)`. It mentions temporary `pub(crate)` helpers as a mitigation, but there is no rule requiring them to be reduced or justified by the end of the proposal. This risks replacing one large private namespace with a crate-wide private API. Add a completion check for minimized visibility and no new public exports except the listed compatibility surface.
- The WASM guidance is ambiguous. Moving modules without public API changes may still require checking the crate's wasm-target build path because `wasm_bindgen` imports and `layout_scene_to_js` remain in the crate. The proposal should require at least `npm run wasm:build` or a documented reason not to run it at final verification, especially if `wire.rs` is touched.

Requested revisions:

- Define the exact dependency graph for primitive contract types, instrument mapping, metrics, scene geometry, engraving collision geometry, emit sink, active planning, prototype compatibility planning, and serialization naming.
- Add explicit input/output contracts for the notes/beams/stems interaction and for structural spans/skylines/stacking.
- Name the destination module for every public compatibility item and for the active private planning structs/functions currently used by `build_layout_scene`.
- Strengthen acceptance criteria with feature-specific scene/golden coverage, id determinism, final visibility audit, and final wasm-target verification or a concrete waiver.
- Ensure the eventual tasks file can split this into independently testable extractions rather than broad "move engraving code" tasks that only compile when several hidden dependencies move together.

STATUS: CHANGES_REQUESTED

### Author Response

Round 2 is accepted. The proposal needs one final authoritative target-state section instead of layered corrections that leave stale `emit.rs`/`planning.rs` wording in play. The revision below supersedes earlier module graphs where they conflict.

## Addendum v1.3: Authoritative Target Graph and Verification Contract

### Supersession Rule

This v1.3 addendum is the authoritative target-state contract for implementation. Earlier v1.0-v1.2 sections remain as review history, but any conflict is resolved in favor of v1.3.

### Final Target Modules

- `contract.rs`: public data types, version constants, and `Fraction`.
- `fraction.rs`: arithmetic/order helpers for `contract::Fraction`.
- `instruments.rs`: track family and staff-position mapping.
- `metrics.rs`: glyph/text roles, canonical metrics, notehead/rest/flag/text lookup, and metric-derived glyph sizing.
- `options.rs`: `LayoutOptions` and `StaffSpace`.
- `roles.rs`: emitted scene item role strings and role-class helpers used by emitters, adapters, skyline filters, and stacking.
- `names.rs`: enum-to-string names for wire/snapshot serialization of semantic enum values, not emitted item roles.
- `scene_geometry.rs`: documented scene primitive bounds, path bounds, item translation, and item-id bounding boxes.
- `collision.rs`: primitive collision math only: rectangle obstacles, overlap area, glyph/line/rest obstacle conversion from fully resolved geometry.
- `display.rs`: display-level semantic expansion: `DisplayMeasure`, `ExpandedLayoutData`, `MeasureRepeatDisplayPart`, and `expand_layout_data`.
- `planning.rs`: width/system planning over `display.rs` measures: `PlannedSystem`, grouping helpers, measure padding, measure width estimation, `MeasureGeometry`, `MeasureGeometryInput`, and `plan_scene_systems`.
- `compat_planning.rs`: legacy public compatibility API: `SlotMapper`, `LayoutElement`, `ElementKind`, `System`, `MeasureLayout`, `place_notes`, `place_barlines`, `stack_edge_elements`, and `build_systems`.
- `scene_builder.rs`: shared scene item builder, deterministic item id counter, primitive push methods, read-only item access, and explicitly allowed item-id-targeted mutations.
- `engraving/barlines.rs`: barline emission.
- `engraving/notes.rs`: slot grouping, hit cluster planning, notehead/rest/stem/accent/grace/ledger emission, rest-placement policy, and beam-anchor production.
- `engraving/beams.rs`: flags, beam grouping, beam slope, beam path emission, secondary beams, and item-id-targeted stem-tip adjustment.
- `engraving/tuplets.rs`: tuplet run grouping and bracket emission from slot-event geometry.
- `structural/skyline.rs`: role-aware top/bottom skyline sampling over already emitted items.
- `structural/spans.rs`: volta, hairpin, dynamic, navigation, repeat-span composite emission, and span fragmentation.
- `structural/stacking.rs`: post-emission structural group stacking and translation.
- `pagination.rs`: header/system box extraction, pagination, page assembly, and page-overflow diagnostics.
- `validation.rs`: final scene validation diagnostics.
- `wire.rs`: `layout_scene_to_js` and wire-scene conversion.
- `snapshot.rs`: `layout_scene_snapshot`.
- `scene.rs`: `build_layout_scene` orchestration. This proposal includes extracting scene assembly from `lib.rs` into `scene.rs`; the crate root becomes module declarations plus public re-exports.

### Final Dependency Graph

- `contract`: no local module dependencies.
- `fraction`: `contract`.
- `instruments`: no local module dependencies.
- `metrics`: `contract`, `instruments`.
- `options`: no local module dependencies.
- `roles`: no local module dependencies; role values are stable emitted-scene strings.
- `names`: `contract`, `metrics`.
- `scene_geometry`: `contract`, `metrics`.
- `collision`: `metrics`.
- `display`: `contract`, `fraction`.
- `planning`: `contract`, `fraction`, `metrics`, `instruments`, `options`, `display`.
- `compat_planning`: `contract`, `fraction`, `metrics`, `instruments`, `options`, `collision`.
- `scene_builder`: `contract`.
- `engraving/barlines`: `contract`, `metrics`, `roles`, `scene_builder`.
- `engraving/notes`: `contract`, `fraction`, `metrics`, `instruments`, `roles`, `collision`, `planning`, `scene_builder`.
- `engraving/beams`: `contract`, `metrics`, `roles`, `scene_builder`, `scene_geometry`.
- `engraving/tuplets`: `contract`, `fraction`, `metrics`, `roles`, `scene_builder`.
- `structural/skyline`: `contract`, `roles`, `scene_geometry`.
- `structural/spans`: `contract`, `fraction`, `metrics`, `roles`, `display`, `planning`, `scene_builder`, `scene_geometry`, `structural/skyline`.
- `structural/stacking`: `contract`, `roles`, `scene_geometry`.
- `pagination`: `contract`, `options`, `scene_geometry`.
- `validation`: `contract`, `scene_geometry`.
- `wire`: `contract`, `names`.
- `snapshot`: `contract`, `names`.
- `scene`: all orchestration dependencies above, but no generated WASM or TypeScript dependencies.
- `lib.rs`: module declarations and public re-exports only.

### Scene Builder Mutation Rules

Target-state `SceneBuilder` may mutate emitted items only through named operations:

- `last_item_mut()` is a temporary migration helper only. It must not remain in target-state call sites except where a task explicitly documents why an immediately emitted item cannot be configured through its item spec.
- Stem-tip adjustment must target a stored stem item id, not "the last item".
- Structural stacking must target explicit item id lists from composites.
- Generic item translation must be implemented in `scene_geometry.rs` and called with explicit item ids or item references, not through open-ended builder access.
- No module may directly modify the shared item counter.

### Tuplet Sequencing Contract

Tuplets are positioned from slot-event start/end x geometry and staff-top offsets, not from final beam slope or adjusted stem tips. The preserved sequence is:

1. Build sorted slot events with resolved x positions.
2. Render slot groups, notes, rests, accents, grace notes, and initial stems; collect beam anchors.
3. Render tuplet brackets from the same slot-event geometry.
4. Render beams/flags and adjust participating stem tips by item id.
5. Render structural spans and sample skylines over the emitted base items, including tuplets and beams where the existing skyline rules include them.

This preserves current behavior and makes clear that beam slope changes do not retroactively reposition tuplet brackets during this proposal.

### Collision and Rest Placement

`collision.rs` owns primitive obstacle conversion and overlap scoring only. Rest-placement policy remains in `engraving/notes.rs` because it depends on voice, slot context, note anchors, hidden-rest settings, rest lane priority, and emitted hit-cluster plans.

Tests for `collision.rs` should use handcrafted glyph/line/rest obstacle inputs. Tests for musical rest placement stay with `engraving/notes.rs` or scene-level tests.

### Roles Versus Names

- `roles.rs` owns emitted `SceneItem.role` values and role-class helpers. These strings are observable by adapters, snapshots, skyline filters, and tests, so their literal values are behavior.
- `names.rs` owns serialization names for enum fields such as glyph role, text role, composite kind, span fragment kind, and scene item kind.
- `wire.rs` and `snapshot.rs` may use `names.rs`; they should not invent role strings.
- Emitters and structural filters may use `roles.rs`; they should not use `names.rs` for item-role classification.

### Bounds Consumer Matrix

The tasks file must create or preserve a bounds consumer matrix before moving pagination, skyline, stacking, or validation. The matrix must cover:

- Pagination/header/system boxes: forgiving bounds; missing bounds skips unsupported items unless validation later reports them.
- Final validation: strict bounds; unsupported path or empty primitive reports diagnostics.
- Skyline sampling: forgiving bounds; missing bounds skips the item as a collision obstacle.
- Structural stacking: forgiving bounds for group construction; empty groups are skipped.
- Stem-tip adjustment and item translation: item-id-targeted mutation; missing item id is a no-op or diagnostic according to the caller's existing behavior.
- Snapshot/wire serialization: no bounds dependency.

If both forgiving and strict APIs remain, they must share fixture tests for text, line, rect, polyline, path, and glyph primitives.

### Named Verification Coverage

The tasks file must preserve or explicitly invoke these existing coverage points:

- `test_cross_system_scene_snapshot_matches_golden`
- `test_structural_span_fragments_emit_child_items_and_navigation`
- `test_scene_fixture_supports_span_fragments_across_system_breaks`
- `test_system_box_orchestrator_outputs_multiple_pages_for_long_scores`
- `test_scene_item_bounds_cover_emitted_primitive_kinds`
- `test_parallel_tuplets_share_one_bracket`
- `test_beamed_shared_stem_chord_tail_stops_at_beam`
- `test_same_slot_rest_avoids_continued_beam_bounds`
- `test_volta_composites_are_emitted`
- `test_dynamic_marks_render_below_hairpins_as_text_runs`
- `npm run drummark -- docs/examples/modifiers.drum --format svg`
- `npm run drummark -- docs/examples/repeats.drum --format svg`
- `npm run drummark -- docs/examples/hairpins.drum --format svg`

Final verification also includes `npm run wasm:build`, unless implementation notes document a concrete reason it was not applicable.

### Public API Compatibility Check

Implementation must add or preserve a compile-time public API smoke test for the crate-root exports listed in v1.0. The smoke test should instantiate representative public structs, call public metric/layout/snapshot/JS entrypoints where practical, and reference the compatibility planning exports. This is in addition to normal unit tests, because ordinary private-module tests can pass while crate-root re-exports regress.

### Final Completion State

This proposal is complete when `lib.rs` is only a crate root with module declarations and public re-exports, `scene.rs` owns `build_layout_scene`, all target modules above exist or are intentionally collapsed with documented justification in the tasks file, named verification coverage passes, the public API smoke check passes, and the final visibility audit shows no unintended public API expansion.

### Author Response

Round 1 is accepted. The original proposal named plausible destination files but did not fully model the actual dependency graph inside `lib.rs`. The revision below clarifies primitive ownership, instrument/metric coupling, scene geometry versus engraving collision geometry, active planning versus prototype compatibility planning, notes/beams/stem side effects, structural-layer passes, visibility rules, and verification breadth.

## Addendum v1.1: Layout Library Modularization

### Revised Primitive Ownership

`Fraction` is part of the public render contract because it appears inside `RenderEvent`, `DynamicMark`, `HairpinSpan`, and scene item metadata. Therefore:

- `contract.rs` owns the public `Fraction` type.
- `fraction.rs` owns arithmetic and ordering helpers for `contract::Fraction`.
- `fraction.rs` depends on `contract`, not the other way around.
- No other module may define an alternate fraction type.

This avoids a circular first extraction and keeps crate-root public compatibility stable.

### Revised Instrument and Metrics Boundary

The original `metrics.rs` / `options.rs` split incorrectly placed `track_family` away from `notehead_glyph`, even though notehead selection depends on track-family semantics.

Revised modules:

- `instruments.rs`: `track_family`, `staff_y_for_track`, supported render-family mapping, and staff-position lookup.
- `metrics.rs`: glyph/text roles, canonical metric tables, role naming, rest glyphs, flag paths, text metrics, and notehead glyph selection.
- `metrics.rs` may depend on `instruments.rs`.
- `options.rs` owns `LayoutOptions` and `StaffSpace` only; it may depend on neither `metrics.rs` nor engraving modules.

The crate root continues to re-export `track_family`, `staff_y_for_track`, `glyph_metrics`, `canonical_glyph_metric`, `canonical_text_metric`, `canonical_flag_path`, `notehead_glyph`, `rest_glyph_for_fraction`, and `rest_glyph`.

### Revised Geometry Boundaries

`geometry.rs` must not become a new dumping ground. It is split into two layers:

- `scene_geometry.rs`: primitive scene geometry only. Owns `SceneItemBounds`, scene item bounds calculation, path bounds, full item translation, path translation, and bounding boxes for item ids. It may depend on `contract`, `metrics`, and `fraction`.
- `collision.rs`: engraving collision primitives only. Owns `LineObstacle`, `GlyphObstacle`, `RectObstacle`, glyph/rest/line obstacle conversion, rectangle overlap area, rest lane geometry support, and beam-envelope obstacles. It may depend on `metrics`, `instruments`, and lightweight plan structs from `engraving/notes.rs` only through explicitly passed data, not by reading emitted scene state.

Skyline sampling is not in either general geometry module. It belongs to a structural-layout support module because it filters by semantic scene roles and system/measure bands.

### Active Planning Versus Prototype Compatibility Planning

There are two distinct planning concepts and they must not be merged:

- `planning.rs`: active scene-building planning. Owns `DisplayMeasure`, `ExpandedLayoutData`, `MeasureRepeatDisplayPart`, `PlannedSystem`, `MeasureGeometry`, `MeasureGeometryInput`, grouping helpers, display-measure expansion, measure width estimation, and `plan_scene_systems`.
- `compat_planning.rs`: legacy/prototype public compatibility surface. Owns `SlotMapper`, `LayoutElement`, `ElementKind`, `System`, `MeasureLayout`, `place_notes`, `place_barlines`, `stack_edge_elements`, and `build_systems`.

`build_layout_scene` may use `planning.rs` but must not start depending on `compat_planning.rs` as part of this refactor. `compat_planning.rs` exists only to preserve existing public exports until a later deprecation/support proposal decides its future.

### Scene Emission Contract

`emit.rs` owns `SceneEmitSink` and primitive item spec structs. Its contract is:

- It receives a mutable `Vec<SceneItem>` and a shared mutable item counter.
- It is the only module that formats new scene item ids.
- It does not choose musical positions or semantic layout decisions.
- It may expose `last_item_mut()` only as `pub(crate)` during the migration, with call sites audited before completion.

Acceptance must include deterministic id-order checks through existing scene snapshot tests and at least one span-heavy fixture. Module extraction may not reorder item emission unless a later behavior proposal approves the change.

### Notes, Stems, and Beams Contract

The notes/beams boundary must make the current side effects explicit:

- `engraving/notes.rs` owns slot grouping, hit cluster planning, notehead emission, ledger lines, rest placement, accents, grace notes, and initial stem emission.
- `engraving/notes.rs` returns `HitClusterPlan` data and a list of `BeamAnchor`s containing resolved stem item ids, stem x positions, stem tips, voice, group, level, and direction.
- `engraving/beams.rs` owns beam grouping, flags for ungrouped beamable notes, slope calculation, beam body paths, secondary beam segmentation, and stem-tip adjustment for already-emitted stems.
- Stem-tip adjustment remains a deliberate mutation of emitted `SceneItem`s, but the operation must be isolated behind a named helper in `engraving/beams.rs` or `scene_geometry.rs`, not scattered through the sink.
- `build_layout_scene` or `engraving/measure.rs` orchestrates the sequence: render slot groups -> collect anchors -> render tuplets -> render beams/flags -> apply stem-tip adjustments.

This keeps the current behavior while making the mutation boundary visible and testable.

### Structural Layer Contract

Voltas, hairpins, dynamics, navigation, skyline sampling, and structural stacking are a second layout layer over already emitted base score items.

Revised modules:

- `structural/skyline.rs`: top and bottom skyline sampling, decoration-role filtering, system/measure band filtering, and dynamic/hairpin inclusion variants.
- `structural/spans.rs`: volta, hairpin, dynamic, navigation, repeat-span composite emission, and span fragment helpers.
- `structural/stacking.rs`: structural composite grouping, edge priority ordering, item-id bounding boxes, and vertical translation of structural groups.

The structural layer takes existing scene items, scene measures, display measures, composites, and layout options as inputs. It may translate emitted structural items after placement, but it may not synthesize note/rest/barline geometry or adapter-only behavior.

### Serialization Naming

Wire serialization and snapshots need naming helpers without depending on engraving modules.

Revised modules:

- `names.rs`: string names for `SceneItemKind`, `GlyphRole`, `TextRole`, `CompositeKind`, and `SpanFragmentKind`.
- `wire.rs`: `to_wire_scene` and `layout_scene_to_js`; depends on `contract` and `names`.
- `snapshot.rs`: `layout_scene_snapshot`; depends on `contract` and `names`.

`wire.rs` and `snapshot.rs` must not depend on `planning`, `emit`, or `engraving/*`.

### Visibility Rules

Mechanical extraction may temporarily use `pub(crate)` to cross module boundaries, but completion requires a visibility audit:

- No new `pub` exports beyond the existing crate-root compatibility list.
- `pub(crate)` helpers must either represent real module contracts or be reduced back to private visibility.
- Any remaining broad `pub(crate)` helper must be justified in the implementation task notes.

### Revised Dependency Graph

- `contract`: no local module dependencies.
- `fraction`: depends on `contract`.
- `instruments`: no engraving dependencies.
- `metrics`: depends on `instruments`.
- `options`: no engraving dependencies.
- `names`: depends on `contract` and `metrics` role enums.
- `scene_geometry`: depends on `contract`, `fraction`, `metrics`, and `names` only if role filtering is not involved.
- `collision`: depends on `metrics`.
- `compat_planning`: depends on `contract`, `fraction`, `metrics`, `instruments`, `options`, and `collision`.
- `planning`: depends on `contract`, `fraction`, `metrics`, `instruments`, and `options`.
- `pagination`: depends on `contract`, `options`, and `scene_geometry`.
- `emit`: depends on `contract`.
- `engraving/barlines`: depends on `contract`, `metrics`, `emit`, and `scene_geometry` helpers for glyph width only where needed.
- `engraving/notes`: depends on `contract`, `fraction`, `metrics`, `instruments`, `collision`, `emit`, and `planning` geometry inputs.
- `engraving/beams`: depends on `contract`, `metrics`, `emit`, and `scene_geometry` item mutation helpers.
- `engraving/tuplets`: depends on `contract`, `fraction`, `metrics`, `emit`, and note slot-event data passed explicitly.
- `structural/skyline`: depends on `contract`, `metrics`, `scene_geometry`, and `names`.
- `structural/spans`: depends on `contract`, `fraction`, `metrics`, `planning`, `emit`, `scene_geometry`, and `structural/skyline`.
- `structural/stacking`: depends on `contract` and `scene_geometry`.
- `wire`: depends on `contract` and `names`.
- `snapshot`: depends on `contract` and `names`.
- `lib.rs` remains the orchestrator until a final extraction moves scene assembly into `scene.rs`.

### Strengthened Acceptance Criteria

The refactor is accepted when:

- `cargo test -p drummark-layout` passes.
- `cargo clippy -p drummark-layout -- -W clippy::all` reports no new warnings. Existing trivial warnings may be cleaned up mechanically.
- `npm run drummark -- docs/examples/modifiers.drum --format svg` succeeds.
- At least one feature-rich existing example or test path covering repeats, spans, tuplets/beams, rests, and pagination is exercised through existing scene snapshot tests or explicit CLI smoke checks.
- Existing snapshot/golden tests pass without churn, unless a task explicitly documents a mechanical snapshot path/name update.
- Item id determinism is preserved by existing scene snapshot tests and at least one span-heavy fixture.
- The crate root still exposes every public API listed in v1.0, including the prototype compatibility surface.
- Final verification includes `npm run wasm:build`, or the implementation notes document why no wasm-target rebuild/check was applicable for the changed files.
- A final visibility audit confirms no unintended `pub` exports and no unjustified broad `pub(crate)` sprawl.

### Revised Completion State

This proposal is complete when `lib.rs` is reduced to a crate root plus scene orchestration glue, all module contracts above are represented in files, all acceptance checks pass, and the proposal's tasks file records which temporary visibility decisions were removed or intentionally retained.

## Addendum v1.2: Scene State and Role Contract Refinements

### Scene Builder Versus Primitive Emitter

`SceneEmitSink` currently provides both primitive emission and read access to already emitted items. Structural placement samples existing items while continuing to emit new items, so `emit.rs` must expose this reality instead of pretending to be write-only.

Revised boundary:

- `scene_builder.rs` owns `SceneBuilder`, wrapping `items`, the shared item counter, and primitive push methods.
- `SceneBuilder` exposes explicit read-only accessors such as `items()` for skyline, pagination, validation, and structural passes.
- `SceneBuilder` exposes narrowly scoped mutation helpers such as `last_item_mut()` and stem/item translation only where a module contract requires them.
- No extracted module may create an independent item counter for the same scene.

The old `SceneEmitSink` name may remain internally during migration, but the target abstraction is a scene builder with deterministic shared id state.

### Scene Role Constants

Role strings are currently a hidden cross-module contract used by emitters, skyline filtering, stacking, snapshots, and adapters. The split must not leave role names scattered as unrelated string literals.

Revised boundary:

- `roles.rs` owns scene role constants or narrowly typed role helper functions for emitted item roles such as `staff-line`, `tempo`, `volta-*`, `hairpin-*`, `dynamic`, `measure-number`, `notehead`, `rest`, `beam`, and navigation roles.
- `structural/skyline.rs` filters through role helpers rather than open-coded string lists where practical.
- Existing emitted role string values must remain unchanged during this proposal to avoid adapter and snapshot churn.

### Display Measure Boundary

`DisplayMeasure` is not merely system-planning scratch data. It is the result of display-level semantic expansion and is consumed by system planning, measure emission, barline/repeat behavior, and structural spans.

Revised boundary:

- `display.rs` owns `DisplayMeasure`, `ExpandedLayoutData`, `MeasureRepeatDisplayPart`, and `expand_layout_data`.
- `planning.rs` owns system-width planning over already expanded display measures.
- `structural/spans.rs` may depend on `display.rs`, not on private system-planning internals.

This keeps repeat-display and span-index rewrites in one module while preventing spans from depending on unrelated width-planning code.

### Bounds Contract

The two existing bounds paths must be reconciled during extraction:

- `scene_geometry.rs` owns one documented bounds API for layout consumers.
- If both loose optional bounds and strict validated bounds remain necessary, they must be named distinctly and tested against the same primitive fixture set.
- Consumers must document whether they need forgiving best-effort bounds or validation-grade bounds that include stroke padding and error reporting.

The tasks file must include a dedicated bounds extraction task before pagination, skyline, or stacking modules move.

### Review Round 2

The v1.1 and v1.2 revisions substantially improve the proposal. The primitive `Fraction` ownership, instrument/metric split, active versus compatibility planning distinction, scene-builder direction, role constants, and display-measure extraction all address real Round 1 blockers. The architecture is now close to implementable, but there are still several contract gaps that would likely surface as hidden coupling during the tasks-file phase.

Blocking issues:

- The dependency graph is internally inconsistent after v1.2. v1.1 says `planning` owns `ExpandedLayoutData`, `DisplayMeasure`, and display-measure expansion; v1.2 moves those to `display.rs`, but the revised graph is not restated. As written, a tasks author could follow the stale graph and make `structural/spans -> planning`, contradicting the later boundary. The proposal needs a final authoritative graph including `display.rs`, `scene_builder.rs`, and `roles.rs`, with old `emit.rs` terminology either demoted to a migration alias or removed from target-state dependencies.
- The `scene_builder.rs` refinement fixes the write-only fiction, but it also weakens mutation discipline. `last_item_mut()` is called out as available, and "stem/item translation" is named broadly. This risks making `SceneBuilder` the new global mutable namespace. The contract should name exactly which mutation operations are allowed in the target state, what identifies their target item(s), and which modules may call them. In particular, stem-tip adjustment should mutate by stored stem item id, not by "last item", because extraction and future item emission order changes will make last-item coupling fragile.
- The notes/beams/tuplets sequencing remains underspecified around tuplets. v1.1 says orchestration is `render slot groups -> collect anchors -> render tuplets -> render beams/flags -> apply stem-tip adjustments`, while the dependency graph gives `engraving/tuplets` note slot-event data passed explicitly. It does not define whether tuplets use pre-adjustment or post-adjustment stem tips, whether tuplet brackets participate in skyline/collision before structural spans, or whether beam slope/stem-tip adjustment can invalidate tuplet placement. This is a likely behavior-preservation trap because tuplets and beams both depend on note-group geometry.
- `collision.rs` is still too thinly specified for rest placement. v1.1 says it owns "rest lane geometry support" but depends only on `metrics`, while notes depend on `collision` and `instruments`. If rest lane geometry needs staff positions, voices, track families, measure geometry, or event fractions, the declared graph is false. Either collision must be restricted to primitive obstacle math, with rest-placement policy remaining in `engraving/notes.rs`, or its inputs and allowed dependencies must be expanded explicitly.
- `roles.rs` and `names.rs` have an unclear overlap. `names.rs` owns string names for enum-like semantic kinds, while `roles.rs` owns emitted item role constants and helpers. Some current consumers care about role strings for filtering and some care about kind names for snapshots/wire output, but the proposal does not state whether role constants are part of the wire contract, snapshot contract, adapter contract, or all three. This needs a sharper rule so a future extractor does not duplicate string formatting in both modules or accidentally serialize a helper-only role spelling.
- The bounds contract correctly demands one documented API, but it does not name consumers. Pagination, skyline, stacking, beam/stem mutation, snapshot validation, and adapter hit metadata may have different stroke-padding and failure semantics. The proposal should require a consumer matrix for bounds APIs before extraction: each consumer should choose strict or forgiving bounds and define whether missing bounds is an error, a skipped obstacle, or a zero-size fallback.
- The acceptance criteria still rely heavily on "existing tests" without naming the coverage. For a behavior-preserving split of this size, "at least one feature-rich existing example or test path" and "at least one span-heavy fixture" are too vague. The proposal should name specific examples/tests now, or require the tasks file to add explicit fixture names before implementation starts. Otherwise the implementation can satisfy the words with a weak smoke command that misses beams, tuplets, stem mutation, structural stacking, and pagination interactions.
- The proposal says `lib.rs` remains the orchestrator until a final extraction moves scene assembly into `scene.rs`, but no target module contract for `scene.rs` is defined. If `lib.rs` is supposed to end as crate root plus orchestration glue, "final extraction" may be outside this proposal; if `scene.rs` is inside this proposal, it needs dependencies, inputs/outputs, and acceptance checks. The completion state currently leaves this ambiguous.
- The public compatibility surface is preserved, but the proposal does not require compile-time API compatibility tests. A mechanical refactor can accidentally preserve crate-root names while changing trait derives, field visibility, constructor ergonomics, or wasm-bindgen-related availability. Add an explicit public API smoke test, compile-only fixture, or documented check for downstream TypeScript/WASM-facing usage.

Requested revisions:

- Append a final authoritative target dependency graph that supersedes v1.1 and includes `display.rs`, `scene_builder.rs`, `roles.rs`, `names.rs`, `scene.rs` if in scope, and any remaining `emit.rs` migration alias.
- Tighten `SceneBuilder` mutation rules around item-id-targeted mutation and eliminate or strictly time-box `last_item_mut()` from the target architecture.
- Define tuplets' input geometry, sequencing relative to beam slope/stem adjustment, and whether tuplets participate in collision/skyline before structural spans.
- Clarify whether `collision.rs` owns only primitive obstacle math or also rest-placement policy, then align dependencies and test seams accordingly.
- Separate `roles.rs` versus `names.rs` responsibilities by contract surface: emitted scene roles, snapshot names, wire names, adapter-observed strings, and internal filter helpers.
- Require a bounds consumer matrix and name concrete feature fixtures/tests for id determinism, spans, beams/tuplets, rests, repeats, pagination, and wasm-facing serialization.
- State whether `scene.rs` extraction is part of this proposal or explicitly deferred, and make the completion state match that choice.
- Add an explicit public API compatibility check beyond ordinary crate tests.

STATUS: CHANGES_REQUESTED

### Review Round 3

Addendum v1.3 resolves the prior blockers enough to proceed to a tasks file. The supersession rule gives implementers a single authoritative target instead of forcing them to reconcile stale v1.0-v1.2 wording, and the final module list now names the previously ambiguous owners for display expansion, scene building, role strings, serialization names, compatibility planning, structural passes, validation, and `scene.rs` orchestration.

The dependency graph is still broad, but it is now explicit and acyclic enough for task decomposition. Most importantly, it removes the earlier deadlocks around `Fraction`, instrument metrics, active versus compatibility planning, `roles.rs` versus `names.rs`, and `scene_builder.rs` versus the older emitter abstraction. The `scene` module being in scope is now unambiguous, and `lib.rs` has a concrete completion target: declarations and public re-exports only.

The mutation contract is also now acceptable for this phase. `last_item_mut()` is explicitly temporary, stem-tip adjustment is item-id-targeted, structural translation is item-list-targeted, and the item counter is protected as `SceneBuilder` state. That is sufficient discipline for a behavior-preserving split, provided the tasks file keeps mutation-helper extraction separate from notes/beams migration so hidden "last emitted item" dependencies are exposed early.

The tuplets, beams, and skyline sequencing contract closes the most likely behavior-preservation trap. Tuplets are defined from slot-event geometry before beam slope and stem-tip adjustment, and structural spans sample after tuplets and beams according to existing skyline inclusion rules. This gives tests a stable ordering expectation rather than leaving tuplets to drift with whichever module happens to move first.

The bounds consumer matrix, named verification coverage, final `npm run wasm:build` requirement or concrete waiver, public API smoke test, and final visibility audit are strong enough acceptance gates for a mechanical modularization. The tasks-file reviewer should still insist that these become independent tasks with clear input/output fixtures, especially for bounds, scene-builder id determinism, compatibility API re-exports, and structural stacking. Those are task-planning constraints, not remaining proposal blockers.

STATUS: APPROVED

### Consolidated Changes

The approved layout modularization refactor is a behavior-preserving split of `crates/drummark-layout/src/lib.rs` into responsibility-focused Rust modules while preserving the crate-root public API.

The authoritative target state is Addendum v1.3. `lib.rs` becomes a crate root containing module declarations and public re-exports. `scene.rs` owns `build_layout_scene`. Public contract types and `Fraction` live in `contract.rs`; fraction arithmetic lives in `fraction.rs`; track/staff mapping lives in `instruments.rs`; canonical metrics live in `metrics.rs`; layout options live in `options.rs`; emitted scene roles live in `roles.rs`; wire/snapshot enum names live in `names.rs`.

Scene infrastructure is split into `scene_builder.rs`, `scene_geometry.rs`, `collision.rs`, `display.rs`, `planning.rs`, `pagination.rs`, and `validation.rs`. The scene builder owns deterministic item ids and exposes only explicit read/mutation operations; stem-tip and structural translations target item ids, not "last emitted item" state. Bounds extraction must document strict versus forgiving consumers before pagination, skyline, stacking, or validation move.

Engraving is split into independent modules: `engraving/barlines.rs`, `engraving/notes.rs`, `engraving/beams.rs`, and `engraving/tuplets.rs`. Tuplets consume explicit slot-event geometry and stay independent of active planning and post-beam stem-tip adjustment. Rest-placement policy remains in notes; primitive obstacle math remains in collision. Structural layout is split into `structural/skyline.rs`, `structural/spans.rs`, and `structural/stacking.rs`, with skyline and stacking testable from handcrafted scene items.

The approved task plan is Revised Tasks v1.3 in `ARCHITECTURE_tasks_layout_lib_modularization.md`. Implementation proceeds task-by-task on a dedicated branch. Each completed task must update its task checkbox to Done after verification. Final acceptance requires named layout tests, CLI SVG smoke checks for modifiers/repeats/hairpins, `cargo clippy -p drummark-layout -- -W clippy::all` with no new warnings, `npm run wasm:build` or a concrete waiver, a visibility audit, and preservation of the crate-root public API smoke test.
