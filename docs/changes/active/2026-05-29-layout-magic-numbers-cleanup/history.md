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
