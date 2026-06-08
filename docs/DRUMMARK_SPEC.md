# DrumMark Specification

## Status

Active canonical v1 specification.

This file describes the current accepted DrumMark language and export behavior. Historical addenda and superseded wording were archived to:

- `docs/archived/DRUMMARK_SPEC_addendum_ledger_2026-06-01.md`

When historical text conflicts with this file, this file is authoritative.

## 1. Scope

DrumMark is a text DSL for drum notation. A DrumMark implementation parses source text into a canonical normalized score, then uses that score for layout, preview, CLI export, and MusicXML export.

This specification covers:
- source syntax,
- rhythmic model,
- structural and expressive directives,
- normalized IR expectations,
- compatibility rules,
- the maintenance contract for future spec changes.

This specification does not define:
- audio playback,
- MIDI semantics,
- renderer-specific drawing primitives,
- editor UX,
- planned features that are not yet implemented and accepted.

## 2. Document Model And Ownership

### 2.1 Pipeline

The active production path is:

```text
source text
-> Rust/WASM parser
-> normalized score / render score
-> layout scene and exports
```

Normative consequences:
- The Rust/WASM parser is the grammar authority for current product behavior.
- Skeleton-like semantic lowering is part of the Rust core normalization path, not a separate authoritative spec source.
- Source rescans and renderer-side reconstruction are not normative language behavior.

### 2.2 Document Shape

A DrumMark document has:
- one header section,
- zero or more paragraphs,
- zero or more track lines per paragraph,
- one or more measures per track line.

Paragraphs are separated by blank lines. A paragraph may begin with a paragraph-local `note 1/N` override before any track lines.

## 3. Headers

### 3.1 Supported Header Fields

```txt
title <text>
subtitle <text>
composer <text>
tempo <number>
time <beats>/<beatUnit>
note 1/<power-of-2>
grouping <a+b+c+...>
```

Rules:
- `title`, `subtitle`, and `composer` use raw remainder-of-line parsing in the current implementation.
- The header value is the trimmed remainder of the line after the keyword.
- Quote characters are preserved literally; they are not parsed as string delimiters.
- `#` inside a header value is preserved literally; it does not start a comment once header-value parsing has begun.
- Empty text values are invalid.
- `tempo` is an optional positive integer and is interpreted as quarter-note BPM.
- `time` is required.
- `note 1/N` is the canonical rhythmic-unit header.
- `N` must be a supported power of 2: `1`, `2`, `4`, `8`, `16`, `32`, `64`, `128`.
- `grouping` is optional for meters with a defined default and required for irregular meters with no default.

### 3.2 Grouping Inference

If `grouping` is omitted, the default grouping is:

| Time | Grouping |
|------|----------|
| `2/4` | `1+1` |
| `3/4` | `1+1+1` |
| `4/4` | `2+2` |
| `2/2` | `1+1` |
| `3/8` | `1+1+1` |
| `6/8` | `3+3` |
| `9/8` | `3+3+3` |
| `12/8` | `3+3+3+3` |

Meters such as `5/4`, `5/8`, `7/8`, and similar irregular signatures require explicit `grouping`.

### 3.3 Paragraph `note 1/N` Override

A paragraph may begin with a line containing only `note 1/N`.

Rules:
- It applies only to the paragraph it immediately precedes.
- It must be the first non-comment, non-blank content of that paragraph.
- At most one override may appear per paragraph.
- The override changes the active Note Unit for that paragraph only.

## 4. Rhythmic Unit Model

### 4.1 Note Units

The primary rhythmic model is based on the active `note 1/N` setting.

Definitions:
- `NoteUnitDuration = 1/N`
- One Note Unit is one active grid unit for the current header or paragraph.
- `MeasureDuration` is derived from the time signature.
- `ExpectedSlots = MeasureDuration / NoteUnitDuration`

Examples:
- In `4/4` with `note 1/16`, the full measure is `16` Note Units.
- In `6/8` with `note 1/16`, the full measure is `12` Note Units.

### 4.2 Validation Model

Validation is exact rational musical-duration math.

A measure is valid if and only if:
- `actualDuration` is greater than zero,
- `actualDuration` does not exceed the full measure duration derived from the active time signature,
- any token or group that contributes duration stays within the header-derived full measure duration, and
- no token or group crosses a grouping boundary inside the authored duration span.

Definitions for the current accepted model:
- `fullDuration` is the nominal measure duration derived from the active time signature.
- `actualDuration` is the maximum explicit duration across all written tracks in the logical measure.
- Explicit `-` rest tokens contribute duration exactly like notes.
- Omitted content does not contribute duration.

Consequences:
- Underfull measures are valid.
- A following measure begins immediately after the prior measure's `actualDuration`; there is no hidden tail up to `fullDuration`.
- A first-measure pickup is represented by an ordinary short first measure; no dedicated pickup syntax is required.
- A fully silent measure must still be authored with explicit `-` rests.

