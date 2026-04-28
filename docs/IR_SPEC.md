# DrumNotation IR Specification v1.0

## Status

Draft — intended to replace both the TypeScript `NormalizedEvents` interface in the DSL parser and the overly playback-coupled DrumIR spec.

---

## 1. Design Goals

- **Language-agnostic**: Represented as JSON; no TypeScript, Rust, or any implementation language in the spec itself.
- **Notation-only**: IR describes the score structure and musical intent. It does NOT encode playback logic (repeat stacks, loop depth, click config, nav markers).
- **Renderer-agnostic**: The same IR feeds VexFlow rendering, MusicXML export, and (in the future) a playback engine.
- **Deterministic**: Given the same DSL input, the IR output is canonical — no ambiguity about who computed what.

---

## 2. Core Data Primitives

### 2.1 Fraction (Timing)

All temporal values use the Fraction structure. Fractions MUST be stored in lowest terms (GCD-reduced).

```json
{ "num": 3, "den": 16 }
```

**Rules**:
- `num` MUST be a non-negative integer.
- `den` MUST be a positive integer.
- Fractions are equal iff `a.num * b.den === b.num * a.den`.
- A `ComplexityOverflowError` SHOULD be thrown if any intermediate `den > 10^9`.

**Common durations for reference**:

| Name | Fraction |
|------|----------|
| whole | `{ "num": 1, "den": 1 }` |
| half | `{ "num": 1, "den": 2 }` |
| quarter | `{ "num": 1, "den": 4 }` |
| 8th | `{ "num": 1, "den": 8 }` |
| 16th | `{ "num": 1, "den": 16 }` |
| dotted quarter | `{ "num": 3, "den": 8 }` |

### 2.2 TimeSignature

```json
{ "beats": 4, "beatUnit": 4 }
```

Note: Not represented as a Fraction — expressed as `{ beats, beatUnit }` to avoid GCD reduction ambiguity (e.g., `4/4` vs `2/2`).

---

## 3. Document Hierarchy

```
DrumScore
  └─ header: Header
  └─ tracks: Track[]
  └─ measures: Measure[]
```

---

## 4. Header

```json
{
  "title": "Funk Study No. 1",
  "subtitle": "Verse groove",
  "composer": "G. Mao",
  "tempo": 96,
  "timeSignature": { "beats": 4, "beatUnit": 4 },
  "divisions": 16,
  "grouping": [2, 2]
}
```

| Field | Type | Required | Default | Meaning |
|-------|------|----------|---------|---------|
| `title` | string | no | `""` | Score title |
| `subtitle` | string | no | `""` | Score subtitle |
| `composer` | string | no | `""` | Composer credit |
| `tempo` | integer | no | `120` | Quarter-note BPM |
| `timeSignature` | TimeSignature | **yes** | — | Measure structure |
| `divisions` | integer | **yes** | — | Grid slots per measure (e.g., 16 for 16th-note grid) |
| `grouping` | integer[] | no | inferred from `timeSignature` | Beat grouping; sum MUST equal `beats` |
| `feel` | string | no | `"straight"` | Playback feel: `"straight"`, `"swing"`, `"shuffle"`, `"latin"` |

### 3.1 Grouping Inference (when absent)

| timeSignature | inferred grouping |
|---------------|-------------------|
| `2/4` | `[1, 1]` |
| `3/4` | `[1, 1, 1]` |
| `4/4` | `[2, 2]` |
| `2/2` | `[1, 1]` |
| `3/8` | `[1, 1, 1]` |
| `6/8` | `[3, 3]` |
| `9/8` | `[3, 3, 3]` |
| `12/8` | `[3, 3, 3, 3]` |

Irregular meters (`5/8`, `7/8`, `5/4`, etc.) require explicit `grouping`.

---

## 5. Tracks

