# WYSIWYG Short Measures / No Auto-Fill History

## 2026-06-02

### Draft Created

Plan file: `docs/changes/active/2026-06-02-wysiwyg-short-measures/plan.md`

Status: pending plan review and human stamp before implementation.

Notes:
- This change supersedes `docs/changes/archive/2026/2026-06-01-first-measure-pickup/plan.md`.
- No implementation may start until plan review is approved and the required spec-change human stamp is recorded.

### Plan Review Round 1

Reviewer: subagent `019e8c77-3f68-75f0-8f57-488568ace4b8`

Status: CHANGES_REQUESTED

Findings:
- High: MusicXML/export semantics for short measures and omitted/shorter tracks were still too open-ended for a spec change.
- High: The plan did not explicitly say whether short middle measures compress time or keep a hidden nominal tail.
- Medium: One rule incorrectly said tokens/groups could extend past `actualDuration`, even though `actualDuration` was defined from authored extent.
- Medium: The "empty measure is illegal" decision was buried in validation instead of being called out as a user-facing migration rule.

Resolution:
- Added a normative MusicXML rule: export only authored notes and authored `-` rests as musical events; any extra timing structure is limited to `forward` / `backup` motion within `actual_duration`, with no synthetic trailing rest notes.
- Stated explicitly that the closing barline lands at `actual_duration` and the next measure begins immediately after it, with no hidden nominal tail in short middle measures.
- Rewrote the invalid-extension rule against `fullDuration` instead of `actualDuration`.
- Promoted the empty-measure decision into the goal/non-goals/spec text and added explicit verification for fully silent measures authored with `-`.

### Plan Review Round 2

Reviewer: subagent `019e8c77-3f68-75f0-8f57-488568ace4b8`

Status: CHANGES_REQUESTED

Findings:
- Medium: The MusicXML section still did not state whether v1 promised third-party import/round-trip compatibility for compressed short middle measures or only DrumMark-owned deterministic export.

Resolution:
- Scoped v1 MusicXML explicitly to DrumMark-owned best-effort export semantics.
- Added non-goal and contract language that deterministic DrumMark export shape is required, while third-party notation-editor round-trip acceptance is not part of the v1 contract.

### Plan Review Round 3

Reviewer: subagent `019e8c77-3f68-75f0-8f57-488568ace4b8`

Status: APPROVED

Summary:
- Revised plan now clearly scopes silent timing to authored `-` rests only.
- Short middle measures explicitly compress time, with the next measure beginning at `actual_duration`.
- MusicXML is scoped to deterministic DrumMark-owned best-effort export semantics rather than third-party round-trip guarantees.

### Approved Plan

Plan file: `docs/changes/active/2026-06-02-wysiwyg-short-measures/plan.md`

Status: APPROVED

Implementation remains blocked until a human stamp records `Status: APPROVED_FOR_IMPLEMENTATION` because this is a Spec / Contract Change.

## Human Stamp

Date: 2026-06-03
Approved by: user
Approved plan: `docs/changes/active/2026-06-02-wysiwyg-short-measures/plan.md`
Approved plan commit: N/A
Scope: Implement authored short measures with no trailing auto-fill, using explicit `-` as the only silent duration token.

Approval text:

> stamp, go implement

Conditions:
- None

Status: APPROVED_FOR_IMPLEMENTATION

## Consolidated Changes

Source:
- `plan.md` > `## Spec Delta`

Affected specs/contracts:
- `docs/DRUMMARK_SPEC.md`
- `docs/RENDER_LAYOUT_CONTRACT.md`

Summary:
- DrumMark measures now use authored content duration as the authoritative `actualDuration`, with `fullDuration` retained as the nominal time-signature duration.
- Trailing rest auto-fill is removed; explicit `-` remains the only silent duration token, and omitted content no longer creates hidden rest events.
- Short middle measures compress time: their closing barline lands at `actualDuration`, and the next measure begins immediately after it.
- MusicXML exports only authored notes and authored rests as musical events, with any extra timing structure limited to non-note cursor motion inside `actualDuration`.

Final integration location:
- Integrated into `docs/DRUMMARK_SPEC.md` sections:
  - `4.2 Validation Model`
  - `5.4 Track Registry And Auto-Fill`
- Appended to `docs/RENDER_LAYOUT_CONTRACT.md` under `## Addendum 2026-06-03: Content-Driven Measure Duration`

## Implementation Review

### Round 1 - Implementation Review

Reviewer: subagent `019e8c99-e370-7a30-a589-4c9aaa19cd82`

### Comments

1. High: structural spans still treated dynamic/hairpin fractions as raw `0..1` progress instead of normalizing against each measure's `actual_duration`, so short measures misplaced those items.
2. High: dangling hairpins in a final short measure still closed at `1/1` instead of that measure's authored duration.

### Checks

- Tasks complete: Mostly, but structural short-measure semantics still had two regressions.
- Tests pass: Not sufficient before follow-up fixes; missing regression coverage for short-measure structural-item placement.
- Spec/contract updated if required: Yes.
- GitHub Issues updated if applicable: N/A.
- ADRs respected: Yes.
- Scope creep: No.

### Agent Response

- Normalized dynamic and hairpin placement against each measure's `actual_duration` in `crates/drummark-layout/src/structural/spans.rs`.
- Closed dangling final-measure hairpins at the last measure's authored duration in `crates/drummark-core/src/normalize.rs`.
- Added regression tests covering both behaviors.

STATUS: CHANGES_REQUESTED

### Round 2 - Implementation Review

Reviewer: subagent `019e8c99-e370-7a30-a589-4c9aaa19cd82`

### Comments

- No remaining findings.

### Checks

- Tasks complete: Yes.
- Tests pass: `cargo test -p drummark-core --lib`; `cargo test -p drummark-layout --lib`; `npm test -- --run src/wasm/parser_layout_parity.test.ts src/renderer/svgSceneAdapter.test.ts`
- Spec/contract updated if required: Yes.
- GitHub Issues updated if applicable: N/A.
- ADRs respected: Yes.
- Scope creep: No.

### Agent Response

- Follow-up fixes resolved the short-measure structural placement regressions.

STATUS: APPROVED
