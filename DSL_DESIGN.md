# Drum Notation DSL Design v0

## Goal

Build a lightweight web app for writing drum notation in a text DSL, previewing it live, and exporting MusicXML for use in MuseScore.

Core goals:

- Faster to write than MuseScore
- Easier to structure than ad hoc ASCII drum tabs
- Live preview in the browser
- Exportable to MusicXML
- Friendly to common drum notation needs like repeats, tuplets, accents, ghost notes, sticking, and basic playing techniques

Non-goals for v0:

- Full-featured general-purpose notation editor
- WYSIWYG score editing
- Complete support for all traditional engraving details

## Product Shape

Single-page web app:

- Left: DSL editor
- Right: live preview
- Export: MusicXML, later PDF

The editor is the source of truth. The preview is derived from parsed DSL. MusicXML is generated from the parsed score model, not from raw text.

## Architecture

Pipeline:

`DSL -> Tokenizer -> Parser -> AST -> Normalized Events -> Renderers / MusicXML`

Outputs:

- Grid preview
- Staff preview
- MusicXML export

## Header Fields

Supported header fields:

- `tempo`
- `time`
- `divisions`

Example:

```txt
tempo 96
time 4/4
divisions 16
```

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
- Defines the musical duration of one measure

### `divisions`

Syntax:

```txt
divisions <number>
```

Examples:

```txt
divisions 8
divisions 12
divisions 16
divisions 24
```

Rules:

- Required
- Positive integer
- Defines how many base slots each measure is divided into
- One ordinary token occupies one slot

Notes:

- `time` defines measure duration
- `divisions` defines input granularity
- Slot duration is:

```txt
slotDuration = (beats / beatUnit) / divisions
```

## Measures, Paragraphs, and Layout

### Measure Syntax

Each measure is enclosed by barlines:

```txt
| ... |
```

Multiple measures can appear on one track line:

```txt
HH | x - x - | x - x - |
```

### Paragraphs

After the header, track content is organized into paragraphs.

Rules:

- A paragraph is a consecutive block of track lines
- One or more blank lines separate paragraphs
- Each paragraph becomes one rendered system/row in preview
- Blank lines affect layout only, not musical time
- Measures across paragraphs are concatenated in order

Example:

```txt
tempo 96
time 4/4
divisions 16

HH | x - x - x - x - | x - x - X - x - |
SD | - - d - - - D - | - - g - d - - - |
BD | p - - - p - - - | p - p - - - p - |

C  | X - - - - - - - | - - - - X - - - |
```

In the second paragraph, previously seen tracks not written explicitly are auto-filled with rests for that paragraph's measure count.

Rules:

- Missing previously known tracks are auto-filled with rests
- Explicitly written tracks within a paragraph must have the same measure count

## Tracks

### Supported Tracks

Percussion tracks:

- `HH` hand hi-hat
- `HF` hi-hat foot
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

## Base Tokens

### Core Tokens

- `-` rest
- `x` cymbal-family normal hit
- `X` cymbal-family accent hit
- `d` drum-family normal hit
- `D` drum-family accent hit
- `g` drum-family ghost hit
- `p` pedal hit
- `R` right hand sticking
- `L` left hand sticking

### Per-Track Token Rules

`HH`, `RC`, `C` allow:

- `-`
- `x`
- `X`

`SD`, `T1`, `T2`, `T3` allow:

- `-`
- `d`
- `D`
- `g`

`BD` allows:

- `-`
- `p`
- `g`

`HF` allows:

- `-`
- `p`

`ST` allows:

- `-`
- `R`
- `L`

Examples:

```txt
HH | x - X - |
SD | d - g D |
HF | - - p - |
ST | R - L - |
```

## Modifiers

Modifier syntax:

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

- Allowed on `HH`

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
- `g:flam` is not allowed in v0

Examples:

