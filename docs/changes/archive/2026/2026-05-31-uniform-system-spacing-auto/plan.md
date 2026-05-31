# Uniform Auto System Spacing

## Status

draft

## Problem

System placement currently advances by each system's visual height plus `system_spacing_pt`. Above-staff and below-staff content such as voltas, hairpins, dynamics, and navigation marks therefore make only the affected system pair farther apart. The result is visually uneven system spacing: one dense row can be pushed away while other rows remain tighter.

The requested behavior is a uniform system spacing model: find the smallest one spacing value that keeps all adjacent systems from overlapping under default settings, then apply that same spacing between systems. The existing app setting should become an offset that fine-tunes the final spacing, and a negative offset is allowed to intentionally reintroduce overlap.

## Goal

- Use one final system spacing value for every non-first system placement on every page.
- Compute that value from layout content:
  - `autoBaseSpacing = smallest valid candidate >= DEFAULT_SYSTEM_SPACING_PT within SYSTEM_SPACING_SEARCH_TOLERANCE_PT`
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

Introduce a layout-owned default spacing constant and rename the option internally from absolute `system_spacing_pt` to offset semantics. During pagination, compute all system boxes first, then find the smallest one spacing value that prevents overlap for actual same-page adjacent systems after pagination. A very tall element that lands across a page break from the next logical system should not inflate spacing for the whole score.

`finalSystemSpacing` keeps the existing spacing coordinate basis: it is the extra advance after the previous system's staff bounding height when placing another system on the same page. In other words, for a same-page pair:

```text
next_system_origin_y = previous_system_origin_y + staff_bounding_height_pt + finalSystemSpacing
```

`requiredNonOverlapSpacing` is measured in the same basis from local system-box geometry:

```text
requiredForPair =
  previous.visual_bottom
  - previous.local_system_origin_y
  - staff_bounding_height_pt
  - (next.visual_top - next.local_system_origin_y)
```

`requiredNonOverlapSpacing` is the maximum required spacing across actual same-page adjacent pairs for a candidate pagination. A candidate is valid when, after paginating with that candidate, no actual same-page adjacent pair requires more than `candidate - SYSTEM_COLLISION_GAP_PT`. To find the automatic base spacing, use a bounded search:

1. Start with lower bound `DEFAULT_SYSTEM_SPACING_PT`.
2. If the lower bound is valid, use it.
3. Otherwise establish a valid upper bound by using a conservative maximum requirement observed from candidate pagination, growing the upper bound as needed.
4. Scan candidates from the lower bound to the valid upper bound at the fixed tolerance step, such as `0.25pt`, and use the first valid candidate found.

Candidate validity is not assumed to be monotonic because page breaks can expose different same-page adjacent pairs at different spacing values. The tolerance-step scan avoids overshooting when a small spacing increase pushes a tall adjacent pair across a page break. Header spacing remains independently governed by existing header cursor logic.

Use explicit option names:

- Rust layout option field: `system_spacing_offset_pt`
- WASM/JS layout option key: `systemSpacingOffsetPt`
- App setting key: `systemSpacingOffset`
- User-facing label: "System Gap Offset (pt)" / "系统间距微调 (pt)"

Saved settings should not translate old absolute values; if old localStorage contains `systemSpacing`, ignore/drop it and use `systemSpacingOffset: 0`.

## Spec Delta

Append an addendum to `docs/RENDER_LAYOUT_CONTRACT.md`:

```md
## Addendum: Uniform Auto System Spacing

Date: 2026-05-31
Source change: `docs/changes/active/2026-05-31-uniform-system-spacing-auto/plan.md`
Status: Accepted

System pagination must use a single final spacing value between non-first systems rather than letting each system pair use the preceding system's full visual height as its stride.

The layout engine owns a default system spacing constant. The public/app setting is a point offset applied after automatic spacing is computed. The offset option is named `systemSpacingOffsetPt` at the WASM/JS layout boundary and maps to `system_spacing_offset_pt` in Rust layout options.

For an ordered set of rendered `SystemLayoutBox` records, pagination must find the smallest uniform spacing that keeps actual same-page adjacent systems from overlapping before user offset is applied. Logical adjacent systems that land on different pages do not contribute to the required spacing for that pagination; page breaks may therefore prevent a tall element from inflating the final spacing.

`finalSystemSpacing` and `requiredNonOverlapSpacing` use the existing system-spacing coordinate basis: the extra same-page advance after the previous system's staff bounding height. For a same-page pair:

`next_system_origin_y = previous_system_origin_y + staff_bounding_height_pt + finalSystemSpacing`

For each same-page adjacent pair under a candidate pagination:

`requiredForPair = previous.visual_bottom - previous.local_system_origin_y - staff_bounding_height_pt - (next.visual_top - next.local_system_origin_y)`

`requiredNonOverlapSpacing = max(0, requiredForPair...)`

The automatic spacing algorithm treats a candidate as valid when paginating with that candidate leaves no same-page adjacent pair requiring more than `candidate - SYSTEM_COLLISION_GAP_PT`. Implementations must find the smallest valid candidate within a fixed tolerance, such as `0.25pt`, by establishing a valid upper bound and scanning candidate values from `DEFAULT_SYSTEM_SPACING_PT` to that upper bound at the tolerance step. Candidate validity is not monotonic because page breaks can expose different same-page adjacent pairs at different spacing values, so binary search is not valid for this check. This bounded scan is required so that a tall pair that becomes page-separated after a small spacing increase does not force the full non-overlap spacing it would need if kept on one page.

The automatic base spacing is the search result, not a direct formula from the final page's observed requirements:

`autoBaseSpacing = smallest valid candidate >= DEFAULT_SYSTEM_SPACING_PT within SYSTEM_SPACING_SEARCH_TOLERANCE_PT`

The final spacing used between non-first systems is:

`finalSystemSpacing = autoBaseSpacing + systemSpacingOffsetPt`

`systemSpacingOffsetPt` may be negative. Negative offsets are allowed to make content overlap; the engine does not clamp the final spacing to the non-overlap requirement after applying the offset.

Header-to-first-system placement keeps the existing header cursor behavior. The uniform final spacing applies to subsequent same-page systems and is used consistently during pagination and page assembly. First systems after a page break start from the page top margin/header cursor rules; they do not receive page-crossing spacing from the previous page.

Visual bounds remain authoritative for overflow diagnostics and validation; they no longer cause one individual system pair to receive a unique larger stride except through the global final spacing calculation.
```

