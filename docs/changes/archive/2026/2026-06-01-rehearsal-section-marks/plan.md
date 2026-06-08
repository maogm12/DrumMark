# Rehearsal Marks

## Status

implementation complete - pending review

## Problem

Long drum charts need visible rehearsal anchors such as `A`, `B`, `Verse`, `Chorus`, and `Bridge`. Current users rely on comments, which do not render or export. Now that rhythmic groups have moved to `()`, square brackets are available for compact rehearsal-mark labels.

## Goal

Add a low-risk v1 rehearsal-mark feature using bracket syntax:
- visible in layout,
- exported to MusicXML,
- represented in normalized and render-facing contracts,
- usable without disturbing rhythmic timing,
- concise enough for common chart notation such as `[A]` and `[Verse]`,
- and anchored to the authored musical position inside the measure rather than forced to measure start.

## Non-goals

- No `@mark` / `@section` directive syntax in v1.
- No separate section-text mode in v1.
- No automatic section detection from comments.
- No multiple stacked rehearsal marks at the same measure in v1.
- No layout-side source rescans.
- No nested bracket labels or escaped `]` support in v1.
- No general-purpose above-staff avoidance policy in this change.

## Current Plan

Introduce one explicit bracket form:

```txt
[A]
[Verse]
```

Every bracket label is a zero-duration rehearsal mark. It attaches to the logical measure where it appears and to the current musical cursor inside that measure.

For v1, authored placement is time-aware rather than token-pixel-aware:
- a label at measure entry anchors at offset `0`,
- a label written after rhythmic material anchors at the accumulated measure-local duration at that point,
- a label authored at the end of a measure is legal and anchors at exactly that measure's trailing offset; it remains owned by the current measure and never reattaches to the next measure,
- source byte/column location is retained only for diagnostics,
- layout owns the final x-position for that musical offset.

Presentation is layout-owned:
- every bracket label renders as a boxed rehearsal mark,
- there is no alternate rendering mode in v1,
- adapters do not infer alternate styles from the payload.

For v1, above-staff avoidance stays narrowly scoped to structural system-top markings that directly interact with rehearsal marks:
- volta / ending brackets reserve their span geometry first,
- rehearsal marks keep the strongest structural claim at their own anchor,
- the covered navigation set in v1 is limited to the existing segno, coda, fine, D.C., D.S., D.C. al Fine, D.C. al Coda, D.S. al Fine, D.S. al Coda, and To Coda symbols/text,
- those navigation items must avoid volta and rehearsal-mark boxes and may move upward when needed,
- this v1 feature does not attempt a general-purpose avoidance policy for all other system text or staff-local text.

Example:

```txt
time 4/4
note 1/8

| [A] x x x x x x x x |

| c x x x [Chorus] c x x x |
```

## Spec Delta

Integrate the accepted behavior into the relevant canonical sections of `DRUMMARK_SPEC.md`:

