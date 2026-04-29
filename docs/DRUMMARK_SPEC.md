# DrumMark Specification

## Status

**Definitive** — the authoritative source of truth for the DrumMark DSL, IR, compiler design, and MusicXML export.

This document is the merged successor of `DSL_DESIGN.md` and `IR_SPEC.md`. All language syntax, intermediate representation, compiler pipeline, error format, and export guidance live here. From now on, only this document needs to be read.

---

## 1. Overview

DrumMark is a plain-text notation language for drum scores. It is designed to be fast to write, human-readable, and directly compilable to a deterministic IR.

**Core design principles**:
- **Human-first**: Readable by musicians without a tool.
- **Deterministic**: Same source always produces the same IR.
- **Validatable**: Compiler reports hard errors for any unsupported construct.
- **Renderer-agnostic**: IR output feeds VexFlow rendering, MusicXML export, and future playback.

---

## 2. Architecture & Compile Pipeline

### 2.1 Pipeline

```
DSL Source
  │
  ▼
Tokenizer
  │ token stream
  ▼
Parser
  │ AST
  ▼
Normalizer  ──►  Validation
  │                    │
  ▼                    ▼  (hard errors thrown here)
IR (JSON)
  │
  ├──────────────────┬────────────────────┐
  ▼                  ▼                    ▼
VexFlow Renderer   MusicXML Exporter   Playback Engine
(preview + PDF)    (MuseScore)         (future)
```

- All score rendering goes through VexFlow 5.
- MusicXML is an export-only backend.
- The editor is the source of truth. Preview and export are derived.
- IR is the single canonical interchange format.

### 2.2 Rendering Modes

**Continuous Scroll Preview**
- Single-page infinite-scroll SVG rendering the full score
- No page breaks; the entire score is visible at once
- Used for live preview in the browser

**Page View / PDF Export**
- Score is sliced into pages using the current page size (default: US Letter 8.5×11 in, 612×792 pt)
- Systems are placed top to bottom, one after another, until the current page has no room for the next system
- At that point, a new page is started and systems continue filling it the same way
- Header (title, subtitle, composer) appears on the first page only
- Each page is rendered as a separate SVG via `renderScorePagesToSvgs`

### 2.3 Normalized Events

The normalized event is the single source for rendering and export. Each event contains:

```
track          — canonical score track after input sugar is resolved
paragraphIndex — paragraph index for layout
measureIndex   — measure index within the score
measureInParagraph — measure position within its paragraph
start          — rational musical duration (Fraction), not raw grid slot
duration       — rational musical duration (Fraction)
kind           — hit | rest | sticking
glyph          — atomic glyph token
modifier       — modifier string(s)
tuplet         — tuplet spec or null
tie            — tie spec or null
voice          — 1 (up-stem) | 2 (down-stem) | null (derived)
beam           — begin | continue | end | none | null (derived)
```

Notes:
- `track` is the canonical score track after input sugar is resolved
- Anonymous tracks are expanded before normalization and do not appear as a normalized track
- `c` resolves canonically to `C:d`; `C` resolves to `C:d:accent`
- `start` and `duration` are rational musical durations, not raw grid slot numbers
- Groups that require automatic tie splitting are **rejected** during validation
- Instrument placement is derived by renderers/exporters from `track`, `glyph`, and `modifier`

---

## 3. Headers

### 3.1 Supported Header Fields

```txt
title <text>
subtitle <text>
composer <text>
tempo <number>
time <beats>/<beatUnit>
divisions <number>
grouping <a+b+c+...>
```

**Rules**:
- `title`, `subtitle`, `composer`: optional, free text.
- `tempo`: optional, positive integer, default `120`, interpreted as quarter-note BPM.
- `time`: required, e.g. `4/4`, `3/4`, `6/8`.
- `divisions`: required, positive integer, defines the grid resolution per measure.
- `grouping`: optional, sum must equal numerator of `time`. Controls beat structure, default accents, beaming. Defaults inferred from `time` if absent.

### 3.2 Grouping Inference

| time | inferred grouping |
|------|-------------------|
| `2/4` | `1+1` |
| `3/4` | `1+1+1` |
| `4/4` | `2+2` |
| `2/2` | `1+1` |
| `3/8` | `1+1+1` |
| `6/8` | `3+3` |
| `9/8` | `3+3+3` |
| `12/8` | `3+3+3+3` |

Irregular meters (`5/8`, `7/8`, `5/4`, etc.) require explicit `grouping`.

---

## 4. Tracks

### 4.1 Supported Track Names