## Affected Specs / Contracts

- `docs/RENDER_LAYOUT_CONTRACT.md`

## Tasks

### Task 1: Plan and Contract Setup

Status: Done

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

Status: Done

Scope:
- `crates/drummark-layout/src/options.rs`
- WASM option ingestion/export files that currently read `systemSpacing`.
- TypeScript render option types/defaults that currently expose `systemSpacing`.
- App settings hook/tests and i18n labels.

Action:
- Add layout constants for default system spacing and collision gap.
- Convert the layout option to offset semantics, with default `0`, using the names `system_spacing_offset_pt`, `systemSpacingOffsetPt`, and `systemSpacingOffset`.
- Update app setting names/labels/ranges to communicate offset behavior.
- Reset old persisted `systemSpacing` rather than migrating absolute values.

Input / Output Contract:
- Input option: `systemSpacingOffsetPt` / `system_spacing_offset_pt` in points.
- Output layout option: offset added after auto spacing calculation.

Dependencies:
- Task 1 approval.

Acceptance:
- Default app/layout behavior uses offset `0`.
- Old saved absolute `systemSpacing` does not survive as a new offset and is dropped/reset to `systemSpacingOffset: 0`.
- Existing app settings tests cover reset/default behavior.

Verification:
- `npm test -- --run src/hooks/useAppSettings.test.ts src/components/settings-panel.test.tsx`
- `npm run typecheck`

### Task 3: Uniform Auto Pagination

Status: Done

Scope:
- `crates/drummark-layout/src/pagination.rs`
- `crates/drummark-layout/src/scene.rs`
- Layout tests/goldens.

Action:
- Stop pre-spacing systems by user-controlled absolute spacing before pagination.
- Compute system boxes and derive one final spacing by bounded search over candidate pagination validity and same-page visual-bound requirements.
- Use that final spacing for all non-first system placements.
- Preserve header-first-system cursor behavior, first-system-after-page-break behavior, and overflow diagnostics.

Input / Output Contract:
- Input: ordered `SystemLayoutBox` records with local system origins and visual bounds.
- Output: `PlacedSystemBox` records whose same-page non-first system origins follow `next_origin = previous_origin + staff_bounding_height_pt + finalSystemSpacing`, subject to page breaks.

Dependencies:
- Task 2 option semantics.

Acceptance:
- A fixture with one large hairpin/volta/navigation mark produces equal same-page spacing gaps, measured as `next_origin - previous_origin - staff_bounding_height_pt`.
- A fixture where an otherwise spacing-inflating tall element lands across a page break does not inflate the final spacing beyond the default/candidate needed for same-page pairs.
- A threshold fixture proves the algorithm does not overshoot to the full same-page non-overlap requirement when a much smaller spacing increase moves the problematic pair across a page break.
- Multi-page output uses the same final spacing for all non-first same-page systems after page breaks.
- Negative offset reduces all same-page spacing gaps equally and may permit visual overlap.
- Golden changes are intentional and explained.

Verification:
- `cargo test -p drummark-layout`
- Update cross-system scene golden if changed.

### Task 4: WASM and End-to-End App Wiring

Status: Done

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
- Layout tests for same-page uniform spacing, page-break-separated tall content not inflating spacing, threshold/no-overshoot search behavior, multi-page uniform spacing, negative offset overlap allowance, and old persisted `systemSpacing` reset.
- Browser smoke against `http://localhost:5175/DrumMark/` if permitted by the in-app browser policy.

## Risks / Notes

- The current pagination code uses visual height as the cursor advance. The new model must avoid losing overflow validation while no longer letting each system pair receive an independent stride.
- Page breaks can change because final uniform spacing may be larger than some prior pair-specific gaps or smaller than the largest previous visual-height stride. The spacing calculation is pagination-aware and uses bounded search because a tall adjacent pair may become harmless when split across pages.
- Candidate validity is not equivalent to jumping directly to the largest observed requirement; the implementation must avoid overshoot by searching for the smallest valid candidate within tolerance.
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
| 2 | 2026-05-31 | Clarified score-wide pre-pagination spacing, coordinate basis, page-break behavior, option names, and acceptance tests |
| 3 | 2026-05-31 | Changed spacing derivation to pagination-aware iteration so page-break-separated tall content does not inflate spacing |
| 4 | 2026-05-31 | Replaced candidate-raise loop with bounded search to find the smallest valid pagination-aware spacing |
| 5 | 2026-05-31 | Defined `autoBaseSpacing` as the bounded-search result rather than recomputing from final observed requirements |
| 6 | 2026-05-31 | Replaced binary search with tolerance-step bounded scan because same-page candidate validity is not monotonic across page breaks |
