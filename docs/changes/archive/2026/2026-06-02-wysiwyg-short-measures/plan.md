# Authored Short Measures / No Trailing Auto-Fill

## Status

implemented - review approved

## Problem

DrumMark currently treats the header time signature as a strict per-measure closure rule and auto-fills missing tail duration with rests. That makes the language safer, but it also means the written notation is not the rendered notation:
- authors cannot intentionally leave a measure short without synthetic rests appearing,
- first-measure pickup support needs a special-case feature,
- omitted tracks are expanded into silent content the author did not write,
- short written material is normalized into full measures before layout and export.

If a user writes two eighth notes in a 4/4 measure, the system currently invents the remaining silence instead of preserving the authored short measure. If the author wants a late entrance inside the measure, they must still write explicit `-` rest tokens to occupy the earlier time; omitted tokens do not imply interior blank time.

## Goal

Adopt an authored-duration measure model:
- the actual duration of each logical measure is derived from explicit written content,
- underfull measures are legal anywhere unless another rule forbids them,
- normalization no longer auto-fills trailing rests to satisfy the header duration,
- layout and export render the written duration rather than a synthesized full measure,
- first-measure pickup becomes an ordinary case of a short measure instead of a dedicated feature,
- `-` remains the only explicit silent duration token in v1.

This change also makes the barline advance rule explicit: every following measure begins immediately after the prior measure's `actual_duration`, not after its nominal full-duration boundary.

## Non-goals

- No support for measures whose written duration exceeds the active time-signature duration in v1.
- No new blank-slot or spacer syntax such as `_` in v1.
- No automatic inference of interior silence; authors must continue to use explicit `-` rest tokens wherever time should advance before a later event.
- No hidden rest synthesis for omitted registered tracks.
- No attempt to preserve legacy full-measure-rest insertion semantics in normalized IR.
- No new shorthand syntax in v1; this is a semantic change to existing measure authoring.
- No playback-specific repeat unfolding or DAW timing model changes beyond the new measure durations already implied by normalized data.
- No implicit empty measures in v1; a fully silent measure must still be authored with explicit `-` rest content.
- No promise that third-party notation editors will round-trip or semantically accept compressed short middle measures from MusicXML; v1 MusicXML is a DrumMark-owned best-effort export.

## Current Plan

Redefine measure duration to be content-driven instead of header-closed.

For each logical measure:
- compute each written track's explicit duration exactly from its tokens under the effective `note 1/N`,
- define the measure's `actual_duration` as the maximum explicit written duration across its tracks,
- require `actual_duration > 0`,
- require `actual_duration <= full_measure_duration` derived from the active time signature,
- treat tracks shorter than `actual_duration` as visually empty for the remaining span, without synthesizing rest events,
- treat omitted registered tracks as absent source content, not as auto-generated whole-measure rests.

This keeps a single shared measure width for cross-track alignment while preserving authored short measures. A first-measure pickup is therefore just a first measure whose `actual_duration` is shorter than the header-derived duration. Interior offsets remain explicit: authors must still write `-` wherever they need time to advance before a later event.

For middle measures, there is no hidden nominal-time tail after the authored content. The closing barline lands at `actual_duration`, and the next logical measure begins immediately after that barline.

Example:

```txt
time 4/4
note 1/8

HH | x x |
SD | - - d |
BD | b |
```

Under this plan:
- `HH` explicit duration is 2 Note Units,
- `SD` explicit duration is 3 Note Units,
- `BD` explicit duration is 1 Note Unit,
- the logical measure `actual_duration` is 3 Note Units,
- no trailing rests are injected into any track,
- layout renders a compact 3-unit measure.

## Spec Delta

Update the canonical body of `DRUMMARK_SPEC.md`:

```md
## Measure Duration and Underfull Measures

DrumMark measures are content-driven. The active time signature defines the maximum duration of an ordinary measure, but a logical measure is not required to contain events that sum to that maximum.

For a logical measure, each written track contributes an explicit duration computed from its written tokens under the effective `note 1/N` setting for that measure. The logical measure's `actualDuration` is the maximum explicit duration across all written tracks in that measure. Explicit `-` rest tokens continue to contribute duration exactly like notes. Omitted content does not contribute duration.

Rules:

- `actualDuration` must be greater than zero.
- `actualDuration` must not exceed the header-derived full measure duration.
- A measure shorter than the full measure duration is a valid short measure.
- Tracks whose written duration is shorter than `actualDuration` remain silent for the remaining span, but DrumMark does not synthesize trailing rest events for them.
- Interior silence is still authored explicitly with `-`; omitted tokens only imply absence of later content, not hidden time before a later event.
- Omitted registered tracks do not receive auto-generated rest content.
- A following measure begins immediately after the prior measure's `actualDuration`; there is no hidden unrendered tail up to `fullDuration`.
- A first-measure pickup is represented by an ordinary short first measure; no dedicated pickup syntax is required.
- Any token or group that would cause a track's explicit duration to exceed the header-derived `fullDuration` is illegal in v1.
- A measure with no duration-bearing content is illegal; a fully silent measure must be authored with explicit `-` rests.

Canonical normalized JSON IR:

```json
{
  "actualDuration": { "num": 3, "den": 8 },
  "fullDuration": { "num": 4, "den": 4 }
}
```

`actualDuration` is required on every normalized measure. `fullDuration` is the header-derived measure duration in force at that measure for validation, diagnostics, and export. Underfull measures are expressed by `actualDuration < fullDuration`.

Normalization must preserve only written musical events and explicit authored rests. It must not insert synthetic trailing rests solely to satisfy measure closure.
```

