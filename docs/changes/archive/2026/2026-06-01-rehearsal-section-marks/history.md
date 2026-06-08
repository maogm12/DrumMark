# Rehearsal Marks History

## 2026-06-07

### History Reset

Reset by explicit user request to remove stale planning history and keep only the current effective direction.

### Current Plan State

Plan file: `docs/changes/active/2026-06-01-rehearsal-section-marks/plan.md`

Current direction:
- every bracket label is a boxed rehearsal mark,
- payload content is treated literally,
- empty and whitespace-only labels are legal,
- only nested `[` and newline / missing-close cases are rejected,
- anchor placement is measure-local musical time,
- avoidance scope is limited to direct interactions with volta and existing navigation items.

Status:
- revised after approval - pending re-review and human stamp

### Post-Review Revision

Reason:
- Review found two remaining contract gaps: whitespace preservation behavior was not explicit enough, and the covered navigation set was described too loosely.

Change summary:
- Pinned leading/trailing/interior whitespace as significant through normalization, layout measurement, and MusicXML export.
- Enumerated the exact v1 navigation set instead of referring vaguely to items already present in the current layout stack.

Status:
- revised after review - pending re-review and human stamp

### Plan Review Round 1

Reviewer: subagent `019ea44d-d69d-7653-aaae-780a7a2a5f93`

Status: APPROVED

Summary:
- The current simplified plan is explicit on literal payload acceptance, whitespace preservation through normalization/layout/MusicXML, measure-local anchor semantics, and the exact v1 navigation set covered by the narrow avoidance scope.

### Approved Plan

Plan file: `docs/changes/active/2026-06-01-rehearsal-section-marks/plan.md`

Status: APPROVED

Implementation remains blocked until a human stamp records `Status: APPROVED_FOR_IMPLEMENTATION` because this is a Spec / Contract Change.

### Human Stamp

Reviewer: user

Status: APPROVED_FOR_IMPLEMENTATION

## Consolidated Changes

Source:
- `plan.md` > `## Spec Delta`

Affected specs/contracts:
- `docs/DRUMMARK_SPEC.md`
- `docs/RENDER_LAYOUT_CONTRACT.md`

Summary:
- Added bracketed boxed rehearsal marks with literal payload preservation, including empty and whitespace-only labels.
- Integrated normalized `rehearsalMark` metadata and render-facing `rehearsal_mark` contract fields with measure-local anchor offsets.
- Documented boxed rehearsal-mark scene roles, narrow volta/navigation avoidance priority, and MusicXML rehearsal-direction export.

Final integration location:
- Integrated into `docs/DRUMMARK_SPEC.md` sections:
  - `6.7 Rehearsal Marks`
  - `10.3 Measures`
  - `11. MusicXML Export`
  - `12.2 Removed Or Rejected Syntax`
- Appended to `docs/RENDER_LAYOUT_CONTRACT.md` under:
  - `## Addendum: Rendered Rehearsal Marks`

## Implementation Review

### Round 1

Reviewer: self-review

Reason:
- Sub-agent implementation review was attempted but blocked by usage-limit failure.

Status: APPROVED

Checks:
- `cargo test -p drummark-core parser -- --nocapture`
- `cargo test -p drummark-core normalize -- --nocapture`
- `cargo test -p drummark-core musicxml -- --nocapture`
- `cargo test -p drummark-layout -- --nocapture`
- `npm run drummark -- docs/examples/section-marks.drum --format ast`
- `npm run drummark -- docs/examples/section-marks.drum --format ir`
- `npm run drummark -- docs/examples/section-marks.drum --format svg`
- `npm run drummark -- docs/examples/section-marks.drum --format xml`
- `npm run wasm:build`
- `npm test -- --run src/wasm/parser_layout_parity.test.ts src/renderer/svgSceneAdapter.test.ts`

Findings:
- No material findings in the implemented rehearsal-mark diff relative to the group-delimiter branch tip.

Residual risk:
- Above-staff avoidance remains intentionally narrow in v1: rehearsal marks only coordinate directly with volta and the current navigation set, not with the broader future lane system.
