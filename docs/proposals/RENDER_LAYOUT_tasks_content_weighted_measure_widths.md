# Execution Plan: Content-Weighted Measure Widths Within a System

### Task 1: Render Options — Add tunable system-level measure width compression
- [x] **Status**: Done
- **Scope**: `src/vexflow/types.ts`, `src/cli.ts`, `src/App.tsx`
- **Commits**:
  - `feat(render): add measure width compression option`
- **Acceptance Criteria**:
  - `VexflowRenderOptions` exposes a numeric measure-width compression field.
  - App settings persist the value locally.
  - CLI / default renderer options compile with the new field.
- **Dependencies**: none

### Task 2: Renderer — Replace equal system measure widths with content-weighted widths
- [x] **Status**: Done
- **Scope**: `src/vexflow/renderer.ts`
- **Commits**:
  - `feat(renderer): allocate system measure widths by content density`
- **Acceptance Criteria**:
  - Dense bars render wider than sparse bars on the same system.
  - Width differences stay clamped and the system still fills the available width exactly.
  - Existing repeat, volta, and hairpin geometry stays stable.
- **Dependencies**: Task 1

### Task 3: Debug UI — Expose system-level measure width compression control
- [x] **Status**: Done
- **Scope**: `src/App.tsx`
- **Commits**:
  - `feat(ui): add debug control for measure width compression`
- **Acceptance Criteria**:
  - In `?debug` mode, settings panel exposes a `Measure Width Compression` control.
  - Adjusting the control updates page preview widths immediately.
- **Dependencies**: Task 1

### Task 4: Verification — Add render regression coverage
- [x] **Status**: Done
- **Scope**: `src/vexflow/render-probe.test.ts`, `LEARNINGS.md`
- **Commits**:
  - `test(renderer): cover content-weighted system measure widths`
  - `docs(learnings): record content-weighted measure width integration`
- **Acceptance Criteria**:
  - Tests verify a dense measure is wider than a sparse neighboring measure.
  - Tests verify two-bar repeat physical measures still share the same width.
  - `npm run build` passes.
- **Dependencies**: Task 2, Task 3

### Task 5: Consolidation
- [x] **Status**: Done
- **Scope**: `docs/proposals/RENDER_LAYOUT_proposal_content_weighted_measure_widths.md`
- **Commits**:
  - `docs(proposal): append consolidated implementation summary for content-weighted measure widths`
- **Acceptance Criteria**:
  - Proposal file ends with a short consolidated summary of the implemented behavior.
- **Dependencies**: Task 4