```md
DrumMark supports bracketed zero-duration measure labels for rendered boxed rehearsal marks:

`[A]`
`[Verse]`

The payload is the literal text between `[` and `]`.

Bracket-label grammar is exact for v1:
- A label begins with `[` and ends at the next `]`.
- Newlines are forbidden inside the label.
- Nested `[` is a hard error.
- The payload is otherwise accepted literally, including empty or all-whitespace content.
- `]` cannot appear inside the payload in v1.
- Comment delimiters inside the payload are literal text, not comments.
- Leading, trailing, and interior whitespace are significant and must survive normalization, layout measurement, and MusicXML export exactly as authored.

The label applies to the logical measure in which it appears and does not advance rhythmic time. It may appear in ordinary measure content, inline groups, or routed blocks. Normalization must recursively scan nested measure content and merge declarations globally per logical measure.

The label anchor is the current measure-local musical position at the point where the label is authored. This position is timing-derived, not source-column-derived. A label at measure entry anchors at offset `0`. A label written after rhythmic content anchors at the accumulated duration at that point. A label authored at the end of a measure anchors at the current measure's trailing offset and remains attached to that measure. Measure-local anchor mapping follows the existing content-driven duration contract and is interpreted against `actualDuration`, not `fullDuration`, in underfull measures.

When the existing DSL treats adjacent routed or inline braced blocks as one simultaneous cluster, rehearsal-mark offset calculation must reuse that same cluster timing rule. A label authored after such a cluster anchors after the cluster's maximum duration, not the sum of each parallel block. Labels authored inside different members of the same simultaneous cluster resolve against the cluster-local timing cursor and therefore compare using their normalized absolute measure-local offset after cluster flattening.

Canonical normalized JSON IR measure shape:

```json
"rehearsalMark": {
  "text": "A",
  "anchor": {
    "type": "measure-time",
    "offset": { "numerator": 0, "denominator": 1 }
  }
}
```

`text` is the literal payload between `[` and `]`, with whitespace preserved exactly. `anchor.type` is always `"measure-time"` in v1. `anchor.offset` is the simplified measure-local rational offset where the label was authored, constrained to `0 <= offset <= actualDuration` for the owning logical measure. The `rehearsalMark` field is omitted when absent. Measure-repeat shorthand and multi-rest expansion do not copy a rehearsal mark unless the source measure being normalized explicitly declares one. A bracket label does not make a zero-duration measure legal by itself; existing measure-validity rules still apply. Therefore `| [A] |` is invalid, while a measure that is already legal under the existing pure-navigation rules may also carry a rehearsal mark without needing duration-bearing notes.

Layout measures the boxed mark from the exact preserved text, including leading/trailing spaces. MusicXML export must preserve authored whitespace semantics for rehearsal text as well, using whitespace-preserving XML output when required rather than trimming or collapsing the payload.

In v1, a measure may contain at most one rendered rehearsal mark total. Declarations are considered identical only when their fully normalized tuple `{ text, anchor.offset }` matches exactly; these collapse to one mark across tracks and nested content. Any second declaration in the same logical measure whose normalized tuple differs in `text` or `anchor.offset` is a hard error.

Layout renders every bracket label as a boxed rehearsal mark at the resolved measure-local x-position for that anchor offset. In underfull measures, that x-position is computed against `actualDuration`, matching the existing short-measure contract. The boxed mark participates in structural stacking and collision avoidance.

For v1 structural avoidance:
- volta / ending brackets are laid out first as span objects and reserve horizontal and vertical space,
- a rehearsal mark keeps its owning measure and preferred anchor x position unless collision avoidance inside the same measure makes a small local horizontal adjustment unavoidable,
- the v1 navigation set of segno, coda, fine, D.C., D.S., D.C. al Fine, D.C. al Coda, D.S. al Fine, D.S. al Coda, and To Coda stay near their semantic anchors but yield vertically to volta and rehearsal-mark combinations,
- if local horizontal adjustment is insufficient, layout may move the rehearsal mark upward within the current structural stack and, if still necessary, increase system-top padding; it must not compress or break volta brackets to make room.

MusicXML export maps every bracket label to a rehearsal direction using the same measure-local offset. An offset equal to `actualDuration` exports at the end of the current measure, not the start of the following measure.
```

Append or update `RENDER_LAYOUT_CONTRACT.md`:

```md
## Addendum: Rendered Rehearsal Marks

Date: 2026-06-07
Source change: `docs/changes/active/2026-06-01-rehearsal-section-marks/plan.md`
Status: Accepted

`RenderMeasure` may carry `rehearsal_mark: Option<RehearsalMark>`.

`RehearsalMark` has:
- `text: string`
- `anchor: { type: "measure-time", offset: Fraction }`

The `anchor` value is a render-facing musical placement hint, not a source byte offset. `offset` is a simplified measure-local fraction measured from the start of the logical measure and interpreted against `actual_duration` for geometry. Absence means the measure has no rendered rehearsal mark. Serialized WASM JSON omits `rehearsal_mark` when it is `None`.

The layout engine owns placement, stacking, collision avoidance, and boxed rehearsal-mark styling. Layout emits stable semantic scene roles:
- `rehearsalMark.box`
- `rehearsalMark.text`

For v1, layout emits ordinary text/rect/path scene items with these roles and does not add a new serialized composite kind. Adapters may only draw the emitted `LayoutScene` items. This field requires a `RenderScore` version bump.

When a rehearsal mark shares local space with existing system-top structural markings already owned by the current contract, layout applies this temporary narrow priority order:
1. volta / ending brackets
2. rehearsal marks
3. segno, coda, fine, D.C., D.S., D.C. al Fine, D.C. al Coda, D.S. al Fine, D.S. al Coda, and To Coda symbols/text

This temporary narrow priority order is intentionally limited to the rehearsal feature's immediate interactions and will be superseded by the broader above-staff avoidance change once that contract lands.
```