| ID | Family | MIDI Note |
|----|--------|-----------|
| `BD` | drum | 36 |
| `BD2` | drum | 36 |
| `SD` | drum | 38 |
| `T1` | drum | 48 |
| `T2` | drum | 45 |
| `T3` | drum | 41 |
| `T4` | drum | 43 |
| `HH` | cymbal | 42 |
| `HF` | pedal | 44 |
| `RC` | cymbal | 51 |
| `RC2` | cymbal | 59 |
| `C` | cymbal | 49 |
| `C2` | cymbal | 57 |
| `SPL` | cymbal | 55 |
| `CHN` | cymbal | 52 |
| `CB` | percussion | 56 |
| `WB` | percussion | 76 |
| `CL` | percussion | 75 |
| `ST` | auxiliary | — (no MIDI) |

### 4.2 Track Line Syntax

```
<TRACK> | ... |
```

Example:
```
HH | x - x - x - x - |
SD | - - d:cross - d - |
```

### 4.3 Anonymous Track

A line that starts directly with a barline acts as a universal container:

```
| x - s - x - s |
```

The default track for anonymous lines is `HH` for glyph routing.

### 4.4 Track Routing Scopes

Use braces `{}` to route a block of notes to a specific track without affecting timing:

```
| RC { x x x x } |        # A full measure of Ride
SD { [3: d d d] }        # Tuplet group on SD
```

### 4.5 Voice Convention

- Voice 1 (up-stem): `HH`, `RC`, `RC2`, `C`, `C2`, `SPL`, `CHN`, `SD`, `T1`, `T2`, `T3`, `T4`, `CB`, `WB`, `CL`, `ST`
- Voice 2 (down-stem): `BD`, `BD2`, `HF`

### 4.6 Track Registry and Auto Fill

- Any track mentioned via line header (`SD |`), routing scope (`SD { ... }`), or summoning prefix (`SD:d`) is **automatically registered** in the score.
- Tracks are ordered based on their first appearance in the document.
- Once a track is registered, it remains active throughout the score.
- If a registered track is omitted in a later paragraph, it is auto-filled with full-measure rests.

### 4.7 Track Families

| Family | Tracks |
|--------|--------|
| cymbal | `HH`, `RC`, `RC2`, `C`, `C2`, `SPL`, `CHN` |
| drum | `SD`, `BD`, `BD2`, `T1`, `T2`, `T3`, `T4` |
| pedal | `HF` |
| percussion | `CB`, `WB`, `CL` |
| auxiliary | `ST` |

---

## 5. Tokens

### 5.1 Atomic Tokens

| Token | Meaning |
|-------|---------|
| `d` | Universal hit (standard notehead) |
| `D` | Universal hit with accent |
| `-` | Rest |
| `x` | Cymbal/Crossstick — maps to `HH:d` in cymbal context, `SD:d:cross` in drum context, `HH:d` in anonymous |
| `s` | `SD:d` |
| `S` | `SD:d:accent` |
| `b` | `BD:d` |
| `B` | `BD:d:accent` |
| `b2` | `BD2:d` |
| `B2` | `BD2:d:accent` |
| `r` | `RC:d` |
| `R` | `RC:d:accent` |
| `r2` | `RC2:d` |
| `R2` | `RC2:d:accent` |
| `c` | `C:d` |
| `C` | `C:d:accent` |
| `c2` | `C2:d` |
| `C2` | `C2:d:accent` |
| `t1`, `t2`, `t3`, `t4` | `T1:d`, `T2:d`, `T3:d`, `T4:d` |
| `o` | `HH:d:open` |
| `O` | `HH:d:open:accent` |
| `spl` | `SPL:d` |
| `SPL` | `SPL:d:accent` |
| `chn` | `CHN:d` |
| `CHN` | `CHN:d:accent` |
| `cb` | `CB:d` |
| `CB` | `CB:d:accent` |
| `wb` | `WB:d` |
| `WB` | `WB:d:accent` |
| `cl` | `CL:d` |
| `CL` | `CL:d:accent` |
| `p` | `(Local):d`; in anonymous track, `HF:d` |
| `g` | `(Local):d:ghost`; in anonymous track, `SD:d:ghost` |
| `R`, `L` | Sticking — used in `ST` track or with `ST:` prefix |

### 5.2 Resolution Priority

When parsing a token, the compiler resolves its target in this order:

1. **Explicit override**: `RC:d` forces delivery to `RC` track.
2. **Static Magic Token**: `s`, `b`, `r`, etc. always map to their global physical target (`s` → `SD`) even inside other track lines.
3. **Context fallback**: `d` or `x` in a named track line uses that line's track; in anonymous `|` defaults to `HH`.

### 5.3 Duration Modifiers

| Symbol | Effect |
|--------|--------|
| `.` | Multiplies duration by 1.5. Multiple dots accumulate (`d..` = 1.75×). |
| `/` | Halves duration. Multiple halves accumulate (`d//` = 0.25×). |

Combined: `d./` = 0.75× duration.

### 5.4 Rhythmic Math

Each token's weight is computed as:

```
weight = base × (2 - 0.5^dots) / (2^halves)
```

