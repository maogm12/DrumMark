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
DSL -> Tokenizer -> Parser -> AST -> Normalized Events -> Renderers
                                                        ├── MusicXML Export
                                                        └── VexFlow Renderer (preview + PDF)
```

All score rendering goes through VexFlow 5. MusicXML is an export-only backend.

### Rendering Modes

VexFlow renderer operates in two modes:

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
- `DR` (deprecated) and Anonymous tracks are expanded before normalization and do not appear as a normalized track
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

- Any track mentioned via line header (`SD |`), routing scope (`SD { ... }`), or summoning prefix (`SD:d`) is **automatically registered** in the score.
- Tracks are ordered based on their first appearance in the document.
- Once a track is registered, it remains active throughout the score.
- If a registered track is omitted in a later paragraph, it is auto-filled with full-measure rests.

---

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

- `HH`, `RC`, `C`

Drum-family tracks:

- `SD`, `BD`, `T1`, `T2`, `T3`

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

An **Anonymous Track** is a line that starts directly with a barline `|`. It acts as a universal container.

```txt
| x - s - x - s |
```

### Global Magic Tokens (Aliases)

These tokens provide instant "summoning" of specific instruments from any line. They are divided into two categories:

- **Context-Aware Aliases (Dynamic Routing)**:
    These tokens resolve to the **local instrument** of the current track or scope. They only fall back to a default instrument in an anonymous track `|`.
    - `x` -> If the target is in the **Drum Family**, maps to `d:cross` (Cross-stick). Otherwise, maps to `d` (Standard hit). In an anonymous track, defaults to **`HH:d`**.
    - `p` -> Maps to `(Local):d`. In an anonymous track, defaults to **`HF:d`**.
    - `g` -> Maps to `(Local):d:ghost`. In an anonymous track, defaults to **`SD:d:ghost`**.

- **Fixed Summoning Tokens (Static Routing)**:
    These tokens always route to a specific instrument regardless of the line's default.
    - `s` -> `SD:d`
    - `S` -> `SD:d:accent`
    - `b` -> `BD:d`
    - `B` -> `BD:d:accent`
    - `r` -> `RC:d`
    - `R` -> `RC:d:accent`
    - `c` -> `C:d`
    - `C` -> `C:d:accent`
    - `t1`, `t2`, `t3` -> `T1:d`, `T2:d`, `T3:d`
    - `o` -> `HH:d:open`
    - `O` -> `HH:d:open:accent`

- **Sticking Annotations**:
    - `r`, `R`, `l`, `L` -> When used in an `ST` track or with an `ST:` prefix, these map to **Right** and **Left** hand sticking.

**Note on `d`**: The token `d` refers to the "local" instrument. In an anonymous track `|`, `d` also defaults to **`HH`**. In an `ST` track, `d` is invalid and results in a parse error.

### Sticking Semantics

- Sticking tokens (`r`, `l`) in the `ST` track do not create MusicXML `<note>` elements with percussion step/octave.
- They are attached as `<fingering>` or `<direction>` to notes at the same rhythmic position.
- If a sticking token is placed in an anonymous track `|` without an `ST:` prefix, `r` is interpreted as a **Ride Cymbal note**. To write sticking in an anonymous track, use `ST:r`.

### Track Routing Scopes

Use braces `{}` to route a block of notes to a specific track without affecting timing or groups.

- Syntax: `TRACK { ... }`
- Example: `| RC { x x x x } |` (A full measure of Ride)
- Scopes can wrap groups: `SD { [3: d d d] }`

### The Summoning Operator

Use `:` to explicitly summon a track or apply a modifier.

- **Individual Summon**: `RC:d`
- **Summon with Modifier**: `s:rim` (equivalent to `SD:d:rim`)

#### Instrument Selection Hierarchy

Priority (from highest to lowest):

1. **Specific Token/Prefix**: A fixed summoning token (like `s`) or an explicit prefix (like `RC:d`) wins.
2. **Context-Aware Alias**: Tokens like `x`, `p`, or `g` resolve based on the active scope.
3. **Routing Scope**: Braces `TRACK { ... }` override the line default.
4. **Line Default**: The track name at the start of the line (e.g., `SD |`).
5. **Fallback**: In an anonymous track `|`, unrouted tokens follow their specific fallback rules.

**Visual Noteheads**:
- **Cymbal family**: X-notehead (Ghost notes will also be parenthesized).
- **Drum/Pedal family**: Standard notehead.

#### Combined Hits

Use `+` to play multiple instruments simultaneously.

- Example: `x+s` (Hi-hat and Snare)
- Example: `b+x` (Bass drum and Hi-hat)

## Base Tokens

### The Atomic Note

The core of the DSL is the single atomic note **`d`**. All other hit tokens are syntactic sugar that map to `d` with various track or modifier defaults.

- **`d`**: The universal hit (standard notehead).
- **`-`**: Rest.

### Duration Suffixes

Any hit or rest can be followed by duration suffixes to adjust its relative weight:

- `.` (Dot): Multiplies duration by 1.5. Multiple dots are cumulative (e.g., `..` is 1.75x).
- `/` (Half): Divides duration by 2. Multiple halves are cumulative (e.g., `//` is 0.25x).

Combinations are allowed: `d./` is 0.75x duration.

---

## Modifiers

Syntax: `<token>:<modifier>` or `Track:d:<modifier>`

