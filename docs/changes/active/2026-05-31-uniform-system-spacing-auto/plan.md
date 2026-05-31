# Uniform Auto System Spacing

## Status

draft

## Problem

System placement currently advances by each system's visual height plus `system_spacing_pt`. Above-staff and below-staff content such as voltas, hairpins, dynamics, and navigation marks therefore make only the affected system pair farther apart. The result is visually uneven system spacing: one dense row can be pushed away while other rows remain tighter.

The requested behavior is a uniform system spacing model: find the smallest one spacing value that keeps all adjacent systems from overlapping under default settings, then apply that same spacing between systems. The existing app setting should become an offset that fine-tunes the final spacing, and a negative offset is allowed to intentionally reintroduce overlap.

## Goal

- Use one final system spacing value for all non-first systems on each page.
- Compute that value from layout content:
  - `autoBaseSpacing = max(DEFAULT_SYSTEM_SPACING_PT, requiredNonOverlapSpacing + SYSTEM_COLLISION_GAP_PT)`
  - `finalSystemSpacing = autoBaseSpacing + systemSpacingOffsetPt`
- Preserve user control by treating the existing app option as an offset, not an absolute spacing.
- Do not provide a mode toggle.
- Do not migrate old saved `systemSpacing` values; the new setting defaults to offset `0`.
- Keep visual bounds and overflow diagnostics available after pagination.
- Update the active layout contract to describe the new semantics.

## Non-goals

- Do not add fixed/content/auto mode choices.
- Do not guarantee non-overlap when the user chooses a sufficiently negative offset.
- Do not change paragraph-to-system break semantics.
- Do not change the meaning or placement rules of individual hairpin, volta, dynamic, navigation, or text elements.
- Do not rewrite historical spec text; append a contract addendum only.

## Current Plan

Introduce a layout-owned default spacing constant and rename the option internally from absolute `system_spacing_pt` to offset semantics. During pagination, compute all system boxes first, measure the required spacing for every adjacent pair from staff origins and visual bounds, choose one global spacing value, and paginate all systems with that value.

The required spacing for adjacent boxes should be based on the first system's visual bottom and the next system's visual top relative to their staff/system origins. It should represent the spacing needed between staff/system origins so the translated visual bounds do not overlap. Header spacing remains independently governed by existing header cursor logic.

For compatibility through the JS/app path, keep the wire option key stable only where needed as a transitional implementation detail, but the app-facing setting should be renamed and labeled as an offset. Saved settings should not translate old absolute values; if an old persisted `systemSpacing` is present, ignore/reset it to offset `0`.

## Spec Delta

Append an addendum to `docs/RENDER_LAYOUT_CONTRACT.md`:

```md
## Addendum: Uniform Auto System Spacing

Date: 2026-05-31
Source change: `docs/changes/active/2026-05-31-uniform-system-spacing-auto/plan.md`
Status: Accepted

System pagination must use a single final spacing value between non-first systems rather than letting each system pair use the preceding system's full visual height as its stride.

The layout engine owns a default system spacing constant. The public/app setting is a point offset applied after automatic spacing is computed.

For an ordered set of rendered `SystemLayoutBox` records, pagination computes the largest spacing required by any adjacent pair to keep the previous system's visual bottom from overlapping the next system's visual top, then adds a layout-owned collision gap. The automatic base spacing is:

`autoBaseSpacing = max(DEFAULT_SYSTEM_SPACING_PT, requiredNonOverlapSpacing + SYSTEM_COLLISION_GAP_PT)`

The final spacing used between non-first systems is:

`finalSystemSpacing = autoBaseSpacing + systemSpacingOffsetPt`

`systemSpacingOffsetPt` may be negative. Negative offsets are allowed to make content overlap; the engine does not clamp the final spacing to the non-overlap requirement after applying the offset.

Header-to-first-system placement keeps the existing header cursor behavior. The uniform final spacing applies to subsequent systems and is used consistently during pagination and page assembly.

Visual bounds remain authoritative for overflow diagnostics and validation; they no longer cause one individual system pair to receive a unique larger stride except through the global final spacing calculation.
```

## Affected Specs / Contracts

- `docs/RENDER_LAYOUT_CONTRACT.md`

## Tasks

### Task 1: Plan and Contract Setup

Status: Pending

Scope:
- `docs/changes/active/2026-05-31-uniform-system-spacing-auto/plan.md`
- `docs/changes/active/2026-05-31-uniform-system-spacing-auto/history.md`
- `docs/RENDER_LAYOUT_CONTRACT.md`

Action:
- Complete plan review and human stamp.
- Append the accepted contract addendum before implementation review.