Update `RENDER_LAYOUT_CONTRACT.md`:

```md
## Addendum: Content-Driven Measure Duration

Date: 2026-06-02
Source change: `docs/changes/active/2026-06-02-wysiwyg-short-measures/plan.md`
Status: Accepted

`RenderMeasure` carries:
- `actual_duration: Fraction`
- `full_duration: Fraction`

`actual_duration` is the geometry-owning duration for measure width, event placement, grouping truncation, compact spacing, and all measure-local anchors. `full_duration` is retained only for validation-facing consumers, diagnostics, and export semantics that need the active time signature context.

Layout engines must not infer missing rest events to occupy the gap between a track's written content and `actual_duration`.

Serialized WASM JSON includes both duration fields on every measure. This change requires a `RenderScore` version bump.
```

## Affected Specs / Contracts

- `docs/DRUMMARK_SPEC.md`
- `docs/RENDER_LAYOUT_CONTRACT.md`

## Tasks

### Task 1: Confirm and Replace Closure Semantics

Status: Done

Scope:
- `crates/drummark-core/src/normalize.rs`
- validation helpers
- existing closure diagnostics

Action:
- Replace "every measure must sum to full measure duration" validation with content-driven `actual_duration` derivation.
- Preserve overflow diagnostics when explicit content exceeds the full time-signature duration.
- Reject empty rhythmic measures if they contain no duration-bearing content.
- Keep explicit `-` rest semantics unchanged; only remove synthetic trailing rest insertion.
- Audit all callers that currently assume synthetic trailing rests exist.

Input / Output Contract:
- Normalized measure always exposes exact `actual_duration` and `full_duration`.
- No synthetic trailing rests are inserted during normalization.

Dependencies:
- Human stamp for spec change before implementation.

Acceptance:
- Underfull first, middle, and last measures normalize successfully.
- Overflow measures still fail precisely.
- Measures with interior offsets still require explicit `-` tokens and do not gain new sparse-position syntax.
- A fully silent measure is rejected unless the silence is authored with explicit `-` rests.
- Existing full measures remain unchanged semantically.

Verification:
- `cargo test -p drummark-core normalize -- --nocapture`
- `npm run drummark -- <fixture> --format ir`

### Task 2: Track Alignment, Omitted Tracks, and IR Contract

Status: Done

Scope:
- normalized measure/track data
- omitted-track handling
- JS/WASM IR serialization

Action:
- Remove auto-fill rest generation for omitted registered tracks.
- Define how shorter written tracks align within a shared `actual_duration` measure without synthetic events.
- Preserve authored `-` tokens as the only silent duration events in IR.
- Add stable IR fields for `actualDuration` and `fullDuration`.
- Make the compressed-measure rule explicit in IR consumers: the next measure starts after `actualDuration`, not after `fullDuration`.
- Audit whether any existing consumers require a compatibility adapter or version bump.

Input / Output Contract:
- Normalized IR preserves authored events only.
- Consumers derive empty tail spans from measure metadata, not inserted rest tokens.

Dependencies:
- Task 1.

Acceptance:
- A one-track-only measure does not invent silent events on other tracks.
- Mixed-duration tracks share a single measure duration equal to the longest written track.
- Interior late entrances continue to require explicit `-` tokens and serialize unchanged.
- WASM/native IR parity covers the new shape.

Verification:
- `npm run drummark -- <fixture> --format ir`
- `npm test -- --run src/wasm/parser_layout_parity.test.ts`

### Task 3: Layout and Scene Semantics

Status: Done

Scope:
- `crates/drummark-core/src/render_score.rs`
- `crates/drummark-layout/src/contract.rs`
- `crates/drummark-layout/src/planning.rs`
- `crates/drummark-layout/src/scene.rs`

Action:
- Make `actual_duration` the sole layout geometry driver.
- Preserve event placement for full measures.
- Render measures compactly when `actual_duration < full_duration`.
- Ensure group truncation, beaming, anchors, and barline placement use the content-driven measure span.
- Verify adapters remain thin and do not patch missing rests.
- Preserve authored visible rests exactly as before; only remove synthetic tail rests.

Input / Output Contract:
- `RenderMeasure` duration fields replace any assumption that measure width equals header time-signature duration.

Dependencies:
- Task 2.

Acceptance:
- Short measures render narrower.
- Written rests still render only when authored.
- Empty tail silence does not create visible rest glyphs.

Verification:
- `cargo test -p drummark-layout -- --nocapture`
- focused geometry/snapshot cases for short measures in multiple positions
- `npm run drummark -- <fixture> --format svg`