**Base values**: `d` = 1 slot, `-` = 1 slot.

**Dotting** (left-associative):
- `d.` = 1.5
- `d..` = 1 + 0.5 + 0.25 = 1.75
- `d...` = 1 + 0.5 + 0.25 + 0.125 = 1.875

**Halving**:
- `d/` = 0.5
- `d//` = 0.25
- `d/`/` = 0.125

Fractional validation: each token is converted to an absolute Fraction relative to a whole note before summing. Validation MUST use exact rational duration math internally. A measure is valid iff the sum of all token durations equals the full `timeSignature` fraction; equivalently, the accumulated token weight equals `divisions`.

### 5.5 Groups

**Syntax**:
```
[span: item1 item2 ...]
[ item1 item2 ... ]     # shorthand for [1: item1 item2 ...]
```

**Semantics**: Each item's duration = `slotDuration × span / itemCount`.

**Supported group forms**:

*Stretched* (`itemCount ≤ span`): Allowed only if each resulting item duration maps to a standard note value, dotted note, or tuplet — and does not require automatic tie splitting.

*Compressed* (`itemCount > span`): Ratios `[2, 1]`, `[4, 1]` → subdivide (no tuplet). All others → tuplet.

*Unsupported*: Any group requiring automatic tie splitting is a hard error.

**Minimum duration**: No guarantees below 64th note.

---

## 6. Modifiers

### 6.1 Supported Modifiers

| Modifier | Allowed on | Visual Effect |
|----------|-----------|--------------|
| `accent` | all tracks | Accent mark (>) above note |
| `open` | `HH` | Open circle on X notehead |
| `half-open` | `HH` | Sizzle; encircled "zz" or half-open circle; CC4 ≈ 64 |
| `close` | `HH`, `HF` | Default hi-hat state |
| `choke` | `C`, `C2`, `RC`, `RC2`, `SPL`, `CHN` | `+` or `×` above note |
| `bell` | `RC`, `RC2` | `B` or dot on ride cymbal |
| `rim` | `SD` | Smaller notehead + "R" optional |
| `cross` | `SD` | X above stem on snare |
| `flam` | `SD`, `T1`, `T2`, `T3`, `T4` | 16th grace note preceding main note |
| `ghost` | `SD`, `HH`, `T1`, `T2`, `T3`, `T4` | Parenthesized notehead |
| `drag` | `SD`, `HH`, `T1`, `T2`, `T3`, `T4`, `RC`, `RC2` | Two 16th grace notes preceding |
| `roll` | `SD`, `HH`, `T1`, `T2`, `T3`, `T4`, `RC`, `RC2`, `BD`, `BD2` | Slash marks on stem |
| `dead` | `SD`, `HH`, `T1`, `T2`, `T3`, `T4`, `BD`, `BD2` | Small "x" notehead, muted attack |

### 6.2 Modifier Syntax

```
<token>:<modifier>
Track:d:<modifier>
```

Examples:
```
HH | d - d:open - d:close - d - |
SD | - - d:cross - d - d:rim:accent - |
RC | - - d:bell - - - d - |
C  | d:choke:accent - - - - - - - |
SD | - - d:ghost - - - - |
HH | d - d:drag - - - - - |
```

---

## 7. Combined Hits

Use `+` to play multiple instruments simultaneously:

```
x+s          # Hi-hat and Snare
b+x          # Bass drum and Hi-hat
HH:d + SD:d  # Explicit combined hit
```

Combined hits produce multiple events at the same `start` position.

---

## 8. Sticking

### 8.1 Sticking Track

Use the `ST` track for hand sticking annotations:

```
ST | R - L - [2: R L R] - | R - L - R - L - |
```

### 8.2 Sticking Semantics

- Sticking tokens in `ST` track do not create MusicXML `<note>` elements with percussion step/octave. They are attached as `<fingering>` or `<direction>` to notes at the same rhythmic position.
- Sticking at a given `start` position applies to **all notes** at that position across all tracks.
- Sticking without a matching note at the same `start` position is ignored in MusicXML export.

---

## 9. Repeats

### 9.1 Repeat Barlines

| Syntax | Meaning |
|--------|---------|
| `\|` | regular barline |
| `\|:` | repeat start |
| `:\|` | repeat end |
| `\|: :\|` | repeat start + end (same measure) |
| `\|\|` | double barline (no measure between) |
| `\|  \|` | double barline with whitespace → empty measure between |
| `\|.` | explicit volta termination |

**Double barline with empty measure**: If whitespace exists between the two bars, it forms an empty measure. `|  |` and `|  |` (any amount of whitespace) both produce a double barline with an empty measure in between. `||` with no whitespace produces a double barline with no measure between.

### 9.2 Repeat Rules

- Repeats are global measure structure, not private to one track.
- Repeat boundaries may be written on any track. A declaration on any track applies to the whole score.
- Nested repeats are not allowed in v1.
- Crossing repeats are not allowed in v1.

### 9.3 Voltas (Alternative Endings)

| Syntax | Meaning |
|--------|---------|
| `\|1.` | Volta for 1st repetition |
| `\|1,2.` | Volta shared by 1st and 2nd repetition |
| `\|.` | Explicit termination of current volta bracket |

**Example**:
```
|: d d d d |1. d d d d :|2. d d d d | d d d d |. d d d d |
```

**Rules**:
- Volta starts at `|N.`` or `|N,M.` barline.
- Volta ends when: (a) a `repeat-end` barline is encountered, (b) a new `volta` with a different index starts, or (c) `|.` is encountered.
- Both `|: :|` and voltas can span multiple paragraphs. Paragraph boundaries (blank lines) only trigger system breaks in the renderer and do not affect the musical logical structure.
- If a volta is followed immediately by `:|`, the bracket ends at that barline.

