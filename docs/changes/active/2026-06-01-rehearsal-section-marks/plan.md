# Rehearsal / Section Marks

## Status

draft - pending plan review and human stamp

## Problem

Long drum charts need visible section anchors such as `A`, `B`, `Verse`, `Chorus`, and `Bridge`. Appendix C mentions rehearsal marks, but the older `[label]` idea conflicts visually and grammatically with DrumMark rhythmic groups. Current users rely on comments, which do not render or export.

## Goal

Add a low-risk v1 section-mark feature with explicit `@...` syntax:
- visible in layout,
- exported to MusicXML,
- represented in normalized and render-facing contracts,
- usable without disturbing rhythmic timing.

## Non-goals

- No `[label]` shorthand.
- No arbitrary Markdown/text block rendering.
- No automatic section detection from comments.
- No multiple stacked rehearsal marks at the same measure in v1.
- No layout-side source rescans.

## Current Plan

Introduce two explicit directives:

```txt
@mark "A"
@section "Verse"
```

Both are zero-duration measure directives. They attach to the logical measure where they appear and render above the measure start. The two names differ by presentation:
- `@mark` is short, boxed rehearsal-mark style.
- `@section` is text/words style.

Example:

```txt
time 4/4
note 1/8

| @mark "A" x x x x x x x x |

| @section "Chorus" c x x x c x x x |
```

## Spec Delta

Append an addendum to `DRUMMARK_SPEC.md`:

```md
## Addendum: Rehearsal and Section Marks

Date: 2026-06-01
Source change: `docs/changes/active/2026-06-01-rehearsal-section-marks/plan.md`
Status: Accepted

DrumMark supports two zero-duration measure directives for rendered section anchors:

`@mark "<text>"`
`@section "<text>"`

`@mark` is intended for short rehearsal labels such as `A`, `B`, or `C1`. `@section` is intended for longer labels such as `Verse`, `Chorus`, or `Bridge`.

The quoted text must be non-empty after trimming. The text may contain spaces. Literal quote characters must use the parser's supported quoted-string escaping rules.

The directive applies to the logical measure in which it appears and does not advance rhythmic time. It may appear in ordinary measure content or routed blocks, but declarations are global per logical measure.

In v1, a measure may contain at most one rendered section anchor total. Multiple identical declarations collapse to one anchor. Conflicting declarations in the same logical measure are a hard error.

Layout renders `@mark` above the measure start as a boxed or otherwise distinct rehearsal mark. Layout renders `@section` above the measure start as section text. Both participate in structural stacking and collision avoidance.

MusicXML export maps `@mark` to a rehearsal direction and `@section` to direction words.

The older `[label]` rehearsal-mark proposal is not part of v1 because square brackets are already owned by rhythmic groups.
```

Append or update `RENDER_LAYOUT_CONTRACT.md`:

```md
## Addendum: Rendered Section Anchors

Date: 2026-06-01
Source change: `docs/changes/active/2026-06-01-rehearsal-section-marks/plan.md`
Status: Accepted

`RenderMeasure` may carry at most one section anchor with kind `mark` or `section`, text, source measure identity, and measure-local anchor position. The layout engine owns placement, stacking, and collision avoidance for section anchors. Adapters may only draw the emitted `LayoutScene` items or composites.
```

## Affected Specs / Contracts

- `docs/DRUMMARK_SPEC.md`
- `docs/RENDER_LAYOUT_CONTRACT.md`

## Tasks

### Task 1: Parser and AST

Status: Pending

Scope:
- `crates/drummark-core/src/lexer.rs`
- `crates/drummark-core/src/parser.rs`
- `crates/drummark-core/src/ast.rs`

Action:
- Add explicit tokens/directives for `@mark` and `@section`.
- Parse a required quoted text payload.
- Preserve source locations.
- Reject empty text and malformed quotes.

Input / Output Contract:
- AST represents a zero-duration section-anchor measure expression.

Dependencies:
- Human stamp for spec change before implementation.

Acceptance:
- Parser tests cover valid marks, valid sections, empty text, missing text, and invalid placement around barlines.

Verification:
- `cargo test -p drummark-core parser -- --nocapture`
- `npm run drummark -- docs/examples/section-marks.drum --format ast`

