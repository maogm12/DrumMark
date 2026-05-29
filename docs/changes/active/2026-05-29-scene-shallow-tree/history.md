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