### Supported Modifiers

- `accent` (Mapped from uppercase tokens like `D`, `S`, `X`)
- `open`
- `close`
- `choke`
- `rim`
- `cross`
- `bell`
- `flam`
- `ghost`
- `drag`

### Modifier Rules

`accent`

- Allowed on all percussion tracks.
- Renders as an accent articulation (`>`) above or below the note.

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
- Renders as a slashed 16th grace note preceding the main note

`ghost`

- Allowed on `SD`, `HH`, `T1`, `T2`, `T3`
- Renders as a parenthesized (bracketed) notehead with a circled shape — standard ghost note notation

`drag`

- Allowed on `SD`, `HH`, `T1`, `T2`, `T3`, `RC`
- Renders as two unsynced 16th grace notes preceding the main note (drag/ruff)

### Additional Constraints

- Modifiers must be valid for both the track and the base glyph

Examples:

```txt
HH | d - d:open - d:close - d - |
SD | - - d:cross - d - d:rim:accent - |
RC | - - d:bell - - - d - |
C  | d:choke:accent - - - - - - - |
SD | - - d:ghost - - - - |   # ghost note on snare
HH | d - d:drag - - - - - |   # drag/ruff on hi-hat
```

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
HH |: d - d - d - d - | d - d - d:accent - d - :|
SD |  - - d - - - d:accent - | - - d - d - - -  |
BD |  d - - - d - - - | d - d - - - d -                     |
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

### Voltas (Alternative Endings)

Voltas allow different measures to be played during subsequent repetitions of a section.

#### Syntax

- `|N.` : Starts a volta for the $N$-th repetition (e.g., `|1.`, `|2.`).
- `|N,M.` : Starts a volta shared by multiple repetitions (e.g., `|1,2.`).
- `|.` : An **explicit termination barline** that ends the current volta bracket.

Example:

```txt
|: d d d d |1. d d d d :|2. d d d d | d d d d |. d d d d |
```

#### Rules

1. **Scoping**: A volta starts at a `|N.` or `|N,M.` barline.
2. **Termination**: A volta ends **ONLY** when:
   - A repeat end barline `:|` is encountered.
   - A new volta start barline `|M.` is encountered.
   - An explicit termination barline `|.` is encountered.
3. **Cross-Paragraph Behavior**: Both repeats (`|: :|`) and voltas can span multiple paragraphs. Paragraph boundaries (blank lines) only trigger system breaks in the renderer and do not affect the musical logical structure.
4. **Implicit Endings**: If a volta is followed immediately by `:|`, the bracket ends at that barline.
5. **Explicit Length**: Use `|.` to define exactly where a volta ends, especially when it continues into subsequent common material across paragraph breaks.

#### Semantic Model

In the intermediate model, each measure carries:
- `volta`: An array of numbers indicating which repetitions this measure belongs to (e.g., `[1]`, `[1, 2]`).
- `voltaStatus`: One of `start`, `continue`, or `end` to define the visual bracket boundaries.

---

### Multi-Measure Rest Syntax

`|--N--|` is the **only** way to specify a multi-measure rest.

Syntax rules:

- `N` must be a positive integer >= 2
- `N` must be surrounded by at least one `-` on each side
- Spaces around `N` are allowed
- The entire construct must fit within a single measure boundary `| ... |`

Examples:

```txt
HH | --8-- |     # 8-measure rest
HH |- 4 - |     # 4-measure rest (spaces allowed)
```

`N=1` is not allowed and will be rejected as an error.

### Inline Measure Repeat

`*N` at the end of a measure repeats that entire measure N times.

Syntax rules:

- `*N` is part of the measure content, not a separate measure
- `N` must be a positive integer
- The measure (including `*N` itself) is repeated N times in the output
- Spaces around `*N` are allowed

Examples:

```txt
HH | dddd *2 |    # repeats the entire measure "dddd *2" 2 times (2 measures of dddd)
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

HH | d. d/ d d |  # Error: 'd.' crosses boundary at slot 2
HH | d. / d d |   # Correct: 'd.' ends at 1.5, followed by half-rest '/' at 1.5-2.0
```

## Whitespace and Comments

### Whitespace

- Spaces and tabs are ignored structurally except as token separators
- Users may add spaces freely for alignment and readability

These should be treated equivalently by the parser:

```txt
HH | d - d - |
HH|d-d-|
HH |   d   -   d   -   |
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
HH | d - d - |   # verse groove
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
- Matching is based on start position (Fraction), not track identity
- A sticking annotation at a given start position applies to all notes at that position, regardless of track
- Sticking without a matching note at the same start position is ignored in MusicXML export

### Modifier Export Priority

v0 modifiers are limited to forms with stable MusicXML export semantics.

The exporter should preserve the supported modifier set directly.

Supported export priorities:

- accents
- open/close hi-hat
- tuplets
- flam
- ghost
- drag

Supported when explicitly included in the whitelist:

- rim
- cross
- bell
- choke

If a modifier cannot be represented reliably in MusicXML, it is out of scope for v0 and should not be accepted by validation.

`ghost` and `drag` are exported as grace notes with appropriate notation semantics.

## Example

```txt
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

---

## Summary

This version:

- Adds explicit beat grouping via `grouping`
- Defines normalized event model
- Restricts exportable durations
- Fixes track filling semantics
- Clarifies sugar behavior (`c`)
- Simplifies repeat parsing
