# Visual / Export Completion History

## 2026-06-01

### Draft Created

Plan file: `docs/changes/active/2026-06-01-modifier-visual-export-completion/plan.md`

Status: pending plan review.

### Plan Review Round 1

Reviewer: subagent `019e818e-d4dc-7602-9fb8-54a7f6386547`

Status: CHANGES_REQUESTED

Findings:
- Medium: Verification commands referenced missing `docs/examples/common-articulations.drum`; repository fixture is `docs/examples/modifiers.drum`.
- Medium: MusicXML scope for `choke` and `half-open` left export behavior open during implementation.
- Low: New stable `LayoutScene` roles were not named.
- Low: Snapshot/golden expectations did not include the existing corpus gate for `docs/examples/modifiers.drum`.

Resolution:
- Corrected fixture references to `docs/examples/modifiers.drum`.
- Locked v1 MusicXML behavior for `choke` and `half-open` to deterministic `other-technical`.
- Added intended scene role names before implementation tasks.
- Added `src/renderer/corpusGate.test.ts` to the verification plan.

### Plan Review Round 2

Reviewer: subagent `019e818e-d4dc-7602-9fb8-54a7f6386547`

Status: CHANGES_REQUESTED

Findings:
- Medium: `modifier.deadNotehead` would change dead notes away from existing scene `role: "notehead"`, causing consumers that count noteheads by role to miss dead notes. Dotted camel-case role names were also inconsistent with the existing role-string surface.

Resolution:
- Revised the plan so `dead` remains `role: "notehead"` and differs through the existing notehead glyph role.
- Revised additive modifier scene roles to existing style: `roll-slash`, `choke`, and `half-open`.

### Plan Review Round 3

Reviewer: subagent `019e818e-d4dc-7602-9fb8-54a7f6386547`

Status: APPROVED

Summary:
- Round 3 resolved the remaining role-surface concern. Dead notes remain scene `role: "notehead"` with glyph-role variation, and additive roles are `roll-slash`, `choke`, and `half-open`.

### Approved Plan

Plan file: `docs/changes/active/2026-06-01-modifier-visual-export-completion/plan.md`

Status: APPROVED

## 2026-06-07

### Post-Approval Plan Revision

Reason:
- User requested broadening this change from modifier-only completion to general visual/export completion for still-undefined accepted release-facing notation, specifically including `CB`, `WB`, `SPL`, and `CHN`.

Change summary:
- Renamed the change scope from modifier-only completion to broader visual/export completion.
- Added specialty-track audit, layout-mapping, and MusicXML coverage for cowbell, woodblock, splash, and china.
- Converted this plan into a `Spec Impact` change with explicit affected spec/contract targets because the accepted track semantics must now be pinned normatively.

Status:
- revised after approval - pending re-review and new human stamp before implementation

### Plan Review Round 4

Reviewer: self-review

### Review Checklist
- [x] Problem clarity — The revised plan now targets both incomplete modifier semantics and still-generic specialty-track semantics that affect release-facing notation fidelity.
- [x] Goal and non-goals — Scope is broadened deliberately but remains bounded to accepted notation/modifier/track semantics without syntax changes or playback work.
- [x] Scope reasonableness — Adding `CB`, `WB`, `SPL`, and `CHN` is coherent because the same visual/export completion machinery owns notehead, staff-position, and MusicXML mapping decisions.
- [x] Hidden compatibility risks — The primary risk is changing accepted rendered/exported output for named tracks; the plan now treats that explicitly as spec-impact and requires regression coverage.
- [x] Task actionability — Audit, implementation, export alignment, and WASM/example update tasks remain concrete after the scope expansion.
- [x] Task independence — Task 1 defines the target matrix, Task 2 implements layout/track mapping, Task 3 locks export behavior, and Task 4 rebuilds/regenerates downstream artifacts.
- [x] Acceptance criteria verifiability — The plan names targeted examples, Rust tests, MusicXML tests, and parity checks.
- [x] Test plan sufficiency — Layout, MusicXML, WASM, SVG/XML CLI outputs, and corpus-facing tests are all represented.
- [x] Unresolved design questions — Exact glyph/position choices for `CB`, `WB`, `SPL`, and `CHN` remain to be chosen in Task 1, but the plan now correctly identifies that as the implementation prerequisite rather than an omitted scope boundary.
- [x] Spec Delta required? — Yes; the broadened scope defines accepted visual/export semantics for named tracks and modifiers.
- [x] Spec Delta specificity (if present) — Specific enough at the planning level: it now names the required semantic categories to pin before merge, even though final glyph choices will be confirmed during Task 1.
- [x] ADR-worthy decision? — No; this is release-facing notation semantics, not a long-term architecture decision.
- [x] Human stamp required? — Yes; this is a spec-impact change.