## Affected Specs / Contracts

- `docs/DRUMMARK_SPEC.md`
- `docs/RENDER_LAYOUT_CONTRACT.md`

## Tasks

### Task 1: Parser and AST

Status: Done

Scope:
- `crates/drummark-core/src/lexer.rs`
- `crates/drummark-core/src/parser.rs`
- `crates/drummark-core/src/ast.rs`

Action:
- Parse bracket labels as zero-duration measure expressions.
- Implement or reuse a small bracket-payload parser with the exact v1 grammar from `## Spec Delta`.
- Preserve source locations.
- Reject nested `[`, missing `]`, and newline-containing labels.
- Preserve authored timing position so later normalization can resolve the measure-local anchor offset.
- Preserve literal payload text byte-for-byte between brackets, including leading/trailing spaces and empty payloads.
- Preserve end-of-measure placement so a trailing label stays attached to the current measure at offset `actualDuration`.

Input / Output Contract:
- AST represents a zero-duration rehearsal-mark measure expression carrying raw literal text and sufficient placement context to recover its measure-local musical offset during normalization.

Dependencies:
- Human stamp for spec change before implementation.

Acceptance:
- Parser tests cover valid short labels, valid long labels, punctuation-bearing labels, empty labels, whitespace-only labels, missing close bracket, nested `[` inside payload, and trailing-in-measure labels such as `| x x x x [A] |`.

Verification:
- `cargo test -p drummark-core parser -- --nocapture`
- `npm run drummark -- docs/examples/section-marks.drum --format ast`

### Task 2: Normalization and Conflict Rules

Status: Done

Scope:
- `crates/drummark-core/src/normalize.rs`
- normalized measure data
- diagnostics

Action:
- Normalize bracket labels into measure-level `rehearsalMark` metadata.
- Recursively scan ordinary content, routed blocks, inline groups, and other nested measure content that can legally contain zero-duration directives.
- Merge identical declarations across tracks and nested content.
- Reject conflicting declarations in the same logical measure.
- Compute the anchor offset from the same accumulated measure-local timing cursor used for events and zero-duration directives.
- Interpret offsets against the owning measure's `actualDuration`, including underfull measures.
- Reuse existing simultaneous-cluster timing semantics for adjacent routed / inline braced blocks.

Input / Output Contract:
- Normalized measure exposes optional rehearsal mark `{ text, anchor: { type: "measure-time", offset } }`.

Dependencies:
- Task 1.

Acceptance:
- Repeated identical `[A]` at the same measure-local offset on multiple tracks collapses because the normalized `{ text, offset }` tuple matches.
- `[A]` plus `[Verse]` in one measure errors.
- `[]` and `[   ]` are legal and remain distinguishable from each other because payload text is preserved literally.
- `[A]` and `[ A ]` are also distinguishable because leading/trailing spaces are preserved literally.
- `[A]` at offset `0` and `[A]` later in the same measure error because their normalized tuples differ by offset.
- Nested declarations such as `| @SD { d d [A] } |` normalize to the same measure-level anchor with the routed block's accumulated measure-local offset.
- Rehearsal marks are not copied from measure-repeat shorthand or multi-rest expansion unless explicitly present in the source measure being normalized.
- Offset resolution is deterministic and test-covered for ordinary content, grouped content, routed content, end-of-measure placement, and underfull measures where `actualDuration < fullDuration`.
- A bare measure such as `| [A] |` is rejected under the existing measure-validity rules.
- A legal pure-navigation measure may carry `[A]`, but the label does not itself satisfy duration-bearing requirements.
- Adjacent simultaneous routed blocks advance the post-cluster anchor offset by cluster max duration rather than summed duration.

