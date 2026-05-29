# History: 2026-05-29-scene-shallow-tree

## 2026-05-29 — Initial plan

- Created from discussion: flat `page.items` obscures system ownership; target shape is Page → System → (measures, items, composites).
- Classified as Spec / Contract Change (`RENDER_LAYOUT_CONTRACT.md` addendum).
- Prerequisite: Phase 1 magic-number / staff_space work committed as `0213630`.

## 2026-05-29 — Plan review (self-review)

Reviewer: self-review

Checklist:

- [x] Problem matches user intent (explicit system grouping in scene wire format)
- [x] Spec Delta defines ownership, header split, and versioning
- [x] Non-goals exclude parser/IR and system-local wire coordinates
- [x] Tasks ordered: types → pagination → emit path → adapters → spec merge
- [x] Verification includes layout tests, scene JSON, WASM, golden snapshot
- [x] No duplicate active plan for same work
- [ ] Human stamp for implementation — **pending user approval**

Findings:

- MEDIUM: Implementation should build nested structure during emit or per-system boxes, not only repartition flat lists post-hoc — captured in Task 3.
- LOW: Keep `SceneMeasure.system_id` for span anchor validation in Task 1 non-goals / plan text.

STATUS: APPROVED (plan only)

### Approved Plan

Plan file: `docs/changes/active/2026-05-29-scene-shallow-tree/plan.md`

**Implementation blocked** until `Status: APPROVED_FOR_IMPLEMENTATION` is recorded below (Spec / Contract gate).

## 2026-05-29 — Human stamp

Status: APPROVED_FOR_IMPLEMENTATION

User: "开工吧" — proceed with nested `ScenePage` wire shape per approved plan.

## 2026-05-29 — Implementation review (self-review)

Reviewer: self-review

Checklist:

- [x] Tasks 1–5 match shipped nested `ScenePage` / `SceneSystem` wire shape
- [x] Task 6 follow-ups: repeat-start on non-first system, barline vertical span, beam gap
- [x] `RENDER_LAYOUT_CONTRACT.md` addendum appended (Task 5)
- [x] Golden `cross_system_scene_snapshot.txt` updated (barline height 20pt; beam secondary positions)
- [x] `cargo test -p drummark-layout -p drummark-cli` passes
- [x] Regression tests added for repeat/clef clearance and barline/staff alignment
- [x] No adapter-side layout logic added in `src/renderer`
- [x] WASM packages rebuilt after layout changes

Findings:

- LOW: Example `.drum` files under `examples/` remain untracked (user content, out of scope).

STATUS: APPROVED

## Consolidated Changes

- **Wire**: `LayoutScene` version `2`; each `ScenePage` has optional `header` and nested `systems[]` with `measures`, `items`, `composites` (no flat `page.items`).
- **Pagination**: `assemble_placed_system_box` preserves nested ownership; `page_header_*` helpers for flattening.
- **Adapters**: CLI scene JSON, WASM wire, TS `svgSceneAdapter` walk nested systems.
- **Spec**: Append-only shallow-tree addendum in `RENDER_LAYOUT_CONTRACT.md`.
- **Follow-ups**: Preamble side gaps; repeat-start placement after clef on continuation systems; barline height `staff_barline_height_pt`; secondary beam offset `(level-1)×(thickness+gap)`.

## 2026-05-29 — Merged

Squash-merged to `main` as `b536a85`.