```json
{
  "id": "HH",
  "family": "cymbal"
}
```

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `id` | string | **yes** | Track identifier; must match the canonical Track Registry |
| `family` | string | **yes** | One of: `cymbal`, `drum`, `pedal`, `percussion`, `auxiliary` |

**Track Registry** (complete — no other tracks are valid):

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

**Voice convention**:
- Voice 1 (up-stem): `HH`, `RC`, `RC2`, `C`, `C2`, `SPL`, `CHN`, `SD`, `T1`, `T2`, `T3`, `T4`, `CB`, `WB`, `CL`, `ST`
- Voice 2 (down-stem): `BD`, `BD2`, `HF`

**Notehead mapping** (renderer responsibility):

| Family | Default | With `:ghost` | With `:accent` |
|--------|---------|---------------|----------------|
| cymbal | X | X (parenthesized) | X + accent mark |
| drum | filled-circle | filled-circle (parenthesized) | filled-circle + accent mark |
| pedal | filled-circle | filled-circle (parenthesized) | filled-circle + accent mark |
| percussion | filled-circle | filled-circle (parenthesized) | filled-circle + accent mark |

**Modifier legality** (validation responsibility):

| Modifier | Allowed on |
|----------|-----------|
| `open` | `HH` only |
| `half-open` | `HH` only |
| `close` | `HH`, `HF` only |
| `choke` | `C`, `C2`, `RC`, `RC2`, `SPL`, `CHN` |
| `bell` | `RC`, `RC2` |
| `rim` | `SD` only |
| `cross` | `SD` only |
| `flam` | `SD`, `T1`, `T2`, `T3`, `T4` |
| `ghost` | `SD`, `HH`, `T1`, `T2`, `T3`, `T4` |
| `drag` | `SD`, `HH`, `T1`, `T2`, `T3`, `T4`, `RC`, `RC2` |
| `roll` | `SD`, `HH`, `T1`, `T2`, `T3`, `T4`, `RC`, `RC2`, `BD`, `BD2` |
| `dead` | `SD`, `HH`, `T1`, `T2`, `T3`, `T4`, `BD`, `BD2` |

---

## 6. Measures

```json
{
  "index": 0,
  "events": [ Event, Event, ... ],
  "barline": "regular",
  "rangeAnnotations": [ ... ]
}
```

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `index` | integer | **yes** | 0-based measure index within the score |
| `events` | Event[] | **yes** | All events in this measure; sorted by `start` ascending |
| `barline` | string | no | One of: `regular` (default), `double`, `final`, `dashed`, `repeat-start`, `repeat-end`, `repeat-both` |
| `repeatTimes` | integer | no | Required when `barline` is `repeat-end`; number of repetitions |
| `volta` | integer[] | no | List of 1-based repetition indices during which this measure is active |
| `multiRest` | integer | no | Number of measures this rest occupies; `≥ 1`; see §6.3 |
| `rangeAnnotations` | RangeAnnotation[] | no | Hairpins, slurs, dynamics active in this measure |
| `repeatOf` | integer | no | 0-based index of the measure whose content this measure repeats (see §6.4) |
| `repeatOfCount` | integer | `1` | How many consecutive measures to repeat; only valid when `repeatOf` is set |

### 6.1 Barline Types

| Value | Visual | DSL Syntax |
|-------|--------|------------|
| `regular` | single barline | `|` |
| `double` | double barline | `||` |
| `final` | final barline | `|` at end of score |
| `dashed` | dashed barline | — |
| `repeat-start` | repeat start | `|:` |
| `repeat-end` | repeat end | `:|` |
| `repeat-both` | repeat start+end | `|: :|` |

---