Verification:
- `cargo test -p drummark-core normalize -- --nocapture`
- `npm run drummark -- docs/examples/section-marks.drum --format ir`

### Task 3: RenderScore and Layout

Status: Done

Scope:
- `crates/drummark-core/src/render_score.rs`
- `crates/drummark-layout/src/contract.rs`
- structural stacking and scene emission

Action:
- Add rehearsal-mark data to `RenderScore`.
- Add `RenderMeasure.rehearsal_mark: Option<RehearsalMark>` and bump the `RenderScore` contract version.
- Emit semantic `LayoutScene` text/rect/path items for boxed rehearsal marks with roles `rehearsalMark.box` and `rehearsalMark.text`; do not add a new serialized composite kind for v1.
- Position them at the resolved x coordinate for the anchor offset and stack them above notes, voltas/navigation as appropriate without overlap.
- Preserve presence/absence parity for `rehearsal_mark` across Rust, WASM JSON, and layout inputs.
- Apply the narrow structural avoidance policy from `## Spec Delta` for rehearsal marks versus volta and currently supported navigation items.

Input / Output Contract:
- `RenderScore` version bump required.
- Platform adapters remain thin.

Dependencies:
- Task 2.

Acceptance:
- `[A]` renders as boxed rehearsal mark.
- `[Chorus]` also renders as boxed rehearsal mark above the anchored beat position, not forcibly at measure start.
- Rehearsal marks survive page/system breaks and preserve anchor offsets.
- Whitespace-only or padded payloads measure and render from their exact preserved text rather than trimmed text.
- A mid-measure anchor aligns with the same x-position family used by other measure-local timed items.
- An anchor at offset `actualDuration` stays on the current measure's trailing edge.
- Absent marks omit `rehearsal_mark` cleanly in serialized render data.
- Volta brackets keep their span geometry and are not compressed to fit rehearsal-mark text.
- Navigation text at the same anchor avoids the rehearsal-mark box by using a higher placement inside the current structural stack when needed.

Verification:
- `cargo test -p drummark-layout section -- --nocapture`
- focused scene snapshot or geometry tests

### Task 4: MusicXML Export

Status: Done

Scope:
- `crates/drummark-core/src/musicxml.rs`
- MusicXML corpus/goldens

Action:
- Export every bracket label as rehearsal direction.
- Emit it with the resolved measure-local MusicXML offset.
- Preserve measure ordering with existing dynamics, hairpins, and navigation directions.
- Preserve authored whitespace in rehearsal text during MusicXML export instead of trimming or collapsing it.
- Treat offset `actualDuration` as the end of the current measure, not the next measure's start.

Input / Output Contract:
- MusicXML output remains deterministic.

Dependencies:
- Task 2.

Acceptance:
- MusicXML tests lock rehearsal export, non-zero offsets, underfull-measure offsets, and end-of-measure offsets.

Verification:
- `cargo test -p drummark-core musicxml -- --nocapture`
- `npm run drummark -- docs/examples/section-marks.drum --format xml`

### Task 5: Specs, WASM, Examples

Status: Done

Scope:
- Active specs/contracts
- WASM packages
- Examples

Action:
- Integrate the final accepted behavior into canonical `DRUMMARK_SPEC.md` sections and append the final addendum to `RENDER_LAYOUT_CONTRACT.md`.
- Add a small rehearsal-mark example using bracket syntax.
- Rebuild WASM.
- Add parity fixtures covering presence/absence of `rehearsal_mark` and non-zero offsets through the browser boundary.

Input / Output Contract:
- Browser, CLI, SVG, PDF, and MusicXML paths agree.

Dependencies:
- Tasks 1-4.

