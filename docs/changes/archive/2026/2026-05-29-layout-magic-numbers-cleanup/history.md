# History: 2026-05-29-layout-magic-numbers-cleanup

## 2026-05-29 — Initial plan draft

- Created `plan.md` from codebase audit of `drummark-layout` and `drummark-core`.
- Classified magic numbers into: LayoutOptions, named const, staff-space/metrics derivation, comments-only, and parser scope.
- Proposed five implementation phases with four core tasks + one optional UI task.

### Plan Review Skipped

Skip reason: User requested an inventory/plan document only; no implementation in this session. Review before Phase 1 implementation.

Plan file: `docs/changes/active/2026-05-29-layout-magic-numbers-cleanup/plan.md`

## 2026-05-29 — Product decisions + Phase 1 partial implementation

- Resolved open questions: default `staff_space_pt = 5.0`, range 1–10; system vertical advance uses staff bounding height; compact gaps remain const-only (no new Settings).
- Implemented: `STAFF_LINE_COUNT` / `staff_bounding_height_pt`, `scene.rs` sys_y fix, planning `finalize_planned_system` passes `opts.staff_space_pt`, TS/Rust/CLI defaults and App slider range.
- Rest lanes use `staff_space_pt` (not hardcoded 10pt). Pagination assigns staff/clef/time-sig by staff span; header bounds use `opts.staff_space_pt`.

### Approved Plan

Plan file: `docs/changes/active/2026-05-29-layout-magic-numbers-cleanup/plan.md`

STATUS: APPROVED (Phase 1 scope only; Phases 2–4 remain pending)

## 2026-06-02 — Phase 1 completion

- Added `crates/drummark-layout/src/constants/mod.rs` and moved shared planner/scene constants there instead of leaving them duplicated in `planning.rs`.
- Replaced compact multi-rest inline padding values in `scene.rs` with named constants.
- Added `StaffSpace::from_layout_options()` and made `StaffSpace::default()` derive from `LayoutOptions::default()` so the helper baseline cannot drift from `staff_space_pt`.
- Replaced remaining inline planner literals in the touched Phase 1 paths with named constants (`MIN_SYSTEM_AVAILABLE_WIDTH_PT`, final/double compact inset).
- Verification: `cargo test -p drummark-layout`

### Implementation Review

Reviewer: self-review

- Checked scope against the approved Phase 1 plan only; no Phase 2 preamble unification or public API expansion was introduced.
- Verified the constants extraction did not change call-site behavior by keeping existing numeric values and passing `cargo test -p drummark-layout` (119 unit/public API/doc test targets: all passed, 1 ignored golden writer).
- Confirmed the `StaffSpace` helper now derives its default from `LayoutOptions` rather than storing a separate baseline.

STATUS: APPROVED

## 2026-06-02 — Task 2 completion

- Added `planning::PreambleLayout` / `preamble_layout()` as the shared source for system-left preamble geometry.
- Updated planner reservation and first-measure repeat-start logic to derive from the shared preamble content start instead of duplicated `margin + gap + glyph width` arithmetic.
- Updated `scene.rs` clef, time signature, and tempo placement to use the same preamble origin/positions as the planner helpers.
- Verification:
  - `npm run drummark -- docs/examples/multi-rest.drum --format svg`
  - `cargo test -p drummark-layout test_header_height_and_gap_match_ts_system_start_semantics`
  - `cargo test -p drummark-layout test_first_measure_repeat_start_sits_after_system_preamble`
  - `cargo test -p drummark-layout test_second_system_first_measure_repeat_start_clears_clef`
  - `cargo test -p drummark-layout test_hide_clef_and_time_signature_shrink_first_measure_preamble`

## 2026-06-02 — Task 3 completion

- Added shared `engraving/constants.rs` for beam, tuplet, grace-note, rest-dot, and final/double-barline inset constants.
- Added shared `structural/constants.rs` for navigation, volta label offset, hairpin trailing inset, and dynamic padding constants.
- Replaced legacy compact/preamble literals in `compat_planning.rs` with named compatibility constants.
- Updated the cross-system layout snapshot golden after the constant extraction pass preserved behavior but changed the serialized scene snapshot ordering/representation expected by the current layout scene version.
- Verification:
  - `cargo test -p drummark-layout write_cross_system_scene_golden -- --ignored`
  - `cargo test -p drummark-layout`

## 2026-06-02 — Task 5 completion

- Added `crates/drummark-core/src/parser_constants.rs` for parser-only semantic constants.
- Replaced inline multi-rest fallback `2` and supported note denominator list with named constants.
- Expanded lexer comments around `priority = 0` to document that the overlap handling is intentional.
- Verification:
  - `cargo test -p drummark-core`

### Implementation Review

Reviewer: self-review

- Confirmed final scope matches the approved remaining plan: Task 2 preamble unification, Task 3 layout constant centralization, Task 5 parser semantic constants/comments, and Task 4 remains cancelled by recorded product decision.
- Verified layout-side changes with `cargo test -p drummark-layout`, targeted CLI SVG generation, and the updated cross-system snapshot golden.
- Verified parser-side changes with `cargo test -p drummark-core`; no parser behavior regressions were introduced by the semantic constant extraction.

STATUS: APPROVED

## 2026-06-02 — Remaining scope plan review

- Reviewed the remaining scope after Task 1 completion.
- Confirmed Phase 4 is no longer in scope because the recorded product decision keeps compact/multirest gaps as internal constants rather than new Settings.
- Remaining implementation scope for this change is:
  - Task 2: preamble single source of truth
  - Task 3: engraving/structural constants + staff-space scaling
  - Task 5: parser documentation/constants pass

### Approved Plan

Reviewer: self-review

- Task 2 stays within `drummark-layout` and unifies existing preamble geometry helpers instead of changing public contracts.
- Task 3 is limited to replacing duplicated literals with named constants or staff-space-derived helpers in existing layout modules; no new layout options or UI surface.
- Task 5 is comments/semantic constants only in `drummark-core`, with no parser behavior change expected.
- Verification remains module-specific: `cargo test -p drummark-layout`, targeted CLI SVG checks, and `cargo test -p drummark-core`.

STATUS: APPROVED