## 7. Events

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
| `track` | string | **yes** | Track ID (e.g., `HH`, `SD`) |
| `start` | Fraction | **yes** | Measure-relative offset; `0 ≤ start < 1` |
| `duration` | Fraction | **yes** | Note duration; `0 < duration ≤ 1` |
| `kind` | string | **yes** | One of: `hit`, `rest`, `sticking` |
| `glyph` | string | `kind == "hit"` | Atomic glyph token; one of: `d`, `x`, `p`, `g`, `s`, `b`, `r`, `c`, `t1`, `t2`, `t3`, `o` |
| `modifiers` | string[] | no | Zero or more modifier strings; see modifier legality table |
| `tuplet` | TupletSpec \| null | no | Present only if this note is part of a tuplet group |
| `tie` | string \| null | no | One of: `start`, `stop`, `both` (see §7.4), or absent |
| `voice` | integer \| null | no | `1` = up-stem (hands), `2` = down-stem (feet); defaults to track-derived convention (see §7.4) |
| `beam` | string \| null | no | One of: `begin`, `continue`, `end`, `none` (see §7.5); absent implies `none` |
| `beamMode` | string \| null | no | `"auto"` (default) or `"manual"`; if `"manual"`, renderer MUST honor the `beam` value exactly |

### 7.4 Voice

Drum notation uses two voices per staff to separate hands (up-stem) from feet (down-stem).

| Voice | Meaning | Tracks |
|-------|---------|--------|
| `1` | Up-stem (hands) | `HH`, `RC`, `RC2`, `C`, `C2`, `SPL`, `CHN`, `SD`, `T1`, `T2`, `T3`, `T4`, `CB`, `WB`, `CL`, `ST` |
| `2` | Down-stem (feet) | `BD`, `HF` |

**Rules**:
- `voice` is optional. If absent, the renderer/validator infers it from the `track` using the table above.
- The `voice` field is authoritative for MusicXML export. Exporter MUST use the explicit `voice` value if present, otherwise fall back to track-derived default.
- In MusicXML, notes on different voices (but the same staff) are beamed independently within each voice.

### 7.5 Beam

Beam state defines this note's position within a beam group. Only 8th notes and shorter can have beam states other than `none`.

| Value | Meaning |
|-------|---------|
| `begin` | Beam starts here |
| `continue` | Mid-beam (neither start nor end) |
| `end` | Beam ends here |
| `none` | No beam on this note (half note or longer, or a rest) |

**Rules**:
- `beam` is optional; absent is equivalent to `none`.
- Only notes with duration ≤ 8th may have `begin/continue/end`. Half notes, whole notes, etc. must be `none`.
- Beaming is computed **per voice** — only notes of the same `voice` are considered for beam grouping.
- A beam may continue across a measure boundary: the ending note of measure N has `beam: "end"` or `"continue"`; the starting note of measure N+1 has `beam: "begin"` or `"continue"`. The renderer is responsible for drawing the continuation.
- The parser computes beam states from `grouping` and `duration` using standard engraving rules before emitting the IR. The renderer does not re-compute beaming from scratch.

### 7.6 Tie

Tie connects two adjacent notes of the same track into a single sustained duration. The second tied note carries no separate MIDI gate.

| Value | Meaning |
|-------|---------|
| `start` | This note is the start of a tie |
| `stop` | This note is the end of a tie |
| `both` | This note is simultaneously a tie start and tie stop (for chains of 3+ notes) |

**Rules**:
- Tie always connects notes on the **same track**.
- `start` and `stop` events must have the same `duration` (the tie duration is implicit — it connects the end of this note to the start of the next note on the same track).
- A chain of 3+ tied notes: first note has `tie: "start"`, middle notes have `tie: "both"`, last note has `tie: "stop"`.
- Tie stop may occur at a measure boundary — the IR makes no cross-measure reference; the renderer/exporter must resolve it by looking at the next measure's event on the same track.

### 7.1 Event Kinds

| Kind | Meaning | `glyph` required? | MIDI output? |
|------|---------|-------------------|-------------|
| `hit` | Percussive strike | yes | yes |
| `rest` | Silence placeholder | no | no |
| `sticking` | Hand indication (R/L) | yes (must be `r` or `l`) | no |

### 7.2 TupletSpec

```json
{
  "actual": 3,
  "normal": 2,
  "span": 1,
  "bracket": true
}
```