“Slot count” language is only shorthand for the Note Unit model. The normative model is exact duration under the active `note 1/N`.

## 5. Tracks, Routing, And Auto-Fill

### 5.1 Supported Track Names

The active track names are:

`HH`, `HF`, `SD`, `BD`, `T1`, `T2`, `T3`, `RC`, `C`, `ST`, `BD2`, `T4`, `RC2`, `C2`, `SPL`, `CHN`, `CB`, `WB`, `CL`

### 5.2 Track Line Syntax

```txt
HH | x x x x |
SD | - d - d |
BD | b - - b |
```

Rules:
- A track line begins with a track name followed by a measure body.
- Anonymous track content may still be normalized through fallback rules where the implementation supports it.
- Tracks mentioned by line headers, summon prefixes, or routed blocks are registered in the score.

### 5.3 Track Routing Forms

Two routed forms are part of accepted syntax:

Summon prefix:

```txt
SD:d
HH:x
```

Routed block:

```txt
@SD { d d d d }
@HH { x x x x }
```

Rules:
- `@TRACK { ... }` is the canonical long-span routed-block syntax.
- Legacy bare routed-block syntax such as `SD { ... }` is removed.
- Routed blocks are measure expressions, not navigation directives.
- Routed blocks do not create navigation anchors.

### 5.4 Track Registry And Auto-Fill

Once a track is registered, omitted measures in later aligned content remain aligned structurally, but omitted content does not synthesize rest events by default.

Rules:
- Explicit `-` remains the only accepted silent duration token.
- Omitted registered tracks do not receive auto-generated trailing rests or whole-measure rest content.
- Tracks whose written duration is shorter than the measure `actualDuration` remain silent for the remaining span without creating additional rest events.

## 6. Measure Content

### 6.1 Basic Glyphs

Accepted basic glyphs include rests, cymbal/drum hits, sticking marks, and summoned shorthand such as `s`, `b`, `c`, `t1`, `spl`, and related upper/lowercase forms already supported by the implementation.

Accepted source behavior includes:
- ordinary rest glyph `-`,
- ordinary hit glyphs such as `x`, `d`, `o`, `c`, `b`, `r`, `t1`,
- combined shorthand such as `s`, `b`, `c`,
- sticking glyphs such as `R`, `L`, `P`.

The canonical event interpretation is implementation-owned and derived from the active track plus glyph spelling.

### 6.2 Duration Modifiers

Accepted duration modifiers are:
- `.` for dotted expansion,
- `/` for halving,
- `*` for doubling by powers of 2.

Rules:
- Duration modifiers are multiplicative and order-independent.
- `d.*`, `d*.`, and equivalent permutations represent the same duration.
- `*` on a note token is distinct from measure-level inline repeat `*N`.
- The `*` modifier is valid on rests.

### 6.3 Articulation And Technique Modifiers

Accepted articulation/technique modifiers are:

`accent`, `open`, `half-open`, `close`, `choke`, `rim`, `cross`, `bell`, `flam`, `ghost`, `drag`, `roll`, `dead`

Rules:
- Modifiers attach with `:modifier`.
- Modifier chaining is valid: `d:ghost:accent`.
- Duration modifiers and articulation modifiers may be interleaved.
- Trailing modifiers after duration suffixes are accepted: `d.*:accent`.

### 6.4 Groups

Rhythmic groups use:

```txt
(span: item1 item2 ...)
(item1 item2 ...)
```

Rules:
- `span` is measured in active Note Units.
- Group-local durations are scaled into the declared span.
- Trailing group modifiers apply to all note events produced by the group.
- If a trailing articulation modifier would apply to a rest inside the group, that is a syntax error.
- A group is invalid if, after removing zero-duration directives such as dynamics and hairpins, it contains no duration-consuming item.

### 6.5 Combined Hits

Combined hits use `+` to place multiple note operands at the same rhythmic position.

Example:

```txt
x+c
s+b
```

Combined-hit operands do not accept zero-duration directives inside the operand list.

### 6.6 Inline Braced Content

Inline braced content is accepted where the implementation supports nested measure expressions:

```txt
{ d d d d }
```

Braced content participates in the same duration and directive semantics as ordinary measure content.

### 6.7 Rehearsal Marks

Bracketed rehearsal marks use:

```txt
[A]
[Verse]
[]
```

