# Drum Notation DSL Design v0.1 (Revised)

## Goal

Build a lightweight web app for writing drum notation in a text DSL, previewing it live, and exporting MusicXML for use in MuseScore.

Core goals:

- Faster to write than MuseScore
- Easier to structure than ad hoc ASCII drum tabs
- Live preview in the browser
- Exportable to MusicXML
- Friendly to common drum notation needs like repeats, tuplets, accents, sticking, and basic playing techniques

Non-goals for v0:

- Full-featured general-purpose notation editor
- WYSIWYG score editing
- Complete support for all traditional engraving details
- Ghost-note parentheses in staff preview/export, which are blocked by current OSMD limitations

## Product Shape

Single-page web app:

- Left: DSL editor
- Right: live preview
- Export: MusicXML, later PDF

The editor is the source of truth. The preview is derived from parsed DSL. MusicXML is generated from the parsed score model, not from raw text.

---

## Architecture

Pipeline:

```txt
DSL -> Tokenizer -> Parser -> AST -> Normalized Events -> Renderers / MusicXML
```

Outputs:

- Grid preview
- Staff preview
- MusicXML export

Current rendering constraint:

- All score rendering goes through OSMD
- Ghost-note parentheses are not part of v0 because OSMD does not currently support this notation reliably
- Reference: https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/issues/887

### Normalized Events

Normalized event is the single source for rendering and export.

Each event contains:

```txt
track
paragraphIndex
measureIndex
measureInParagraph
start
duration
kind
glyph
modifier
tuplet
```

Notes:

- `track` is the canonical score track after input sugar is resolved
- `DR` is expanded before normalization and does not appear as a normalized track
- `HH` crash sugar `c` remains a glyph on `HH`; MusicXML derives crash instrument semantics during export
- `kind` is one of hit, accent, pedal, or sticking
- `start` and `duration` are rational musical durations, not raw grid slot numbers
- v0 does not store tie fields; groups that require automatic tie splitting are rejected during validation
- instrument placement is derived by renderers/exporters from `track`, `glyph`, and `modifier`

---

## Header Fields

Supported header fields:

- `title`
- `subtitle`
- `composer`
- `tempo`
- `time`
- `divisions`
- `grouping`

Example:

```txt
title Funk Study No. 1
subtitle Verse groove
composer G. Mao
tempo 96
time 4/4
divisions 16
grouping 2+2
```

### `title`

Syntax:

```txt
title <text>
```

Rules:

- Optional
- Single-line free text
- Preserved exactly after trimming leading/trailing whitespace
- If omitted, preview and export may use an app default title
- Empty title text is invalid
- At most one `title` header is allowed
- Used as the score title in preview and MusicXML export

---

### `subtitle`

Syntax:

```txt
subtitle <text>
```

Rules:

- Optional
- Single-line free text
- Preserved exactly after trimming leading/trailing whitespace
- Empty subtitle text is invalid
- At most one `subtitle` header is allowed
- Used as secondary score text in preview and MusicXML export when present

---

### `composer`

Syntax:

```txt
composer <text>
```

Rules:

- Optional
- Single-line free text
- Preserved exactly after trimming leading/trailing whitespace
- Empty composer text is invalid
- At most one `composer` header is allowed
- Used as composer/creator metadata in preview and MusicXML export when present

---

### `tempo`

Syntax:

```txt
tempo <number>
```

Rules:

- Optional
- Positive integer
- Default: `120`
- Interpreted as quarter-note BPM
- At most one `tempo` header is allowed

---

### `time`

Syntax:

```txt
time <beats>/<beatUnit>
```

Examples:

```txt
time 4/4
time 3/4
time 6/8
```

Rules:

- Required
- `beats` and `beatUnit` must be positive integers
- `beatUnit` should be one of `2`, `4`, `8`, `16`
- Defines measure duration and beat grouping intent

---

### `divisions`

Syntax:

```txt
divisions <number>
```

Rules:

- Required
- Positive integer
- Defines grid resolution per measure

---

### `grouping`

Declares the measure's internal beat grouping.

This is a musical structure field, not a display-only hint.

Syntax:

```txt
grouping <a+b+c+...>
```

Examples:

```txt
grouping 2+2
grouping 3+3
grouping 2+2+3
```