| Field | Type | Default | Meaning |
|-------|------|---------|---------|
| `actual` | integer | — | Number of notes played in the tuplet |
| `normal` | integer | — | Number of notes in the normal duration |
| `span` | integer | — | How many beat groups this tuplet occupies |
| `bracket` | boolean | `true` | Whether to draw the tuplet bracket; if `false`, all notes must be beamed together |

Tuplet math: each tuplet note's notated duration = `beat_duration × normal / actual`.

**Supported tuplet ratios**: `[2, 1]`, `[3, 2]`, `[4, 3]`, `[3, 1]`, `[4, 1]`, `[5, 4]`, `[6, 4]`, `[7, 4]`.

**Example**: `[3: d d d]` (three 8ths in the space of two) →

```json
{
  "actual": 3,
  "normal": 2,
  "span": 1
}
```

Each of the three events carries the same `tuplet: { "actual": 3, "normal": 2, "span": 1 }`.

### 7.3 Modifier Values

| Value | Semantic | Visual Effect |
|-------|----------|--------------|
| `accent` | Emphasized hit | Accent mark (>) above note |
| `open` | Hi-hat open | Open circle on X notehead |
| `half-open` | Hi-hat sizzle | Encircled "zz" or half-open circle on X notehead; CC4 ≈ 64 |
| `close` | Hi-hat closed | Default hi-hat state |
| `choke` | Cymbal choke | `+` or `×` above note |
| `rim` | Rim shot | Smaller notehead + "R" optional |
| `cross` | Cross-stick | X above stem on snare |
| `bell` | Ride bell | `B` or dot on ride cymbal |
| `flam` | Flam | 16th grace note preceding main note |
| `ghost` | Ghost note | Parenthesized notehead, lighter |
| `drag` | Drag/ruff | Two 16th grace notes preceding |
| `roll` | Roll/tremolo | Slash marks on stem (single = 16th roll, double = 32nd) |
| `dead` | Dead-stroke | Small "x" notehead, muted attack |

---

## 8. Repeats & Voltas

These are stored at the **measure level**, not the event level.

**Note**: There are two separate repeat mechanisms in this spec. Traditional `|: :|` repeat barlines are encoded via `barline` + `repeatTimes` (§8.1). The `%` / `//` shorthand for repeating the previous one or two measures is encoded via `repeatOf` (§6.4) and does not involve the repeat stack.

### 8.1 Repeat Encoding

```json
{
  "index": 0,
  "events": [...],
  "barline": "repeat-start"
}
```

```json
{
  "index": 5,
  "events": [...],
  "barline": "repeat-end",
  "repeatTimes": 2
}
```

| Field | Applies to | Meaning |
|-------|-----------|---------|
| `barline: "repeat-start"` | any measure | Push measure index onto repeat stack |
| `barline: "repeat-end"` | any measure | Pop from repeat stack; jump back if `passCount < repeatTimes` |
| `repeatTimes` | `repeat-end` measures | Number of repetitions; default `2` |

### 8.2 Volta Encoding

```json
{
  "index": 6,
  "events": [...],
  "barline": "regular",
  "volta": [1]
}
```

```json
{
  "index": 7,
  "events": [...],
  "barline": "regular",
  "volta": [2]
}
```