### 9.4 Measure Repeat (`%`)

A measure containing only `%` shorthand repeats the preceding measures. Each `%` repeats one preceding measure.

```
HH | d d d d | % |      # repeats 1 preceding measure
HH | c c c c | %% |     # repeats 2 preceding measures
BD | b - - - | % |      # repeats 1 preceding measure
```

**Rules**:
- One `%` repeats one preceding measure; two `%%` repeats two preceding measures; and so on.
- The measure containing `%` shorthand must contain only that token (no other notes).
- The referenced measures must not themselves be repeat shorthand measures (no chaining).
- Canonical IR stores measure-repeat intent as `measureRepeat.slashes` (`1` for `%`, `2` for `%%`).

### 9.5 Complex Repeats (Markers & Jumps)

Complex navigation is handled via markers (targets) and jumps (instructions). These are global and can be declared on any track.

| Syntax | Meaning | Visual |
|--------|---------|--------|
| `@segno` | Segno marker | $\S$ |
| `@coda` | Coda marker | $\phi$ |
| `@fine` | Fine marker | "Fine" |
| `@to-coda` | To Coda jump | "To Coda" |
| `@da-capo` | Da Capo | "D.C." |
| `@dal-segno` | Dal Segno | "D.S." |
| `@dc-al-fine` | Da Capo al Fine | "D.C. al Fine" |
| `@dc-al-coda` | Da Capo al Coda | "D.C. al Coda" |
| `@ds-al-fine` | Dal Segno al Fine | "D.S. al Fine" |
| `@ds-al-coda` | Dal Segno al Coda | "D.S. al Coda" |

**Rules**:
- **Placement**: These tokens can appear anywhere within a measure's content (e.g., `| @segno d d d d |`).
- **Global Scope**: Like repeat barlines, a marker or jump declared on one track applies to the entire measure for all tracks.
- **Conflict**: A single measure may contain at most one marker and at most one jump. Conflicting declarations within the same measure (on same or different tracks) are a hard error.
- **Render position**: Markers usually appear above the start of the measure; jumps usually appear above the end of the measure.

---

## 10. Multi-Measure Rest

`|--N--|` is the **only** way to specify a multi-measure rest.

```
HH | --8-- |       # 8-measure rest
HH |- 4 - |        # 4-measure rest (spaces allowed)
```

**Rules**:
- `N` must be a positive integer ≥ 1.
- `N` must be surrounded by at least one `-` on each side.
- The entire construct must fit within a single measure boundary `| ... |`.

---

## 11. Inline Measure Repeat

### `*N` — Inline repeat count

`*N` at the end of a measure expands that measure to a total of `N` consecutive measures.

```
HH | dddd *2 |       # 2 measures of dddd
HH | - *3 |           # 3 blank measures
```

This is syntactic sugar. After expansion, there is no record that `*N` was used.

---

## 12. Measure Validation

### 12.1 Total Duration

For each measure, the sum of all token durations must equal one full measure length. Equivalently, the sum of token weights must equal `divisions`. Any mismatch is a hard error.

### 12.2 Grouping Boundary Alignment

No token or group may cross a boundary defined by `grouping`. A hard error is reported if a token's duration overlaps a grouping boundary.

**Example** (error):
```
HH | d. d/ d d |    # 'd.' crosses boundary at slot 2
```

**Correct**:
```
HH | d. -/ d d |    # 'd.' ends at 1.5, followed by a half-rest at 1.5-2.0
```

### 12.3 Whole-Measure Rest

If all entries in a voice are rests and their combined duration equals the full measure, emit one `<rest measure="yes"/>` element instead of splitting at grouping boundaries:

```xml
<note>
  <rest measure="yes"/>
  <duration>32</duration>
  <voice>2</voice>
  <type>whole</type>
  <staff>1</staff>
</note>
```