Rules:

- Each item must be a positive integer
- Sum must equal the numerator of `time`
- Values are interpreted in units of the denominator of `time`
- Controls beat structure, default accents, visual grouping, and default beaming
- Does not affect duration math
- Does not change measure duration
- Does not change tuplet math
- Does not depend on `divisions` for its meaning

Examples:

- `time 4/4` + `grouping 2+2` = two half-note beats inside the bar
- `time 6/8` + `grouping 3+3` = two dotted-quarter beats
- `time 7/8` + `grouping 2+2+3` = irregular eighth-note grouping

`grouping` should be treated as the default source for:

- internal beat structure
- default accent placement
- default visual grouping
- default beaming strategy
- default beaming must stay inside `grouping` boundaries
- default beaming should not cross `grouping` boundaries

Default behavior:

- If omitted, inferred from `time` only for common stable meters

  * `2/4` → `1+1`
  * `3/4` → `1+1+1`
  * `4/4` → `2+2`
  * `2/2` → `1+1`
  * `3/8` → `1+1+1`
  * `6/8` → `3+3`
  * `9/8` → `3+3+3`
  * `12/8` → `3+3+3+3`

- For meters without a single stable default grouping, `grouping` must be written explicitly

  * `5/8`
  * `7/8`
  * `5/4`
  * `7/4`
  * `8/8`
  * `10/8`
  * `11/8`

Compatibility with `divisions`:

- `divisions` defines grid resolution, not beat grouping
- Every `grouping` boundary must fall on an integer slot position under the current `divisions`
- Every supported group must produce item durations that can be represented cleanly under the current `divisions`
- If `divisions` cannot represent the intended grouping or supported group durations cleanly, validation should report an error

---

## Measures, Paragraphs, and Layout

### Measure Syntax

Each measure is enclosed by barlines:

```txt
| ... |
```

An empty measure is allowed:

```txt
| |
```

An empty measure means a full-measure rest on that track.

Multiple measures can appear on one track line:

```txt
HH | x - x - | x - x - |
```

Rules:

- Empty measures are valid on any track
- Empty measure content is shorthand for a full-measure rest
- Non-empty measures must still satisfy normal slot-count validation

---

### Paragraphs

After the header, track content is organized into paragraphs.

Rules:

- Paragraph = consecutive block of track lines
- Blank lines separate paragraphs
- Paragraph primarily affects layout and text organization
- Each paragraph starts a new system in the rendered score
- Paragraph does not change musical time structure
- Active tracks continue across paragraph boundaries
- Omitting an active track in a later paragraph means that track is present but silent for that paragraph

---

### Track Registry and Auto Fill

- Tracks are registered globally in order of first appearance
- Once a track appears, it remains active
- Missing tracks in later paragraphs are auto-filled with rests
- Tracks never seen before are not auto-created

---

## Tracks

### Supported Tracks

Percussion tracks:

- `HH` hand hi-hat
- `HF` hi-hat foot
- `DR` drum-combined input sugar
- `SD` snare drum
- `BD` bass drum
- `T1` high tom
- `T2` mid tom
- `T3` floor tom
- `RC` ride cymbal
- `C` crash cymbal

Auxiliary track:

- `ST` sticking

### Track Families

Cymbal-family tracks:

- `HH`
- `RC`
- `C`

Drum-family tracks:

- `DR`
- `SD`
- `BD`
- `T1`
- `T2`
- `T3`

Pedal-family track:

- `HF`

Auxiliary:

- `ST`

### Track Line Syntax

```txt
<TRACK> | ... |
```

Example:

```txt
HH | x - x - x - x - |
```

Track names are case-sensitive. Unknown track names are errors.

### `DR` Input Sugar

`DR` is an input-only sugar track for quickly writing snare/tom patterns on one line.

It is not a real score track. After parsing, `DR` is expanded into standard track events:

- `s` -> `SD` normal hit
- `S` -> `SD` accent hit
- `t1` -> `T1` normal hit
- `t2` -> `T2` normal hit
- `t3` -> `T3` normal hit

Rules:

- `DR` exists only as source syntax sugar
- AST, normalized events, preview semantics, and export should use only the standard target tracks
- `DR` only covers `SD`, `T1`, `T2`, and `T3`
- `DR` should not be mixed with explicit `SD`, `T1`, `T2`, or `T3` lines in the same paragraph
- `DR` may use normal group syntax
- Group items inside `DR` must still use only valid `DR` tokens
- In v0, `DR` does not support modifiers

Example:

```txt
DR | s - t1 - t2 - t3 - |
```

## Base Tokens

### Core Tokens

- `-` rest
- `s` snare normal hit (`DR` only)
- `S` snare accent hit (`DR` only)
- `t1`, `t2`, `t3` tom normal hits (`DR` only)
- `T1`, `T2`, `T3` tom accent hits (`DR` only)
- `x` cymbal-family normal hit
- `X` cymbal-family accent hit
- `d` drum-family normal hit
- `D` drum-family accent hit
- `p` pedal hit
- `P` pedal accent hit
- `R` right hand sticking
- `L` left hand sticking

### Duration Suffixes

Any hit or rest can be followed by duration suffixes to adjust its relative weight:

- `.` (Dot): Multiplies duration by 1.5. Multiple dots are cumulative (e.g., `..` is 1.75x).
- `/` (Half): Divides duration by 2. Multiple halves are cumulative (e.g., `//` is 0.25x).

Combinations are allowed: `d./` is 0.75x duration.

---

`DR` allows:

- `-`
- `s`
- `S`
- `t1`, `T1`
- `t2`, `T2`
- `t3`, `T3`

`HH`, `RC`, `C` allow:

- `-`
- `x`, `X`
- `o`, `O` (HH only)
- `c`, `C` (HH only)

`SD`, `T1`, `T2`, `T3`, `BD` allow:

- `-`
- `d`, `D`

`HF` allows:

- `-`
- `p`, `P`

`ST` allows:

- `-`
- `R`
- `L`

Examples:

```txt
HH | x - X - |
SD | d - d D |
HF | - - p - |
ST | R - L - |
```

---

## Modifiers

Syntax:

```txt
<glyph>:<modifier>
```

Examples:

```txt
x:open
x:choke
d:rim
d:cross
x:bell
d:flam
p:close
```

Modifiers do not change slot count. They only affect playing meaning and rendering/export.

Modifiers are a fixed v0 whitelist, not a general extension system.

Any unknown modifier, or any modifier used on an unsupported track/glyph combination, is a hard error.

### Supported Modifiers

- `open`
- `close`
- `choke`
- `rim`
- `cross`
- `bell`
- `flam`

### Modifier Rules

`open`

- Allowed on `HH` ONLY

`close`

- Allowed on `HH`, `HF`

`choke`

- Allowed on `C`, `RC`

`rim`

- Allowed on `SD`

`cross`

- Allowed on `SD`

`bell`

- Allowed on `RC`

`flam`

- Allowed on `SD`, `T1`, `T2`, `T3`

### Additional Constraints

- Modifiers must be valid for both the track and the base glyph
- Ghost-note syntax is intentionally out of scope for v0 until OSMD supports notehead parentheses reliably

Examples:

```txt
HH | x - x:open - x:close - x - |
SD | - - d:cross - d - D:rim - |
RC | - - x:bell - - - x - |
C  | X:choke - - - - - - - |
```

## Open Hi-Hat Sugar

`o` is valid only on `HH` and is sugar for:

```txt
x:open
```

Example:

```txt
HH | x - o - x - x:close - |
```

Internally, `o` should normalize to `x` with modifier `open`.

## Crash Sugar on Hi-Hat

`c` is valid on `HH` and produces a crash cymbal sound.

This is a convenience sugar, not a new primary notation form.

`C` remains the canonical crash track.

`HH` with `c` is shorthand for a crash hit that should be interpreted the same way as writing on the `C` track at the model/export level.

Example:

```txt
HH | x - c - x - c:choke - |
```

Rules:

- `c` on `HH` is a special-case input sugar
- It should not be generalized into arbitrary cross-track remapping
- It should map to crash cymbal semantics in rendering and export

Internally, `c` on `HH` is rendered with the crash instrument in MusicXML.

## Groups

### Syntax

```txt
[span: item1 item2 ...]
[item1 item2 ...]
```

`[item1 item2 ...]` is shorthand for:

```txt
[1: item1 item2 ...]
```

---

### Semantics

```txt
Each item's duration = slotDuration × span / itemCount
```

---

## Supported Group Constraints (v0)

v0 only accepts groups that can be exported reliably to MusicXML.

Unsupported group forms are hard errors.

---

### Stretched Groups

`itemCount <= span`

Allowed only if each resulting item duration maps to:

- standard note value
- dotted note

and does not require automatic tie splitting.

Otherwise validation fails.

---

### Compressed Groups

Allowed ratios:

```txt
2 in 1
3 in 1
4 in 1
3 in 2
5 in 4
6 in 4
7 in 4
```

Mapping:

- 2 in 1, 4 in 1 → subdivide (no tuplet)
- others → tuplet

---

### Minimum Duration

```txt
No guarantees below 64th note
```

---

### No Automatic Tie Splitting

```txt
Exporter does not split one item into multiple tied notes
```

Any group that would require automatic tie splitting is a hard error in v0.

---

## Repeats

### Supported Repeat Syntax

- `|:` repeat start
- `:|` repeat end

Legal measure boundary forms:

- `| ... |`
- `|: ... |`
- `| ... :|`
- `|: ... :|`

Examples:

```txt
HH |: x - x - x - x - | x - x - X - x - :|
SD |  - - d - - - D - | - - d - d - - -  |
BD |  p - - - p - - - | p - p - - - p -  |
```

### Repeat Semantics

- Repeats are global measure structure, not private to one track
- Repeat boundaries may be written on any track
- A repeat declaration on any track applies to the whole score
- Track choice does not change repeat meaning
- Tracks that do not write repeat boundaries are treated as undeclared, not conflicting
- If multiple tracks declare repeat boundaries, they must agree exactly

Practical guidance:

- In most cases, writing repeat boundaries on a single track is enough
- Repeating the same boundaries on multiple tracks is allowed for readability
- If repeated declarations disagree, validation should report a hard error rather than guessing

### Repeat Rules

- Repeat starts and ends must be paired
- Nested repeats are not allowed in v0
- Crossing repeats are not allowed
- First/second endings are not supported in v0
- D.C., D.S., Segno, and Coda are not supported in v0

### Multi-Measure Rest Syntax

`|--N--|` is the **only** way to specify a multi-measure rest.

Syntax rules:

- `N` must be surrounded by at least one `-` on each side
- Spaces around `N` are allowed
- The entire construct must fit within a single measure boundary `| ... |`

Examples:

```txt
HH | --8-- |     # 8-measure rest
HH |- 4 - |     # 4-measure rest (spaces allowed)
BD | --1-- |    # 1-measure rest
```

This is semantically distinct from: `|--N--|` generates a single `<multiple-rest>` measure in MusicXML, which signals the notation software to display a thick bar with the number N.

### Inline Measure Repeat

`*N` at the end of a measure repeats that entire measure N times.

Syntax rules:

- `*N` is part of the measure content, not a separate measure
- `N` must be a positive integer
- The measure (including `*N` itself) is repeated N times in the output
- Spaces around `*N` are allowed

Examples:

```txt
HH | xxxx *2 |    # repeats the entire measure "xxxx *2" 2 times (2 measures of xxxx)
HH | - *3 |       # repeats the blank measure 3 times (3 blanks)
```

This macro is syntactic sugar. After expansion, there is no record that `*N` was used—it is indistinguishable from writing the measure N times manually.

## Measure Validation

Within a measure:

- An ordinary token counts as `1` slot
- A token with suffixes has its weight calculated as: `(2 - 0.5^dots) / (2^halves)`
- A group `[span: ...]` counts as `span` slots

Validation Rules:

1. **Total Duration Match**: For each measure, the sum of all token weights must exactly equal the `divisions` header value. Any mismatch results in a hard error.
2. **Grouping Boundary Alignment**: No token or group is allowed to cross a boundary defined by the `grouping` header. If a token's duration would cause it to overlap a boundary, a hard error is reported.

Example:

```txt
time 4/4
grouping 2+2
divisions 4

HH | x. x/ x x |  # Error: 'x.' crosses boundary at slot 2
HH | x. / x x |   # Correct: 'x.' ends at 1.5, followed by half-rest '/' at 1.5-2.0
```