Acceptance:
- A long-form example can show visible boxed rehearsal marks without comments.
- Example coverage includes a mid-measure anchor whose SVG and XML positions are observably not measure-start only.
- Example coverage includes a trailing anchor and an underfull-measure anchor.

Verification:
- `npm run wasm:build`
- `npm test -- --run src/wasm/parser_layout_parity.test.ts src/renderer/svgSceneAdapter.test.ts`

## Test Plan

- `cargo test -p drummark-core parser -- --nocapture`
- `cargo test -p drummark-core normalize -- --nocapture`
- `cargo test -p drummark-core musicxml -- --nocapture`
- `cargo test -p drummark-layout section -- --nocapture`
- Parser fixtures: `[A]`, `[Verse]`, `[x d b]`, `[2: x x]`, `[A:B]`, `[  A  ]`, `[]`, `[   ]`, `[A`, `[A[B]`, label newline rejection, trailing-in-measure `[A]`
- Parser fixtures: `[A]`, `[Verse]`, `[x d b]`, `[2: x x]`, `[A:B]`, `[  A  ]`, `[]`, `[   ]`, `[A`, `[A[B]`, label newline rejection, trailing-in-measure `[A]`
- Normalization fixtures: duplicate identical declarations in separate tracks, different-text conflicts, same-text different-offset declarations, start-of-measure vs mid-measure declaration, nested/routed declaration, inline grouped declaration, underfull-measure offset interpretation, bare `| [A] |` rejection, legal pure-navigation measure with `[A]`, simultaneous routed-block cluster offset behavior
- Interaction fixtures: measure-repeat/multi-rest behavior, stacking with the v1 navigation set (`segno`, `coda`, `fine`, `D.C.`, `D.S.`, `D.C. al Fine`, `D.C. al Coda`, `D.S. al Fine`, `D.S. al Coda`, `To Coda`), anchor x-position at non-zero offsets, trailing-edge anchors, absence/presence parity for `rehearsal_mark`
- Structural-avoidance fixtures: rehearsal mark near a volta span, same-anchor navigation yielding to a rehearsal mark, small local horizontal adjustment before upward escape, and system-top padding growth when no supported local placement fits
- Whitespace fixtures: `[]`, `[   ]`, `[ A ]`, and their exact render/export preservation
- WASM / JSON parity fixtures: `rehearsal_mark` omitted when absent, present with `{ text, anchor }` when present, and non-zero offset preserved through serialization
- `npm run drummark -- docs/examples/section-marks.drum --format ast`
- `npm run drummark -- docs/examples/section-marks.drum --format ir`
- `npm run drummark -- docs/examples/section-marks.drum --format svg`
- `npm run drummark -- docs/examples/section-marks.drum --format xml`
- `npm run wasm:build`

## Risks / Notes

- Position-aware anchors widen the interaction surface with spacing and direction ordering, so offset semantics must reuse existing musical-time fractions rather than invent a source-column coordinate system.
- Underfull-measure behavior must stay aligned with the existing `actualDuration` contract; this feature must not reintroduce `fullDuration`-based x mapping for anchors.
- Text metrics must remain layout-owned. Adapters should not measure rehearsal-mark text to decide placement.
- Interactions with currently supported volta/navigation items need explicit stacking tests.
- This v1 plan deliberately limits avoidance scope to structural system-top interactions around rehearsal marks; broader above-staff avoidance remains follow-up work.
- Because the syntax is compact, parser recovery for malformed `[` labels must avoid polluting following measure content.

## Linked Items

- GitHub Issue: N/A
- Bug: v1 release feature request
- ADR: N/A
- PR: N/A

## Revision Log

| Round | Date | Summary of changes |
|-------|------|--------------------|
| 1 | 2026-06-01 | Initial draft |
| 2 | 2026-06-07 | Reframed the change as boxed rehearsal marks only, removed `section`/`kind` semantics, and switched internal contracts to `rehearsalMark` / `rehearsal_mark`. |
| 3 | 2026-06-07 | Relaxed bracket payload rules so any single-level bracket content is accepted as literal rehearsal-mark text, including empty and whitespace-only payloads. |