**Rationale**: A voice that is entirely silent for a full measure does not need to assert the silence slot-by-slot. The grouping structure is irrelevant when there is nothing to render. A single whole-measure rest is semantically equivalent and more compact.

**Rule**: If a voice consists entirely of rests covering a complete measure, emit one whole-measure rest. Otherwise, split rests at grouping boundaries as normal. Applies to both voice 1 and voice 2.

---

## 13. Comments

```
# comment
```

`#` starts a comment that runs to end of line. Comments are ignored by the parser.

---

## 14. Whitespace

- Spaces and tabs are ignored structurally except as token separators.
- Users may add spaces freely for alignment and readability.

These should be treated equivalently by the parser:

```
HH | d - d - |
HH|d-d-|
HH |   d   -   d   -   |
```

### Paragraphs

After the header, track content is organized into paragraphs. Blank lines separate paragraphs. Paragraph primarily affects layout and text organization. Each paragraph starts a new system in the rendered score. Paragraph does not change musical time structure.

---

## 15. Compiler Errors

### 15.1 Parsing Strategy

- Be permissive about whitespace
- Be strict about semantics
- Try to collect multiple errors in one pass
- Do not silently rewrite user intent
- Any unsupported, ambiguous, or inconsistent construct is a hard error

### 15.2 Error Format

Errors should include line, column, and message:

```
Line 8, Col 12: Unknown token `q` on track HH
Line 10, Col 7: Group [3: a b] expects 3 items, got 2
Line 14, Col 1: Repeat boundary conflicts with previous declaration
Line 18, Col 3: Modifier `:choke` is not allowed on SD
Line 21, Col 5: Measure duration (14) does not equal divisions (16)
Line 24, Col 1: Token `d.` crosses grouping boundary at slot 2
Line 27, Col 8: Unknown track `XX`
Line 30, Col 1: Empty measure is not allowed in repeat section
```

### 15.3 Hard Error List

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
- Multi-measure rest with `N < 2`
- Inline repeat with non-positive `N`

---

## 16. Intermediate Representation (IR)

The compiler emits a JSON IR. All temporal values use the **Fraction** structure.

### 16.1 Basic Types

#### Fraction (Object)
All temporal values (start, duration) MUST be stored as reduced fractions.
- `num`: Non-negative integer.
- `den`: Positive integer.

#### TimeSignature (Object)
- `beats`: Number of beats in a measure.
- `beatUnit`: The note value that represents one beat.

---

### 16.2 Document Hierarchy

```
DrumScore
  └─ version: string
  └─ header: Header
  └─ tracks: Track[]
  └─ measures: Measure[]
```

### 16.3 Header IR

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `title` | string | no | Score title |
| `subtitle` | string | no | Score subtitle |
| `composer` | string | no | Composer credit |
| `tempo` | integer | no | Quarter-note BPM |
| `timeSignature` | `TimeSignature` | **yes** | Measure structure |
| `divisions` | integer | **yes** | Grid slots per measure |
| `grouping` | integer[] | no | Beat grouping |

### 16.4 Track IR

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `id` | string | **yes** | Track identifier (e.g., "HH") |
| `family` | string | **yes** | `cymbal`, `drum`, `pedal`, `percussion`, `auxiliary` |

### 16.5 Measure IR

A `Measure` is the primary container for events and visual/structural metadata.

```json
{
  "index": 0,
  "events": [ Event, Event, ... ],
  "barline": "regular",
  "marker": "segno",
  "jump": "ds-al-coda",
  "volta": { "indices": [1, 2] },
  "measureRepeat": { "slashes": 1 },
  "multiRest": { "count": 4 }
}
```

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `index` | integer | **yes** | 0-based measure index within the score |
| `events` | `Event[]` | **yes** | All events in this measure |
| `barline` | `BarlineType` | **yes** | Visual style of the right-hand barline |
| `marker` | `MarkerType` | no | Navigation marker (e.g., segno, coda) |
| `jump` | `JumpType` | no | Navigation jump instruction (e.g., D.S. al Coda) |
| `volta` | `VoltaIntent` | no | Metadata for alternative endings |
| `measureRepeat` | `MeasureRepeatIntent` | no | Visual repeat shorthand (% or %%) |
| `multiRest` | `MultiRestIntent` | no | Multi-measure rest metadata |

---

### 16.6 BarlineType (Enum)

| Value | Meaning |
|-------|---------|
| `regular` | Standard single barline |
| `double` | Double barline |
| `final` | Termination or heavy double barline |
| `repeat-start` | Start of a repeat section |
| `repeat-end` | End of a repeat section |
| `repeat-both` | Back-to-back repeat (end + start) |

### 16.7 MarkerType (Enum)

| Value | Meaning |
|-------|---------|
| `segno` | Segno symbol ($\S$) |
| `coda` | Coda symbol ($\phi$) |
| `fine` | "Fine" text |

### 16.8 JumpType (Enum)