STATUS: APPROVED

### Approved Plan

Approved file: `docs/changes/active/2026-06-01-modifier-visual-export-completion/plan.md`
Approved commit: N/A
Approved summary:
- Expand the change from modifier-only completion to broader visual/export completion.
- Keep modifier completion for `dead`, `roll`, `choke`, and `half-open`.
- Add explicit visual/export semantics for `CB`, `WB`, `SPL`, and `CHN`.
- Update spec/contract text and regression coverage together with implementation.
Open conditions:
- Human stamp required before implementation.

### Plan Clarification

Reason:
- User selected the MusicXML-style stopped mark, i.e. the plus-sign-like choke symbol, as the canonical v1 `choke` rendering.

Change summary:
- Pinned `choke` visual semantics to the stopped-style plus-sign mark instead of leaving the plan open to a generic choke-like glyph or SMuFL `pictChokeCymbal`.
- Pinned `choke` MusicXML export to `stopped` instead of `other-technical`.

Status:
- approved plan clarified; still pending human stamp before implementation

## 2026-06-08

### Plan Clarification

Reason:
- User replaced the temporary stopped-mark choice for `choke` and resolved the remaining target semantics for `WB`, `SPL`, and `CHN`.

Change summary:
- Replaced `choke` stopped-mark rendering with an apostrophe-like mark placed at the note's upper-right.
- Reverted `choke` v1 MusicXML export to deterministic `other-technical`.
- Pinned `WB` to an upward triangle notehead on the fourth line.
- Pinned `SPL` to an x notehead in the second space above the staff.
- Pinned `CHN` to an x notehead on the second line above the staff.

Status:
- approved plan clarified; still pending human stamp before implementation

### Human Stamp

Reviewer: user

Decision:
- APPROVED_FOR_IMPLEMENTATION

Notes:
- Proceed with the current approved plan, including the 2026-06-08 clarified target semantics for `WB`, `SPL`, `CHN`, and the apostrophe-style upper-right `choke` mark.

### Task 1 Audit

Status:
- done

Current -> target matrix:
- `dead`
  - Current layout: generic notehead fallback in layout.
  - Current MusicXML: `notehead=x`.
  - Target: x/dead notehead in layout, matching the existing MusicXML notehead behavior.
- `roll`
  - Current layout: no roll-slash rendering.
  - Current MusicXML: `<tremolo type="single">3</tremolo>`.
  - Target: stem-attached roll slashes in layout, keep existing MusicXML tremolo.
- `choke`
  - Current layout: no dedicated choke mark.
  - Current MusicXML: no choke-specific export.
  - Target: apostrophe-like mark at the note's upper-right, export as deterministic `other-technical`.
- `half-open`
  - Current layout: no dedicated half-open mark.
  - Current MusicXML: `<other-technical>half-open</other-technical>`.
  - Target: render a half-open pictogram above the note, keep `other-technical`.
- `CB`
  - Current layout: black notehead at `staff_y_for_track = 2.0`.
  - Current MusicXML: no explicit notehead; display pitch `B4`.
  - Target: upward triangle notehead in the fourth space (`staff_y = 0.5`), MusicXML triangle notehead with display pitch aligned to that position.
- `WB`
  - Current layout: black notehead at `staff_y_for_track = 6.5`.
  - Current MusicXML: no explicit notehead; display pitch `A3`.
  - Target: upward triangle notehead on the fourth line (`staff_y = 1.0`), MusicXML triangle notehead with aligned display pitch.