```txt
HH | x - x:open - x:close - x - |
SD | - - d:cross - g - D:rim - |
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

## Groups

Group syntax:

```txt
[m: item1 item2 item3 ...]
[item1 item2 item3 ...]
```

Examples:

```txt
[3/2: x x x]    # old format: 3 items in 2 slots
[2: x]           # new format: 1 item in 2 slots (half note)
[x x x]          # simplified: 3 items in 1 slot (triplet eighths)
[2: p p]         # 2 items in 2 slots (two eighth notes)
```

### Group Semantics

- `m` = number of measure slots the group occupies
- Items are distributed evenly across `m` slots
- When `m` equals the number of items, the ratio is 1:1 (no tuplet effect)
- When `m` is less than the number of items, items are compressed (triplet feel)
- When `m` is greater than the number of items, items are stretched

Examples:

- `[3/2: x x x]` = three events in the time of two slots → triplet
- `[2: x]` = one event stretched to two slots → half note (in 4/4)
- `[x x x]` = three events in one slot → triplet (shorthand for `[1: x x x]`)

### Group Rules

- The group occupies `m` slots in measure validation
- Group items must be valid tokens for the enclosing track
- Modifiers are allowed inside groups
- `o` is allowed inside `HH` groups
- Nested groups are not allowed in v0

Examples:

```txt
HH | x - [2: o] - x - |           # stretched: open HH as half note
SD | - - [x x x] - - - |          # triplet: three snare ghost notes
ST | R - [R L R] - - - |          # triplet: sticking pattern
ST | R - [3/2: R L R] - - - |
```

## Repeats

### Supported Repeat Syntax

- `|:` repeat start
- `:|` repeat end
- `:|xN` repeat end with total play count

Legal measure boundary forms:

- `| ... |`
- `|: ... |`
- `| ... :|`
- `|: ... :|`

Examples:

```txt
HH |: x - x - x - x - | x - x - X - x - :|
SD |  - - d - - - D - | - - g - d - - -  |
BD |  p - - - p - - - | p - p - - - p -  |
```

Single-measure repeat repeated four times total:

```txt
HH |: x - x - x - x - :|x4
```

Two-measure repeat played three times total:

```txt
HH |: x - x - x - x - | x - x - X - x - :|x3
SD |  - - d - - - D - | - - g - d - - -  |
BD |  p - - - p - - - | p - p - - - p -  |
```

### Repeat Semantics

- `:|` is equivalent to `:|x2`
- `xN` means total play count for the repeated region, not extra repeats
- Repeats are global measure structure, not private to one track
- If any track declares repeat boundaries, they apply to the whole score
- If multiple tracks declare them, they must agree

### Repeat Rules

- Repeat starts and ends must be paired
- Nested repeats are not allowed in v0
- Crossing repeats are not allowed
- `N` in `:|xN` must be an integer greater than or equal to `2`
- First/second endings are not supported in v0
- D.C., D.S., Segno, and Coda are not supported in v0

## Measure Validation

Within a measure:

- An ordinary token counts as `1` slot
- A group `[n/m: ...]` counts as `m` slots

For each explicitly written measure on a track:

- Total occupied slots must equal `divisions`

Example:

```txt
time 4/4
divisions 16

HH | x - x - [3/2: x x x] - x - x - |
```

The total slot count must equal `16`.

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

## Errors and Warnings

### Parsing Strategy

- Be permissive about whitespace
- Be strict about semantics
- Try to collect multiple errors in one pass
- Do not silently rewrite user intent

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

### Warnings

Examples of soft warnings:

- Unusual `time` + `divisions` combination
- `g` on `BD`

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
- Measures and time signatures come from `time`
- Tuplets come from groups `[n/m: ...]`
- `divisions` in MusicXML may be chosen independently as needed for accurate durations
- `:|` and `:|x2` should export as actual repeat barlines when possible
- `:|xN` where `N > 2` may be expanded in v0 if repeat-count preservation is unreliable

### Sticking

`ST` is part of the DSL and preview model, but is not exported in v0 MusicXML.

### Modifier Export Priority

Strong priority to preserve:

- accents
- ghost notes
- open/close hi-hat
- tuplets
- flam

Try to preserve where possible:

- rim
- cross
- bell
- choke

If a modifier cannot be represented reliably, degrade gracefully without breaking rhythm.

## Example

```txt
tempo 96
time 4/4
divisions 16

HH |: x - x - o - x - | x - x:close - X - x - :|x3
SD |  - - d:cross - g - | D:rim - [3/2: d d:flam d] - - -  |
BD |  p - - - p - - - | p - p - - - p -                     |
HF |  - - - - p - - - | - - - - p:close - -                |

RC | - - x:bell - - - x - | - - - - - - - - |
C  | X:choke - - - - - - - | - - - - X - - - |
ST | R - L - [3/2: R L R] - | R - L - R - L - |
```

## Summary

This v0 DSL is designed around:

- fast text entry
- clean drum-centric semantics
- inline tuplets and repeats
- permissive visual formatting
- auto-filled missing tracks by paragraph
- MusicXML export as a practical interchange target

It is intentionally scoped to cover common drum writing well before tackling full engraving complexity.