| Value | Meaning |
|-------|---------|
| `da-capo` | "D.C." |
| `dal-segno` | "D.S." |
| `dc-al-fine` | "D.C. al Fine" |
| `dc-al-coda` | "D.C. al Coda" |
| `ds-al-fine` | "D.S. al Fine" |
| `ds-al-coda` | "D.S. al Coda" |
| `to-coda` | "To Coda" |

### 16.9 VoltaIntent (Object)

| Field | Type | Meaning |
|-------|------|---------|
| `indices` | `integer[]` | 1-based indices for the jump bracket (e.g., `[1]`) |

### 16.8 MeasureRepeatIntent (Object)

| Field | Type | Meaning |
|-------|------|---------|
| `slashes` | `integer` | `1` for `%`, `2` for `%%` |

### 16.9 MultiRestIntent (Object)

| Field | Type | Meaning |
|-------|------|---------|
| `count` | `integer` | Total measures in the rest block (N >= 1) |

---

### 16.10 Event IR

```json
{
  "track": "HH",
  "start": { "num": 0, "den": 16 },
  "duration": { "num": 1, "den": 16 },
  "kind": "hit",
  "glyph": "d",
  "modifiers": [],
  "tuplet": null,
  "tie": null,
  "voice": 1,
  "beam": "begin"
}
```

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `track` | string | **yes** | Track ID |
| `start` | `Fraction` | **yes** | Offset from start of measure |
| `duration` | `Fraction` | **yes** | Musical duration |
| `kind` | string | **yes** | `hit`, `rest`, `sticking` |
| `glyph` | string | `kind == "hit"` | Atomic glyph token |
| `modifiers` | string[] | no | List of modifier strings |
| `tuplet` | `TupletSpec` | no | Tuplet metadata if applicable |
| `tie` | `string` | no | `start`, `stop`, `both` |
| `voice` | integer | no | `1` (up), `2` (down) |
| `beam` | `string` | no | `begin`, `continue`, `end`, `none` |

---

### 16.11 TupletSpec (Object)

| Field | Type | Meaning |
|-------|------|---------|
| `actual` | integer | Notes played (e.g., 3) |
| `normal` | integer | Notes in normal time (e.g., 2) |
| `span` | integer | Duration in "normal" units |
| `bracket` | boolean | Whether to draw the bracket |

### 16.12 Range Annotations

| Field | Type | Meaning |
|-------|------|---------|
| `type` | string | `hairpin`, `slur`, `dynamic` |
| `subtype` | string | e.g., `crescendo`, `p`, `ff` |
| `start` | `Fraction` | Start position |
| `end` | `Fraction` | End position (for span types) |

**Cross-measure spanning**: A hairpin that spans measures 0–2 is represented as one fragment per measure, using `{ "num": 1, "den": 1 }` to anchor at measure boundaries.

---

## 17. MusicXML Export

### 17.1 Export Structure

- Export from normalized events, not raw DSL
- Use **one percussion part** for the whole drum kit, not one part per track
- `divisions` in MusicXML may be chosen independently as needed for accurate durations
- `:|` should export as actual repeat barlines when possible

### 17.2 Track → Instrument Mapping

| Track | MusicXML Instrument | MIDI Note |
|-------|-------------------|-----------|
| `HH` | closed hi-hat | 42 |
| `HF` | pedal hi-hat | 44 |
| `SD` | snare | 38 |
| `BD` | bass drum | 36 |
| `BD2` | bass drum | 36 |
| `T1` | high tom | 48 |
| `T2` | mid tom | 45 |
| `T3` | floor tom | 41 |
| `T4` | low tom | 43 |
| `RC` | ride cymbal | 51 |
| `RC2` | ride cymbal 2 | 59 |
| `C` | crash cymbal | 49 |
| `C2` | crash cymbal 2 | 57 |
| `SPL` | splash cymbal | 55 |
| `CHN` | china cymbal | 52 |
| `CB` | cowbell | 56 |
| `WB` | wobble board | 76 |
| `CL` | clap | 75 |

### 17.3 Velocity Mapping

| Track | Default Velocity | Accent Velocity | Ghost Velocity |
|-------|-------------------|-----------------|----------------|
| `BD` / `BD2` | 90 | 127 | 30 |
| `SD` | 85 | 120 | 25 |
| `T1` / `T2` | 80 | 115 | 25 |
| `T3` / `T4` | 82 | 118 | 28 |
| `HH` | 80 | 115 | 20 |
| `HF` | 75 | 110 | 20 |
| `RC` / `RC2` | 78 | 112 | 20 |
| `C` / `C2` | 85 | 120 | 25 |
| `SPL` | 80 | 115 | 20 |
| `CHN` | 83 | 120 | 22 |
| `CB` | 75 | 110 | 20 |
| `WB` / `CL` | 72 | 108 | 18 |