- `SPL`
  - Current layout: x notehead via cymbal fallback at `staff_y_for_track = -2.5`.
  - Current MusicXML: x notehead; display pitch `D6`.
  - Target: explicit x notehead in the second space above the staff (`staff_y = -1.5`), MusicXML x notehead with aligned display pitch.
- `CHN`
  - Current layout: x notehead via cymbal fallback at `staff_y_for_track = -2.0`.
  - Current MusicXML: x notehead; display pitch `C6`.
  - Target: explicit x notehead on the second line above the staff (`staff_y = -2.0`), MusicXML x notehead with aligned display pitch.

### Task 2 Implementation

Status:
- done

Implemented:
- `dead` now resolves to the x / dead notehead in layout.
- `CB` and `WB` now resolve to the upward triangle notehead in layout.
- `CB`, `WB`, `SPL`, and `CHN` now use explicit `staff_y_for_track(...)` semantics instead of generic fallback.
- `roll` now emits `roll-slash` scene items anchored to the resolved stem.
- `choke` now emits an apostrophe-like upper-right mark as `choke`.
- `half-open` now emits a dedicated `half-open` pictogram item above the note.

Verification:
- `cargo test -p drummark-layout -- --nocapture`

### Task 3 Export Alignment

Status:
- done

Implemented:
- `choke` now exports deterministic MusicXML `<other-technical>choke</other-technical>`.
- `half-open` remains deterministic MusicXML `<other-technical>half-open</other-technical>`.
- `CB` and `WB` now export triangle noteheads with aligned display pitches.
- `SPL` and `CHN` now export explicit x noteheads with aligned display pitches.

Verification:
- `cargo test -p drummark-core -- --nocapture`
- `npm test -- --run src/dsl/musicxml_corpus.test.ts`

## Consolidated Changes

- Integrated accepted specialty-track semantics into `docs/DRUMMARK_SPEC.md` section 5 and accepted modifier semantics into section 6.
- Appended `## Addendum 2026-06-08: Visual / Export Completion` to `docs/RENDER_LAYOUT_CONTRACT.md`.

### Task 4 Downstream Verification

Status:
- done with noted external drift

Implemented:
- Rebuilt parser/layout WASM outputs.
- Updated `docs/examples/modifiers.drum` to cover `CB`, `WB`, `SPL`, and `CHN`.
- Regenerated browser and native SVG outputs for the modifiers example.

Verification:
- `npm run drummark -- docs/examples/modifiers.drum --format svg`
- `npm run drummark -- docs/examples/modifiers.drum --format xml`
- `npm run drummark:native -- docs/examples/modifiers.drum --format svg`
- `npm run wasm:build`
- `npm test -- --run src/wasm/parser_layout_parity.test.ts src/renderer/svgSceneAdapter.test.ts src/dsl/musicxml_corpus.test.ts`

Notes:
- Refreshed `docs/layout-corpus/corpus_gate_report.json` and the representative scene snapshots so the corpus gate reflects the current accepted layout baseline.
- `npm test -- --run src/renderer/corpusGate.test.ts` now passes.

### Implementation Review

Reviewer: self-review

### Review Checklist
- [x] Planned scope completed — modifier visuals/export semantics and the targeted specialty-track semantics are implemented.
- [x] Contract ownership respected — all new noteheads and marks come from layout/MusicXML ownership, not adapter-side engraving logic.
- [x] Tests and verification executed — Rust layout/core tests, browser CLI smoke, native CLI smoke, WASM build, and parity/musicxml tests all passed.
- [x] Spec/contract updates integrated — accepted behavior is reflected in `docs/DRUMMARK_SPEC.md` and `docs/RENDER_LAYOUT_CONTRACT.md`.
- [x] Regressions assessed — notehead mappings, staff positions, and MusicXML export are covered by focused tests.
- [x] Remaining blockers identified — only the unrelated existing corpus-golden drift remains outside this change's scope.

STATUS: APPROVED
