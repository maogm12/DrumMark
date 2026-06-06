# First-Measure Pickup / Anacrusis

## Status

superseded by `docs/changes/archive/2026/2026-06-02-wysiwyg-short-measures/plan.md`

## Problem

Many real drum charts start with a pickup/anacrusis measure. Today DrumMark requires every measure to sum to the full time signature duration, so users must fake pickups with rests or irregular notation. Appendix C lists `@partial:<N>` as a future feature, but it has no grammar, IR, layout, or MusicXML design.

## Goal

Add a conservative v1 pickup feature:
- one optional pickup declaration,
- first measure only,
- duration expressed in active Note Units under `note 1/N`,
- validated exactly,
- rendered and exported as a short opening measure without changing the global time signature.

## Non-goals

- No mid-score partial measures.
- No mid-score time signature changes.
- No new note-value override mechanism beyond existing global and paragraph-level `note 1/N`.
- No pickup support after repeats, codas, or section breaks.
- No automatic upbeat detection.
- No playback repeat-unfolding changes.

## Current Plan

Introduce `@partial:<N>` as a zero-duration measure directive that may appear in the first logical measure before or among its content. `N` means "this measure has N active Note Units"; one Note Unit is the duration defined by the effective `note 1/N` setting for that first logical measure. The normal full-measure Note Unit count is derived as `MeasureDuration / NoteUnitDuration`.

Example:

```txt
time 4/4
note 1/8

| @partial:1 s |
HH | x x x x x x x x |
SD | - - d - - - d - |
BD | b - - - b - - - |
```

The first measure validates against 1 Note Unit instead of the full-measure Note Unit count. Later measures validate normally.

## Spec Delta

Append an addendum to `DRUMMARK_SPEC.md`:

```md
## Addendum: First-Measure Pickup / Anacrusis

Date: 2026-06-01
Source change: `docs/changes/active/2026-06-01-first-measure-pickup/plan.md`
Status: Accepted

DrumMark supports an optional first-measure pickup directive:

`@partial:<N>`

`N` is a positive integer count of active Note Units. One Note Unit is the duration defined by the effective `note 1/N` setting for the first logical measure, including an existing paragraph-level note override if that override applies to the first paragraph. A normal full measure contains `MeasureDuration / NoteUnitDuration` Note Units. The deprecated `divisions` header may continue to map to a derived `note 1/N` for backward compatibility, but `@partial:<N>` is specified in Note Units, not `divisions`. The directive is legal only in the first logical measure of the score. A score may contain at most one pickup directive.

The first logical measure's expected duration is `N * NoteUnitDuration`. All explicit tracks and auto-filled omitted tracks in the first measure validate against that shortened duration. An omitted registered track in the pickup measure receives a whole-measure rest whose duration is the pickup duration, not the header full-measure duration. Every later measure validates against the full time signature duration.

`@partial:<N>` is a zero-duration measure directive. It does not create a note, rest, dynamic mark, or navigation mark.

Pickup duration may end inside a normal grouping segment. Tokens in the pickup measure must not cross the pickup end; grouping geometry and validation are truncated to the pickup duration for the first measure only.

The pickup directive must not be combined with measure-repeat shorthand, multi-measure rest shorthand, or an empty pure-navigation first measure. Duplicate pickup directives, pickup directives after the first logical measure, malformed values, and conflicting Note Unit counts are hard errors.

MusicXML export preserves the global time signature and emits the first measure with the shortened total duration, no emitted time-signature change, and deterministic pickup-specific measure metadata in the XML golden. Layout renders the pickup as a proportionally compact opening measure while preserving normal system preamble rendering.
```

Append or update `RENDER_LAYOUT_CONTRACT.md`:

```md
## Addendum: Partial Measure Duration

Date: 2026-06-01
Source change: `docs/changes/active/2026-06-01-first-measure-pickup/plan.md`
Status: Accepted

`RenderMeasure` may carry `expected_duration: Option<Fraction>` when its measure duration differs from the score header's default measure duration. Layout engines must use that duration for measure geometry, event placement, compact width budgeting, grouping truncation, and validation of measure-local anchors. Absence of this field means the header-derived full measure duration. Serialized WASM JSON omits the field when it is `None` and includes a fraction object when it is `Some`.

The v1 producer emits this field only for the first-measure pickup feature.
```