Rules:
- Rehearsal marks are zero-duration measure expressions.
- A rehearsal mark begins with `[` and ends at the next `]`.
- Newlines are forbidden inside the mark.
- Nested `[` is a hard error.
- `]` is not allowed inside the payload in v1.
- The payload is otherwise literal, including empty and all-whitespace content.
- Leading, trailing, and interior whitespace are significant and must survive normalization, layout measurement, and MusicXML export exactly as authored.
- `#` inside the payload is literal text, not a comment introducer.
- Rehearsal marks are legal in ordinary content, routed blocks, inline braced content, and rhythmic groups.
- A rehearsal mark anchors to the current measure-local musical position at the point where it is authored.
- The anchor is interpreted against `actualDuration`, not `fullDuration`, in underfull measures.
- Adjacent routed or inline braced blocks reuse the current simultaneous-cluster timing rule, so post-cluster anchors advance by cluster maximum duration rather than summed duration.
- A measure may contribute at most one rendered rehearsal mark after normalization.
- Identical declarations collapse only when both literal payload and normalized anchor offset match exactly.
- A rehearsal mark does not by itself make an otherwise zero-duration measure legal.

## 7. Structural Syntax

### 7.1 Barlines

Accepted barline forms are:

| Token | Meaning |
|------|---------|
| `|` | regular |
| `||` | double |
| `|:` | repeat start |
| `:|` | repeat end |
| `|.` | volta terminator |
| `||.` | double volta terminator |
| `|N.` / `|N,M.` | volta open |
| `|:N.` / `|:N,M.` | repeat start + volta open |
| `:|N.` / `:|N,M.` | repeat end + volta open |
| `|:.` | repeat start + volta terminator |

`|:.` does not implicitly close a repeat. A prior repeat must already be closed where required.

### 7.2 Repeat Semantics

Accepted repeat behavior includes:
- repeat starts and ends,
- volta spans,
- implicit repeat-end behavior for intermediate voltas,
- the clarified exclusion that `|.` and `||.` do not themselves trigger implicit repeat-end inference,
- repeat-span derivation in normalized score metadata.

### 7.3 Measure Repeat Shorthand

Measure repeat shorthand uses `%`, `%%`, and related slash-count forms supported by the implementation.

Rules:
- Same-position/global conflict rules are resolved at the logical measure level.
- Chained measure-repeat resolution follows the accepted current normalization rules rather than the older base-spec wording.

### 7.4 Multi-Measure Rest

Accepted multi-rest syntax is the relaxed dash-run form:

```txt
--8--
-- 8 --
---8----
```

Rules:
- Left and right dash runs each contain at least two dashes.
- `N` is an unsigned decimal integer and must be at least `2`.
- Leading zeros are invalid.
- Multi-rest occupies the entire non-navigation rhythmic content of the measure.

### 7.5 Inline Repeat Count

Measure-level inline repeat uses trailing `*N`.

Examples:

```txt
| d* *2 |
| - *3 |
| *4 |
```

Rules:
- `*N` repeats the measure to a total count of `N`.
- Token-local stars remain duration modifiers.

### 7.6 Navigation Directives

Accepted navigation directives are:

`@segno`, `@coda`, `@fine`, `@dc`, `@ds`, `@dc-al-fine`, `@dc-al-coda`, `@ds-al-fine`, `@ds-al-coda`, `@to-coda`

Rules:
- Navigation directives are zero-duration measure expressions.
- Navigation anchors normalize using accepted positional and default-anchor rules.
- Pure-navigation measures are allowed and follow the current default-anchor behavior.
- Multi-marker navigation measures collapse into canonical measure metadata according to current merge rules.

## 8. Expressive Directives

### 8.1 Hairpins

Accepted hairpin directives are:
- `<` for crescendo start,
- `>` for decrescendo start,
- `!` for hairpin end.

Rules:
- Hairpins are zero-duration measure expressions.
- They are legal in ordinary content, routed blocks, inline braced content, and rhythmic groups.
- If not explicitly closed, a hairpin closes at the end of the current measure and may carry forward semantically into the next measure.
- Same-position duplicate starts of the same type collapse.
- Conflicting same-position types are errors.

### 8.2 Dynamic Marks

Accepted dynamic directives are:

`@ppp`, `@pp`, `@p`, `@mp`, `@mf`, `@f`, `@ff`, `@fff`

Rules:
- Dynamics are exact whole-token `@...` forms.
- Dynamics are zero-duration measure expressions anchored to exact measure-local fractions.
- Same-position same-level declarations deduplicate.
- Same-position different-level declarations are a hard error.
- Dynamics are global score expression marks, not track-local note modifiers.

### 8.3 Comments

`#` begins a comment and consumes the remainder of the line, except inside quoted header text where it is literal.

## 9. Validation Rules

### 9.1 Total Duration

Every measure must resolve to the full measure duration for its paragraph-local rhythmic unit context unless a future accepted change explicitly introduces a shorter expected duration.

### 9.2 Grouping Boundary Alignment

No token or group may cross a grouping boundary.

### 9.3 Structural Exclusivity

