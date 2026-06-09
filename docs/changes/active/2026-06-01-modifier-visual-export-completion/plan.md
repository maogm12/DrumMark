# Visual / Export Completion

## Status

approved plan - pending human stamp before implementation

## Problem

The parser and validator already accept the v1 modifier surface and track set, but layout and MusicXML support are uneven. This creates a release-quality gap: users can write legal notation that parses, but some accepted modifiers and named tracks either render as generic notes or only partially export.

Current high-value gaps:
- `roll` exports MusicXML tremolo but does not render stem slashes in layout.
- `dead` exports an x notehead but does not render as a dead/muted notehead in layout.
- `choke` is legal and documented but still lacks a pinned release-facing visual and MusicXML mapping.
- `half-open` is legal and documented but lacks a layout mark.
- Several accepted track identities still rely on generic fallback semantics instead of deliberate visual/export definitions:
  - `CB` cowbell currently uses a generic black notehead and generic percussion placement/export.
  - `WB` woodblock currently uses a generic black notehead and generic percussion placement/export.
  - `SPL` splash currently inherits generic cymbal x-notehead behavior without an explicit release-facing mapping.
  - `CHN` china currently inherits generic cymbal x-notehead behavior without an explicit release-facing mapping.

## Goal

Before v1 publish, the accepted modifier set and accepted release-facing specialty tracks should either:
- render and export with deliberate, tested semantics, or
- be explicitly documented as supported syntax/track identity with intentionally limited visual/export behavior.

For this change, complete the highest-value visual/export behavior without changing DSL syntax.

## Non-goals

- No new modifiers.
- No new tracks.
- No playback/MIDI implementation.
- No user-facing settings for modifier geometry.
- No rewrite of notehead metric ownership.
- No broad MusicXML compatibility overhaul beyond these modifier and track semantics.

## Current Plan

Implement the missing rendering and specialty-track mapping in `drummark-layout`, keep adapters thin, and align MusicXML where a stable representation exists.

Two scope buckets drive this change:

1. **Modifier completion**
   - `dead`
   - `roll`
   - `choke`
   - `half-open`

2. **Specialty track visual/export definition**
   - `CB` cowbell
   - `WB` woodblock
   - `SPL` splash
   - `CHN` china

Priority order:
1. `dead`: map to a dead/muted x notehead in layout, matching current MusicXML notehead behavior.
2. `roll`: render one or more tremolo/stem slashes anchored to the resolved stem; keep current MusicXML `<tremolo type="single">3</tremolo>`.
3. `choke`: render an apostrophe-like choke mark at the note's upper-right rather than directly above the note; keep MusicXML export as deterministic `other-technical` for v1.
4. `half-open`: render a half-open hi-hat mark above the note; keep MusicXML export as deterministic `other-technical` text for v1.
5. `CB` / `WB` / `SPL` / `CHN`: replace generic fallback behavior with explicit notehead, staff-position, and MusicXML notehead decisions:
   - `CB`: upward triangle notehead in the fourth space; export `triangle` notehead.
   - `WB`: upward triangle notehead on the fourth line; export `triangle` notehead.
   - `SPL`: x notehead in the second space above the staff; export `x` notehead.
   - `CHN`: x notehead on the second line above the staff; export `x` notehead.

## Spec Delta

Append a canonical clarification to `docs/DRUMMARK_SPEC.md` and an addendum to `docs/RENDER_LAYOUT_CONTRACT.md` covering accepted v1 visual/export semantics for:

- modifier completion items (`dead`, `roll`, `choke`, `half-open`)
- specialty-track mappings (`CB`, `WB`, `SPL`, `CHN`)

The final accepted text should define:
- notehead shape where applicable,
- staff placement where the track should not rely on generic family fallback,
- and MusicXML notehead/export semantics where a stable representation is chosen.

Current target semantics to lock before implementation review:
- `dead`: x/dead notehead semantics, matching existing dead-note intent.
- `roll`: stem slashes plus existing tremolo MusicXML.
- `choke`: apostrophe-like mark at the upper-right of the note; v1 MusicXML remains `other-technical`.
- `half-open`: half-open hi-hat mark above the note; v1 MusicXML remains `other-technical`.
- `CB`: upward triangle notehead in the fourth space; MusicXML triangle notehead.
- `WB`: upward triangle notehead on the fourth line; MusicXML triangle notehead.
- `SPL`: x notehead in the second space above the staff; MusicXML x notehead.
- `CHN`: x notehead on the second line above the staff; MusicXML x notehead.