### Task 4: MusicXML and Export Semantics

Status: Done

Scope:
- `crates/drummark-core/src/musicxml.rs`
- MusicXML fixtures/goldens

Action:
- Export measure content using `actual_duration`.
- Preserve the active time signature without emitting fake time-signature changes solely to encode short measures.
- Export only authored notes and authored `-` rests as note/rest events; do not synthesize trailing rest notes for omitted tracks or shorter tracks.
- When MusicXML timing structure needs cursor movement within the authored measure span, use structural `forward` / `backup` motion only inside `actual_duration`.
- Emit each short measure with measure-local total timing equal to `actual_duration`; the next measure begins immediately after it, even when `actual_duration < full_duration`.
- Preserve authored `-` rest export semantics.
- Treat this as a DrumMark-owned best-effort MusicXML mapping; deterministic export and DrumMark-side tests are required, but third-party round-trip acceptance is not a v1 contract.
- Lock deterministic XML goldens for short measures at start, middle, and end of score.

Input / Output Contract:
- MusicXML reflects only authored rests and authored notes as musical events. Any additional timing-only structure is limited to non-note cursor motion within `actual_duration` and must not recreate trailing silent note/rest events.
- The v1 contract guarantees deterministic DrumMark export shape, not cross-editor import fidelity for compressed short middle measures.

Dependencies:
- Task 2.

Acceptance:
- A short first measure exports without dedicated pickup syntax.
- A short middle measure exports deterministically.
- Export does not depend on normalization-inserted rest events.
- Omitted tracks and shorter tracks do not gain synthetic trailing rest notes in XML.

Verification:
- `cargo test -p drummark-core musicxml -- --nocapture`
- `npm run drummark -- <fixture> --format xml`

### Task 5: Compatibility, Migration, and Examples

Status: Done

Scope:
- examples
- docs
- compatibility notes
- WASM packages

Action:
- Identify existing fixtures, tests, and examples that currently rely on auto-fill rest insertion.
- Update goldens intentionally where rendered output becomes more sparse.
- Document migration impact for users who previously relied on implicit closure.
- Document that fully silent measures must now be written with explicit `-` content.
- Rebuild WASM once contract changes are settled.

Input / Output Contract:
- Browser and native pipelines agree on short-measure semantics.

Dependencies:
- Tasks 1-4.

Acceptance:
- Representative examples demonstrate full measure, short first measure, short middle measure, and mixed-track sparse measure behavior.

Verification:
- `npm run wasm:build`
- `npm test -- --run src/renderer/svgSceneAdapter.test.ts src/wasm/parser_layout_parity.test.ts`

## Test Plan

- `cargo test -p drummark-core normalize -- --nocapture`
- `cargo test -p drummark-core musicxml -- --nocapture`
- `cargo test -p drummark-layout -- --nocapture`
- `npm run wasm:build`
- `npm test -- --run src/wasm/parser_layout_parity.test.ts src/renderer/svgSceneAdapter.test.ts`
- CLI fixtures:
  - short first measure with no explicit rests
  - short middle measure
  - short final measure
  - mixed-duration tracks where the longest track defines `actual_duration`
  - authored explicit rest versus omitted tail silence
  - interior late entrance using explicit `-` tokens
  - fully silent measure authored with explicit `-` tokens
  - overflow failure where explicit content exceeds full measure duration
  - empty measure failure with no duration-bearing content
- `npm run drummark -- <fixture> --format ast`
- `npm run drummark -- <fixture> --format ir`
- `npm run drummark -- <fixture> --format svg`
- `npm run drummark -- <fixture> --format xml`

## Risks / Notes

- This is broader than pickup support. It changes the meaning of ordinary underfull measures everywhere.
- Existing tests or user expectations may rely on implicit whole-measure rest synthesis.
- MusicXML may still require minimal structural padding in some edge cases even if DrumMark IR does not synthesize rests; this must be researched precisely before implementation.
- This plan intentionally does not add a new "blank slot" concept. Interior silence still uses authored rests, so the main behavior change is removal of trailing auto-fill.
- This plan intentionally compresses short middle measures instead of preserving hidden nominal tail time. That is a real notation-model change and must be called out in migration notes and examples.
- MusicXML interoperability is intentionally scoped narrowly in v1: serializer stability and DrumMark-owned verification matter more than round-trip acceptance in third-party notation editors.
- If export or layout reveals that fully implicit short measures are too ambiguous, the fallback should be an explicit opt-in syntax instead of reintroducing hidden auto-fill.

## Linked Items

- GitHub Issue:
- Bug:
- ADR:
- PR:
- Supersedes: `docs/changes/active/2026-06-01-first-measure-pickup/plan.md`

## Revision Log

| Round | Date | Summary of changes |
|-------|------|--------------------|
| 1 | 2026-06-02 | Initial draft replacing the narrower first-measure pickup plan with a WYSIWYG short-measure proposal. |
| 2 | 2026-06-03 | Narrowed the proposal: no `_` spacer syntax, explicit `-` rests remain the only silent duration token, and the core change is removal of trailing auto-fill rests. |