Input / Output Contract:
- Input: approved plan and human approval.
- Output: active change records and appended layout contract addendum.

Dependencies:
- None.

Acceptance:
- Plan review is approved.
- Human stamp is recorded in `history.md`.
- Contract addendum matches the approved Spec Delta.

Verification:
- Inspect `history.md` for `STATUS: APPROVED` and `Status: APPROVED_FOR_IMPLEMENTATION`.
- Inspect `docs/RENDER_LAYOUT_CONTRACT.md` for the addendum.

### Task 2: Layout Option Semantics

Status: Pending

Scope:
- `crates/drummark-layout/src/options.rs`
- WASM option ingestion/export files as needed.
- TypeScript render option types/defaults.
- App settings hook/tests and i18n labels.

Action:
- Add layout constants for default system spacing and collision gap.
- Convert the layout option to offset semantics, with default `0`.
- Update app setting names/labels/ranges to communicate offset behavior.
- Reset old persisted `systemSpacing` rather than migrating absolute values.

Input / Output Contract:
- Input option: `systemSpacingOffsetPt` (or equivalent Rust field) in points.
- Output layout option: offset added after auto spacing calculation.

Dependencies:
- Task 1 approval.

Acceptance:
- Default app/layout behavior uses offset `0`.
- Old saved absolute `systemSpacing` does not survive as a new offset.
- Existing app settings tests cover reset/default behavior.

Verification:
- `npm test -- --run src/hooks/useAppSettings.test.ts src/components/settings-panel.test.tsx`
- `npm run typecheck`

### Task 3: Uniform Auto Pagination

Status: Pending

Scope:
- `crates/drummark-layout/src/pagination.rs`
- `crates/drummark-layout/src/scene.rs`
- Layout tests/goldens.

Action:
- Stop pre-spacing systems by user-controlled absolute spacing before pagination.
- Compute system boxes and derive one global final spacing from adjacent visual-bound requirements.
- Use that final spacing for all non-first system placements.
- Preserve header-first-system cursor behavior and overflow diagnostics.

Input / Output Contract:
- Input: ordered `SystemLayoutBox` records with staff origins and visual bounds.
- Output: `PlacedSystemBox` records whose non-first system origins are separated by one final spacing value plus staff height semantics, subject to page breaks.

Dependencies:
- Task 2 option semantics.

Acceptance:
- A fixture with one large hairpin/volta/navigation mark produces uniform system-origin gaps across systems.
- Offset changes all non-first system gaps equally and may permit overlap when negative.
- Golden changes are intentional and explained.

Verification:
- `cargo test -p drummark-layout`
- Update cross-system scene golden if changed.

### Task 4: WASM and End-to-End App Wiring

Status: Pending

Scope:
- Generated WASM layout packages.
- Renderer option adapters.
- App preview wiring.

Action:
- Rebuild layout WASM after Rust changes.
- Ensure browser/TS renderer sends the offset option.
- Smoke-check the app path where available.

Input / Output Contract:
- Input: app setting offset value.
- Output: WASM layout receives offset and produces uniform auto spacing.

Dependencies:
- Tasks 2 and 3.

Acceptance:
- Generated layout WASM changes are present.
- TypeScript adapters compile against the new option shape.
- Local app still renders previews.

Verification:
- `npm run wasm:build`
- `npm run typecheck`
- Browser smoke if in-app browser policy permits; otherwise record the limitation.

## Test Plan

- `cargo test -p drummark-layout`
- `npm test -- --run src/hooks/useAppSettings.test.ts src/components/settings-panel.test.tsx`
- `npm run typecheck`
- `npm run wasm:build`
- Golden/snapshot update for any intentional layout output changes.
- Browser smoke against `http://localhost:5175/DrumMark/` if permitted by the in-app browser policy.

## Risks / Notes

- The current pagination code uses visual height as the cursor advance. The new model must avoid losing overflow validation while no longer letting each system pair receive an independent stride.
- Page breaks can change because final uniform spacing may be larger than some prior pair-specific gaps or smaller than the largest previous visual-height stride. Tests should focus on semantic spacing guarantees, not exact old page positions.
- Negative offsets intentionally allow overlap, so validators should not treat all system-to-system visual overlap as a hard layout error unless an existing contract already requires it.
- Existing `systemSpacing` localStorage values will be dropped/reset, per user request: no migration.

## Linked Items

- GitHub Issue: N/A
- Bug: User feedback in current thread
- ADR: N/A
- PR: N/A

## Revision Log

| Round | Date | Summary of changes |
|-------|------|--------------------|
| 1 | 2026-05-31 | Initial draft |