## Affected Specs / Contracts

- `docs/DRUMMARK_SPEC.md`
- `docs/RENDER_LAYOUT_CONTRACT.md`

## Tasks

### Task 1: Audit Modifier And Specialty-Track Semantics

Status: Done

Scope:
- `crates/drummark-layout/src/metrics.rs`
- `crates/drummark-layout/src/engraving/notes.rs`
- `crates/drummark-layout/src/instruments.rs`
- `crates/drummark-core/src/musicxml.rs`
- Existing modifier tests and examples

Action:
- Produce a small matrix of parser legality, layout rendering, MusicXML export, and examples for every supported modifier plus the targeted specialty tracks.
- Confirm SMuFL glyph choices for `dead`, `roll`, `choke`, `half-open`, `CB`, `WB`, `SPL`, and `CHN`, with `choke` specifically using an apostrophe-like mark at the note's upper-right.
- Record the current and target `staff_y_for_track(...)` semantics for the targeted tracks before source edits.
- Record the exact scene roles and MusicXML export form before Task 2 or Task 3 source edits. Initial intended roles are:
  - `dead` continues to emit scene `role: "notehead"` and differs through the existing notehead `glyphRole` surface, e.g. `noteheadX`; existing consumers must still count it as a notehead.
  - `roll` additive slash scene items use `role: "roll-slash"`.
  - `choke` additive mark scene items use `role: "choke"` and export as MusicXML `other-technical` for v1.
  - `half-open` additive mark scene items use `role: "half-open"`.
  - specialty tracks continue to emit scene `role: "notehead"` and differ through explicit glyph role plus explicit track-position mapping.

Input / Output Contract:
- No source behavior changes yet.
- Add implementation notes to this plan or `history.md`.

Dependencies:
- Existing canonical glyph metric table.

Acceptance:
- Matrix identifies which targeted modifiers/tracks are complete, partial, generic-fallback, or intentionally limited.

Verification:
- `rg` over modifier handling code.
- Focused CLI outputs for `docs/examples/modifiers.drum`.

Outcome summary:
- Audited the current layout/MusicXML baseline and pinned the target semantics now recorded in `history.md`.

### Task 2: Implement Layout Rendering And Track Mapping

Status: Done

Scope:
- Notehead selection for `dead`.
- Stem-attached roll slashes.
- Above-note choke and half-open marks.
- Explicit notehead selection and staff placement for `CB`, `WB`, `SPL`, and `CHN`.
- Collision participation for newly emitted marks.

Action:
- Extend canonical glyph roles or text/glyph emission as needed.
- Update `staff_y_for_track(...)` and `notehead_glyph(...)` where the targeted tracks should not use generic family fallback.
- Ensure all new marks are emitted as `LayoutScene` items with semantic roles and anchors.
- Add obstacles so rests/sticking/structural marks avoid the new modifier marks.

Input / Output Contract:
- `RenderScore` remains unchanged.
- `LayoutScene` gains only ordinary scene items with stable roles named in Task 1.

Dependencies:
- Task 1 glyph choices.

Acceptance:
- Legal modifier examples visibly render the intended marks.
- Targeted specialty tracks render with explicit, non-generic semantics.
- Existing notehead priority remains deterministic when multiple modifiers are present.
- Adapters need no engraving logic.

Verification:
- Focused Rust layout tests for each new visual role.
- `npm run drummark -- docs/examples/modifiers.drum --format svg`

Outcome summary:
- Added explicit `CB` / `WB` / `SPL` / `CHN` track mapping in layout.
- Added release-facing layout rendering for `dead`, `roll`, `choke`, and `half-open`.

### Task 3: Align MusicXML Export Tests

Status: Done

Scope:
- `crates/drummark-core/src/musicxml.rs`
- MusicXML unit/corpus tests

Action:
- Keep or refine stable MusicXML output for `roll`, `dead`, `choke`, `half-open`, `CB`, `WB`, `SPL`, and `CHN`.
- Add tests that lock the chosen export behavior.

Input / Output Contract:
- No raw-source rescans.
- Export derives from normalized events only.

