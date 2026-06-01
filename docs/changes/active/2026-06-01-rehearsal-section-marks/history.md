# Rehearsal / Section Marks History

## 2026-06-01

### Draft Created

Plan file: `docs/changes/active/2026-06-01-rehearsal-section-marks/plan.md`

Status: pending plan review and human stamp before implementation.

### Plan Review Round 1

Reviewer: subagent `019e818f-0386-7662-8bcf-9758bc27d2dc`

Status: CHANGES_REQUESTED

Findings:
- High: Quoted-string grammar was underspecified and the current parser has no reusable quoted-string token path.
- High: Routed/nested block support was not backed by a recursive normalization rule or tests.
- Medium: Anchor position semantics conflicted between measure start and a measure-local `at` field.
- Medium: Render contract delta did not name field/type, scene roles, or version behavior.
- Medium: IR/spec delta omitted the canonical normalized field shape.
- Low: Conflict and placement regression tests were too thin.

Resolution:
- Added exact v1 quoted-text grammar, escaping, newline, comment, and unknown-escape rules.
- Required recursive normalization over ordinary content, routed blocks, inline groups, and nested measure content.
- Pinned anchor placement to `anchor: "measure-start"` with source location reserved for diagnostics.
- Defined `RenderMeasure.section_anchor: Option<SectionAnchor>`, WASM omission behavior, contract version bump, and stable scene roles.
- Expanded parser, normalization, interaction, and MusicXML/layout verification cases.

### Plan Review Round 2

Reviewer: subagent `019e818f-0386-7662-8bcf-9758bc27d2dc`

Status: CHANGES_REQUESTED

Findings:
- Medium: Canonical IR field shape was still not in the `DRUMMARK_SPEC.md` addendum.
- Medium: Layout scene contract still left composite surface ambiguous.

Resolution:
- Added the canonical normalized JSON IR field `sectionAnchor: { kind, text, anchor: "measure-start" }`, omission behavior, and repeat/multi-rest non-copy rule to the Spec Delta.
- Pinned v1 LayoutScene output to ordinary text/rect/path scene items and explicitly avoided adding a new serialized composite kind.

### Plan Review Round 3

Reviewer: subagent `019e818f-0386-7662-8bcf-9758bc27d2dc`

Status: APPROVED

Summary:
- Round 3 resolved the remaining canonical IR and composite-surface concerns.

### Approved Plan

Plan file: `docs/changes/active/2026-06-01-rehearsal-section-marks/plan.md`

Status: APPROVED

Implementation remains blocked until a human stamp records `Status: APPROVED_FOR_IMPLEMENTATION` because this is a Spec / Contract Change.