```json
{
  "index": 8,
  "events": [...],
  "barline": "regular",
  "volta": [1, 2]
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `volta` | integer[] | List of 1-based repetition indices during which this measure is active |

**Volta termination** (parser responsibility):
- A volta ends when: (a) a `repeat-end` barline is encountered, (b) a new `volta` with a different index starts, or (c) an explicit termination barline `|.` is encountered.

### 8.3 Multi-Measure Rest

A multi-measure rest is encoded as **consecutive measure entries** in the `measures` array. The first entry carries `multiRest: n`; the following `n−1` entries each carry `multiRest: 1`. All `n` entries must be present in the array with consecutive `index` values.

```json
[
  { "index": 2, "events": [], "multiRest": 4 },
  { "index": 3, "events": [], "multiRest": 1 },
  { "index": 4, "events": [], "multiRest": 1 },
  { "index": 5, "events": [], "multiRest": 1 }
]
```

| Field | Type | Meaning |
|-------|------|---------|
| `multiRest` | integer | Number of measures this rest occupies, including this one; `≥ 1` |

**Rules**:
- `multiRest: 1` is equivalent to a normal empty measure (full-measure rest). The distinction is visual only.
- When `multiRest > 1`, the first entry (`multiRest: n`) triggers the visually-rendered multi-rest glyph. The trailing `n−1` entries are renderer hints for systems that break across pages.
- All `n` entries MUST have empty `events` arrays.
- If `multiRest > 1` on a measure that is not the first in a sequence, it is a validation error.

### 6.4 Repeat Shorthand

A measure may reference the content of one or more previous measures using `repeatOf`, instead of duplicating the events.

```json
[
  { "index": 0, "events": [{ "track": "HH", "start": { "num": 0, "den": 16 }, ... }] },
  { "index": 1, "repeatOf": 0 },                    // repeats measure 0
  { "index": 2, "repeatOf": 0, "repeatOfCount": 2 } // repeats measures 0 and 1
]
```

| Field | Meaning |
|-------|---------|
| `repeatOf` | 0-based index of the first measure to repeat |
| `repeatOfCount` | Number of consecutive measures to repeat; default `1` |

**Rules**:
- `repeatOf` and `repeatOfCount` are optional; absent means this is a normal measure with explicit events.
- The referenced source measures (`repeatOf` through `repeatOf + repeatOfCount - 1`) must exist and must NOT themselves have `repeatOf` set (no nested repeat references).
- Source measures must not be multiRest measures.
- When a measure has `repeatOf`, its `events` array should be empty — renderer and exporter read the source measure's events instead.
- A measure with `repeatOf` may still carry `barline`, `volta`, `rangeAnnotations`, and `multiRest` — these apply to the repeat instance itself (e.g., the repeated measure may have a different barline style).

---

## 9. Range Annotations

Range annotations are per-measure spanners that mark a time-bounded region with a visual indication. They live on the **Measure** object, not on individual events.

```json
{
  "index": 0,
  "events": [ ... ],
  "rangeAnnotations": [
    { "type": "hairpin", "subtype": "crescendo", "track": "HH", "start": { "num": 0, "den": 16 }, "end": { "num": 1, "den": 1 } },
    { "type": "slur", "tracks": ["HH", "SD"], "start": { "num": 2, "den": 16 }, "end": { "num": 7, "den": 16 } }
  ]
}
```

### 9.1 RangeAnnotation Fields

| Field | Type | Meaning |
|-------|------|---------|
| `type` | string | One of: `hairpin`, `slur`, `dynamic` |
| `subtype` | string | For `hairpin`: `crescendo` or `decrescendo`. For `slur`: `slur`. For `dynamic`: one of `pp`, `p`, `mp`, `mf`, `f`, `ff`, `fff`, `sfz`, `fp` |
| `track` | string | For hairpin and dynamic — the track this annotation belongs to |
| `tracks` | string[] | For slur only — all tracks covered by this slur |
| `start` | Fraction | Measure-relative start position; for `dynamic` this is also the `position` |
| `end` | Fraction | Measure-relative end position; `end > start`; required for `hairpin` and `slur`, absent for `dynamic` |

**Hairpin** (`type: "hairpin"`):
- Hairpins are single-track. One track may have multiple hairpins in the same measure.
- `track` gives the vertical position; the renderer looks up the track's staff line.
- A hairpin that continues into the next measure uses `end: { "num": 1, "den": 1 }` to mean "end at measure boundary".
- A hairpin fragment that continues from the previous measure uses `start: { "num": 0, "den": 1 }` to mean "start at measure boundary".
- The renderer is responsible for drawing a continuous-looking wedge across measure breaks.

**Slur** (`type: "slur"`):
- A slur can cover one or more tracks simultaneously (`tracks: ["SD", "HH"]`).
- Slur endpoints should align with note heads at `start` and `end` positions.
- If multiple slurs on the same track are active simultaneously, they are disambiguated by a unique spanner ID (future extension; v1 does not support overlapping slurs on the same track).

**Dynamic** (`type: "dynamic"`):
- A point annotation that sets the baseline dynamic level at a specific position. It has no duration.
- `track` gives the vertical position; renderer places it below the staff.
- `start` is the measure-relative position; should coincide with a note `start`.
- Dynamics set the baseline velocity for subsequent notes on the same track until overridden by another dynamic.
- Dynamics are **per-track** — `f` on `HH` does not affect `SD`.
- If no note exists at the specified `start` position, the renderer places the dynamic at the nearest following note.

### 9.2 Cross-Measure Spanning

A crescendo that spans measures 0–2 is represented as **one fragment per measure**:

```json
// Measure 0
{ "type": "hairpin", "subtype": "crescendo", "track": "HH", "start": { "num": 0, "den": 16 }, "end": { "num": 1, "den": 1 } }