## Whitespace and Comments

### Whitespace

- Spaces and tabs are ignored structurally except as token separators
- Users may add spaces freely for alignment and readability

These should be treated equivalently by the parser:

```txt
HH | x - x - |
HH|x-x-|
HH |   x   -   x   -   |
```

### Blank Lines

- Blank lines separate paragraphs
- Multiple blank lines are equivalent to one paragraph break

### Comments

Supported comment syntax:

```txt
# comment
```

Also allowed at line end:

```txt
HH | x - x - |   # verse groove
```

Rules:

- `#` starts a comment that runs to end of line
- Comments are ignored by the parser
- Only `#` comments are supported in v0

## Errors

### Parsing Strategy

- Be permissive about whitespace
- Be strict about semantics
- Try to collect multiple errors in one pass
- Do not silently rewrite user intent
- v0 does not use warnings
- Any unsupported, ambiguous, inconsistent, or non-exportable construct is a hard error

### Errors

Examples of hard errors:

- Unknown header field
- Unknown track
- Illegal token on a track
- Unknown modifier
- Illegal glyph + modifier combination
- Malformed group
- Group item count mismatch
- Measure slot mismatch
- Repeat conflict
- Repeat structure mismatch
- Paragraph measure-count mismatch among explicit tracks

### Error Format

Errors should ideally include:

- line
- column
- message

Examples:

```txt
Line 8, Col 12: Unknown token `q` on track HH
Line 10, Col 7: Group [3/2] expects 3 items, got 2
Line 14, Col 1: Repeat boundary conflicts with previous declaration
```

## MusicXML Export

### Goal

Export `.musicxml` that opens correctly in MuseScore and preserves rhythm and drum meaning as well as possible.

### Export Structure

Use one percussion part for the whole drum kit, not one part per track.

Suggested mapping:

- `HH` -> closed hi-hat
- `HF` -> pedal hi-hat
- `SD` -> snare
- `BD` -> bass drum
- `T1` -> high tom
- `T2` -> mid tom
- `T3` -> floor tom
- `RC` -> ride cymbal
- `C` -> crash cymbal

### Export Rules

- Export from normalized events, not raw DSL
- `title` exports as the MusicXML work title
- `subtitle` exports as score-level credit text when present
- `composer` exports as creator metadata and score-level credit text when present
- Measures and time signatures come from `time`
- Tuplets come from groups `[span: ...]` where item count ≠ span
- `divisions` in MusicXML may be chosen independently as needed for accurate durations
- `:|` should export as actual repeat barlines when possible

### Sticking

`ST` sticking is exported as above-staff fingering text at matching note positions.

- `R` and `L` do not export as percussion notes
- Sticking text does not advance rhythmic time
- Sticking without a matching note at the same start position is ignored in MusicXML export

### Modifier Export Priority

v0 modifiers are limited to forms with stable MusicXML export semantics.

The exporter should preserve the supported modifier set directly.

Supported export priorities:

- accents
- open/close hi-hat
- tuplets
- flam

Supported when explicitly included in the whitelist:

- rim
- cross
- bell
- choke

If a modifier cannot be represented reliably in MusicXML, it is out of scope for v0 and should not be accepted by validation.

Ghost-note rendering/export note:

- Parenthesized ghost-note heads are deferred
- Reason: OSMD does not currently support this notation reliably
- Reference: https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/issues/887

## Example

```txt
tempo 96
time 4/4
divisions 16
grouping 2+2

HH |: x - x - o - x - | x - x:close - X - x - :|
SD |  - - d:cross - d - | D:rim - [2: d d:flam d] - - -  |
BD |  p - - - p - - - | p - p - - - p -                     |
HF |  - - - - p - - - | - - - - p:close - -                |

RC | - - x:bell - - - x - | - - - - - - - - |
C  | X:choke - - - - - - - | - - - - X - - - |
ST | R - L - [2: R L R] - | R - L - R - L - |
```

---

## Summary

This version:

- Adds explicit beat grouping via `grouping`
- Defines normalized event model
- Restricts exportable durations
- Fixes track filling semantics
- Clarifies sugar behavior (`c`)
- Simplifies repeat parsing