Dependencies:
- Task 1 export choices.

Acceptance:
- MusicXML tests cover each completed modifier.
- MusicXML tests cover each targeted specialty track with explicit semantics.
- `choke` and `half-open` remain explicitly documented as `other-technical` exports for v1.

Verification:
- `cargo test -p drummark-core musicxml -- --nocapture`
- `npm test -- --run src/dsl/musicxml_corpus.test.ts` after expected golden updates.

Outcome summary:
- Locked `choke` and `half-open` to deterministic `other-technical`.
- Locked explicit MusicXML notehead/export behavior for `CB`, `WB`, `SPL`, and `CHN`.

### Task 4: Rebuild WASM And Update Examples

Status: Done

Scope:
- WASM parser/layout packages.
- Existing modifier example SVGs/goldens if output intentionally changes.
- Example fixtures that cover targeted specialty tracks when output intentionally changes.

Action:
- Rebuild WASM.
- Regenerate affected examples/goldens only when the output change is intentional.

Input / Output Contract:
- Browser and Node packages remain split.

Dependencies:
- Tasks 2 and 3.

Acceptance:
- Browser/CLI paths use the completed modifier behavior.

Verification:
- `npm run wasm:build`
- `npm test -- --run src/wasm/parser_layout_parity.test.ts src/renderer/svgSceneAdapter.test.ts src/renderer/corpusGate.test.ts`

Outcome summary:
- Rebuilt parser/layout WASM packages.
- Updated `docs/examples/modifiers.drum`, `docs/examples/modifiers.svg`, and `docs/examples/modifiers-native.svg`.
- Browser CLI smoke, native CLI smoke, Rust tests, and parity tests passed.
- `src/renderer/corpusGate.test.ts` still reports broader pre-existing corpus-golden drift beyond this change; no bulk corpus rebaseline was folded into this change.

## Test Plan

- `cargo test -p drummark-layout modifier -- --nocapture` or focused named tests.
- `cargo test -p drummark-layout -- --nocapture` if collision/stacking changes are broad.
- `cargo test -p drummark-core musicxml -- --nocapture`
- `npm run wasm:build`
- `npm run drummark -- docs/examples/modifiers.drum --format svg`
- `npm run drummark -- docs/examples/modifiers.drum --format xml`
- `npm test -- --run src/wasm/parser_layout_parity.test.ts src/renderer/svgSceneAdapter.test.ts src/renderer/corpusGate.test.ts`

## Risks / Notes

- Modifier priority can get muddy when users combine notehead-changing modifiers, e.g. `ghost:dead`, `rim:dead`, `open:dead`. The implementation should define deterministic priority before emitting visuals.
- `roll` slash geometry must attach to resolved stems after beam/stem layout, not guess from notehead coordinates.
- Specialty-track semantics can become inconsistent if layout and MusicXML pick different notehead families; the plan must lock both together.
- Prefer an existing MusicXML technical mapping when one matches the intended notation; use `other-technical` only when no stable standard mapping fits.
- This is the best v1 value-to-risk polish change: existing syntax/track set, visible release polish, limited contract churn.

## Linked Items

- GitHub Issue: N/A
- Bug: v1 release readiness review
- ADR: N/A
- PR: N/A

## Revision Log

| Round | Date | Summary of changes |
|-------|------|--------------------|
| 1 | 2026-06-01 | Initial draft |
| 2 | 2026-06-01 | Addressed plan review: corrected modifier fixture path, locked v1 `other-technical` MusicXML behavior for choke/half-open, named intended scene roles, and added corpus gate verification. |
| 3 | 2026-06-01 | Addressed re-review: kept dead-note scene role as `notehead` with glyph-role variation and switched additive modifier roles to existing role-string style. |
| 4 | 2026-06-07 | Expanded scope from modifiers-only to broader visual/export completion, including `CB`, `WB`, `SPL`, and `CHN` specialty-track semantics. |
| 5 | 2026-06-07 | Pinned `choke` to the stopped-style plus-sign mark and MusicXML `stopped` export instead of a generic choke-like mark or `other-technical`. |
| 6 | 2026-06-08 | Replaced the temporary stopped-mark decision with an apostrophe-style choke at the note's upper-right, and pinned `WB`, `SPL`, and `CHN` to explicit notehead and staff-position targets. |