// Measure 1
{ "type": "hairpin", "subtype": "crescendo", "track": "HH", "start": { "num": 0, "den": 1 }, "end": { "num": 6, "den": 16 } }

// Measure 2
{ "type": "hairpin", "subtype": "crescendo", "track": "HH", "start": { "num": 0, "den": 1 }, "end": { "num": 3, "den": 16 } }
```

Each fragment uses `{ "num": 1, "den": 1 }` or `{ "num": 0, "den": 1 }` to anchor at measure boundaries. No cross-measure reference ID is needed — the renderer connects adjacent fragments by matching `subtype` + `track` + continuity.

---

## 10. Example IR

```json
{
  "version": "1.0",
  "header": {
    "title": "Funk Study No. 1",
    "subtitle": "",
    "composer": "G. Mao",
    "tempo": 96,
    "timeSignature": { "beats": 4, "beatUnit": 4 },
    "divisions": 16,
    "grouping": [2, 2]
  },
  "tracks": [
    { "id": "HH", "family": "cymbal" },
    { "id": "SD", "family": "drum" },
    { "id": "BD", "family": "drum" }
  ],
  "measures": [
    {
      "index": 0,
      "barline": "repeat-start",
      "events": [
        { "track": "HH", "start": { "num": 0, "den": 16 }, "duration": { "num": 1, "den": 16 }, "kind": "hit", "glyph": "d", "modifiers": [], "tuplet": null, "tie": null, "voice": 1, "beam": "begin" },
        { "track": "HH", "start": { "num": 1, "den": 16 }, "duration": { "num": 1, "den": 16 }, "kind": "rest", "glyph": null, "modifiers": [], "tuplet": null, "tie": null, "voice": 1, "beam": "none" },
        { "track": "HH", "start": { "num": 2, "den": 16 }, "duration": { "num": 1, "den": 16 }, "kind": "hit", "glyph": "d", "modifiers": [], "tuplet": null, "tie": "start", "voice": 1, "beam": "end" },
        { "track": "HH", "start": { "num": 3, "den": 16 }, "duration": { "num": 1, "den": 16 }, "kind": "hit", "glyph": "d", "modifiers": [], "tuplet": null, "tie": "stop", "voice": 1, "beam": "begin" },
        { "track": "HH", "start": { "num": 4, "den": 16 }, "duration": { "num": 1, "den": 16 }, "kind": "hit", "glyph": "d", "modifiers": [], "tuplet": null, "tie": null, "voice": 1, "beam": "continue" },
        { "track": "HH", "start": { "num": 5, "den": 16 }, "duration": { "num": 1, "den": 16 }, "kind": "hit", "glyph": "d", "modifiers": [], "tuplet": null, "tie": null, "voice": 1, "beam": "end" },
        { "track": "SD", "start": { "num": 2, "den": 16 }, "duration": { "num": 1, "den": 16 }, "kind": "hit", "glyph": "d", "modifiers": ["cross"], "tuplet": null, "tie": null, "voice": 1, "beam": "begin" },
        { "track": "SD", "start": { "num": 3, "den": 16 }, "duration": { "num": 1, "den": 16 }, "kind": "hit", "glyph": "d", "modifiers": [], "tuplet": null, "tie": null, "voice": 1, "beam": "end" },
        { "track": "BD", "start": { "num": 0, "den": 16 }, "duration": { "num": 1, "den": 16 }, "kind": "hit", "glyph": "d", "modifiers": [], "tuplet": null, "tie": null, "voice": 2, "beam": "none" }
      ],
      "rangeAnnotations": [
        { "type": "hairpin", "subtype": "crescendo", "track": "HH", "start": { "num": 0, "den": 16 }, "end": { "num": 4, "den": 16 } },
        { "type": "slur", "tracks": ["HH", "SD"], "start": { "num": 2, "den": 16 }, "end": { "num": 4, "den": 16 } }
      ]
    },
    { "index": 1, "events": [], "multiRest": 4 },
    { "index": 2, "events": [], "multiRest": 1 },
    { "index": 3, "events": [], "multiRest": 1 },
    { "index": 4, "events": [], "multiRest": 1 }
  ]
}
```

---

## 11. Rendering vs Export vs Playback

### 11.1 Responsibilities of Each Consumer

| Consumer | Reads | Computes |
|----------|-------|----------|
| **VexFlow Renderer** | header, tracks, measures, events | stem directions, beaming, notehead shapes, positioning |
| **MusicXML Exporter** | header, tracks, measures, events | MIDI note numbers, notehead types, beam grouping, tuplet XML elements |
| **Playback Engine** (future) | header, tracks, measures (with repeats/volts expanded) | linear MIDI event stream, velocities, CC messages |

### 11.2 What IR Does NOT Store

The following are intentionally absent — they are concerns of specific consumers, not the IR:

- MIDI velocity values — mapped by exporter from `modifiers` (e.g., `accent` → velocity 120, `ghost` → velocity 30)
- Notehead shape per track/modifier — looked up by renderer from the Track Registry appearance table
- Expanded playback sequence (repeat/volta unfolded) — computed by playback engine as a separate pass

### 11.3 MIDI Mapping (Exporter Reference)

| Track | MIDI Note | Default Velocity | Accent Velocity | Ghost Velocity |
|-------|-----------|-------------------|-----------------|----------------|
| `BD` | 36 | 90 | 127 | 30 |
| `BD2` | 36 | 90 | 127 | 30 |
| `SD` | 38 | 85 | 120 | 25 |
| `T1` | 48 | 80 | 115 | 25 |
| `T2` | 45 | 80 | 115 | 25 |
| `T3` | 41 | 82 | 118 | 28 |
| `T4` | 43 | 82 | 118 | 28 |
| `HH` | 42 | 80 | 115 | 20 |
| `HF` | 44 | 75 | 110 | 20 |
| `RC` | 51 | 78 | 112 | 20 |
| `RC2` | 59 | 78 | 112 | 20 |
| `C` | 49 | 85 | 120 | 25 |
| `C2` | 57 | 85 | 120 | 25 |
| `SPL` | 55 | 80 | 115 | 20 |
| `CHN` | 52 | 83 | 120 | 22 |
| `CB` | 56 | 75 | 110 | 20 |
| `WB` | 76 | 72 | 108 | 18 |
| `CL` | 75 | 72 | 108 | 18 |

**HiHat open/close**: Note-on for `HH` (42) is sent regardless; a CC4 message follows with value `0` (closed) or `127` (open), sent simultaneously with or 1 tick after the note-on.

