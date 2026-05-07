# Execution Plan: Duration-Weighted Intra-Measure Spacing

### Task 1: Render Options — Add tunable spacing compression parameter
- [x] **Status**: Done
- **Scope**: `src/vexflow/types.ts`, `src/cli.ts`, `src/App.tsx`
- **Commits**:
  - `feat(render): add duration spacing compression option`
- **Acceptance Criteria**:
  - `VexflowRenderOptions` exposes a numeric duration-spacing compression field.
  - App settings persist the value locally.
  - CLI / default renderer options compile with the new field.
- **Dependencies**: none

### Task 2: Renderer — Apply duration-weighted tick-context remapping inside each measure
- [x] **Status**: Done
- **Scope**: `src/vexflow/renderer.ts`
- **Commits**:
  - `feat(renderer): apply duration-weighted intra-measure spacing`
- **Acceptance Criteria**:
  - Mixed quarter/eighth measures render with visibly wider quarter-note spacing than eighth-note spacing.
  - Simultaneous cross-voice events remain aligned.
  - Existing repeat, tuplet, hairpin, and volta rendering continues to work.
- **Dependencies**: Task 1

### Task 3: Debug UI — Expose compression slider for tuning
- [x] **Status**: Done
- **Scope**: `src/App.tsx`
- **Commits**:
  - `feat(ui): add debug control for duration spacing compression`
- **Acceptance Criteria**:
  - In `?debug` mode, settings panel exposes a numeric control for duration spacing compression.
  - Adjusting the control updates page preview spacing immediately.
- **Dependencies**: Task 1

### Task 4: Verification — Add render regression coverage
- [x] **Status**: Done
- **Scope**: `src/vexflow/render-probe.test.ts`, `LEARNINGS.md`
- **Commits**:
  - `test(renderer): cover duration-weighted spacing anchors`
  - `docs(learnings): record duration-weighted spacing integration`
- **Acceptance Criteria**:
  - Tests verify longer values receive wider spacing than shorter values in the same measure.
  - Tests verify simultaneous voice alignment is preserved.
  - `npm run build` passes.
- **Dependencies**: Task 2, Task 3

### Task 5: Consolidation
- [x] **Status**: Done
- **Scope**: `docs/proposals/RENDER_LAYOUT_proposal_duration_weighted_spacing.md`
- **Commits**:
  - `docs(proposal): append consolidated implementation summary for duration-weighted spacing`
- **Acceptance Criteria**:
  - Proposal file ends with a short consolidated summary of the implemented behavior.
- **Dependencies**: Task 4
