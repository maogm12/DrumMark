# Modifier Visual / Export Completion

## Status

draft - pending plan review

## Problem

The parser and validator already accept the v1 modifier surface, but layout and MusicXML support are uneven. This creates a release-quality gap: users can write legal notation that parses, but some modifiers either render as plain notes or only partially export.

Current high-value gaps:
- `roll` exports MusicXML tremolo but does not render stem slashes in layout.
- `dead` exports an x notehead but does not render as a dead/muted notehead in layout.
- `choke` is legal and documented but lacks a clear layout glyph and stable MusicXML representation.
- `half-open` is legal and documented but lacks a layout mark.

## Goal

Before v1 publish, the accepted modifier set should either:
- render and export with deliberate, tested semantics, or
- be explicitly documented as supported syntax with intentionally limited visual/export behavior.

For this change, complete the visual/export behavior for the common release-facing modifiers without changing DSL syntax.

## Non-goals

- No new modifiers.
- No playback/MIDI implementation.
- No user-facing settings for modifier geometry.
- No rewrite of notehead metric ownership.
- No broad MusicXML compatibility overhaul beyond these modifier semantics.

## Current Plan

Implement the missing modifier rendering in `drummark-layout`, keep adapters thin, and align MusicXML where a stable representation exists.

Priority order:
1. `dead`: map to a dead/muted x notehead in layout, matching current MusicXML notehead behavior.
2. `roll`: render one or more tremolo/stem slashes anchored to the resolved stem; keep current MusicXML `<tremolo type="single">3</tremolo>`.
3. `choke`: render a small above-note `+` or SMuFL-supported choke-like mark; export as `other-technical` unless a better MusicXML primitive is chosen during implementation.
4. `half-open`: render a half-open hi-hat mark above the note; keep MusicXML `other-technical` unless a stable standard element is verified.

## Spec Delta

N/A. Existing `DRUMMARK_SPEC.md` already lists these modifiers and their intended visual meanings. If implementation discovers that any listed visual meaning must be narrowed, append a small spec clarification before implementation review.

## Affected Specs / Contracts

N/A unless behavior must be narrowed during implementation.

## Tasks

### Task 1: Audit Modifier Semantics

Status: Pending

Scope:
- `crates/drummark-layout/src/metrics.rs`
- `crates/drummark-layout/src/engraving/notes.rs`
- `crates/drummark-core/src/musicxml.rs`
- Existing modifier tests and examples

Action:
- Produce a small matrix of parser legality, layout rendering, MusicXML export, and examples for every supported modifier.
- Confirm SMuFL glyph choices for `dead`, `roll`, `choke`, and `half-open`.

Input / Output Contract:
- No source behavior changes yet.
- Add implementation notes to this plan or `history.md`.

Dependencies:
- Existing canonical glyph metric table.

Acceptance:
- Matrix identifies which modifiers are complete, partial, or intentionally limited.

Verification:
- `rg` over modifier handling code.
- Focused CLI outputs for `docs/examples/common-articulations.drum`.

### Task 2: Implement Layout Rendering

Status: Pending

Scope:
- Notehead selection for `dead`.
- Stem-attached roll slashes.
- Above-note choke and half-open marks.
- Collision participation for newly emitted marks.

Action:
- Extend canonical glyph roles or text/glyph emission as needed.
- Ensure all new marks are emitted as `LayoutScene` items with semantic roles and anchors.
- Add obstacles so rests/sticking/structural marks avoid the new modifier marks.

Input / Output Contract:
- `RenderScore` remains unchanged.
- `LayoutScene` gains only ordinary scene items with stable roles.

Dependencies:
- Task 1 glyph choices.

Acceptance:
- Legal modifier examples visibly render the intended marks.
- Existing notehead priority remains deterministic when multiple modifiers are present.
- Adapters need no engraving logic.

Verification:
- Focused Rust layout tests for each new visual role.
- `npm run drummark -- docs/examples/common-articulations.drum --format svg`

### Task 3: Align MusicXML Export Tests

Status: Pending

Scope:
- `crates/drummark-core/src/musicxml.rs`
- MusicXML unit/corpus tests

Action:
- Keep current stable MusicXML output for `roll`, `dead`, `choke`, `half-open`, or improve where safe.
- Add tests that lock the chosen export behavior.

Input / Output Contract:
- No raw-source rescans.
- Export derives from normalized events only.

Dependencies:
- Task 1 export choices.

Acceptance:
- MusicXML tests cover each completed modifier.
- Any intentionally lossy export behavior is explicitly documented in tests or plan notes.

Verification:
- `cargo test -p drummark-core musicxml -- --nocapture`
- `npm test -- --run src/dsl/musicxml_corpus.test.ts` after expected golden updates.

### Task 4: Rebuild WASM and Update Examples

Status: Pending

Scope:
- WASM parser/layout packages.
- Existing modifier example SVGs/goldens if output intentionally changes.

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
- `npm test -- --run src/wasm/parser_layout_parity.test.ts src/renderer/svgSceneAdapter.test.ts`

## Test Plan

- `cargo test -p drummark-layout modifier -- --nocapture` or focused named tests.
- `cargo test -p drummark-layout -- --nocapture` if collision/stacking changes are broad.
- `cargo test -p drummark-core musicxml -- --nocapture`
- `npm run wasm:build`
- `npm run drummark -- docs/examples/common-articulations.drum --format svg`
- `npm run drummark -- docs/examples/common-articulations.drum --format xml`
- `npm test -- --run src/wasm/parser_layout_parity.test.ts src/renderer/svgSceneAdapter.test.ts`

## Risks / Notes

- Modifier priority can get muddy when users combine notehead-changing modifiers, e.g. `ghost:dead`, `rim:dead`, `open:dead`. The implementation should define deterministic priority before emitting visuals.
- `roll` slash geometry must attach to resolved stems after beam/stem layout, not guess from notehead coordinates.
- If MusicXML has no good standard representation, prefer stable `other-technical` over speculative export.
- This is the best v1 value-to-risk feature: existing syntax, visible release polish, limited contract churn.

## Linked Items

- GitHub Issue: N/A
- Bug: v1 release readiness review
- ADR: N/A
- PR: N/A

## Revision Log

| Round | Date | Summary of changes |
|-------|------|--------------------|
| 1 | 2026-06-01 | Initial draft |