**HiHat open/close**: Note-on for `HH` (42) is sent regardless; a CC4 message follows with value `0` (closed) or `127` (open), sent simultaneously with or 1 tick after the note-on.

### 17.4 Notehead Selection (Renderer & Exporter Reference)

| Family | Default | With `:ghost` | With `:accent` |
|--------|---------|---------------|----------------|
| cymbal | X | X (parenthesized) | X + accent mark |
| drum | filled-circle | filled-circle (parenthesized) | filled-circle + accent mark |
| pedal | filled-circle | filled-circle (parenthesized) | filled-circle + accent mark |
| percussion | filled-circle | filled-circle (parenthesized) | filled-circle + accent mark |

### 17.5 Modifier Export Priority

v0 modifiers are limited to forms with stable MusicXML export semantics.

**Supported and reliably exported**:
- accents
- open/close hi-hat
- tuplets
- flam
- ghost
- drag

**Supported when explicitly included in the whitelist**:
- rim
- cross
- bell
- choke

**Out of scope for the current v0 MusicXML exporter**: A modifier may be valid in the DSL even if this exporter does not yet provide a stable representation for it.

`ghost` and `drag` are exported as grace notes with appropriate notation semantics.

### 17.6 Sticking Export

- `ST` sticking is exported as above-staff fingering text at matching note positions.
- `R` and `L` do not export as percussion notes.
- Sticking text does not advance rhythmic time.
- Matching is based on start position (Fraction), not track identity.
- A sticking annotation at a given start position applies to all notes at that position, regardless of track.
- Sticking without a matching note at the same start position is ignored.

---

## 18. Complete Example

```
title Funk Study No. 1
subtitle Verse groove
composer G. Mao
tempo 96
time 4/4
divisions 16
grouping 2+2

HH |: d - d - o - d - | d - d:close - d:accent - d - :|
SD |  - - d:cross - d - | d:rim:accent - [2: d d:flam d] - - -  |
BD |  d - - - d - - - | d - d - - - d -                     |
HF |  - - - - p - - - | - - - - p:close - -                |

RC | - - d:bell - - - d - | - - - - - - - - |
C  | d:choke:accent - - - - - - - | - - - - d:accent - - - |
ST | R - L - [2: R L R] - | R - L - R - L - |
```

Corresponding IR excerpt (first measure):

```json
{
  "version": "1.0",
  "header": {
    "title": "Funk Study No. 1",
    "subtitle": "Verse groove",
    "composer": "G. Mao",
    "tempo": 96,
    "timeSignature": { "beats": 4, "beatUnit": 4 },
    "divisions": 16,
    "grouping": [2, 2]
  },
  "tracks": [
    { "id": "HH", "family": "cymbal" },
    { "id": "SD", "family": "drum" },
    { "id": "BD", "family": "drum" },
    { "id": "HF", "family": "pedal" },
    { "id": "RC", "family": "cymbal" },
    { "id": "C", "family": "cymbal" },
    { "id": "ST", "family": "auxiliary" }
  ],
  "measures": [
    {
      "index": 0,
      "barline": "repeat-start",
      "events": [
        { "track": "HH", "start": { "num": 0, "den": 16 }, "duration": { "num": 1, "den": 16 }, "kind": "hit", "glyph": "d", "modifiers": [], "tuplet": null, "tie": null, "voice": 1, "beam": "begin" },
        { "track": "HH", "start": { "num": 1, "den": 16 }, "duration": { "num": 1, "den": 16 }, "kind": "rest", "glyph": null, "modifiers": [], "tuplet": null, "tie": null, "voice": 1, "beam": "none" },
        { "track": "HH", "start": { "num": 2, "den": 16 }, "duration": { "num": 1, "den": 16 }, "kind": "hit", "glyph": "d", "modifiers": [], "tuplet": null, "tie": null, "voice": 1, "beam": "continue" },
        { "track": "HH", "start": { "num": 3, "den": 16 }, "duration": { "num": 1, "den": 16 }, "kind": "hit", "glyph": "o", "modifiers": [], "tuplet": null, "tie": null, "voice": 1, "beam": "end" },
        { "track": "HH", "start": { "num": 4, "den": 16 }, "duration": { "num": 1, "den": 16 }, "kind": "hit", "glyph": "d", "modifiers": [], "tuplet": null, "tie": null, "voice": 1, "beam": "begin" },
        { "track": "HH", "start": { "num": 7, "den": 16 }, "duration": { "num": 1, "den": 16 }, "kind": "hit", "glyph": "d", "modifiers": [], "tuplet": null, "tie": null, "voice": 1, "beam": "end" },
        { "track": "SD", "start": { "num": 2, "den": 16 }, "duration": { "num": 1, "den": 16 }, "kind": "hit", "glyph": "d", "modifiers": ["cross"], "tuplet": null, "tie": null, "voice": 1, "beam": "begin" },
        { "track": "SD", "start": { "num": 3, "den": 16 }, "duration": { "num": 1, "den": 16 }, "kind": "hit", "glyph": "d", "modifiers": [], "tuplet": null, "tie": null, "voice": 1, "beam": "end" },
        { "track": "BD", "start": { "num": 0, "den": 16 }, "duration": { "num": 1, "den": 16 }, "kind": "hit", "glyph": "d", "modifiers": [], "tuplet": null, "tie": null, "voice": 2, "beam": "none" }
      ]
    }
  ]
}
```