### Task 2: Normalization and Conflict Rules

Status: Pending

Scope:
- `crates/drummark-core/src/normalize.rs`
- normalized measure data
- diagnostics

Action:
- Normalize section anchors into measure-level metadata.
- Merge identical declarations across tracks.
- Reject conflicting declarations in the same logical measure.

Input / Output Contract:
- Normalized measure exposes optional section anchor `{ kind, text, at }`.

Dependencies:
- Task 1.

Acceptance:
- Repeated identical `@mark "A"` on multiple tracks collapses.
- `@mark "A"` plus `@section "Verse"` in one measure errors.

Verification:
- `cargo test -p drummark-core normalize -- --nocapture`
- `npm run drummark -- docs/examples/section-marks.drum --format ir`

### Task 3: RenderScore and Layout

Status: Pending

Scope:
- `crates/drummark-core/src/render_score.rs`
- `crates/drummark-layout/src/contract.rs`
- structural stacking and scene emission

Action:
- Add section-anchor data to `RenderScore`.
- Emit semantic `LayoutScene` items/composites for marks and sections.
- Stack them above notes, voltas/navigation as appropriate without overlap.

Input / Output Contract:
- `RenderScore` version bump required.
- Platform adapters remain thin.

Dependencies:
- Task 2.

Acceptance:
- `@mark "A"` renders as distinct short rehearsal mark.
- `@section "Chorus"` renders as readable text above the measure.
- Marks survive page/system breaks and preserve anchors.

Verification:
- `cargo test -p drummark-layout section -- --nocapture`
- focused scene snapshot or geometry tests.

### Task 4: MusicXML Export

Status: Pending

Scope:
- `crates/drummark-core/src/musicxml.rs`
- MusicXML corpus/goldens

Action:
- Export `@mark` as rehearsal direction.
- Export `@section` as words direction.
- Preserve measure ordering with existing tempo, dynamics, hairpins, and navigation directions.

Input / Output Contract:
- MusicXML output remains deterministic.

Dependencies:
- Task 2.

Acceptance:
- MusicXML tests lock both export forms.

Verification:
- `cargo test -p drummark-core musicxml -- --nocapture`
- `npm run drummark -- docs/examples/section-marks.drum --format xml`

### Task 5: Specs, WASM, Examples

Status: Pending

Scope:
- Active specs/contracts.
- WASM packages.
- Examples.

Action:
- Append final spec/contract addenda.
- Add a small section-mark example.
- Rebuild WASM.

Input / Output Contract:
- Browser, CLI, SVG, PDF, and MusicXML paths agree.

Dependencies:
- Tasks 1-4.

Acceptance:
- A long-form example can show visible Verse/Chorus anchors without comments.

Verification:
- `npm run wasm:build`
- `npm test -- --run src/wasm/parser_layout_parity.test.ts src/renderer/svgSceneAdapter.test.ts`

## Test Plan

- `cargo test -p drummark-core parser -- --nocapture`
- `cargo test -p drummark-core normalize -- --nocapture`
- `cargo test -p drummark-core musicxml -- --nocapture`
- `cargo test -p drummark-layout section -- --nocapture`
- `npm run drummark -- docs/examples/section-marks.drum --format ast`
- `npm run drummark -- docs/examples/section-marks.drum --format ir`
- `npm run drummark -- docs/examples/section-marks.drum --format svg`
- `npm run drummark -- docs/examples/section-marks.drum --format xml`
- `npm run wasm:build`

## Risks / Notes

- Do not use `[label]`; it fights rhythmic group syntax and will make the parser feel haunted in the bad way.
- Text metrics must remain layout-owned. Adapters should not measure section text to decide placement.
- Interactions with volta/navigation/tempo need explicit stacking tests.
- If quoted-string parsing is currently header-specific, this change may need a small reusable quoted-text parser.

## Linked Items

- GitHub Issue: N/A
- Bug: v1 release feature request
- ADR: N/A
- PR: N/A

## Revision Log

| Round | Date | Summary of changes |
|-------|------|--------------------|
| 1 | 2026-06-01 | Initial draft |