Mutually exclusive whole-measure forms include:
- multi-rest versus ordinary measure content,
- multi-rest versus measure-repeat shorthand,
- multi-rest versus inline repeat suffix content.

### 9.4 Header And Paragraph Legality

Invalid constructs include:
- empty required text headers,
- malformed `note 1/N`,
- legacy `divisions <number>` headers,
- paragraph-local `note 1/N` appearing after paragraph track content,
- malformed routed-block syntax,
- malformed compact barline/volta syntax.

## 10. Canonical Normalized IR

### 10.1 Header

Current normalized header shape is:

```json
{
  "title": "Backbeat Study",
  "subtitle": "Verse groove",
  "composer": "G. Mao",
  "tempo": 120,
  "timeSignature": { "beats": 4, "beatUnit": 4 },
  "noteValue": 8,
  "grouping": [2, 2]
}
```

Rules:
- `noteValue` is the canonical active rhythmic-unit denominator.
- Normalized IR does not expose a DrumMark `divisions` field.
- Canonical semantic discussion in this spec uses `noteValue` and Note Units.

### 10.2 Tracks

Tracks normalize as:

```json
{ "id": "HH", "family": "cymbal" }
```

### 10.3 Measures

Current normalized measure shape includes:

```json
{
  "index": 0,
  "globalIndex": 0,
  "paragraphIndex": 0,
  "measureInParagraph": 0,
  "sourceLine": 4,
  "events": [],
  "barline": "regular",
  "startNav": { "kind": "segno", "anchor": "left-edge" },
  "endNav": { "kind": "fine", "anchor": "right-edge" },
  "volta": { "indices": [1, 2] },
  "measureRepeat": { "slashes": 1 },
  "multiRest": { "count": 4 },
  "hairpins": [],
  "dynamics": [],
  "noteValue": 8
}
```

Current accepted measure metadata includes:
- barline,
- repeat-end location where applicable,
- start navigation,
- end navigation,
- volta intent,
- measure-repeat intent,
- multi-rest intent,
- hairpins,
- dynamics,
- optional `rehearsalMark` metadata with literal `text` and `anchor: { type: "measure-time", offset }`,
- paragraph-local `noteValue`.

### 10.4 Events

Normalized events carry:
- track,
- paragraph and measure identity,
- `start` and `duration` as exact fractions,
- `kind`,
- glyph,
- modifiers,
- optional tuplet,
- optional tie,
- optional voice,
- optional beam.

## 11. MusicXML Export

MusicXML export is derived from normalized score semantics, not from source rescans.

Accepted export behavior includes:
- global time signature from the header,
- independently chosen MusicXML `<divisions>` values for exact duration encoding,
- instrument mapping from canonical track identity,
- notehead mapping from glyph plus modifiers,
- measure repeats and multi-rest export,
- navigation export,
- rehearsal-direction export with whitespace-preserving text,
- hairpin wedge export,
- dynamic direction export below the staff.

MusicXML `<divisions>` is an export-unit choice and is distinct from the removed DrumMark DSL `divisions` header.

## 12. Compatibility And Deprecated Syntax

### 12.1 Removed `divisions` Header

`divisions <number>` is no longer accepted DrumMark syntax.

Rules:
- Parsers should report a migration-oriented diagnostic directing users to `note 1/N`.
- It remains relevant only as historical syntax when reading archived material or migration notes.

### 12.2 Removed Or Rejected Syntax

The following are not part of accepted current syntax:
- legacy rhythmic-group form `[ ... ]` or `[N: ... ]`,
- legacy bare routed-block form `TRACK { ... }`,
- generic `@Identifier` directives outside the closed accepted directive families,
- inline `@divisions:<N>` change syntax.

## 13. Planned V1 Changes

The following items are active plans and are not yet accepted normative behavior:
- first-measure pickup / anacrusis: `docs/changes/archive/2026/2026-06-01-first-measure-pickup/`
- rehearsal / section marks: `docs/changes/active/2026-06-01-rehearsal-section-marks/`
- modifier visual / export completion: `docs/changes/active/2026-06-01-modifier-visual-export-completion/`

These items must not be treated as accepted language or export behavior until their implementation changes are merged and their spec deltas are integrated here.

## 14. Maintenance Policy

This file is a canonical-integrated spec, not a chronological addendum ledger.

Future Spec / Contract Changes must follow this maintenance rule:
- draft the proposed change in a change folder under `docs/changes/active/<change-id>/plan.md`,
- review and approve the plan,
- implement and verify the behavior,
- integrate the accepted final behavior into the appropriate canonical section of this file during merge,
- keep rationale, debate, and review history in the change folder and archive,
- avoid appending new chronological addenda to this file by default.

Historical exceptions are allowed only when:
- the user explicitly requests append-only maintenance for a specific active spec, or
- the relevant active spec has not yet been converted to canonical-integrated maintenance.