## Affected Specs / Contracts

- `docs/DRUMMARK_SPEC.md`
- `docs/RENDER_LAYOUT_CONTRACT.md`

## Tasks

### Task 1: Parser and AST Support

Status: Pending

Scope:
- `crates/drummark-core/src/lexer.rs`
- `crates/drummark-core/src/parser.rs`
- `crates/drummark-core/src/ast.rs`
- JS/WASM serialization if AST output includes the directive

Action:
- Add `@partial:<N>` tokenization and parsing as a measure expression.
- Preserve source location for diagnostics.
- Reject malformed forms such as `@partial`, `@partial:0`, `@partial:-1`, `@partial:x`.
- Reject duplicate pickup declarations and conflicting duplicate Note Unit counts if the parser can observe them before normalization.

Input / Output Contract:
- AST can represent a pickup directive with `note_units: u32`.

Dependencies:
- Human stamp for spec change before implementation.

Acceptance:
- Parser tests cover valid and invalid directive spelling.

Verification:
- `cargo test -p drummark-core parser -- --nocapture`
- `npm run drummark -- docs/examples/pickup.drum --format ast`

### Task 2: Normalization and Validation

Status: Pending

Scope:
- `crates/drummark-core/src/normalize.rs`
- `crates/drummark-core/src/event.rs`
- validation helpers

Action:
- Store first-measure expected duration in normalized measure data as an exact musical duration derived from `note_units * effective NoteUnitDuration`.
- Validate that only the first logical measure may use `@partial:<N>`.
- Validate all first-measure tracks against the shortened expected duration.
- Ensure auto-filled omitted tracks in the pickup measure receive a pickup-duration whole-measure rest.
- Allow pickup durations that end inside a grouping segment, while rejecting tokens that cross the pickup end.
- Reject combination with measure repeat, multi-rest, and pure-navigation-only first measures.

Input / Output Contract:
- Normalized measure exposes the shortened expected duration and may retain the pickup Note Unit count for diagnostics/IR.

Dependencies:
- Task 1.

Acceptance:
- A pickup fixture normalizes cleanly.
- A pickup fixture with an omitted registered track normalizes to a pickup-duration rest.
- Ordinary first measures remain unchanged.
- Invalid non-first pickup fails with a precise diagnostic.
- Invalid fixtures cover duplicate declarations, pickup after first logical measure, pickup with `%`, pickup with multi-rest shorthand, pickup with pure navigation, malformed values, and a token crossing the pickup end.

Verification:
- `cargo test -p drummark-core normalize -- --nocapture`
- `npm run drummark -- docs/examples/pickup.drum --format ir`

### Task 3: RenderScore and Layout

Status: Pending

Scope:
- `crates/drummark-core/src/render_score.rs`
- `crates/drummark-layout/src/contract.rs`
- `crates/drummark-layout/src/planning.rs`
- `crates/drummark-layout/src/scene.rs`
- WASM boundary

Action:
- Add render-facing measure duration metadata.
- Use measure-local duration in geometry and x-position mapping.
- Truncate first-measure grouping geometry to the pickup duration, including cases such as `@partial:1` and `@partial:3`.
- Add WASM parity and serialization assertions for the new `expected_duration` field.
- Render pickup measure as compact but not structurally special-cased in adapters.

Input / Output Contract:
- `RenderMeasure.expected_duration: Option<Fraction>` is added and requires a `RenderScore` version bump.
- `LayoutScene` output remains adapter-consumable without source rescans.

Dependencies:
- Task 2.

Acceptance:
- First measure width reflects pickup duration.
- Notes, rests, stems, beams, dynamics, and barlines remain correctly placed.

Verification:
- `cargo test -p drummark-layout pickup -- --nocapture`
- Scene snapshot or focused geometry test for pickup width and event positions.

