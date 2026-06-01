# First-Measure Pickup / Anacrusis History

## 2026-06-01

### Draft Created

Plan file: `docs/changes/active/2026-06-01-first-measure-pickup/plan.md`

Status: pending plan review and human stamp before implementation.

### Plan Review Round 1

Reviewer: subagent `019e818e-ec0c-7d10-b9d0-43008eed0956`

Status: CHANGES_REQUESTED

Findings:
- High: Pickup duration interaction with auto-filled omitted tracks was undefined.
- High: `@partial:<N>` unit meaning was ambiguous against the active `divisions` spec.
- Medium: Pickup endings inside grouping segments were not settled.
- Medium: RenderScore/layout contract delta did not name the new field, type, serialized behavior, or compatibility semantics.
- Medium: MusicXML acceptance was not concrete enough for public export behavior.
- Low: Negative test coverage was too sparse for the declared restrictions.

Resolution:
- Defined `N` as token-weight slots where a full measure equals active `divisions`.
- Required pickup-duration auto-filled rests for omitted registered tracks in the pickup measure.
- Allowed pickup duration to end inside normal grouping, with explicit token-crossing-end rejection and layout geometry tests.
- Named `RenderMeasure.expected_duration: Option<Fraction>` and WASM JSON behavior.
- Added concrete MusicXML golden expectations and expanded negative fixtures.

### Plan Review Round 2

Reviewer: subagent `019e818e-ec0c-7d10-b9d0-43008eed0956`

Status: APPROVED

Summary:
- Round 2 resolved the prior unit, omitted-track, grouping, RenderScore contract, MusicXML, negative-test, and workflow findings.

### Approved Plan

Plan file: `docs/changes/active/2026-06-01-first-measure-pickup/plan.md`

Status: APPROVED

Implementation remains blocked until a human stamp records `Status: APPROVED_FOR_IMPLEMENTATION` because this is a Spec / Contract Change.

### Approval Invalidated By Spec Correction

Reviewer: user

Status: CHANGES_REQUESTED

Finding:
- High: The approved Round 2 plan incorrectly used deprecated `divisions` as the normative unit model. Current active spec addenda define `note 1/N` and Note Units as the replacement model, with `divisions` retained only for backward compatibility/derived consumers.

Resolution:
- Revised `plan.md` so `@partial:<N>` is defined in active Note Units under the effective `note 1/N` setting for the first logical measure.
- Derived pickup expected duration as `N * NoteUnitDuration`.
- Replaced remaining active-plan `divisions`/slot-count wording with Note Unit or exact-duration terminology where applicable.
- Marked the plan status as pending corrected plan review.

### Corrected Plan Review

Reviewer: subagent `019e818e-ec0c-7d10-b9d0-43008eed0956`

Status: APPROVED

Summary:
- Corrected plan now defines `@partial:<N>` in active Note Units, not `divisions`.
- Pickup duration is specified as exact musical duration derived from `N * NoteUnitDuration`.
- Paragraph-level `note 1/N` override behavior is included in the spec delta and test plan.
- Remaining `divisions` mention is explicitly backward-compatibility context, not normative semantics.

### Approved Plan

Plan file: `docs/changes/active/2026-06-01-first-measure-pickup/plan.md`

Status: APPROVED

Implementation remains blocked until a human stamp records `Status: APPROVED_FOR_IMPLEMENTATION` because this is a Spec / Contract Change.