---

## Appendix A: Complete Token Reference

| Token | Track | Modifiers | Notes |
|-------|-------|-----------|-------|
| `d` | local | — | |
| `x` | HH/SD | cross in drum ctx | context-aware |
| `s` | SD | — | |
| `S` | SD | accent | |
| `b` | BD | — | |
| `B` | BD | accent | |
| `b2` | BD2 | — | |
| `B2` | BD2 | accent | |
| `r` | RC | — | |
| `R` | RC | accent | |
| `r2` | RC2 | — | |
| `R2` | RC2 | accent | |
| `c` | C | — | |
| `C` | C | accent | |
| `c2` | C2 | — | |
| `C2` | C2 | accent | |
| `t1`–`t4` | T1–T4 | — | |
| `o` | HH | open | |
| `O` | HH | open, accent | |
| `spl` | SPL | — | |
| `SPL` | SPL | accent | |
| `chn` | CHN | — | |
| `CHN` | CHN | accent | |
| `cb` | CB | — | |
| `CB` | CB | accent | |
| `wb` | WB | — | |
| `WB` | WB | accent | |
| `cl` | CL | — | |
| `CL` | CL | accent | |
| `p` | HF (local fallback) | — | |
| `g` | local | ghost | |
| `R/L` | ST | — | sticking |
| `-` | — | — | rest |

---

## Appendix B: Modifier Legality Matrix

| Modifier | BD | BD2 | SD | T1 | T2 | T3 | T4 | HH | HF | RC | RC2 | C | C2 | SPL | CHN | CB | WB | CL |
|----------|----|----|----|----|----|----|----|----|----|----|----|----|----|-----|-----|----|----|----|----|----|----|
| accent | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| open | | | | | | | | ✓ | | | | | | | | | | | |
| half-open | | | | | | | | ✓ | | | | | | | | | | | |
| close | | | | | | | | | ✓ | ✓ | | | | | | | | | |
| choke | | | | | | | | | | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | | |
| bell | | | | | | | | | | ✓ | ✓ | | | | | | | | |
| rim | | | ✓ | | | | | | | | | | | | | | | | |
| cross | | | ✓ | | | | | | | | | | | | | | | | | |
| flam | | | ✓ | ✓ | ✓ | ✓ | ✓ | | | | | | | | | | | | | |
| ghost | | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | | | | | | | | | |
| drag | | | ✓ | ✓ | ✓ | ✓ | ✓ | | | ✓ | ✓ | | | | | | | | |
| roll | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | ✓ | ✓ | | | | | | | | |
| dead | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | | | | | | | | | | | |

---

## Appendix C: Future Improvements

The following features are defined in the spec but not yet implemented or not storable in IR:

| Feature | Description | IR Status |
|---------|-------------|-----------|
| `@tempo:<N>` | Inline tempo change mid-score | Not stored in IR |
| `@time:<N/M>` | Inline time signature change mid-score | Not stored in IR |
| `@partial:<N>` | Pickup/anacrusis measure with N slots | Not stored in IR |
| `@divisions:<N>` | Inline divisions change | Rejected — mid-score divisions change is not supported |
| `dashed` barline | Dashed barline visual | Not yet implemented in IR or renderer |

---

## 19. Implementation Responsibilities

### 19.1 Responsibilities of Each Consumer

| Consumer | Reads | Computes |
|----------|-------|----------|
| **VexFlow Renderer** | header, tracks, measures, events | notehead shapes, positioning, page layout |
| **MusicXML Exporter** | header, tracks, measures, events | MIDI note numbers, notehead types, tuplet XML elements |
| **Playback Engine** (future) | header, tracks, measures (with repeats/volts expanded) | linear MIDI event stream, velocities, CC messages |

### 19.2 What IR Does NOT Store

The following are intentionally absent — they are concerns of specific consumers, not the IR:

- **MIDI velocity values**: Mapped by exporter from `modifiers` (e.g., `accent` → velocity 120, `ghost` → velocity 30).
- **Notehead shape per track/modifier**: Looked up by renderer from the Track Registry appearance table.
- **Expanded playback sequence**: (Repeat/volta unfolded) computed by playback engine as a separate pass.
- **Visual positioning data**: (X/Y coordinates) computed by the renderer during layout.