### Task 4: MusicXML Export

Status: Pending

Scope:
- `crates/drummark-core/src/musicxml.rs`
- MusicXML corpus

Action:
- Export shortened first measure duration while retaining global time signature.
- Ensure backup/forward durations match shortened measure duration for each voice.
- Lock XML golden behavior for first-measure attributes, voice backup/forward duration, pickup-duration whole-measure rests, and absence of an emitted time-signature change.

Input / Output Contract:
- MusicXML remains score-partwise 3.1.

Dependencies:
- Task 2.

Acceptance:
- MusicXML output has a deterministic golden for pickup representation and does not require a time-signature change.

Verification:
- `cargo test -p drummark-core musicxml -- --nocapture`
- `npm run drummark -- docs/examples/pickup.drum --format xml`

### Task 5: Specs, WASM, and Examples

Status: Pending

Scope:
- Active specs/contracts.
- WASM packages.
- Minimal docs/example fixture.

Action:
- Append final spec/contract addenda.
- Rebuild WASM.
- Add a small pickup example.

Input / Output Contract:
- Browser and native paths agree.

Dependencies:
- Tasks 1-4.

Acceptance:
- CLI, WASM, layout, and MusicXML paths all support the same pickup fixture.

Verification:
- `npm run wasm:build`
- `npm test -- --run src/wasm/parser_layout_parity.test.ts src/renderer/svgSceneAdapter.test.ts`

## Test Plan

- `cargo test -p drummark-core parser -- --nocapture`
- `cargo test -p drummark-core normalize -- --nocapture`
- `cargo test -p drummark-core musicxml -- --nocapture`
- `cargo test -p drummark-layout pickup -- --nocapture`
- Normalization and IR fixture: pickup with an omitted registered track auto-filled as a pickup-duration rest.
- Layout fixture: `@partial:1`, `@partial:3`, and a token-crossing-pickup-end negative case.
- Paragraph-override fixture: first paragraph uses a paragraph-level `note 1/N` override and `@partial:<N>` is interpreted in that effective Note Unit.
- MusicXML golden: first-measure XML attributes, backup/forward duration, whole-measure pickup rests, and no emitted time-signature change.
- Negative fixtures: duplicate pickup declarations, conflicting duplicate Note Unit counts if parsed, pickup after first logical measure, pickup with `%`, pickup with multi-rest shorthand, pickup with pure navigation, malformed values.
- `npm run drummark -- docs/examples/pickup.drum --format ast`
- `npm run drummark -- docs/examples/pickup.drum --format ir`
- `npm run drummark -- docs/examples/pickup.drum --format svg`
- `npm run drummark -- docs/examples/pickup.drum --format xml`
- `npm run wasm:build`
- `npm test -- --run src/wasm/parser_layout_parity.test.ts src/renderer/svgSceneAdapter.test.ts`

## Risks / Notes

- This is intentionally first-measure-only. Supporting arbitrary partial bars would pull in time-map and repeat semantics that are too large for v1.
- Measure geometry currently assumes header/full-measure-derived duration in several places; this must be changed through `RenderScore`, not patched in SVG adapters.
- MusicXML readers vary in pickup interpretation. The safest v1 behavior is a short first measure under the declared global time signature.
- Because this is a Spec / Contract Change, implementation requires plan approval and a human stamp recorded in `history.md`.

## Linked Items

- GitHub Issue: N/A
- Bug: v1 release feature request
- ADR: N/A
- PR: N/A

## Revision Log

| Round | Date | Summary of changes |
|-------|------|--------------------|
| 1 | 2026-06-01 | Initial draft |
| 2 | 2026-06-01 | Addressed plan review: defined pickup units as token-weight slots, specified auto-filled omitted-track rests, allowed truncated grouping with crossing-end rejection, named `RenderMeasure.expected_duration`, and tightened MusicXML/negative test gates. |
| 3 | 2026-06-01 | Corrected deprecated `divisions` terminology: `@partial:<N>` is defined in active Note Units under `note 1/N`, with exact duration derived from the effective note value. |
